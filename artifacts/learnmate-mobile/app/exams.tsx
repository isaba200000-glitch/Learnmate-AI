import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

interface ExamEvent {
  id: number;
  subject: string;
  examDate: string;
  notes: string;
  routine: string;
  color: string;
  createdAt: string;
}

const EXAM_COLORS: { value: string; hex: string }[] = [
  { value: 'blue', hex: '#3B82F6' },
  { value: 'green', hex: '#10B981' },
  { value: 'red', hex: '#EF4444' },
  { value: 'purple', hex: '#A855F7' },
  { value: 'amber', hex: '#F59E0B' },
  { value: 'rose', hex: '#F43F5E' },
];

function colorHex(color: string): string {
  return EXAM_COLORS.find((c) => c.value === color)?.hex ?? '#3B82F6';
}

function countdown(examDate: string): { label: string; past: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate + 'T00:00:00');
  const diff = Math.round((exam.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'Today!', past: false };
  if (diff < 0) return { label: 'Past', past: true };
  return { label: `${diff} day${diff === 1 ? '' : 's'} away`, past: false };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Strict calendar validation: rejects rollover dates like 2026-02-31,
// which new Date() would silently normalize to March.
function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export default function ExamsScreen() {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<ExamEvent | 'new' | null>(null);
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('blue');

  const { data: exams = [], isLoading, error, refetch } = useQuery({
    queryKey: ['exam-calendar'],
    queryFn: () => apiFetch<{ events: ExamEvent[] }>('/api/exam-calendar').then((r) => r.events),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: number; subject: string; examDate: string; notes: string; color: string; routine: string }) =>
      payload.id
        ? apiFetch(`/api/exam-calendar/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : apiFetch('/api/exam-calendar', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-calendar'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm();
    },
    onError: (err: any) => Alert.alert('Could not save exam', err?.message ?? 'Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/exam-calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exam-calendar'] }),
    onError: () => Alert.alert('Could not delete exam', 'Please try again.'),
  });

  function openAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing('new');
    setSubject('');
    setExamDate('');
    setNotes('');
    setColor('blue');
  }

  function openEdit(exam: ExamEvent) {
    setEditing(exam);
    setSubject(exam.subject);
    setExamDate(exam.examDate.slice(0, 10));
    setNotes(exam.notes || '');
    setColor(exam.color || 'blue');
  }

  function closeForm() {
    setEditing(null);
  }

  function handleSave() {
    if (!subject.trim()) {
      Alert.alert('Missing subject', 'Please enter the exam subject.');
      return;
    }
    if (!isValidCalendarDate(examDate.trim())) {
      Alert.alert('Invalid date', 'Please enter the date as YYYY-MM-DD, e.g. 2026-08-20.');
      return;
    }
    saveMutation.mutate({
      id: editing !== 'new' && editing ? editing.id : undefined,
      subject: subject.trim(),
      examDate: examDate.trim(),
      notes: notes.trim(),
      color,
      routine: editing !== 'new' && editing ? editing.routine || '' : '',
    });
  }

  function handleDelete(exam: ExamEvent) {
    Alert.alert('Delete exam', `Remove "${exam.subject}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(exam.id) },
    ]);
  }

  const sorted = [...exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
  );

  // ── Form view ──
  if (editing !== null) {
    return (
      <KeyboardAwareScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formTitle}>{editing === 'new' ? 'Add Exam' : 'Edit Exam'}</Text>

        <Text style={styles.label}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mathematics"
          placeholderTextColor={C.mutedForeground}
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.label}>Exam date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2026-08-20"
          placeholderTextColor={C.mutedForeground}
          value={examDate}
          onChangeText={setExamDate}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Colour</Text>
        <View style={styles.colorRow}>
          {EXAM_COLORS.map((c) => (
            <Pressable
              key={c.value}
              style={[
                styles.colorDot,
                { backgroundColor: c.hex },
                color === c.value && styles.colorDotActive,
              ]}
              onPress={() => setColor(c.value)}
            />
          ))}
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Topics to revise, room number, anything useful…"
          placeholderTextColor={C.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.formActions}>
          <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]} onPress={closeForm}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saveMutation.isPending && styles.disabled]}
            onPress={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>{editing === 'new' ? 'Add Exam' : 'Save Changes'}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    );
  }

  // ── List view ──
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />}

        {!isLoading && !error && sorted.length === 0 && (
          <View style={styles.empty}>
            <Feather name="calendar" size={40} color={C.border} />
            <Text style={styles.emptyTitle}>No exams yet</Text>
            <Text style={styles.emptyText}>Add your exam dates so you always know what's coming up.</Text>
          </View>
        )}

        {sorted.map((exam) => {
          const cd = countdown(exam.examDate);
          const hex = colorHex(exam.color);
          return (
            <Pressable
              key={exam.id}
              style={({ pressed }) => [styles.examCard, { borderLeftColor: hex }, pressed && styles.pressed]}
              onPress={() => openEdit(exam)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.examSubject}>{exam.subject}</Text>
                <Text style={styles.examDate}>{formatDate(exam.examDate.slice(0, 10))}</Text>
                {!!exam.notes && (
                  <Text style={styles.examNotes} numberOfLines={2}>{exam.notes}</Text>
                )}
              </View>
              <View style={styles.examRight}>
                <View style={[styles.countBadge, { backgroundColor: (cd.past ? C.mutedForeground : hex) + '22' }]}>
                  <Text style={[styles.countText, { color: cd.past ? C.mutedForeground : hex }]}>{cd.label}</Text>
                </View>
                <Pressable onPress={() => handleDelete(exam)} hitSlop={8} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={16} color={C.destructive} />
                </Pressable>
              </View>
            </Pressable>
          );
        })}

        {error != null && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Failed to load exams</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Pressable style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]} onPress={openAdd}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 20, paddingBottom: 100 },
  formTitle: { fontSize: 22, color: C.foreground, fontFamily: 'Inter_700Bold', marginBottom: 18 },
  label: { fontSize: 13, color: C.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 14 },
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
  textArea: { minHeight: 100 },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  cancelText: { fontSize: 15, color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    flex: 2,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, color: '#fff', fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  examCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  examSubject: { fontSize: 16, color: C.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  examDate: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  examNotes: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 18 },
  examRight: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  countBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
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
});
