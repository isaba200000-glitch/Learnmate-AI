import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-url";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  Cpu,
  Lock,
  Loader2,
  Sparkles,
  BookOpen,
  RotateCcw,
  BrainCircuit,
  Trophy,
  Image as ImageIcon,
} from "lucide-react";

interface QuizQuestion {
  q: string;
  options: string[];
  answer: string; // "A", "B", "C", or "D"
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessonMeta {
  index: number;
  title: string;
  summary: string;
  isPremium: boolean;
  completed: boolean;
}

interface TopicMeta {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
  totalLessons: number;
  completedLessons: number;
  lessons: LessonMeta[];
}

interface Limits {
  isPremium: boolean;
  dailyLimit: number | null;
  used: number;
  remaining: number | null;
}

interface OverviewData {
  topics: TopicMeta[];
  limits: Limits;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const { getAuthToken } = await import("@workspace/api-client-react");
  const token = await getAuthToken();
  const res = await fetch(apiUrl(url), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? "Request failed"), { status: res.status, data: body });
  return body as T;
}

const OVERVIEW_KEY = ["courses", "overview"];

// ─── Photo attribution (Pexels licence requires visible credit) ───────────────

interface ImageData {
  imageUrl: string;
  photographerName?: string | null;
  photographerUrl?: string | null;
}

/** Small unobtrusive "Photo: Name · Pexels" credit line. Renders nothing for curated fallbacks. */
function PhotoCredit({ image, overlay = false, linked = true }: { image?: ImageData; overlay?: boolean; linked?: boolean }) {
  if (!image?.photographerName) return null;
  const text = <>Photo: {image.photographerName} · Pexels</>;
  const cls = overlay
    ? "absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] leading-none text-white/90"
    : "text-[10px] text-muted-foreground/80";
  if (linked && image.photographerUrl) {
    return (
      <a
        href={image.photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(cls, "hover:underline")}
      >
        {text}
      </a>
    );
  }
  return <span className={cls}>{text}</span>;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string; progress: string }> = {
  sky:    { bg: "bg-sky-500/10",    border: "border-sky-500/20",    text: "text-sky-600 dark:text-sky-400",    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",    progress: "bg-sky-500" },
  amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300", progress: "bg-amber-500" },
  green:  { bg: "bg-green-500/10",  border: "border-green-500/20",  text: "text-green-600 dark:text-green-400", badge: "bg-green-500/15 text-green-700 dark:text-green-300", progress: "bg-green-500" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300", progress: "bg-violet-500" },
  rose:   { bg: "bg-rose-500/10",   border: "border-rose-500/20",   text: "text-rose-600 dark:text-rose-400",   badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",   progress: "bg-rose-500" },
  teal:   { bg: "bg-teal-500/10",   border: "border-teal-500/20",   text: "text-teal-600 dark:text-teal-400",   badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300",   progress: "bg-teal-500" },
};

function colors(color: string) {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES["sky"];
}

// ─── Topic grid view ──────────────────────────────────────────────────────────

function TopicCard({ topic, onSelect }: { topic: TopicMeta; onSelect: () => void }) {
  const c = colors(topic.color);
  const pct = topic.totalLessons > 0 ? Math.round((topic.completedLessons / topic.totalLessons) * 100) : 0;

  const imageQuery = useQuery<ImageData>({
    queryKey: ["courses", "image", "topic", topic.slug],
    queryFn: () => apiFetch(`/courses/image/topic/${topic.slug}`),
    staleTime: Infinity, // images never change once generated
    retry: false,
  });

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group w-full overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
        c.border, c.bg,
      )}
    >
      {/* Hero illustration */}
      <div className={cn("relative h-32 w-full overflow-hidden", c.bg)}>
        {imageQuery.data?.imageUrl ? (
          <img
            src={imageQuery.data.imageUrl}
            alt={topic.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center", c.bg)}>
            {imageQuery.isError ? (
              <span className="text-5xl leading-none">{topic.emoji}</span>
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
          </div>
        )}
        {/* Emoji badge overlay */}
        <div className="absolute bottom-2 right-2 rounded-xl bg-white/80 px-2 py-1 text-2xl leading-none shadow-sm dark:bg-black/50">
          {topic.emoji}
        </div>
        {/* Pexels attribution — no <a> inside this <button>, plain text credit */}
        <PhotoCredit image={imageQuery.data} overlay linked={false} />
        {topic.completedLessons > 0 && (
          <div className="absolute left-2 top-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm", c.badge)}>
              {topic.completedLessons}/{topic.totalLessons} done
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className={cn("text-lg font-bold", c.text)}>{topic.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{topic.totalLessons} lessons</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full transition-all", c.progress)} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className={cn("mt-3 flex items-center gap-1 text-xs font-medium", c.text)}>
          {pct === 100 ? "Completed ✓" : pct > 0 ? "Continue →" : "Start learning →"}
        </div>
      </div>
    </button>
  );
}

// ─── Lesson list view ─────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  topicColor,
  isPremiumUser,
  onSelect,
  active,
}: {
  lesson: LessonMeta;
  topicColor: string;
  isPremiumUser: boolean;
  onSelect: () => void;
  active: boolean;
}) {
  const c = colors(topicColor);
  const locked = lesson.isPremium && !isPremiumUser;
  return (
    <button
      onClick={locked ? undefined : onSelect}
      disabled={locked}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
        active ? cn("border-primary/40 bg-primary/5") : "border-border hover:bg-secondary/50",
        locked && "cursor-not-allowed opacity-60",
      )}
    >
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", lesson.completed ? "bg-green-500/15 text-green-600" : c.bg, c.text)}>
        {lesson.completed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : lesson.index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium leading-snug [overflow-wrap:anywhere]", active && "text-primary")}>{lesson.title}</p>
        <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{lesson.summary}</p>
      </div>
      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground", active && "text-primary")} />
      )}
    </button>
  );
}

// ─── Lesson content view ──────────────────────────────────────────────────────

function LessonView({
  topic,
  lesson,
  limits,
  onBack,
  onComplete,
}: {
  topic: TopicMeta;
  lesson: LessonMeta;
  limits: Limits;
  onBack: () => void;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  // Quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const loadQuiz = async () => {
    setQuizOpen(true);
    setQuizQuestions([]);
    setAnswers({});
    setQuizSubmitted(false);
    setQuizLoading(true);
    try {
      const res = await apiFetch<{ questions: QuizQuestion[] }>("/courses/quiz", {
        method: "POST",
        body: JSON.stringify({ topic: topic.slug, lessonIndex: lesson.index }),
      });
      setQuizQuestions(res.questions);
    } catch (err: any) {
      setQuizOpen(false);
      if (err?.status === 403) {
        toast({
          title: "Premium feature",
          description: "AI Practice Quiz requires Premium. Upgrade to unlock.",
          variant: "destructive",
        });
      } else {
        toast({ title: err?.data?.error ?? "Could not load quiz. Please try again.", variant: "destructive" });
      }
    } finally {
      setQuizLoading(false);
    }
  };

  const score = quizSubmitted
    ? quizQuestions.filter((q, i) => answers[i] === q.answer).length
    : 0;

  const generateMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ content: string; cached: boolean }>("/courses/lesson", {
        method: "POST",
        body: JSON.stringify({ topic: topic.slug, lessonIndex: lesson.index }),
      }),
    onSuccess: (data) => {
      setContent(data.content);
      // Refresh overview to update usage count
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
    onError: (err: { status?: number; data?: { error?: string } }) => {
      if (err.status === 429 || err.status === 403) {
        setLimitHit(true);
      } else {
        toast({ title: err.data?.error ?? "Could not load lesson. Please try again.", variant: "destructive" });
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiFetch("/courses/lesson/complete", {
        method: "POST",
        body: JSON.stringify({ topic: topic.slug, lessonIndex: lesson.index }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      onComplete();
    },
  });

  const c = colors(topic.color);

  // Topic hero image — already pre-warmed at startup, returns instantly from cache.
  // Used as an immediate visual in the pre-load screen and as a placeholder
  // while the lesson-specific image generates in the background.
  const topicImageQuery = useQuery<ImageData>({
    queryKey: ["courses", "image", "topic", topic.slug],
    queryFn: () => apiFetch(`/courses/image/topic/${topic.slug}`),
    staleTime: Infinity,
    retry: false,
  });

  // Lesson illustration — start fetching immediately when the lesson opens,
  // not after content loads, so the image is often ready by the time the student reads.
  const lessonImageQuery = useQuery<ImageData>({
    queryKey: ["courses", "image", "lesson", topic.slug, lesson.index],
    queryFn: () => apiFetch(`/courses/image/lesson/${topic.slug}/${lesson.index}`),
    staleTime: Infinity,
    retry: false,
  });

  // Step-by-step visual guide images — also start immediately.
  const stepImagesQuery = useQuery<{ steps: ({ stepNumber: number; stepLabel: string } & ImageData)[] }>({
    queryKey: ["courses", "image", "lesson", topic.slug, lesson.index, "steps"],
    queryFn: () => apiFetch(`/courses/image/lesson/${topic.slug}/${lesson.index}/steps`),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2 border-b px-3 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", c.text)}>{topic.emoji} {topic.title}</p>
          <h2 className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{lesson.title}</h2>
        </div>
        {lesson.completed && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500 mt-1" />}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full p-4 pb-6">
          {!content && !generateMutation.isPending && !limitHit && (
            <div className="flex flex-col items-center gap-5 text-center">
              {/* Show project image immediately — uses cached topic hero while lesson image warms up */}
              <div className="relative w-full overflow-hidden rounded-2xl">
                {(lessonImageQuery.data?.imageUrl ?? topicImageQuery.data?.imageUrl) ? (
                  <>
                    <img
                      src={lessonImageQuery.data?.imageUrl ?? topicImageQuery.data?.imageUrl}
                      alt={lesson.title}
                      className="h-52 w-full object-cover"
                    />
                    <PhotoCredit image={lessonImageQuery.data?.imageUrl ? lessonImageQuery.data : topicImageQuery.data} overlay />
                  </>
                ) : (
                  <div className={cn("flex h-52 w-full items-center justify-center text-6xl", c.bg)}>
                    {topicImageQuery.isLoading ? <Skeleton className="h-full w-full rounded-none" /> : topic.emoji}
                  </div>
                )}
              </div>
              <div className="px-2">
                <h3 className="text-lg font-bold">{lesson.title}</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">{lesson.summary}</p>
              </div>
              {limits.remaining !== null && (
                <p className="text-xs text-muted-foreground">
                  {limits.remaining} free lesson{limits.remaining !== 1 ? "s" : ""} left today
                </p>
              )}
              <Button onClick={() => generateMutation.mutate()} className="gap-2 rounded-xl px-8">
                <Sparkles className="h-4 w-4" /> Load Lesson
              </Button>
            </div>
          )}

          {generateMutation.isPending && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparing your lesson…</p>
            </div>
          )}

          {limitHit && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
              <Crown className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h3 className="font-bold">
                {limits.remaining === 0 ? "Daily limit reached" : "Premium lesson"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {limits.remaining === 0
                  ? `You've used your ${limits.dailyLimit} free lessons for today. Upgrade to Premium for unlimited access — or come back tomorrow.`
                  : "This lesson is part of the Premium curriculum. Upgrade to unlock all 7 lessons per course."}
              </p>
              <Button asChild className="mt-4 gap-2 rounded-xl">
                <Link href="/premium"><Crown className="h-4 w-4" /> Upgrade to Premium</Link>
              </Button>
            </div>
          )}

          {content && (
            <div className="space-y-4">
              {/* Lesson illustration */}
              {lessonImageQuery.data?.imageUrl && (
                <div className="relative overflow-hidden rounded-2xl">
                  <img
                    src={lessonImageQuery.data.imageUrl}
                    alt={lesson.title}
                    className="h-44 w-full object-cover sm:h-52"
                  />
                  <PhotoCredit image={lessonImageQuery.data} overlay />
                </div>
              )}
              {lessonImageQuery.isLoading && (
                <Skeleton className="h-44 w-full rounded-2xl sm:h-52" />
              )}
              <Markdown content={content} />

              {/* Step-by-step visual guide */}
              {(stepImagesQuery.data?.steps?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> Visual Guide
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {stepImagesQuery.data!.steps.map((step) => (
                      <div key={step.stepNumber} className="flex-1 min-w-[110px] max-w-[180px] shrink-0 space-y-1">
                        <div className="overflow-hidden rounded-xl aspect-square bg-muted">
                          <img
                            src={step.imageUrl}
                            alt={step.stepLabel}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="text-center text-[10px] font-medium leading-tight text-muted-foreground [overflow-wrap:anywhere]">
                          {step.stepLabel}
                        </p>
                        <p className="text-center leading-tight">
                          <PhotoCredit image={step} />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stepImagesQuery.isLoading && content !== null && (
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded-md bg-muted" />
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="aspect-square rounded-xl flex-1 min-w-[110px] max-w-[180px] shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-secondary/30 py-6 text-center">
                {lesson.completed ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <p className="font-semibold text-green-600 dark:text-green-400">Lesson completed!</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" onClick={() => { setContent(null); generateMutation.mutate(); }} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Review again
                      </Button>
                      <Button variant="outline" onClick={loadQuiz} disabled={quizLoading} className="gap-2 border-primary/30 text-primary hover:bg-primary/5">
                        {quizLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                        Practice Quiz
                        <span className="ml-0.5 rounded-sm bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">PRO</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Finished reading?</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        onClick={() => completeMutation.mutate()}
                        disabled={completeMutation.isPending}
                        className="gap-2 rounded-xl"
                      >
                        {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Mark as complete
                      </Button>
                      <Button variant="outline" onClick={loadQuiz} disabled={quizLoading} className="gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5">
                        {quizLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                        Practice Quiz
                        <span className="ml-0.5 rounded-sm bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">PRO</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Quiz section */}
              {quizOpen && (
                <div className="rounded-2xl border border-primary/20 bg-primary/3 p-5 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold text-sm">
                      <BrainCircuit className="h-4 w-4 text-primary" /> AI Practice Quiz
                    </h3>
                    <button
                      onClick={() => { setQuizOpen(false); setQuizSubmitted(false); setAnswers({}); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Close
                    </button>
                  </div>

                  {quizLoading && (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Generating quiz questions…</p>
                    </div>
                  )}

                  {!quizLoading && quizQuestions.length > 0 && (
                    <div className="space-y-5">
                      {quizQuestions.map((q, qi) => (
                        <div key={qi} className="space-y-2">
                          <p className="text-sm font-medium leading-snug">
                            <span className="font-bold text-primary mr-1">{qi + 1}.</span> {q.q}
                          </p>
                          <div className="space-y-1.5">
                            {q.options.map((opt) => {
                              const letter = opt.charAt(0); // "A", "B", "C", "D"
                              const isSelected = answers[qi] === letter;
                              const isCorrect  = quizSubmitted && letter === q.answer;
                              const isWrong    = quizSubmitted && isSelected && letter !== q.answer;
                              return (
                                <button
                                  key={opt}
                                  disabled={quizSubmitted}
                                  onClick={() => !quizSubmitted && setAnswers(a => ({ ...a, [qi]: letter }))}
                                  className={cn(
                                    "w-full rounded-lg border px-3 py-2 text-left text-xs transition-all",
                                    isCorrect ? "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400" :
                                    isWrong   ? "border-red-400/60 bg-red-400/10 text-red-600 dark:text-red-400" :
                                    isSelected ? "border-primary/60 bg-primary/10" :
                                    "border-border hover:border-primary/30 hover:bg-secondary/50"
                                  )}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {!quizSubmitted ? (
                        <Button
                          onClick={() => setQuizSubmitted(true)}
                          disabled={Object.keys(answers).length < quizQuestions.length}
                          className="w-full rounded-xl gap-2"
                          size="sm"
                        >
                          Submit Answers
                        </Button>
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-center space-y-2">
                          <Trophy className={cn("h-8 w-8 mx-auto", score >= 4 ? "text-amber-500" : "text-muted-foreground")} />
                          <p className="font-bold text-lg">{score}/{quizQuestions.length}</p>
                          <p className="text-sm text-muted-foreground">
                            {score === quizQuestions.length ? "Perfect score! You've mastered this lesson." :
                             score >= 3 ? "Great job! A couple more reviews and you'll have it." :
                             "Keep reviewing the lesson — you've got this!"}
                          </p>
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => { setAnswers({}); setQuizSubmitted(false); }}>
                            <RotateCcw className="h-3.5 w-3.5" /> Try again
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const queryClient = useQueryClient();
  const overview = useQuery<OverviewData>({
    queryKey: OVERVIEW_KEY,
    queryFn: () => apiFetch("/courses/overview"),
  });

  const [selectedTopic, setSelectedTopic] = useState<TopicMeta | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonMeta | null>(null);

  const data = overview.data;
  const limits = data?.limits;

  // Refresh topic/lesson objects from latest data
  const liveTopic = selectedTopic
    ? (data?.topics.find((t) => t.slug === selectedTopic.slug) ?? selectedTopic)
    : null;
  const liveLesson = selectedLesson && liveTopic
    ? (liveTopic.lessons.find((l) => l.index === selectedLesson.index) ?? selectedLesson)
    : null;

  if (overview.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── Lesson content view (full screen on mobile) ──
  if (liveTopic && liveLesson && limits) {
    return (
      <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col overflow-hidden sm:-m-6 lg:-m-8">
        <LessonView
          topic={liveTopic}
          lesson={liveLesson}
          limits={limits}
          onBack={() => setSelectedLesson(null)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
            setSelectedLesson(null);
          }}
        />
      </div>
    );
  }

  // ── Topic detail: lesson list ──
  if (liveTopic && limits) {
    const c = colors(liveTopic.color);
    const pct = liveTopic.totalLessons > 0
      ? Math.round((liveTopic.completedLessons / liveTopic.totalLessons) * 100)
      : 0;

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Back + header */}
        <button
          onClick={() => setSelectedTopic(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All courses
        </button>

        <div className={cn("rounded-2xl border p-5", c.bg, c.border)}>
          <div className="flex items-center gap-3">
            <span className="text-5xl">{liveTopic.emoji}</span>
            <div>
              <h1 className={cn("text-2xl font-bold", c.text)}>{liveTopic.title}</h1>
              <p className="text-sm text-muted-foreground">{liveTopic.description}</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{liveTopic.completedLessons} of {liveTopic.totalLessons} lessons completed</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all", c.progress)} style={{ width: `${pct}%` }} />
            </div>
          </div>
          {limits && limits.remaining !== null && (
            <p className="mt-3 text-xs text-muted-foreground">
              {limits.remaining} free lesson{limits.remaining !== 1 ? "s" : ""} remaining today
            </p>
          )}
        </div>

        {/* Lesson list */}
        <div className="space-y-2">
          {liveTopic.lessons.map((lesson) => (
            <LessonRow
              key={lesson.index}
              lesson={lesson}
              topicColor={liveTopic.color}
              isPremiumUser={limits?.isPremium ?? false}
              onSelect={() => setSelectedLesson(lesson)}
              active={false}
            />
          ))}
        </div>

        {!limits.isPremium && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm">
              <Crown className="mb-1 inline h-4 w-4 text-primary" />{" "}
              Lessons 5–7 in every course require <strong>Premium</strong>.{" "}
              Upgrade for unlimited lessons and the full curriculum.
            </p>
            <Button asChild size="sm" className="mt-2 gap-1.5 rounded-xl">
              <Link href="/premium"><Crown className="h-3.5 w-3.5" /> Upgrade</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Topic grid (default view) ──
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Cpu className="h-6 w-6 text-primary" /> Tech Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Robotics, electronics, coding, AI and more — beginner-friendly, AI-powered lessons.
          </p>
        </div>
        {limits && limits.remaining !== null && (
          <Badge variant={limits.remaining === 0 ? "destructive" : "secondary"} className="shrink-0">
            <BookOpen className="mr-1 h-3 w-3" />
            {limits.remaining} free lesson{limits.remaining !== 1 ? "s" : ""} left today
          </Badge>
        )}
        {limits?.isPremium && (
          <Badge variant="secondary" className="shrink-0">
            <Sparkles className="mr-1 h-3 w-3 text-primary" /> Unlimited access
          </Badge>
        )}
      </div>

      {/* How it works banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              Pick a topic
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              Choose a lesson
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
              AI explains it clearly
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
              Mark complete & track progress
            </div>
          </div>
          {limits && !limits.isPremium && (
            <p className="mt-3 text-xs text-muted-foreground">
              Free plan: {limits.dailyLimit} lessons per day · Lessons 1–4 in every course are free · Upgrade for unlimited access
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.topics ?? []).map((topic) => (
          <TopicCard key={topic.slug} topic={topic} onSelect={() => setSelectedTopic(topic)} />
        ))}
      </div>
    </div>
  );
}
