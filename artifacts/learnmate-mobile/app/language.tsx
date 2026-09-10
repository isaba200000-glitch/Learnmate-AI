import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

const MODES = [
  { id: 'vocab', label: 'Vocabulary', icon: 'book' },
  { id: 'grammar', label: 'Grammar', icon: 'edit-3' },
  { id: 'sentence', label: 'Fix the Sentence', icon: 'tool' },
  { id: 'translate', label: 'Translate', icon: 'globe' },
] as const;
type Mode = (typeof MODES)[number]['id'];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

// Matches the server's LANGUAGES list in artifacts/api-server/src/routes/language.ts
const LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'German',
  'Arabic', 'Hindi', 'Japanese', 'Chinese', 'Korean', 'Turkish', 'Italian',
] as const;
type Language = (typeof LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = '@learnmate/practice_language';

interface Overview {
  usedSeconds: number;
  capSeconds: number | null;
  remainingSeconds: number | null;
  locked: boolean;
  resetsAt: string;
  streak: number;
  bestStreak: number;
  exercisesCompleted: number;
  correctAnswers: number;
  wordsLearned: number;
}

interface Exercise {
  type: Mode;
  // vocab / grammar
  word?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  meaning?: string;
  meaningBangla?: string;
  example?: string;
  explanation?: string;
  translation?: string;
  // sentence
  incorrect?: string;
  // translate
  sentence?: string;
  hint?: string;
}

interface GradeResult {
  correct: boolean;
  corrected: string;
  feedback: string;
}

export default function LanguageScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [language, setLanguageState] = useState<Language>('English');
  const [langLoaded, setLangLoaded] = useState(false);

  // Load persisted language on mount — failure falls back to default English
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved && LANGUAGES.includes(saved as Language)) {
          setLanguageState(saved as Language);
        }
      })
      .catch(() => {/* storage unavailable — keep default English */})
      .finally(() => setLangLoaded(true));
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    // Reset session when language changes
    setMode(null);
    setExercises([]);
  }

  const [mode, setMode] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('beginner');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [sessionStats, setSessionStats] = useState({ done: 0, correct: 0 });

  useEffect(() => {
    navigation.setOptions({ title: 'Language Practice' });
  }, [navigation]);

  const { data: overview, refetch: refetchOverview, isLoading } = useQuery({
    queryKey: ['language-overview', language],
    queryFn: () => apiFetch<Overview>(`/api/language/overview?language=${encodeURIComponent(language)}`),
    enabled: langLoaded,
  });

  const locked = overview?.locked ?? false;

  // Heartbeat: credit practice time while actively practicing (not while locked).
  // Every tick returns fresh usage state — if the daily cap is hit, end the round.
  const practicing = mode !== null && exercises.length > 0 && !locked;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (practicing) {
      tickRef.current = setInterval(async () => {
        try {
          const usage = await apiFetch<{ locked: boolean }>('/api/language/tick', {
            method: 'POST',
            body: JSON.stringify({ language }),
          });
          if (usage.locked) {
            // Time's up — exit the round and show the locked banner
            setMode(null);
            setExercises([]);
            refetchOverview();
          }
        } catch {}
      }, 30_000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [practicing, refetchOverview]);

  // Store the language that was active when generation started so stale
  // responses from a previously selected language can be discarded.
  const generateLangRef = useRef<Language>('English');

  const generate = useMutation({
    mutationFn: (m: Mode) => {
      generateLangRef.current = language;
      return apiFetch<{ exercises: Exercise[] }>('/api/language/exercises', {
        method: 'POST',
        body: JSON.stringify({ mode: m, difficulty, language }),
      });
    },
    onSuccess: (data, m) => {
      // Discard if the user switched language while the request was in flight
      if (generateLangRef.current !== language) return;
      setMode(m);
      setExercises(data.exercises);
      setIdx(0);
      setSelected(null);
      setRevealed(false);
      setTextAnswer('');
      setGrade(null);
    },
  });

  const gradeAnswer = useMutation({
    mutationFn: (ex: Exercise) => {
      if (ex.type === 'sentence') {
        return apiFetch<GradeResult>('/api/language/grade-sentence', {
          method: 'POST',
          body: JSON.stringify({ incorrect: ex.incorrect, answer: textAnswer.trim(), language }),
        });
      }
      return apiFetch<GradeResult>('/api/language/grade-translation', {
        method: 'POST',
        body: JSON.stringify({ sentence: ex.sentence, answer: textAnswer.trim(), language }),
      });
    },
    onSuccess: (result, ex) => {
      setGrade(result);
      setRevealed(true);
      recordCompletion(ex, result.correct);
    },
  });

  async function recordCompletion(ex: Exercise, correct: boolean) {
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    setSessionStats((s) => ({ done: s.done + 1, correct: s.correct + (correct ? 1 : 0) }));
    try {
      await apiFetch('/api/language/complete', {
        method: 'POST',
        body: JSON.stringify({
          type: ex.type,
          correct,
          word: ex.word,
          meaning: ex.meaning,
          meaningBangla: ex.meaningBangla,
          example: ex.example,
          language,
          difficulty,
        }),
      });
    } catch {}
  }

  function pickOption(i: number, ex: Exercise) {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
    recordCompletion(ex, i === ex.correctIndex);
  }

  function next() {
    if (idx + 1 < exercises.length) {
      setIdx(idx + 1);
      setSelected(null);
      setRevealed(false);
      setTextAnswer('');
      setGrade(null);
    } else {
      // Round finished — back to mode picker with refreshed stats
      setMode(null);
      setExercises([]);
      refetchOverview();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  }

  const botPad = insets.bottom + 24;

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  // ─── Mode picker ───
  if (!mode || exercises.length === 0) {
    const remaining = overview?.remainingSeconds;
    const remainingLabel =
      remaining == null ? 'Unlimited' : `${Math.max(0, Math.floor(remaining / 60))} min left today`;

    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}>
        {/* Stats strip */}
        <View style={styles.statsRow}>
          <Stat icon="flame" value={String(overview?.streak ?? 0)} label="Streak" color="#EF4444" />
          <Stat icon="check-circle" value={String(overview?.exercisesCompleted ?? 0)} label="Done" color={C.success} />
          <Stat icon="book-open" value={String(overview?.wordsLearned ?? 0)} label="Words" color="#A78BFA" />
        </View>

        <View style={[styles.timeBanner, locked && styles.timeBannerLocked]}>
          <Feather name={locked ? 'lock' : 'clock'} size={14} color={locked ? '#EF4444' : C.primary} />
          <Text style={[styles.timeText, locked && { color: '#EF4444' }]}>
            {locked ? 'Daily practice time used up — come back tomorrow!' : remainingLabel}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Language</Text>
        <View style={[styles.chipRow, { marginBottom: 20 }]}>
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              style={[styles.chip, language === lang && styles.chipActive, generate.isPending && styles.disabled]}
              disabled={generate.isPending}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLanguage(lang);
              }}
            >
              <Text style={[styles.chipText, language === lang && styles.chipTextActive]}>
                {lang}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d}
              style={[styles.chip, difficulty === d && styles.chipActive]}
              onPress={() => setDifficulty(d)}
            >
              <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
                {d[0].toUpperCase() + d.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Practice mode</Text>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            style={({ pressed }) => [styles.modeCard, (pressed || generate.isPending) && styles.pressed, locked && styles.disabled]}
            disabled={locked || generate.isPending}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              generate.mutate(m.id);
            }}
          >
            <View style={styles.modeIcon}>
              <Feather name={m.icon as any} size={20} color={C.primary} />
            </View>
            <Text style={styles.modeLabel}>{m.label}</Text>
            {generate.isPending && generate.variables === m.id ? (
              <ActivityIndicator color={C.primary} size="small" />
            ) : (
              <Feather name="chevron-right" size={18} color={C.mutedForeground} />
            )}
          </Pressable>
        ))}

        {generate.error ? (
          <Text style={styles.errorMsg}>{(generate.error as Error).message}</Text>
        ) : null}
      </ScrollView>
    );
  }

  // ─── Exercise view ───
  const ex = exercises[idx];
  const isMcq = ex.type === 'vocab' || ex.type === 'grammar';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.progressText}>
        {idx + 1} of {exercises.length} · {sessionStats.correct}/{sessionStats.done} correct
      </Text>

      {isMcq && (
        <>
          {ex.word ? <Text style={styles.word}>{ex.word}</Text> : null}
          <Text style={styles.question}>{ex.question}</Text>
          {(ex.options ?? []).map((opt, i) => {
            const isCorrectOpt = revealed && i === ex.correctIndex;
            const isWrongPick = revealed && selected === i && i !== ex.correctIndex;
            return (
              <Pressable
                key={i}
                style={[
                  styles.option,
                  isCorrectOpt && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                ]}
                onPress={() => pickOption(i, ex)}
              >
                <Text
                  style={[
                    styles.optionText,
                    isCorrectOpt && { color: C.success },
                    isWrongPick && { color: '#EF4444' },
                  ]}
                >
                  {opt}
                </Text>
                {isCorrectOpt && <Feather name="check" size={16} color={C.success} />}
                {isWrongPick && <Feather name="x" size={16} color="#EF4444" />}
              </Pressable>
            );
          })}
          {revealed && (
            <View style={styles.feedbackCard}>
              {ex.meaning ? <Text style={styles.feedbackText}>Meaning: {ex.meaning}</Text> : null}
              {ex.meaningBangla ? <Text style={styles.feedbackText}>বাংলা: {ex.meaningBangla}</Text> : null}
              {ex.example ? <Text style={styles.feedbackText}>Example: {ex.example}</Text> : null}
              {ex.explanation ? <Text style={styles.feedbackText}>{ex.explanation}</Text> : null}
            </View>
          )}
        </>
      )}

      {!isMcq && (
        <>
          <Text style={styles.question}>
            {ex.type === 'sentence' ? 'Fix this sentence:' : 'Translate this sentence:'}
          </Text>
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{ex.type === 'sentence' ? ex.incorrect : ex.sentence}</Text>
          </View>
          {ex.hint ? <Text style={styles.hint}>Hint: {ex.hint}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Type your answer…"
            placeholderTextColor={C.mutedForeground}
            value={textAnswer}
            onChangeText={setTextAnswer}
            editable={!revealed}
            multiline
          />
          {!revealed && (
            <Pressable
              style={[styles.primaryBtn, (!textAnswer.trim() || gradeAnswer.isPending) && styles.disabled]}
              disabled={!textAnswer.trim() || gradeAnswer.isPending}
              onPress={() => gradeAnswer.mutate(ex)}
            >
              {gradeAnswer.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Check Answer</Text>
              )}
            </Pressable>
          )}
          {gradeAnswer.error ? (
            <Text style={styles.errorMsg}>{(gradeAnswer.error as Error).message}</Text>
          ) : null}
          {grade && (
            <View style={[styles.feedbackCard, { borderColor: grade.correct ? C.success + '55' : '#EF444455' }]}>
              <Text style={[styles.gradeVerdict, { color: grade.correct ? C.success : '#EF4444' }]}>
                {grade.correct ? '✓ Correct!' : '✗ Not quite'}
              </Text>
              {grade.corrected ? <Text style={styles.feedbackText}>Correct: {grade.corrected}</Text> : null}
              {grade.feedback ? <Text style={styles.feedbackText}>{grade.feedback}</Text> : null}
            </View>
          )}
        </>
      )}

      {revealed && (
        <Pressable style={styles.primaryBtn} onPress={next}>
          <Text style={styles.primaryBtnText}>
            {idx + 1 < exercises.length ? 'Next' : 'Finish Round'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Stat({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon as any} size={15} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statValue: { fontSize: 17, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  timeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary + '15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  timeBannerLocked: { backgroundColor: '#EF444415' },
  timeText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_500Medium', flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.primary + '22', borderColor: C.primary },
  chipText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: C.primary },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 10,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  errorMsg: { fontSize: 13, color: '#EF4444', fontFamily: 'Inter_400Regular', marginTop: 10, textAlign: 'center' },
  progressText: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  word: { fontSize: 26, fontWeight: '700', color: C.primary, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  question: {
    fontSize: 17,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 25,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 10,
  },
  optionCorrect: { borderColor: C.success, backgroundColor: C.success + '11' },
  optionWrong: { borderColor: '#EF4444', backgroundColor: '#EF444411' },
  optionText: { flex: 1, fontSize: 15, color: C.foreground, fontFamily: 'Inter_400Regular', marginRight: 8 },
  feedbackCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginTop: 6,
    marginBottom: 10,
    gap: 6,
  },
  feedbackText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  gradeVerdict: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  promptCard: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  promptText: { fontSize: 16, color: C.foreground, fontFamily: 'Inter_500Medium', lineHeight: 24 },
  hint: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 10, fontStyle: 'italic' },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
});
