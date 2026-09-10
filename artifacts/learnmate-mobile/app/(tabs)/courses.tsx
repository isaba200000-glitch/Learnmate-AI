import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { resolveCourseColor } from '@/lib/courseColor';
import colors from '@/constants/colors';

const C = colors.dark;

// Visual fallbacks when the API doesn't provide a colour for a topic
const FALLBACK_COLORS = [
  C.primary,
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
];

interface OverviewLesson {
  index: number;
  title: string;
  summary: string;
  isPremium: boolean;
  completed: boolean;
}

interface OverviewTopic {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  color?: string;
  totalLessons: number;
  completedLessons: number;
  lessons: OverviewLesson[];
}

interface OverviewResponse {
  topics: OverviewTopic[];
  limits: {
    isPremium: boolean;
    dailyLimit: number | null;
    used: number;
    remaining: number | null;
  };
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: overview, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['courses-overview'],
    queryFn: () => apiFetch<OverviewResponse>('/api/courses/overview'),
    staleTime: 60_000,
  });

  const topics = overview?.topics ?? [];
  const isPremium = overview?.limits.isPremium ?? false;

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  function topicColor(topic: OverviewTopic, index: number): string {
    // API sends Tailwind-style tokens; normalize to valid hex for RN styles
    return resolveCourseColor(
      topic.color,
      topic.slug,
      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.loadingText}>Loading courses…</Text>
      </View>
    );
  }

  if (error && topics.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Feather name="wifi-off" size={36} color={C.mutedForeground} />
        <Text style={styles.errorTitle}>Couldn't load courses</Text>
        <Text style={styles.errorText}>
          {(error as Error)?.message ?? 'Check your connection and try again.'}
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={topics}
        keyExtractor={(item) => item.slug}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>Courses</Text>
            <Text style={styles.subtitle}>Pick a subject and start learning</Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          const color = topicColor(item, index);
          const freeCount = item.lessons.filter((l) => !l.isPremium).length;
          const progress =
            item.totalLessons > 0
              ? Math.round((item.completedLessons / item.totalLessons) * 100)
              : 0;

          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/courses/${item.slug}` as any);
              }}
            >
              <View style={[styles.emojiBox, { backgroundColor: color + '22' }]}>
                <Text style={styles.emoji}>{item.emoji || '📚'}</Text>
              </View>
              <Text style={styles.courseName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.courseDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.lessonCount}>{item.totalLessons} lessons</Text>
                <View style={[styles.freeBadge, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.freeText, { color }]}>
                    {isPremium ? 'All access' : `${freeCount} free`}
                  </Text>
                </View>
              </View>
              {/* Real progress bar from API */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: color, width: `${progress}%` },
                  ]}
                />
              </View>
              {item.completedLessons > 0 && (
                <Text style={styles.progressLabel}>
                  {item.completedLessons}/{item.totalLessons} completed
                </Text>
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
  },
  errorText: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  header: { marginBottom: 20 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  emojiBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: { fontSize: 26 },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  courseDesc: {
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  lessonCount: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  freeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  freeText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  progressBg: {
    height: 3,
    backgroundColor: C.secondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: {
    fontSize: 10,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
  },
});
