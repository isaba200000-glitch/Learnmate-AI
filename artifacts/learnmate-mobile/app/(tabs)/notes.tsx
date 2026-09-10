import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useGetSubscription } from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

interface Note {
  id: number;
  title: string;
  content: string;
  subject: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  robotics: colors.courses.robotics,
  electronics: colors.courses.electronics,
  python: colors.courses.python,
  cpp: colors.courses['cpp'],
  'ai-ml': colors.courses['ai-ml'],
  'coding-basics': colors.courses['coding-basics'],
};

function subjectColor(subject: string | null): string {
  if (!subject) return C.primary;
  const lower = subject.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECT_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return C.primary;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const { data: notes, isLoading, error, refetch } = useQuery({
    queryKey: ['notes', search],
    queryFn: () =>
      apiFetch<Note[]>(
        `/api/notes${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const handleCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notes/new' as any);
  }, [router]);

  const { data: sub } = useGetSubscription();
  const subInfo = sub as unknown as { status?: string; isOwner?: boolean } | undefined;
  const isPremium = subInfo?.status === 'active' || subInfo?.isOwner === true;

  const handleSmartNotes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPremium) {
      router.push('/notes/smart' as any);
    } else {
      router.push('/premium' as any);
    }
  }, [router, isPremium]);

  const filtered = notes ?? [];

  return (
    <View style={styles.root}>
      {/* Fixed header with search */}
      <View style={[styles.headerArea, { paddingTop: topPad }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notes</Text>
          <Text style={styles.count}>{filtered.length}</Text>
          <View style={{ flex: 1 }} />
          <Pressable
            style={({ pressed }) => [styles.smartBtn, pressed && { opacity: 0.75 }]}
            onPress={handleSmartNotes}
          >
            <Feather name="zap" size={14} color="#fff" />
            <Text style={styles.smartBtnText}>Smart Notes</Text>
            {!isPremium && <Feather name="lock" size={12} color="#FFD866" />}
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={C.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes…"
            placeholderTextColor={C.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={C.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      )}

      {!isLoading && filtered.length === 0 && !error && (
        <View style={styles.empty}>
          <Feather name="file-text" size={40} color={C.border} />
          <Text style={styles.emptyTitle}>
            {search ? 'No matching notes' : 'No notes yet'}
          </Text>
          <Text style={styles.emptyText}>
            {search
              ? 'Try a different search term'
              : 'Tap + to create your first note'}
          </Text>
        </View>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad, paddingTop: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(`/notes/${item.id}` as any)}
            >
              {item.subject && (
                <View style={[styles.subjectBadge, { backgroundColor: subjectColor(item.subject) + '22' }]}>
                  <Text style={[styles.subjectText, { color: subjectColor(item.subject) }]}>
                    {item.subject}
                  </Text>
                </View>
              )}
              <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.notePreview} numberOfLines={2}>
                {item.content}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.noteDate}>{timeAgo(item.updatedAt)}</Text>
                {item.tags.length > 0 && (
                  <Text style={styles.noteTags} numberOfLines={1}>
                    {item.tags.map((t) => `#${t}`).join(' ')}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load notes</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: botPad - 30 },
          pressed && styles.fabPressed,
        ]}
        onPress={handleCreate}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  headerArea: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  count: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    backgroundColor: C.secondary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smartBtnText: { fontSize: 13, color: '#fff', fontFamily: 'Inter_600SemiBold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  pressed: { opacity: 0.75 },
  subjectBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  subjectText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  notePreview: {
    fontSize: 13,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteDate: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  noteTags: { fontSize: 12, color: C.primary, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
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
});
