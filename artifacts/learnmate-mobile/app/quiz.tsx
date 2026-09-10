import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getGetProgressStatsQueryKey } from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

const SUBJECTS = [
  'Math', 'Science', 'English', 'History', 'Geography', 'Computer',
];
const COUNTS = [5, 10, 15];
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

interface QuizQuestion {
  id: number;
  question: string;
  type: string;
  options: string[];
  // Only present on completed sessions (submit/review responses) — the server
  // strips the answer key while a quiz is pending.
  correctAnswer?: string;
  explanation?: string | null;
  userAnswer?: string | null;
  isCorrect?: boolean | null;
}

interface StartQuizResponse {
  id: number;
  subject: string;
  totalQuestions: number;
  questions: QuizQuestion[];
}

interface SubmitResponse {
  sessionId: number;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  questions: QuizQuestion[];
}

type Phase = 'setup' | 'quiz' | 'results';

export default function QuizScreen() {
  const { subject: subjectParam } = useLocalSearchParams<{ subject?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>('setup');
  const [subject, setSubject] = useState(subjectParam || SUBJECTS[0]);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('medium');

  const [session, setSession] = useState<StartQuizResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<SubmitResponse | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Practice Quiz' });
  }, [navigation]);

  const startQuiz = useMutation({
    mutationFn: () =>
      apiFetch<StartQuizResponse>('/api/quiz-sessions', {
        method: 'POST',
        body: JSON.stringify({ subject, totalQuestions: count, difficulty }),
      }),
    onSuccess: (data) => {
      setSession(data);
      setCurrentIdx(0);
      setAnswers({});
      setResult(null);
      setPhase('quiz');
    },
  });

  const submitQuiz = useMutation({
    mutationFn: () =>
      apiFetch<SubmitResponse>(`/api/quiz-sessions/${session!.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId: Number(questionId),
            answer,
          })),
        }),
      }),
    onSuccess: (data) => {
      setResult(data);
      setPhase('results');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Refresh XP/streak/level on the profile tab immediately after quiz completion.
      queryClient.invalidateQueries({ queryKey: getGetProgressStatsQueryKey() });
    },
  });

  const questions = session?.questions ?? [];
  const current = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const botPad = insets.bottom + 24;

  function selectAnswer(option: string) {
    if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers((a) => ({ ...a, [current.id]: option }));
  }

  // ─── Setup phase ───
  if (phase === 'setup') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.setupScroll, { paddingBottom: botPad }]}
      >
        <Text style={styles.setupTitle}>Set up your quiz</Text>

        <Text style={styles.label}>Subject</Text>
        <View style={styles.chipRow}>
          {(subjectParam && !SUBJECTS.includes(subjectParam)
            ? [subjectParam, ...SUBJECTS]
            : SUBJECTS
          ).map((s) => (
            <Chip key={s} label={s} active={subject === s} onPress={() => setSubject(s)} />
          ))}
        </View>

        <Text style={styles.label}>Questions</Text>
        <View style={styles.chipRow}>
          {COUNTS.map((n) => (
            <Chip key={n} label={String(n)} active={count === n} onPress={() => setCount(n)} />
          ))}
        </View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d}
              label={d[0].toUpperCase() + d.slice(1)}
              active={difficulty === d}
              onPress={() => setDifficulty(d)}
            />
          ))}
        </View>

        {startQuiz.error ? (
          <Text style={styles.errorMsg}>{(startQuiz.error as Error).message}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          disabled={startQuiz.isPending}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            startQuiz.mutate();
          }}
        >
          {startQuiz.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Start Quiz</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // ─── Results phase ───
  if (phase === 'results' && result) {
    const pass = result.score >= 70;
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.setupScroll, { paddingBottom: botPad }]}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.resultEmoji}>{pass ? '🎉' : '💪'}</Text>
          <Text style={styles.resultScore}>{Math.round(result.score)}%</Text>
          <Text style={styles.resultSub}>
            {result.correctAnswers}/{result.totalQuestions} correct · +{result.xpEarned} XP
          </Text>
        </View>

        {result.questions.map((q, i) => (
          <View key={q.id} style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Feather
                name={q.isCorrect ? 'check-circle' : 'x-circle'}
                size={16}
                color={q.isCorrect ? C.success : '#EF4444'}
              />
              <Text style={styles.reviewQ}>{i + 1}. {q.question}</Text>
            </View>
            {!q.isCorrect && (
              <Text style={styles.reviewAnswer}>
                Your answer: {q.userAnswer ?? '—'} · Correct: {q.correctAnswer}
              </Text>
            )}
            {q.explanation ? <Text style={styles.reviewExplain}>{q.explanation}</Text> : null}
          </View>
        ))}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => setPhase('setup')}
        >
          <Text style={styles.primaryBtnText}>New Quiz</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ─── Quiz phase ───
  if (!current) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  const selected = answers[current.id];
  const isLast = currentIdx === questions.length - 1;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.quizScroll, { paddingBottom: botPad }]}>
        {/* Progress */}
        <View style={styles.progressBg}>
          <View
            style={[styles.progressFill, { width: `${((currentIdx + 1) / questions.length) * 100}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          Question {currentIdx + 1} of {questions.length} · {answeredCount} answered
        </Text>

        <Text style={styles.question}>{current.question}</Text>

        {current.options.map((opt) => {
          const active = selected === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => selectAnswer(opt)}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}

        {submitQuiz.error ? (
          <Text style={styles.errorMsg}>{(submitQuiz.error as Error).message}</Text>
        ) : null}

        <View style={styles.quizNav}>
          {currentIdx > 0 && (
            <Pressable style={styles.secondaryBtn} onPress={() => setCurrentIdx((i) => i - 1)}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {isLast ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtnSmall,
                answeredCount < questions.length && styles.disabledBtn,
                pressed && styles.pressed,
              ]}
              disabled={submitQuiz.isPending || answeredCount < questions.length}
              onPress={() => submitQuiz.mutate()}
            >
              {submitQuiz.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtnSmall, pressed && styles.pressed]}
              onPress={() => setCurrentIdx((i) => i + 1)}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  setupScroll: { padding: 20 },
  quizScroll: { padding: 20 },
  setupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 10,
    marginTop: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.primary + '22', borderColor: C.primary },
  chipText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: C.primary },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnSmall: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginTop: 0,
  },
  secondaryBtnText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  disabledBtn: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  errorMsg: {
    fontSize: 13,
    color: '#EF4444',
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
    textAlign: 'center',
  },
  progressBg: { height: 4, backgroundColor: C.secondary, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressText: {
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    marginBottom: 16,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 26,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 10,
  },
  optionActive: { borderColor: C.primary, backgroundColor: C.primary + '11' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  optionText: { flex: 1, fontSize: 15, color: C.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  optionTextActive: { color: C.foreground },
  quizNav: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  resultHeader: { alignItems: 'center', marginBottom: 24 },
  resultEmoji: { fontSize: 44, marginBottom: 8 },
  resultScore: { fontSize: 44, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  resultSub: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 4 },
  reviewCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 10,
  },
  reviewTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reviewQ: { flex: 1, fontSize: 14, color: C.foreground, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  reviewAnswer: { fontSize: 13, color: '#EF4444', fontFamily: 'Inter_400Regular', marginTop: 6, marginLeft: 24 },
  reviewExplain: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, marginLeft: 24, lineHeight: 19 },
});
