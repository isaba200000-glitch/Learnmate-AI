import { memo, useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLanguageOverview,
  getGetLanguageOverviewQueryKey,
  useLanguageTick,
  useGenerateLanguageExercises,
  useGradeLanguageSentence,
  useGradeLanguageTranslation,
  useCompleteLanguageExercise,
  type LanguageExercise,
  type GradeSentenceResult,
  type LanguageProgressResult,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { FocusModeButton } from "@/components/focus/focus-mode-card";
import { format } from "date-fns";
import {
  Languages,
  Clock,
  Flame,
  BookA,
  CheckCircle2,
  Trophy,
  SpellCheck,
  PenLine,
  Crown,
  Hourglass,
  Lightbulb,
  Check,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  X,
  BookOpen,
} from "lucide-react";

type Mode = "vocab" | "grammar" | "sentence" | "translate";
type Difficulty = "beginner" | "intermediate" | "advanced";
type TargetLanguage =
  | "English"
  | "Spanish"
  | "French"
  | "Portuguese"
  | "German"
  | "Arabic"
  | "Hindi"
  | "Japanese"
  | "Chinese"
  | "Korean"
  | "Turkish"
  | "Italian";

const LANGUAGES: { value: TargetLanguage; flag: string }[] = [
  { value: "English", flag: "🇬🇧" },
  { value: "Spanish", flag: "🇪🇸" },
  { value: "French", flag: "🇫🇷" },
  { value: "Portuguese", flag: "🇵🇹" },
  { value: "German", flag: "🇩🇪" },
  { value: "Arabic", flag: "🇸🇦" },
  { value: "Hindi", flag: "🇮🇳" },
  { value: "Japanese", flag: "🇯🇵" },
  { value: "Chinese", flag: "🇨🇳" },
  { value: "Korean", flag: "🇰🇷" },
  { value: "Turkish", flag: "🇹🇷" },
  { value: "Italian", flag: "🇮🇹" },
];

function loadSavedLanguage(): TargetLanguage {
  const saved = localStorage.getItem("lm_lang_target");
  return LANGUAGES.some((l) => l.value === saved) ? (saved as TargetLanguage) : "English";
}

const MODE_META: {
  mode: Mode;
  title: string;
  desc: string;
  icon: typeof BookA;
  iconClass: string;
}[] = [
  {
    mode: "vocab",
    title: "Vocabulary",
    desc: "Learn useful words with Bangla meanings and real examples.",
    icon: BookA,
    iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    mode: "grammar",
    title: "Grammar",
    desc: "Pick the correct form — tenses, articles, prepositions and more.",
    icon: SpellCheck,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    mode: "sentence",
    title: "Fix the Sentence",
    desc: "Spot the mistakes and rewrite the sentence correctly.",
    icon: PenLine,
    iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    mode: "translate",
    title: "Translate to English",
    desc: "Read a sentence in the language you're learning and translate it into English.",
    icon: Languages,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const TICK_INTERVAL_MS = 20_000;

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function errStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

function errMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } | null } | null)?.data;
  return data?.error ?? fallback;
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function TimePill({
  remaining,
  cap,
  locked,
}: {
  remaining: number | null;
  cap: number | null;
  locked: boolean;
}) {
  if (cap === null) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 shadow-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Unlimited practice</span>
      </div>
    );
  }
  const left = remaining ?? 0;
  const pct = Math.max(0, Math.min(100, (left / cap) * 100));
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-2.5 shadow-sm">
      <Clock className={`h-5 w-5 ${locked ? "text-destructive" : "text-primary"}`} />
      <div>
        <div className="text-lg font-bold leading-none tabular-nums" data-testid="text-time-remaining">
          {fmtTime(left)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          left today · {Math.round(cap / 60)} min/day
        </div>
      </div>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${locked ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  iconClass: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
          <div className="truncate text-xs text-muted-foreground">
            {label}
            {hint ? <span className="text-emerald-600 dark:text-emerald-400"> · {hint}</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LockCard({ plan, resetsAt }: { plan: string; resetsAt: string | null }) {
  let resetLabel = "midnight";
  if (resetsAt) {
    try {
      resetLabel = format(new Date(resetsAt), "h:mm a");
    } catch {
      /* keep default */
    }
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Hourglass className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold" data-testid="text-lock-title">
            That's your practice time for today!
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Great work — you used all of today's practice minutes. Your timer
            resets at <span className="font-medium text-foreground">{resetLabel}</span>.
          </p>
        </div>
        {plan === "free" ? (
          <div className="mt-2 w-full max-w-md rounded-2xl bg-gradient-to-br from-primary via-primary to-violet-600 p-[1px]">
            <div className="rounded-2xl bg-card p-5 text-left">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <Crown className="h-4 w-4 text-primary" /> Want 3× more practice?
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Premium students get <span className="font-medium text-foreground">30 minutes every day</span> —
                plus Smart Notes and likely exam questions.
              </p>
              <Link href="/premium">
                <Button className="w-full rounded-full" data-testid="button-upgrade-premium">
                  Upgrade to Premium <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400">
            <Flame className="h-4 w-4" /> Come back tomorrow to keep your streak going!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Exercise views ──────────────────────────────────────────────────────────

// Word-by-word translator: every word of the exercise translated into English.
function WordGlossary({
  glossary,
  translation,
  showTranslation = true,
}: {
  glossary?: Array<{ term: string; english: string }>;
  translation?: string;
  showTranslation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasWords = !!glossary && glossary.length > 0;
  const hasTranslation = showTranslation && !!translation;
  if (!hasWords && !hasTranslation) return null;

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-700 dark:text-sky-300"
        data-testid="button-word-translator"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Word-by-word translator
        <span className="ml-auto text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3" data-testid="panel-word-translator">
          {hasWords && (
            <div className="flex flex-wrap gap-1.5">
              {glossary!.map((g, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold">{g.term}</span>
                  <span className="text-muted-foreground">→ {g.english}</span>
                </span>
              ))}
            </div>
          )}
          {hasTranslation && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Meaning:</span> {translation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function optionClasses(state: "idle" | "correct" | "wrong" | "dimmed"): string {
  const base =
    "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors";
  switch (state) {
    case "correct":
      return `${base} border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`;
    case "wrong":
      return `${base} border-destructive bg-destructive/10 text-destructive`;
    case "dimmed":
      return `${base} border-border opacity-50`;
    default:
      return `${base} border-border hover:border-primary/60 hover:bg-primary/5`;
  }
}

function McqExercise({
  exercise,
  onAnswered,
  onNext,
  isLast,
}: {
  exercise: LanguageExercise;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const options = exercise.options ?? [];
  const correctIndex = exercise.correctIndex ?? -1;
  const answered = selected !== null;
  const wasCorrect = selected === correctIndex;

  const pick = (i: number) => {
    if (answered) return;
    setSelected(i);
    onAnswered(i === correctIndex);
  };

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold leading-snug" data-testid="text-question">
        {exercise.question}
      </p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          let state: "idle" | "correct" | "wrong" | "dimmed" = "idle";
          if (answered) {
            if (i === correctIndex) state = "correct";
            else if (i === selected) state = "wrong";
            else state = "dimmed";
          }
          return (
            <button
              key={i}
              type="button"
              className={optionClasses(state)}
              onClick={() => pick(i)}
              disabled={answered}
              data-testid={`button-option-${i}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <WordGlossary glossary={exercise.glossary} translation={exercise.translation} showTranslation={answered} />

      {answered && (
        <div
          className={`space-y-2 rounded-xl border p-4 text-sm ${
            wasCorrect
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
          data-testid="panel-explanation"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {wasCorrect ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Correct — well done!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" /> Not quite — here's the idea:
              </>
            )}
          </div>
          {exercise.type === "vocab" && (
            <div className="space-y-1 text-muted-foreground">
              {exercise.meaning ? (
                <p>
                  <span className="font-medium text-foreground">{exercise.word}</span> — {exercise.meaning}
                </p>
              ) : null}
              {exercise.meaningBangla ? (
                <p className="font-medium text-foreground">বাংলা: {exercise.meaningBangla}</p>
              ) : null}
              {exercise.example ? <p className="italic">"{exercise.example}"</p> : null}
            </div>
          )}
          {exercise.explanation ? (
            <p className="text-muted-foreground">{exercise.explanation}</p>
          ) : null}
          <Button onClick={onNext} className="mt-1 rounded-full" size="sm" data-testid="button-next">
            {isLast ? "Finish round" : "Next question"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SentenceExercise({
  exercise,
  language,
  onAnswered,
  onNext,
  onTimeUp,
  isLast,
}: {
  exercise: LanguageExercise;
  language: TargetLanguage;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  onTimeUp: () => void;
  isLast: boolean;
}) {
  const { toast } = useToast();
  const grade = useGradeLanguageSentence();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<GradeSentenceResult | null>(null);

  const submit = () => {
    const clean = answer.trim();
    if (!clean || grade.isPending || result) return;
    grade.mutate(
      { data: { incorrect: exercise.incorrect ?? "", answer: clean, language: language as never } },
      {
        onSuccess: (d) => {
          setResult(d);
          onAnswered(d.correct);
        },
        onError: (err) => {
          if (errStatus(err) === 403) {
            onTimeUp();
            return;
          }
          toast({
            title: "Could not check your sentence",
            description: errMessage(err, "Please try again."),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fix this sentence
        </p>
        <p className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-lg font-medium" data-testid="text-incorrect-sentence">
          {exercise.incorrect}
        </p>
      </div>
      {exercise.hint ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> Hint: {exercise.hint}
        </p>
      ) : null}
      <WordGlossary glossary={exercise.glossary} translation={exercise.translation} />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write the corrected sentence here…"
        rows={3}
        disabled={!!result}
        className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        data-testid="input-sentence-answer"
      />
      {!result && (
        <Button
          onClick={submit}
          disabled={!answer.trim() || grade.isPending}
          className="rounded-full"
          data-testid="button-check-sentence"
        >
          {grade.isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" /> Checking…
            </>
          ) : (
            "Check my sentence"
          )}
        </Button>
      )}

      {result && (
        <div
          className={`space-y-2 rounded-xl border p-4 text-sm ${
            result.correct
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
          data-testid="panel-sentence-result"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {result.correct ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Correct — nicely fixed!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" /> Almost — compare with this:
              </>
            )}
          </div>
          {result.corrected ? (
            <p className="rounded-lg bg-background px-3 py-2 font-medium">"{result.corrected}"</p>
          ) : null}
          {result.feedback ? <p className="text-muted-foreground">{result.feedback}</p> : null}
          <Button onClick={onNext} className="mt-1 rounded-full" size="sm" data-testid="button-next">
            {isLast ? "Finish round" : "Next sentence"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function TranslateExercise({
  exercise,
  language,
  onAnswered,
  onNext,
  onTimeUp,
  isLast,
}: {
  exercise: LanguageExercise;
  language: TargetLanguage;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  onTimeUp: () => void;
  isLast: boolean;
}) {
  const { toast } = useToast();
  const grade = useGradeLanguageTranslation();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<GradeSentenceResult | null>(null);

  const submit = () => {
    const clean = answer.trim();
    if (!clean || grade.isPending || result) return;
    grade.mutate(
      { data: { sentence: exercise.sentence ?? "", answer: clean, language: language as never } },
      {
        onSuccess: (d) => {
          setResult(d);
          onAnswered(d.correct);
        },
        onError: (err) => {
          if (errStatus(err) === 403) {
            onTimeUp();
            return;
          }
          toast({
            title: "Could not check your translation",
            description: errMessage(err, "Please try again."),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Translate this into English
        </p>
        <p
          className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-lg font-medium"
          data-testid="text-translate-sentence"
        >
          {exercise.sentence}
        </p>
      </div>
      {exercise.hint ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> Hint: {exercise.hint}
        </p>
      ) : null}
      <WordGlossary glossary={exercise.glossary} showTranslation={false} />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write the English translation here…"
        rows={3}
        disabled={!!result}
        className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        data-testid="input-translate-answer"
      />
      {!result && (
        <Button
          onClick={submit}
          disabled={!answer.trim() || grade.isPending}
          className="rounded-full"
          data-testid="button-check-translation"
        >
          {grade.isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" /> Checking…
            </>
          ) : (
            "Check my translation"
          )}
        </Button>
      )}

      {result && (
        <div
          className={`space-y-2 rounded-xl border p-4 text-sm ${
            result.correct
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
          data-testid="panel-translate-result"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {result.correct ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Correct — great translation!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" /> Almost — compare with this:
              </>
            )}
          </div>
          {result.corrected ? (
            <p className="rounded-lg bg-background px-3 py-2 font-medium">"{result.corrected}"</p>
          ) : null}
          {result.feedback ? <p className="text-muted-foreground">{result.feedback}</p> : null}
          <Button onClick={onNext} className="mt-1 rounded-full" size="sm" data-testid="button-next">
            {isLast ? "Finish round" : "Next sentence"} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function LanguagePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(loadSavedLanguage);

  const overview = useGetLanguageOverview({ language: targetLanguage as never }, {
    query: { queryKey: getGetLanguageOverviewQueryKey({ language: targetLanguage as never }) },
  });

  // Server-synced time state (server is the source of truth via ticks).
  const [cap, setCap] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [resetsAt, setResetsAt] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");

  // Practice session state.
  const [practicing, setPracticing] = useState<Mode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem("lm_lang_difficulty");
    return saved === "beginner" || saved === "advanced" ? saved : "intermediate";
  });
  const [exercises, setExercises] = useState<LanguageExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [batchDone, setBatchDone] = useState(false);
  const [progress, setProgress] = useState<LanguageProgressResult | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const gen = useGenerateLanguageExercises();
  const tick = useLanguageTick();
  const complete = useCompleteLanguageExercise();

  const syncFromServer = (d: {
    capSeconds: number | null;
    remainingSeconds: number | null;
    locked: boolean;
    resetsAt: string;
    plan: string;
  }) => {
    setCap(d.capSeconds);
    setRemaining(d.remainingSeconds);
    setLocked(d.locked);
    setResetsAt(d.resetsAt);
    setPlan(d.plan);
  };

  // Keep timer/lock/plan in sync with every fresh overview from the server.
  const overviewData = overview.data;
  useEffect(() => {
    if (overviewData) syncFromServer(overviewData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewData]);

  // Heartbeat while practicing (tab visible only).
  const tickMutate = tick.mutate;
  useEffect(() => {
    if (!practicing) return;
    const send = () => {
      if (document.hidden) return;
      tickMutate(undefined, { onSuccess: syncFromServer });
    };
    send();
    const id = setInterval(send, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [practicing, tickMutate]);

  // Local 1-second countdown between heartbeats.
  const counting = practicing !== null && typeof remaining === "number" && !locked;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      setRemaining((r) => (typeof r === "number" && r > 0 ? r - 1 : r));
    }, 1000);
    return () => clearInterval(id);
  }, [counting]);

  // Lock the session the moment the local countdown reaches zero.
  useEffect(() => {
    if (cap !== null && typeof remaining === "number" && remaining <= 0 && !locked) {
      setLocked(true);
    }
  }, [remaining, cap, locked]);

  // When locked, end the practice session so heartbeats stop firing.
  useEffect(() => {
    if (locked && practicing) {
      setPracticing(null);
      setExercises([]);
      setBatchDone(false);
    }
  }, [locked, practicing]);

  // Auto-refresh at the daily reset so the page unlocks without a reload.
  useEffect(() => {
    if (!locked || !resetsAt) return;
    const delta = new Date(resetsAt).getTime() - Date.now() + 2000;
    if (delta <= 0 || delta > 26 * 60 * 60 * 1000) return;
    const id = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: getGetLanguageOverviewQueryKey() });
    }, delta);
    return () => clearTimeout(id);
  }, [locked, resetsAt, queryClient]);

  const changeDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    localStorage.setItem("lm_lang_difficulty", d);
  };

  const changeLanguage = (l: TargetLanguage) => {
    setTargetLanguage(l);
    localStorage.setItem("lm_lang_target", l);
  };

  const loadBatch = (mode: Mode) => {
    setBatchDone(false);
    setSuggestionDismissed(false);
    setSessionCorrect(0);
    setExercises([]);
    setIndex(0);
    gen.mutate(
      { data: { mode, difficulty, language: targetLanguage as never } },
      {
        onSuccess: (d) => setExercises(d.exercises),
        onError: (err) => {
          if (errStatus(err) === 403) {
            setLocked(true);
            setPracticing(null);
            return;
          }
          toast({
            title: "Could not load exercises",
            description: errMessage(err, "Please try again."),
            variant: "destructive",
          });
          setPracticing(null);
        },
      },
    );
  };

  const startPractice = (mode: Mode) => {
    setPracticing(mode);
    loadBatch(mode);
  };

  const endPractice = () => {
    setPracticing(null);
    setExercises([]);
    setBatchDone(false);
    queryClient.invalidateQueries({ queryKey: getGetLanguageOverviewQueryKey() });
  };

  const handleAnswered = (ex: LanguageExercise, correct: boolean) => {
    setSessionCorrect((c) => c + (correct ? 1 : 0));
    complete.mutate(
      {
        data: {
          type: ex.type,
          correct,
          word: ex.word,
          meaning: ex.meaning,
          meaningBangla: ex.meaningBangla,
          example: ex.example,
          language: targetLanguage as never,
          difficulty: difficulty as never,
        },
      },
      { onSuccess: (d) => setProgress(d) },
    );
  };

  const handleNext = () => {
    if (index < exercises.length - 1) setIndex((i) => i + 1);
    else setBatchDone(true);
  };

  const handleTimeUp = () => {
    setLocked(true);
    setPracticing(null);
  };

  // Display stats prefer the freshest server response.
  const streak = progress?.streak ?? overview.data?.streak ?? 0;
  const bestStreak = progress?.bestStreak ?? overview.data?.bestStreak ?? 0;
  const wordsLearned = progress?.wordsLearned ?? overview.data?.wordsLearned ?? 0;
  const exercisesDone = progress?.exercisesCompleted ?? overview.data?.exercisesCompleted ?? 0;
  const practicedToday = progress !== null || overview.data?.practicedToday === true;
  const recentWords = overview.data?.recentWords ?? [];
  const currentMeta = MODE_META.find((m) => m.mode === practicing);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Languages className="h-7 w-7 text-primary" /> Language Learning
          </h1>
          <p className="mt-1 text-muted-foreground">
            Daily {targetLanguage} practice — a little every day goes a long way.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FocusModeButton />
          {overview.isLoading ? (
            <Skeleton className="h-[52px] w-44 rounded-2xl" />
          ) : (
            <TimePill remaining={remaining} cap={cap} locked={locked} />
          )}
        </div>
      </div>

      {/* Stats */}
      {overview.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Flame}
            iconClass="bg-orange-500/10 text-orange-600 dark:text-orange-400"
            label="Day streak"
            value={streak}
            hint={practicedToday ? "practiced today" : undefined}
          />
          <StatCard
            icon={BookA}
            iconClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            label="Words learned"
            value={wordsLearned}
          />
          <StatCard
            icon={CheckCircle2}
            iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            label="Exercises done"
            value={exercisesDone}
          />
          <StatCard
            icon={Trophy}
            iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            label="Best streak"
            value={bestStreak}
          />
        </div>
      )}

      {/* Main area */}
      {overview.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : locked ? (
        <LockCard plan={plan} resetsAt={resetsAt} />
      ) : practicing ? (
        <Card>
          <CardContent className="p-5 sm:p-8">
            {/* Practice header */}
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {currentMeta && (
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${currentMeta.iconClass}`}>
                    <currentMeta.icon className="h-4.5 w-4.5" />
                  </div>
                )}
                <div>
                  <div className="font-semibold leading-tight">{currentMeta?.title}</div>
                  {exercises.length > 0 && !batchDone && (
                    <div className="text-xs text-muted-foreground">
                      Question {index + 1} of {exercises.length}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={endPractice}
                className="rounded-full text-muted-foreground"
                data-testid="button-end-practice"
              >
                <X className="mr-1 h-4 w-4" /> End practice
              </Button>
            </div>

            {gen.isPending ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Spinner className="h-6 w-6" />
                <p className="text-sm text-muted-foreground">Preparing your exercises…</p>
              </div>
            ) : batchDone ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <Trophy className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold" data-testid="text-round-score">
                    You got {sessionCorrect} of {exercises.length} right!
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sessionCorrect >= exercises.length - 1
                      ? "Excellent work — keep it up!"
                      : "Every mistake is a lesson. One more round?"}
                  </p>
                </div>
                {progress?.levelSuggestion && !suggestionDismissed && (
                  <div
                    className={`w-full max-w-md rounded-2xl border p-4 text-left ${
                      progress.levelSuggestion.direction === "up"
                        ? "border-primary/40 bg-primary/5"
                        : "border-amber-500/40 bg-amber-500/5"
                    }`}
                    data-testid="panel-level-suggestion"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          progress.levelSuggestion.direction === "up"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {progress.levelSuggestion.direction === "up" ? (
                          <Sparkles className="h-4.5 w-4.5" />
                        ) : (
                          <Lightbulb className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold" data-testid="text-level-suggestion-title">
                          {progress.levelSuggestion.direction === "up"
                            ? "Ready for the next level?"
                            : "Want to build confidence first?"}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {progress.levelSuggestion.direction === "up"
                            ? `You got ${Math.round(progress.levelSuggestion.accuracy * 100)}% of your last ${progress.levelSuggestion.sampleSize} answers right at ${difficulty} level — ${progress.levelSuggestion.suggested} might challenge you more.`
                            : `The last ${progress.levelSuggestion.sampleSize} questions at ${difficulty} level have been tough (${Math.round(progress.levelSuggestion.accuracy * 100)}% right). Stepping down to ${progress.levelSuggestion.suggested} can help the basics click.`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              changeDifficulty(progress.levelSuggestion!.suggested as Difficulty);
                              setSuggestionDismissed(true);
                              if (practicing) loadBatch(practicing);
                            }}
                            data-testid="button-accept-level-suggestion"
                          >
                            {progress.levelSuggestion.direction === "up" ? "Level up" : "Step down"} to{" "}
                            {progress.levelSuggestion.suggested}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-muted-foreground"
                            onClick={() => setSuggestionDismissed(true)}
                            data-testid="button-dismiss-level-suggestion"
                          >
                            Stay on {difficulty}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={() => practicing && loadBatch(practicing)}
                    className="rounded-full"
                    data-testid="button-more-exercises"
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> 5 more
                  </Button>
                  <Button variant="outline" onClick={endPractice} className="rounded-full">
                    Change mode
                  </Button>
                </div>
              </div>
            ) : exercises[index] ? (
              practicing === "translate" ? (
                <TranslateExercise
                  key={index}
                  exercise={exercises[index]}
                  language={targetLanguage}
                  onAnswered={(c) => handleAnswered(exercises[index], c)}
                  onNext={handleNext}
                  onTimeUp={handleTimeUp}
                  isLast={index === exercises.length - 1}
                />
              ) : practicing === "sentence" ? (
                <SentenceExercise
                  key={index}
                  exercise={exercises[index]}
                  language={targetLanguage}
                  onAnswered={(c) => handleAnswered(exercises[index], c)}
                  onNext={handleNext}
                  onTimeUp={handleTimeUp}
                  isLast={index === exercises.length - 1}
                />
              ) : (
                <McqExercise
                  key={index}
                  exercise={exercises[index]}
                  onAnswered={(c) => handleAnswered(exercises[index], c)}
                  onNext={handleNext}
                  isLast={index === exercises.length - 1}
                />
              )
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Language picker */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Which language do you want to learn?</h2>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => changeLanguage(l.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    targetLanguage === l.value
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-language-${l.value.toLowerCase()}`}
                >
                  <span aria-hidden>{l.flag}</span> {l.value}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty + modes */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Choose a practice mode</h2>
            <div className="flex rounded-full border bg-card p-1 shadow-sm">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => changeDifficulty(d.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    difficulty === d.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-difficulty-${d.value}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MODE_META.filter(
              (m) => m.mode !== "translate" || targetLanguage !== "English",
            ).map((m) => (
              <Card key={m.mode} className="group transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.iconClass}`}>
                    <m.icon className="h-5.5 w-5.5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                  <Button
                    onClick={() => startPractice(m.mode)}
                    className="w-full rounded-full"
                    data-testid={`button-start-${m.mode}`}
                  >
                    Start practicing <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Words learned */}
          {recentWords.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Words you've learned recently</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentWords.map((w) => (
                  <div
                    key={w.word}
                    className="rounded-xl border bg-card px-4 py-3 shadow-sm"
                    data-testid={`card-word-${w.word}`}
                  >
                    <div className="font-semibold">{w.word}</div>
                    <div className="text-sm text-muted-foreground">
                      {w.meaningBangla || w.meaning}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default memo(LanguagePage);
