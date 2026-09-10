import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { consumeSmartNotesDraft } from '@/lib/smartNotesDraft';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { MarkdownText } from '@/components/MarkdownText';
import colors from '@/constants/colors';

const C = colors.dark;

type Mode = 'generate' | 'summarize' | 'solve';

const MODES: { value: Mode; label: string; icon: keyof typeof Feather.glyphMap; blurb: string }[] = [
  { value: 'generate', label: 'Generate', icon: 'zap', blurb: 'Create clear study notes on any topic.' },
  { value: 'summarize', label: 'Summarize', icon: 'file-text', blurb: 'Condense long text into key points.' },
  { value: 'solve', label: 'Solve', icon: 'help-circle', blurb: 'Work through a problem step by step.' },
];

export default function SmartNotesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // draftNoteId param signals that [id].tsx stored a draft in the transient store.
  // Content/subject are never put in URL params to avoid length limits and history leakage.
  const { draftNoteId } = useLocalSearchParams<{ draftNoteId?: string }>();

  const [mode, setMode] = useState<Mode>('generate');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // On focus (or when the draftNoteId param changes), consume the in-memory draft
  // and pre-fill the form. This handles both initial mount and re-navigation from
  // a different note without reusing stale state.
  useFocusEffect(
    useCallback(() => {
      const noteId = draftNoteId ? parseInt(draftNoteId, 10) : NaN;
      if (!Number.isNaN(noteId)) {
        const draft = consumeSmartNotesDraft(noteId);
        if (draft) {
          setMode(draft.mode);
          setContent(draft.content);
          setSubject(draft.subject);
          setTopic('');
          setResult('');
        }
      }
    }, [draftNoteId]),
  );

  const activeMode = MODES.find((m) => m.value === mode)!;
  const canSubmit = mode === 'generate' ? topic.trim().length > 0 : content.trim().length > 0;

  async function handleGenerate() {
    if (!canSubmit || generating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGenerating(true);
    setResult('');
    try {
      const res = await apiFetch<{ result: string }>('/api/premium/smart-notes', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          topic: topic.trim() || undefined,
          content: content.trim() || undefined,
          subject: subject.trim() || undefined,
        }),
      });
      setResult(res.result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Could not generate', err?.message ?? 'Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function defaultTitle(): string {
    if (mode === 'generate' && topic.trim()) return topic.trim();
    if (subject.trim()) return `${subject.trim()} — ${activeMode.label}`;
    return `AI ${activeMode.label} Notes`;
  }

  async function handleSaveAsNote() {
    if (!result || saving) return;
    setSaving(true);
    try {
      await apiFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: defaultTitle().slice(0, 120),
          content: result,
          subject: subject.trim() || undefined,
          tags: ['ai'],
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Could not save note', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.blurb}>{activeMode.blurb}</Text>

      {/* Mode tabs */}
      <View style={styles.tabs}>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            style={[styles.tab, mode === m.value && styles.tabActive]}
            onPress={() => setMode(m.value)}
          >
            <Feather name={m.icon} size={14} color={mode === m.value ? '#fff' : C.mutedForeground} />
            <Text style={[styles.tabText, mode === m.value && styles.tabTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Inputs */}
      {mode === 'generate' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Topic</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Photosynthesis, Quadratic equations"
            placeholderTextColor={C.mutedForeground}
            value={topic}
            onChangeText={setTopic}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>
            {mode === 'summarize' ? 'Text to summarize' : 'Problem or question'}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={
              mode === 'summarize'
                ? 'Paste the text or notes you want summarized…'
                : 'Type the question or problem you need solved…'
            }
            placeholderTextColor={C.mutedForeground}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Subject (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Biology, Mathematics"
          placeholderTextColor={C.mutedForeground}
          value={subject}
          onChangeText={setSubject}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.generateBtn,
          (!canSubmit || generating) && styles.btnDisabled,
          pressed && styles.pressed,
        ]}
        onPress={handleGenerate}
        disabled={!canSubmit || generating}
      >
        {generating ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.generateText}>Working on it…</Text>
          </>
        ) : (
          <>
            <Feather name="zap" size={16} color="#fff" />
            <Text style={styles.generateText}>{activeMode.label} with AI</Text>
          </>
        )}
      </Pressable>

      {/* Result */}
      {result !== '' && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>Result</Text>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              onPress={handleSaveAsNote}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={14} color="#fff" />
                  <Text style={styles.saveText}>Save as note</Text>
                </>
              )}
            </Pressable>
          </View>
          <MarkdownText content={result} />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 20, paddingBottom: 60 },
  blurb: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  tabTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: C.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  textArea: { minHeight: 140 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  generateText: { fontSize: 15, color: '#fff', fontFamily: 'Inter_700Bold' },
  resultCard: {
    marginTop: 20,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultLabel: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveText: { fontSize: 13, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.75 },
});
