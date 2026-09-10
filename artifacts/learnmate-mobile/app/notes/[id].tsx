import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useGetSubscription, getGetProgressStatsQueryKey } from '@workspace/api-client-react';
import { setSmartNotesDraft } from '@/lib/smartNotesDraft';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

const SUBJECTS = ['Robotics', 'Electronics', 'Python', 'C++', 'AI & ML', 'Coding Basics', 'General'];

interface Note {
  id: number;
  title: string;
  content: string;
  subject: string | null;
  tags: string[];
}

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const { data: sub } = useGetSubscription();
  const subInfo = sub as unknown as { status?: string; isOwner?: boolean } | undefined;
  const isPremium = subInfo?.status === 'active' || subInfo?.isOwner === true;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ['note', id],
    queryFn: () => apiFetch<Note>(`/api/notes/${id}`),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setSubject(note.subject);
    }
  }, [note]);

  // AI subject illustration — same key logic as web: subject, else first 3 title words
  const imageKey = !isNew && note
    ? (note.subject?.trim() || note.title.split(' ').slice(0, 3).join(' '))
    : null;
  const { data: noteImage } = useQuery({
    queryKey: ['note-image', imageKey?.toLowerCase()],
    queryFn: () => apiFetch<{ imageUrl: string }>(`/api/notes/image?subject=${encodeURIComponent(imageKey!)}`),
    enabled: !!imageKey,
    staleTime: Infinity,
    retry: false,
  });

  const isDirty = isNew
    ? title.trim().length > 0 || content.trim().length > 0
    : note && (title !== note.title || content !== note.content || subject !== note.subject);

  useEffect(() => {
    navigation.setOptions({
      title: isNew ? 'New Note' : 'Edit Note',
      headerRight: () => (
        <Pressable
          onPress={handleSave}
          style={{ paddingHorizontal: 4 }}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <Text style={[styles.saveBtn, !isDirty && { opacity: 0.4 }]}>Save</Text>
          )}
        </Pressable>
      ),
    });
  }, [title, content, subject, saving, isDirty]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title for your note.');
      return;
    }
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isNew) {
        await apiFetch('/api/notes', {
          method: 'POST',
          body: JSON.stringify({ title: title.trim(), content: content.trim(), subject }),
        });
      } else {
        await apiFetch(`/api/notes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: title.trim(), content: content.trim(), subject }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', id] });
      // Refresh XP/streak on the profile tab immediately after a note is saved.
      if (isNew) {
        queryClient.invalidateQueries({ queryKey: getGetProgressStatsQueryKey() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isNew) router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete Note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            router.back();
          } catch {
            Alert.alert('Delete failed', 'Please try again.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (!isNew && isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  const botPad = insets.bottom + 20 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.root, { paddingBottom: botPad }]}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* AI subject illustration */}
        {noteImage?.imageUrl ? (
          <Image
            source={{ uri: noteImage.imageUrl }}
            style={styles.illustration}
            resizeMode="cover"
          />
        ) : null}

        {/* Subject picker */}
        <Pressable
          style={styles.subjectBtn}
          onPress={() => setShowSubjectPicker(!showSubjectPicker)}
        >
          <Feather name="tag" size={14} color={C.mutedForeground} />
          <Text style={styles.subjectBtnText}>{subject ?? 'Add subject'}</Text>
          <Feather name={showSubjectPicker ? 'chevron-up' : 'chevron-down'} size={14} color={C.mutedForeground} />
        </Pressable>

        {showSubjectPicker && (
          <View style={styles.subjectList}>
            {SUBJECTS.map((s) => (
              <Pressable
                key={s}
                style={[styles.subjectItem, subject === s && styles.subjectItemActive]}
                onPress={() => {
                  setSubject(s === subject ? null : s);
                  setShowSubjectPicker(false);
                }}
              >
                <Text style={[styles.subjectItemText, subject === s && styles.subjectItemTextActive]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.titleInput}
          placeholder="Note title"
          placeholderTextColor={C.mutedForeground}
          value={title}
          onChangeText={setTitle}
          multiline={false}
          returnKeyType="next"
          maxLength={200}
        />

        <TextInput
          style={styles.contentInput}
          placeholder="Start writing…"
          placeholderTextColor={C.mutedForeground}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>{isNew ? 'Create Note' : 'Save Changes'}</Text>
            )}
          </Pressable>

          {!isNew && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Feather name="trash-2" size={18} color={C.destructive} />
            </Pressable>
          )}
        </View>

        {/* AI action — only for existing notes with content */}
        {!isNew && content.trim().length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.aiBtn, pressed && styles.pressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!isPremium) {
                router.push('/premium' as any);
                return;
              }
              setSmartNotesDraft({
                noteId: parseInt(id!, 10),
                content,
                subject: subject ?? '',
                mode: 'summarize',
              });
              router.push({
                pathname: '/notes/smart',
                params: { draftNoteId: id },
              } as any);
            }}
          >
            <Feather name="zap" size={16} color={C.primary} />
            <Text style={styles.aiBtnText}>Summarize with AI</Text>
            {!isPremium && <Feather name="lock" size={13} color="#FFD866" />}
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  scroll: { padding: 20, flexGrow: 1 },
  illustration: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: C.card,
  },
  saveBtn: { fontSize: 16, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  subjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  subjectBtnText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  subjectList: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  subjectItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  subjectItemActive: { backgroundColor: C.primary + '22' },
  subjectItemText: { fontSize: 14, color: C.foreground, fontFamily: 'Inter_400Regular' },
  subjectItemTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
    paddingVertical: 4,
  },
  contentInput: {
    fontSize: 16,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 26,
    minHeight: 300,
    flex: 1,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionBtn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  deleteBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: C.destructive + '22',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  pressed: { opacity: 0.7 },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary + '55',
    backgroundColor: C.primary + '12',
  },
  aiBtnText: { fontSize: 15, color: C.primary, fontFamily: 'Inter_600SemiBold' },
});
