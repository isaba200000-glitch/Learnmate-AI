import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListFlashcardDecks } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

interface Deck {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  cardCount: number;
  updatedAt: string;
}

const DECK_COLORS = [C.primary, '#22C55E', '#F59E0B', '#EC4899', '#A78BFA', '#F97316'];

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: decks, isLoading, refetch } = useListFlashcardDecks();

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 32 + (Platform.OS === 'web' ? 34 : 0);

  async function createDeck() {
    if (!newTitle.trim()) {
      Alert.alert('Missing title', 'Please enter a deck name.');
      return;
    }
    try {
      setCreating(true);
      await apiFetch('/api/flashcard-decks', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), subject: newSubject.trim() || undefined }),
      });
      queryClient.invalidateQueries({ queryKey: ['listFlashcardDecks'] });
      refetch();
      setShowCreate(false);
      setNewTitle('');
      setNewSubject('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create deck.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.root}>
      {isLoading && !decks ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: topPad + 40 }} />
      ) : (
        <FlatList
          data={(decks as unknown as Deck[]) ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20 }}
          onRefresh={refetch}
          refreshing={isLoading}
          ListHeaderComponent={() => (
            <View style={styles.header}>
              <Text style={styles.title}>Flashcards</Text>
              <Text style={styles.subtitle}>Study with spaced repetition</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Feather name="layers" size={40} color={C.border} />
              <Text style={styles.emptyTitle}>No decks yet</Text>
              <Text style={styles.emptyText}>Create your first flashcard deck to start studying</Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const color = DECK_COLORS[index % DECK_COLORS.length];
            return (
              <Pressable
                style={({ pressed }) => [styles.deckCard, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/flashcards/${item.id}` as any);
                }}
              >
                <View style={[styles.deckIcon, { backgroundColor: color + '22' }]}>
                  <Feather name="layers" size={22} color={color} />
                </View>
                <View style={styles.deckInfo}>
                  <Text style={styles.deckTitle} numberOfLines={1}>{item.title}</Text>
                  {item.subject && (
                    <Text style={styles.deckSubject}>{item.subject}</Text>
                  )}
                  <Text style={styles.deckCount}>{item.cardCount} cards</Text>
                </View>
                <Pressable
                  style={[styles.studyBtn, { backgroundColor: color }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/flashcards/${item.id}` as any);
                  }}
                >
                  <Text style={styles.studyBtnText}>Study</Text>
                </Pressable>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: botPad - 20 },
          pressed && styles.fabPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowCreate(true);
        }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Create deck modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Deck</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Deck title (e.g. Python Basics)"
              placeholderTextColor={C.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="next"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Subject (optional)"
              placeholderTextColor={C.mutedForeground}
              value={newSubject}
              onChangeText={setNewSubject}
              returnKeyType="done"
              onSubmitEditing={createDeck}
            />

            <Pressable
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
              onPress={createDeck}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>Create Deck</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 4 },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 12,
  },
  pressed: { opacity: 0.75 },
  deckIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deckInfo: { flex: 1 },
  deckTitle: { fontSize: 16, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  deckSubject: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  deckCount: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  studyBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  studyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.95 }] },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  modalInput: {
    backgroundColor: C.secondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  createBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
});
