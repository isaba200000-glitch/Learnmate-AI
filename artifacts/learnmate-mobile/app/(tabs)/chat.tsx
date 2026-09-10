import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
} from '@workspace/api-client-react';
import { streamSse, apiFetch } from '@/lib/api';
import colors from '@/constants/colors';
import { MarkdownText } from '@/components/MarkdownText';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

interface UsageInfo {
  isPremium: boolean;
  remaining: number | null;
  dailyLimit: number | null;
}

/** Tab bar is position:absolute, so content must pad past it. The context is
 *  undefined under native (liquid glass) tabs, which lay out normally. */
function useTabBarPad(): number {
  return React.useContext(BottomTabBarHeightContext) ?? 0;
}

const C = colors.dark;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

let msgCounter = 0;
function uid() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 6)}`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch daily usage on mount so we can show the counter immediately.
  useEffect(() => {
    apiFetch<UsageInfo>('/api/openai/usage').then(setUsage).catch(() => null);
  }, []);

  const { data: conversations, refetch: refetchConversations } = useListOpenaiConversations();
  const { data: activeConv } = useGetOpenaiConversation(
    activeConversationId as number,
    { query: { enabled: activeConversationId != null } } as any,
  );
  const createConvMutation = useCreateOpenaiConversation();

  // Load messages from server when conversation changes
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!activeConv?.messages || initializedRef.current) return;
    setMessages(
      activeConv.messages.map((m: any) => ({
        id: uid(),
        role: m.role,
        content: m.content,
      })),
    );
    initializedRef.current = true;
  }, [activeConv?.messages]);

  // Reset initialization flag when switching conversations
  useEffect(() => {
    initializedRef.current = false;
    setMessages([]);
  }, [activeConversationId]);

  async function startNewConversation() {
    try {
      const conv = await (createConvMutation as any).mutateAsync({
        data: { title: 'New Chat', subject: 'General' },
      });
      setActiveConversationId(conv.id);
      setMessages([]);
      refetchConversations();
      setShowConversations(false);
    } catch {
      const conv = await (createConvMutation as any).mutateAsync({
        title: 'New Chat', subject: 'General',
      } as any).catch(() => null);
      if (conv) {
        setActiveConversationId(conv.id);
        refetchConversations();
      }
    }
  }

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    // Ensure we have a conversation
    let convId = activeConversationId;
    if (!convId) {
      try {
        const conv = await (createConvMutation as any).mutateAsync({
          data: { title: text.slice(0, 40), subject: 'General' },
        });
        convId = conv.id;
        setActiveConversationId(conv.id);
        refetchConversations();
      } catch {
        return;
      }
    }

    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }]);
    setIsStreaming(true);
    setShowTyping(true);

    abortRef.current = new AbortController();
    let fullContent = '';
    let assistantAdded = false;
    const assistantId = uid();

    try {
      await streamSse(
        `/api/openai/conversations/${convId}/messages`,
        { content: text },
        (chunk) => {
          fullContent += chunk;
          if (!assistantAdded) {
            setShowTyping(false);
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: 'assistant', content: fullContent },
            ]);
            assistantAdded = true;
          } else {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
              return updated;
            });
          }
        },
        abortRef.current.signal,
      );
      // Optimistically decrement the remaining count after a successful send.
      setUsage((u) =>
        u && u.remaining !== null ? { ...u, remaining: Math.max(0, u.remaining - 1) } : u,
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setShowTyping(false);
        if ((err as any)?.limitReached) {
          // Daily limit reached — remove the in-flight user message and show banner.
          setMessages((prev) => prev.filter((m) => m.role !== 'user' || m.content !== text));
          setLimitHit(true);
          setUsage((u) => u ? { ...u, remaining: 0 } : u);
          setInputText(text); // restore so they can copy it
        } else {
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
          ]);
        }
      }
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
    }
  }, [inputText, isStreaming, activeConversationId, createConvMutation]);

  const reversedMessages = [...messages].reverse();

  const tabBarHeight = useTabBarPad();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const botPad = Math.max(tabBarHeight, insets.bottom + (Platform.OS === 'web' ? 34 : 0));

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.convBtn}
          onPress={() => setShowConversations(!showConversations)}
        >
          <Feather name="list" size={18} color={C.mutedForeground} />
          <Text style={styles.convBtnText} numberOfLines={1}>
            {activeConv?.title ?? 'New Chat'}
          </Text>
          <Feather name="chevron-down" size={14} color={C.mutedForeground} />
        </Pressable>
        {/* Daily usage counter — only visible for free users */}
        {usage && !usage.isPremium && usage.remaining !== null && (
          <View style={[
            styles.usagePill,
            usage.remaining === 0 && styles.usagePillEmpty,
          ]}>
            <Text style={[
              styles.usageText,
              usage.remaining === 0 && styles.usageTextEmpty,
            ]}>
              {usage.remaining}/{usage.dailyLimit} left
            </Text>
          </View>
        )}
        <Pressable onPress={startNewConversation} style={styles.newBtn}>
          <Feather name="plus" size={20} color={C.primary} />
        </Pressable>
      </View>

      {/* Conversation list overlay */}
      {showConversations && (
        <View style={styles.convList}>
          <Pressable style={styles.newConvItem} onPress={startNewConversation}>
            <Feather name="plus-circle" size={16} color={C.primary} />
            <Text style={styles.newConvText}>New Conversation</Text>
          </Pressable>
          {(conversations ?? []).map((conv: any) => (
            <Pressable
              key={conv.id}
              style={[styles.convItem, conv.id === activeConversationId && styles.convItemActive]}
              onPress={() => {
                setActiveConversationId(conv.id);
                setShowConversations(false);
              }}
            >
              <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
              <Text style={styles.convMeta}>{conv.messageCount} msgs</Text>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={topPad}>
        {/* Messages */}
        {messages.length === 0 && !isStreaming ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>AI Tutor</Text>
            <Text style={styles.emptyText}>
              Ask me anything — concepts, problems, exam prep, or explanations.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reversedMessages}
            keyExtractor={(item) => item.id}
            inverted={messages.length > 0}
            renderItem={({ item }) => <MessageBubble message={item} />}
            ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Daily limit banner — shown when free user hits cap */}
        {limitHit && (
          <View style={styles.limitBanner}>
            <View style={styles.limitBannerIcon}>
              <Feather name="lock" size={14} color="#fff" />
            </View>
            <Text style={styles.limitBannerText}>
              You've used all 10 free AI messages today.{' '}
              <Text style={styles.limitBannerBold}>Come back tomorrow or upgrade to Premium.</Text>
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: Math.max(botPad, 12) }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask anything…"
            placeholderTextColor={C.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || isStreaming) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              handleSend();
              inputRef.current?.focus();
            }}
            disabled={!inputText.trim() || isStreaming}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="arrow-up" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={{ fontSize: 14 }}>🧠</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {isUser ? (
          <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{message.content}</Text>
        ) : (
          <MarkdownText content={message.content} />
        )}
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <Text style={{ fontSize: 14 }}>🧠</Text>
      </View>
      <View style={styles.bubbleAssistant}>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  convBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  convBtnText: { flex: 1, fontSize: 14, color: C.foreground, fontFamily: 'Inter_500Medium' },
  newBtn: { padding: 8 },
  usagePill: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  usagePillEmpty: { backgroundColor: '#7c2d2d' },
  usageText: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  usageTextEmpty: { color: '#fca5a5' },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#451a03',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#92400e',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  limitBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b45309',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  limitBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#fde68a',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  limitBannerBold: { fontFamily: 'Inter_600SemiBold', color: '#fcd34d' },
  convList: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: 300,
  },
  newConvItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  newConvText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  convItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  convItemActive: { backgroundColor: C.primary + '11' },
  convTitle: { fontSize: 14, color: C.foreground, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  convMeta: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  emptyText: {
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: C.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  bubbleText: {
    fontSize: 15,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  bubbleTextUser: { color: '#fff' },
  typingDots: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.mutedForeground },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: C.secondary },
  pressed: { opacity: 0.75 },
});
