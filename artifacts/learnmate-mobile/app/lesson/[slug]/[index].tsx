import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';
import { useEffect } from 'react';

const C = colors.dark;

interface LessonResponse {
  content: string;   // markdown text
  cached: boolean;
}

interface ImageResponse {
  imageUrl: string;
}

interface TopicMeta {
  slug: string;
  totalLessons: number;
}

interface OverviewResponse {
  topics: TopicMeta[];
}

/** Very simple markdown → text block renderer: splits on headings and paragraphs. */
function parseMarkdown(md: string) {
  const lines = md.split('\n');
  const blocks: Array<{ type: 'h2' | 'h3' | 'bullet' | 'code' | 'p'; text: string }> = [];
  let inCode = false;
  let codeBuffer: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeBuffer.join('\n') });
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuffer.push(raw); continue; }
    if (!line) continue;
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## '))  { blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# '))   { blocks.push({ type: 'h2', text: line.slice(2) }); continue; }
    if (line.startsWith('- ') || line.startsWith('• ') || line.match(/^\d+\.\s/)) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-•]\s/, '').replace(/^\d+\.\s/, '') });
      continue;
    }
    // Strip inline markdown: **bold**, `code`, *italic*
    const cleaned = line
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1');
    blocks.push({ type: 'p', text: cleaned });
  }
  return blocks;
}

export default function LessonScreen() {
  const { slug, index } = useLocalSearchParams<{ slug: string; index: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Route uses 1-based index for readability; API uses 0-based
  const lessonNumber = parseInt(index ?? '1', 10);
  const lessonIndex = lessonNumber - 1;

  // Fetch lesson content via POST
  const {
    data: lessonData,
    isPending: isLoading,
    error,
    mutate: loadLesson,
  } = useMutation({
    mutationFn: () =>
      apiFetch<LessonResponse>('/api/courses/lesson', {
        method: 'POST',
        body: JSON.stringify({ topic: slug, lessonIndex }),
      }),
  });

  // Fetch overview to get the real totalLessons for this topic
  const { data: overviewData } = useQuery({
    queryKey: ['courses', 'overview'],
    queryFn: () => apiFetch<OverviewResponse>('/api/courses/overview'),
    staleTime: 5 * 60 * 1000,
  });
  const totalLessons = overviewData?.topics.find((t) => t.slug === slug)?.totalLessons ?? null;

  // Fetch lesson image
  const { data: imageData } = useQuery({
    queryKey: ['lesson-image', slug, lessonIndex],
    queryFn: () =>
      apiFetch<ImageResponse>(
        `/api/courses/image/lesson/${slug}/${lessonIndex}`,
      ).catch(() => null),
    enabled: !!slug && lessonIndex >= 0,
  });

  // Trigger lesson load on mount
  useEffect(() => {
    if (slug && lessonIndex >= 0) loadLesson();
  }, [slug, lessonIndex]);

  useEffect(() => {
    navigation.setOptions({ title: `Lesson ${lessonNumber}` });
  }, [lessonNumber, navigation]);

  const imageUrl = imageData?.imageUrl;
  const blocks = lessonData?.content ? parseMarkdown(lessonData.content) : [];
  const botPad = insets.bottom + 20 + (Platform.OS === 'web' ? 34 : 0);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.loadingText}>Generating lesson…</Text>
      </View>
    );
  }

  if (error) {
    const e = error as { message?: string };
    const isUpgrade = e?.message?.includes('Premium') || e?.message?.includes('429');
    return (
      <View style={styles.centered}>
        <Feather name={isUpgrade ? 'lock' : 'alert-circle'} size={36} color={C.mutedForeground} />
        <Text style={styles.errorTitle}>{isUpgrade ? 'Premium Lesson' : 'Could not load lesson'}</Text>
        <Text style={styles.errorText}>{e?.message ?? 'Please try again.'}</Text>
        {isUpgrade && (
          <Pressable style={styles.upgradeBtn} onPress={() => router.push('/premium' as any)}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          {/* Lesson badge */}
          <View style={styles.lessonBadge}>
            <Text style={styles.lessonBadgeText}>Lesson {lessonNumber}</Text>
          </View>

          {/* Render parsed markdown blocks */}
          {blocks.map((block, i) => {
            switch (block.type) {
              case 'h2':
                return <Text key={i} style={styles.h2}>{block.text}</Text>;
              case 'h3':
                return <Text key={i} style={styles.h3}>{block.text}</Text>;
              case 'bullet':
                return (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{block.text}</Text>
                  </View>
                );
              case 'code':
                return (
                  <View key={i} style={styles.codeBlock}>
                    <Text style={styles.codeText}>{block.text}</Text>
                  </View>
                );
              default:
                return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
            }
          })}

          {/* Retry button if no content */}
          {!isLoading && blocks.length === 0 && (
            <View style={styles.placeholder}>
              <Feather name="book-open" size={32} color={C.border} />
              <Text style={styles.placeholderTitle}>No content yet</Text>
              <Pressable style={styles.retryBtn} onPress={() => loadLesson()}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Practice quiz for this lesson's subject */}
        {blocks.length > 0 && (
          <View style={styles.quizCta}>
            <Pressable
              style={({ pressed }) => [styles.quizBtn, pressed && styles.pressed]}
              onPress={() => router.push(`/quiz?subject=${encodeURIComponent(slug ?? '')}` as any)}
            >
              <Feather name="help-circle" size={16} color="#fff" />
              <Text style={styles.quizBtnText}>Take a Practice Quiz</Text>
            </Pressable>
          </View>
        )}

        {/* Prev / Next navigation */}
        <View style={styles.navRow}>
          {lessonNumber > 1 && (
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => router.replace(`/lesson/${slug}/${lessonNumber - 1}` as any)}
            >
              <Feather name="arrow-left" size={16} color={C.primary} />
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {(totalLessons === null || lessonNumber < totalLessons) && (
            <Pressable
              style={({ pressed }) => [styles.navBtn, styles.navBtnRight, pressed && styles.pressed]}
              onPress={() => router.replace(`/lesson/${slug}/${lessonNumber + 1}` as any)}
            >
              <Text style={styles.navBtnText}>Next</Text>
              <Feather name="arrow-right" size={16} color={C.primary} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.background,
    padding: 24,
  },
  loadingText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  errorText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  upgradeBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  scroll: {},
  heroImage: { width: '100%', height: 220 },
  content: { padding: 20 },
  lessonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.primary + '22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  lessonBadgeText: { fontSize: 12, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginTop: 20,
    marginBottom: 8,
    lineHeight: 28,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: { fontSize: 15, color: C.primary, lineHeight: 24, marginTop: 1 },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  codeBlock: {
    backgroundColor: C.secondary,
    borderRadius: 10,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  codeText: {
    fontSize: 13,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  placeholder: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  placeholderTitle: { fontSize: 16, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  quizCta: { paddingHorizontal: 20, paddingTop: 4 },
  quizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
  },
  quizBtnText: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  navBtnRight: { marginLeft: 'auto' },
  navBtnText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.7 },
});
