import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useAuth } from "@clerk/react";
import { useListQuizSessions, useCreateQuizSession, useCreateQuizFromPhoto, getListQuizSessionsQueryKey, useGetQuizSession, getGetQuizSessionQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { usePremium } from "@/hooks/use-premium";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Target, CheckCircle2, XCircle, Trophy, Plus, Clock, ChevronRight, Play, Camera, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";
import { motion, AnimatePresence } from "framer-motion";
import { MotionFade, MotionStagger, MotionStaggerItem } from "@/components/motion";
import EmptyState from "@/components/shared/empty-state";

export default function QuizzesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState("10");

  const { data: sessions, isLoading } = useListQuizSessions({
    query: { queryKey: getListQuizSessionsQueryKey() },
  });

  const createSession = useCreateQuizSession();
  const photoQuiz = useCreateQuizFromPhoto();
  const { status: premiumStatus, isOwner } = usePremium();
  const isPremium = premiumStatus === "active" || isOwner;

  const handlePhotoPicked = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose a photo", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please use a photo under 8 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:image/")) return;
      photoQuiz.mutate(
        { data: { imageBase64: dataUrl, totalQuestions: 5, difficulty } },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getListQuizSessionsQueryKey() });
            setActiveSessionId(data.id);
          },
          onError: (err: any) => {
            const msg = err?.response?.data?.error ?? "Could not read that photo. Please try a clearer picture.";
            toast({ title: "Photo quiz failed", description: msg, variant: "destructive" });
          },
        },
      );
    };
    reader.readAsDataURL(file);
  };

  // Prefill from /quizzes?subject=... (e.g. from Exam Prep)
  const searchString = useSearch();
  useEffect(() => {
    const subjectParam = new URLSearchParams(searchString).get("subject");
    if (subjectParam) {
      setSubject(subjectParam);
      setIsCreateOpen(true);
    }
  }, [searchString]);

  const handleCreate = () => {
    if (!subject.trim()) {
      toast({ title: "Please enter a topic", variant: "destructive" });
      return;
    }
    createSession.mutate(
      { data: { subject: subject.trim(), difficulty, totalQuestions: parseInt(questionCount) } },
      {
        onSuccess: data => {
          queryClient.invalidateQueries({ queryKey: getListQuizSessionsQueryKey() });
          setIsCreateOpen(false);
          setActiveSessionId(data.id);
          setSubject("");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not load questions. Check your connection and try again.";
          toast({ title: "Failed to create quiz", description: msg, variant: "destructive" });
        },
      }
    );
  };

  if (activeSessionId) {
    return <QuizTakingView sessionId={activeSessionId} onExit={() => setActiveSessionId(null)} />;
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const photoQuizzesUsed = sessions?.filter(s => s.source === "photo" && new Date(s.createdAt).getTime() >= dayAgo).length ?? 0;
  const freePhotoLeft = Math.max(0, 3 - photoQuizzesUsed);
  const canSnap = isPremium || freePhotoLeft > 0;

  const completedSessions = sessions?.filter(s => s.status === "completed") || [];
  const inProgressSessions = sessions?.filter(s => s.status !== "completed") || [];
  const avgScore =
    completedSessions.length > 0
      ? Math.round(completedSessions.reduce((a, b) => a + (b.score ?? 0), 0) / completedSessions.length)
      : 0;

  if (isLoading) {
    return (
      <MotionFade className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={`h${i}`} className="h-16 w-full rounded-2xl" />)}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="glass-card rounded-2xl divide-y divide-border/30 overflow-hidden">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </MotionFade>
    );
  }

  return (
    <MotionFade className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Test your knowledge &amp; earn XP</p>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-sm px-6 h-10 gradient-btn self-start md:self-auto">
              <Plus className="h-4 w-4 mr-2" /> New Quiz
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a Quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Topic or Subject</label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. World War II, Biology, Mathematics"
                  className="h-11"
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
                <p className="text-xs text-muted-foreground">Questions are pulled from a verified trivia database.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Questions</label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!subject.trim() || createSession.isPending}>
                {createSession.isPending ? "Loading questions…" : "Start Quiz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Photo Quiz Banner */}
      <div className="glass-card rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600/90 to-violet-600/90 border-0 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-bold text-base">
                Photo Quiz
                {!isPremium && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20">
                    {freePhotoLeft} free left today
                  </span>
                )}
              </h2>
              <p className="mt-0.5 max-w-md text-sm text-white/85">
                Snap your notes or textbook — AI reads it and creates a quiz from the exact material you're studying.
                {!isPremium && " Free students get 3 photo quizzes every 24 hours."}
              </p>
            </div>
          </div>
          {canSnap ? (
            <label className="cursor-pointer shrink-0">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={photoQuiz.isPending}
                onChange={(e) => { handlePhotoPicked(e.target.files?.[0]); e.target.value = ""; }}
                data-testid="input-photo-quiz"
              />
              <span
                className={`inline-flex h-10 items-center rounded-full bg-white text-blue-600 font-semibold px-5 text-sm shadow-sm transition-opacity ${photoQuiz.isPending ? "opacity-60" : "hover:opacity-90"}`}
                data-testid="button-photo-quiz"
              >
                {photoQuiz.isPending ? "Reading photo…" : <><Camera className="mr-2 h-4 w-4" /> Snap &amp; Quiz</>}
              </span>
            </label>
          ) : (
            <Button asChild variant="outline" className="rounded-full border-white/30 text-white hover:bg-white/10 shrink-0">
              <Link href="/premium">
                <Crown className="mr-2 h-4 w-4 text-amber-300" /> Unlock Premium
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Left: History */}
        <div className="space-y-5">
          {inProgressSessions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> In Progress
              </h2>
              {inProgressSessions.map(session => (
                <div key={session.id} className="glass-card rounded-2xl flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{session.subject}</p>
                      <p className="text-xs text-muted-foreground">{session.totalQuestions} questions · Started {format(new Date(session.createdAt), "MMM d")}</p>
                    </div>
                  </div>
                  <Button size="sm" className="rounded-full px-5" onClick={() => setActiveSessionId(session.id)}>
                    <Play className="h-3.5 w-3.5 mr-1.5" fill="currentColor" /> Resume
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Quiz History
            </h2>
            {completedSessions.length > 0 && (
              <span className="text-xs text-muted-foreground font-mono">{completedSessions.length} completed</span>
            )}
          </div>

          {completedSessions.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-dashed border-border/40">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 mx-auto mb-4">
                <Trophy className="h-8 w-8 text-emerald-500/50" />
              </div>
              <h3 className="font-semibold text-base mb-1">No quizzes yet</h3>
              <p className="text-muted-foreground text-sm mb-5">Take your first quiz to test your knowledge and earn XP.</p>
              <Button onClick={() => setIsCreateOpen(true)} className="gradient-btn rounded-full">
                <Plus className="h-4 w-4 mr-2" /> Start a Quiz
              </Button>
            </div>
          ) : (
            <div className="glass-card rounded-2xl divide-y divide-border/30 overflow-hidden">
              {completedSessions.map(session => {
                const score = session.score ?? 0;
                const scoreColor = score >= 70 ? "text-emerald-400 bg-emerald-500/15" : score >= 40 ? "text-amber-400 bg-amber-500/15" : "text-red-400 bg-red-500/15";
                const tileColor = score >= 70 ? "bg-emerald-500 text-white" : score >= 40 ? "bg-amber-500 text-white" : "bg-red-500 text-white";
                return (
                  <div key={session.id} className="flex items-center gap-3 py-3.5 px-4 hover:bg-muted/20 transition-colors">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tileColor} shadow-sm`}>
                      <Target className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-0.5 truncate">{session.subject}</h3>
                      <p className="text-xs text-muted-foreground">{format(new Date(session.completedAt!), "MMM d, yyyy")}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl font-bold text-sm font-mono ${scoreColor}`}>
                      {score}%
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Stats */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Your Stats
          </h2>
          <div className="glass-card rounded-2xl divide-y divide-border/30 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Score</p>
                <p className="text-xl font-bold font-mono">{avgScore}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Quizzes Taken</p>
                <p className="text-xl font-bold font-mono">{completedSessions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm">
                <Target className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Correct Answers</p>
                <p className="text-xl font-bold font-mono">{completedSessions.reduce((a, b) => a + (b.correctAnswers ?? 0), 0)}</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 text-sm space-y-2">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">How it works</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions are sourced from the Open Trivia Database — a community-verified library of thousands of real multiple-choice questions.
            </p>
          </div>
        </div>
      </div>
    </MotionFade>
  );
}

// ─── Quiz Taking View ─────────────────────────────────────────────────────────

function QuizTakingView({ sessionId, onExit }: { sessionId: number; onExit: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { data: sessionData, isLoading } = useGetQuizSession(sessionId, {
    query: { queryKey: getGetQuizSessionQueryKey(sessionId) },
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bursting, setBursting] = useState<string | null>(null);

  useEffect(() => { setBursting(null); }, [currentIndex]);

  const handleSubmit = async () => {
    if (!sessionData) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const answersArray = Object.entries(answers).map(([qId, ans]) => ({
        questionId: parseInt(qId),
        answer: ans,
      }));

      const res = await fetch(apiUrl(`/quiz-sessions/${sessionId}/submit`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answers: answersArray }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: getGetQuizSessionQueryKey(sessionId) });
      queryClient.invalidateQueries({ queryKey: getListQuizSessionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    } catch (e) {
      console.error("Quiz submit error:", e);
      toast({
        title: "Couldn't submit your answers",
        description: "Check your connection and try again — your answers are still here.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MotionFade>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="w-full text-center space-y-4">
            <Skeleton className="h-[400px] w-full max-w-[600px] mx-auto rounded-3xl" />
            <p className="text-muted-foreground text-sm">Loading questions…</p>
          </div>
        </div>
      </MotionFade>
    );
  }

  if (!sessionData) return null;

  const session = sessionData as any;
  const questions: any[] = session.questions || [];

  // Results view
  if (isSubmitted || sessionData.status === "completed") {
    return (
      <MotionFade>
        <div className="max-w-3xl mx-auto py-8">
          <div className="text-center mb-10 space-y-4">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10 text-success mb-4 ring-8 ring-success/5"
            >
              <Trophy className="h-10 w-10" />
            </motion.div>
            <h2 className="text-4xl font-extrabold tracking-tight">Quiz Complete!</h2>
            <div className="flex justify-center gap-8 text-lg">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-primary font-mono">{sessionData.score}%</span>
                <span className="text-sm text-muted-foreground">Score</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold font-mono">{sessionData.correctAnswers}/{sessionData.totalQuestions}</span>
                <span className="text-sm text-muted-foreground">Correct</span>
              </div>
            </div>
          </div>

                {session.source === "photo" && session.imageUrl && (
          <Card className="glass-card border-border/50 mb-6 overflow-hidden" data-testid="card-quiz-source-photo">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your photographed page
                </p>
                <a
                  href={session.imageUrl}
                  download="quiz-photo.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  Open full size
                </a>
              </div>
              <img
                src={session.imageUrl}
                alt="The page you photographed for this quiz"
                className="w-full rounded-xl border border-border/40"
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Reviewing the original page alongside the questions helps you see where each answer came from.
              </p>
            </CardContent>
          </Card>
        )}

        <MotionStagger className="space-y-5">
          <MotionStaggerItem>
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-3">Review Answers</h3>
          </MotionStaggerItem>
          {questions.map((q: any, i: number) => (
            <MotionStaggerItem key={q.id}>
              <Card className={`glass-card border-l-4 ${q.isCorrect ? "border-l-success" : "border-l-destructive"}`}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="mt-1">
                      {q.isCorrect
                        ? <CheckCircle2 className="h-5 w-5 text-success" />
                        : <XCircle className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-base mb-4">{i + 1}. {q.question}</p>
                      <div className="space-y-2 mb-4">
                        {q.options.map((opt: string) => {
                          const isUser = q.userAnswer === opt;
                          const isCorrect = q.correctAnswer === opt;
                          const cls =
                            isCorrect
                              ? "border-success/40 bg-success/10 text-success"
                              : isUser
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : "border-border/40 bg-background/50 text-muted-foreground";
                          return (
                            <div key={opt} className={`p-3 rounded-xl border ${cls} text-sm flex items-center gap-2`}>
                              {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                              {isUser && !isCorrect && <XCircle className="h-4 w-4" />}
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className="rounded-xl bg-secondary/40 border border-border/40 p-3 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">Explanation: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </MotionStaggerItem>
          ))}
        </MotionStagger>

        <div className="flex justify-center mt-8">
          <Button size="lg" onClick={onExit} className="rounded-full px-12">Return to Quizzes</Button>
        </div>
      </div>
      </MotionFade>
    );
  }

  // Taking view
  const currentQ = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;
  const isLast = currentIndex === questions.length - 1;
  const hasAnswered = !!answers[currentQ?.id];

  if (!currentQ) return null;

  return (
    <MotionFade className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Badge variant="secondary" className="mb-2">{sessionData.subject}</Badge>
          <h2 className="text-xl font-bold">Question {currentIndex + 1} of {questions.length}</h2>
        </div>
        <Button variant="ghost" onClick={onExit} className="rounded-full">Exit Quiz</Button>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary mb-8">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-deep to-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="glass-card border-border/50 shadow-lg">
            <CardHeader className="pb-6">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-xl leading-relaxed">{currentQ.question}</CardTitle>
                {session.source === "photo" && session.imageUrl && (
                  <details className="shrink-0 text-xs">
                    <summary className="cursor-pointer rounded-full border border-border/60 bg-secondary/30 px-3 py-1 text-muted-foreground hover:text-foreground transition-colors list-none">
                      View photo
                    </summary>
                    <img
                      src={session.imageUrl}
                      alt="Your photographed page"
                      className="mt-2 max-h-72 rounded-xl border border-border/40 shadow-sm"
                    />
                  </details>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {currentQ.options.map((opt: string, idx: number) => {
                const isSelected = answers[currentQ.id] === opt;
                const isBursting = isSelected && bursting === opt;
                return (
                  <motion.button
                    key={opt}
                    initial={{ opacity: 0, y: 6 }}
                    animate={isBursting ? { scale: [1, 1.04, 0.97, 1.01, 1] } : { opacity: 1, y: 0, scale: 1 }}
                    transition={isBursting ? { duration: 0.35, ease: [0.22, 1, 0.36, 1] } : { duration: 0.2, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => { if (!isSelected) { setAnswers(p => ({ ...p, [currentQ.id]: opt })); setBursting(opt); setTimeout(() => setBursting(null), 400); } }}
                    className={`relative w-full text-left p-4 rounded-2xl border-2 transition-colors duration-200 text-base ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-[0_0_0_4px_hsl(217_91%_60%_/_0.08)]"
                        : "border-border/50 bg-background hover:border-primary/50 hover:bg-secondary/50"
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="quiz-option-check"
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </motion.span>
                    )}
                    {opt}
                  </motion.button>
                );
              })}
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/50 bg-secondary/10">
              <div className="flex justify-between w-full items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-full"
                >
                  Previous
                </Button>
                {isLast ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!hasAnswered || submitting}
                    className="rounded-full px-8"
                  >
                    {submitting ? "Submitting…" : "Submit Quiz"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentIndex(p => p + 1)}
                    disabled={!hasAnswered}
                    className="rounded-full px-8"
                  >
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </MotionFade>
  );
}
