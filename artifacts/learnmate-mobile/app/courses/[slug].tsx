import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { resolveCourseColor } from '@/lib/courseColor';
import colors from '@/constants/colors';
import { useEffect } from 'react';

const C = colors.dark;

const COURSE_META: Record<string, { name: string; emoji: string; color: string; description: string }> = {
  robotics:       { name: 'Robotics',      emoji: '🤖', color: colors.courses.robotics,         description: 'Build robots with Arduino & sensors' },
  electronics:    { name: 'Electronics',   emoji: '⚡', color: colors.courses.electronics,       description: 'Circuits, components & breadboards' },
  python:         { name: 'Python',        emoji: '🐍', color: colors.courses.python,            description: 'Code from zero to automation' },
  cpp:            { name: 'C++',           emoji: '💻', color: colors.courses['cpp'],            description: 'Systems programming & algorithms' },
  'ai-ml':        { name: 'AI & ML',       emoji: '🧠', color: colors.courses['ai-ml'],         description: 'Neural networks & machine learning' },
  'coding-basics':{ name: 'Coding Basics', emoji: '🎯', color: colors.courses['coding-basics'], description: 'Logic, loops & first programs' },
};

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
  emoji?: string;
  description?: string;
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

export default function CourseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Fetch course overview — includes lesson titles, premium flags, and subscription status
  const { data: overview, isLoading } = useQuery({
    queryKey: ['courses-overview'],
    queryFn: () => apiFetch<OverviewResponse>('/api/courses/overview'),
    staleTime: 60_000,
  });

  const topic = overview?.topics.find((t) => t.slug === slug);

  // Prefer live API data; hardcoded map is only a visual fallback while loading
  const localMeta = COURSE_META[slug ?? ''];
  const meta = {
    name: topic?.title ?? localMeta?.name ?? slug ?? 'Course',
    emoji: topic?.emoji ?? localMeta?.emoji ?? '📚',
    color: resolveCourseColor(topic?.color, slug ?? '', localMeta?.color ?? C.primary),
    description: topic?.description ?? localMeta?.description ?? '',
  };

  useEffect(() => {
    navigation.setOptions({ title: meta.name });
  }, [meta.name, navigation]);
  const isPremium = overview?.limits.isPremium ?? false;
  const lessons = topic?.lessons ?? [];
  const totalLessons = topic?.totalLessons ?? 14;
  const freeLessons = lessons.filter((l) => !l.isPremium).length;

  return (
    <View style={styles.root}>
      <FlatList
        data={lessons}
        keyExtractor={(item) => String(item.index)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={[styles.emojiBox, { backgroundColor: meta.color + '22' }]}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
            </View>
            <Text style={styles.courseName}>{meta.name}</Text>
            <Text style={styles.courseDesc}>{meta.description}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Feather name="book-open" size={14} color={C.mutedForeground} />
                <Text style={styles.statText}>{totalLessons} lessons</Text>
              </View>
              {isPremium ? (
                <View style={styles.stat}>
                  <Feather name="star" size={14} color="#F59E0B" />
                  <Text style={[styles.statText, { color: '#F59E0B' }]}>Premium — all unlocked</Text>
                </View>
              ) : (
                <>
                  <View style={styles.stat}>
                    <Feather name="unlock" size={14} color={C.success} />
                    <Text style={[styles.statText, { color: C.success }]}>{freeLessons} free</Text>
                  </View>
                  <View style={styles.stat}>
                    <Feather name="lock" size={14} color={C.warning} />
                    <Text style={[styles.statText, { color: C.warning }]}>{totalLessons - freeLessons} premium</Text>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.sectionTitle}>Lessons</Text>
            {isLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />}
          </View>
        )}
        renderItem={({ item }) => {
          // Lesson is accessible if it's free OR if the user has Premium
          const accessible = !item.isPremium || isPremium;

          return (
            <Pressable
              style={({ pressed }) => [styles.lessonCard, pressed && styles.pressed]}
              onPress={() => {
                if (!accessible) {
                  router.push('/premium');
                  return;
                }
                // API uses 0-based index; route uses 1-based for readability
                router.push(`/lesson/${slug}/${item.index + 1}` as any);
              }}
            >
              <View
                style={[
                  styles.lessonNum,
                  { backgroundColor: accessible ? meta.color + '22' : C.secondary },
                ]}
              >
                <Text style={[styles.lessonNumText, { color: accessible ? meta.color : C.mutedForeground }]}>
                  {item.index + 1}
                </Text>
              </View>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle} numberOfLines={1}>
                  {item.title || `Lesson ${item.index + 1}`}
                </Text>
                <Text style={styles.lessonMeta}>
                  {item.completed ? '✓ Completed · ' : ''}{accessible ? (item.isPremium ? 'Premium' : 'Free') : 'Premium'}
                </Text>
              </View>
              {accessible ? (
                <Feather name="chevron-right" size={18} color={C.mutedForeground} />
              ) : (
                <View style={styles.lockBadge}>
                  <Feather name="lock" size={13} color="#F59E0B" />
                </View>
              )}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { padding: 20, paddingBottom: 0 },
  emojiBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: { fontSize: 36 },
  courseName: {
    fontSize: 26,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  courseDesc: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: C.background,
  },
  pressed: { backgroundColor: C.card },
  lessonNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  lessonInfo: { flex: 1 },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: C.foreground,
    fontFamily: 'Inter_500Medium',
  },
  lessonMeta: {
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F59E0B22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
});
