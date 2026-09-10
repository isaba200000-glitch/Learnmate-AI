import { useGetDashboard, useGetProfile, getGetDashboardQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { MotionFade, MotionStagger, MotionStaggerItem } from "@/components/motion";
import EmptyState from "@/components/shared/empty-state";
import {
  BookOpen,
  Layers,
  Target,
  Timer,
  CalendarDays,
  FileText,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
  ListTodo,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { lazy, Suspense } from "react";
const WeeklyXpChart = lazy(() => import("@/components/dashboard/weekly-xp-chart").then((m) => ({ default: m.WeeklyXpChart })));

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError, refetch: refetchDashboard } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  const { data: profile, isLoading: isProfileLoading, error: profileError, refetch: refetchProfile } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() },
  });

  const isLoading = isDashboardLoading || isProfileLoading;
  const loadError = dashboardError || profileError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-80 md:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <MotionFade>
        <div className="space-y-6">
          <Card className="glass-card border-destructive/30 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive via-amber-500 to-destructive" />
            <CardContent className="p-8 text-center space-y-5">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-bold tracking-tight">Couldn't load your dashboard</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We couldn't reach the Learnova API. Make sure the backend is running on
                  {" "}<code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">http://localhost:3000</code>{" "}
                  and that you are signed in.
                </p>
                {(dashboardError || profileError) && (
                  <p className="text-xs text-muted-foreground/80 font-mono break-all mt-3 p-3 rounded-lg bg-muted/40 border border-border/40 text-left">
                    {(dashboardError as any)?.message ?? (profileError as any)?.message ?? "Unknown error"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  onClick={() => {
                    refetchDashboard();
                    refetchProfile();
                    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                  }}
                  className="rounded-full gradient-btn"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Try again
                </Button>
                <Button asChild variant="outline" className="rounded-full border-border/60">
                  <Link href="/notes">Open Notes</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </MotionFade>
    );
  }

  if (!dashboard || !profile) return null;

  // Safe fallbacks for optional/derived fields
  const weeklyXp = dashboard.weeklyXp ?? [];
  const todayTasks = dashboard.todayTasks ?? [];
  const totalWeeklyXp = weeklyXp.reduce((a, b) => a + (b.xp ?? 0), 0);
  const notesCount = dashboard.notesCount ?? 0;
  const flashcardDecksCount = dashboard.flashcardDecksCount ?? 0;
  const quizzesCompletedCount = dashboard.quizzesCompletedCount ?? 0;
  const studyTimeWeek = dashboard.studyTimeWeek ?? 0;

  return (
    <div className="space-y-8">
      {/* Profile Hero Card */}
      <MotionFade>
        <Card className="glass-card overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand-deep to-primary" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 min-w-0">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar className="h-16 w-16 ring-2 ring-primary/30 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] shrink-0">
                  <AvatarImage src={profile.photoUrl || undefined} alt={profile.name} />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-deep text-white font-bold text-xl">
                    {(profile.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight truncate">{profile.name}</h2>
                  <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
                <div className="flex items-center gap-2 rounded-full glass-card px-4 py-2 border border-border/60">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse" />
                  <span className="font-mono">{dashboard.streak}</span>
                  <span className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Streak</span>
                </div>
                <div className="flex items-center gap-2 rounded-full glass-card px-4 py-2 border border-primary/30">
                  <Award className="h-4 w-4 text-primary" />
                  <span className="font-mono">{dashboard.level}</span>
                  <span className="text-muted-foreground font-normal text-xs uppercase tracking-wider">Level</span>
                </div>
              </div>
            </div>

            {/* Activity counts row */}
            <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActivityTile
                icon={BookOpen}
                label="Notes"
                value={String(notesCount)}
                tone="primary"
              />
              <ActivityTile
                icon={Layers}
                label="Decks"
                value={String(flashcardDecksCount)}
                tone="violet"
              />
              <ActivityTile
                icon={Target}
                label="Quizzes"
                value={String(quizzesCompletedCount)}
                tone="success"
              />
              <ActivityTile
                icon={Clock}
                label="Study Time"
                value={`${Math.floor(studyTimeWeek / 60)}h ${studyTimeWeek % 60}m`}
                tone="cyan"
              />
            </div>
          </CardContent>
        </Card>
      </MotionFade>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Main Chart */}
        <MotionFade delay={0.1} className="md:col-span-2">
          <Card className="glass-card border-border/50 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2 uppercase tracking-wider">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  XP Earned This Week
                </CardTitle>
                <p className="text-xs text-muted-foreground font-medium">
                  Total:{" "}
                  <span className="font-mono text-foreground">
                    {totalWeeklyXp}
                  </span>{" "}
                  XP in 7 days
                </p>
              </div>
              <Link href="/progress">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs">
                  Details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="h-[250px] w-full mt-2 min-h-[200px] flex items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                }
              >
                <WeeklyXpChart data={weeklyXp} />
              </Suspense>
            </CardContent>
          </Card>
        </MotionFade>

        {/* Today's Tasks */}
        <MotionFade delay={0.16} className="flex flex-col">
          <Card className="glass-card border-border/50 flex flex-col h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 uppercase tracking-wider">
                <ListTodo className="h-4 w-4 text-amber-600" />
                Today's Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-1">
              {todayTasks.length > 0 ? (
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {todayTasks.map((task) => (
                      <motion.li
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0 transition-all hover:bg-muted/40 -mx-2 px-2 rounded-lg cursor-pointer group"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-colors ${
                            task.completed ? "bg-success" : "bg-primary"
                          }`}
                        >
                          {task.completed ? (
                            <Check className="h-5 w-5" strokeWidth={2.5} />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              task.completed ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.subject && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                              {task.subject}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No tasks scheduled"
                  description="Use the planner to set up today's study tasks."
                  action={
                    <Link href="/planner">
                      <Button variant="outline" size="sm">Go to Planner</Button>
                    </Link>
                  }
                  className="h-full border-0 bg-transparent"
                />
              )}
            </CardContent>
          </Card>
        </MotionFade>
      </div>

      {/* Quick Actions */}
      <MotionFade delay={0.22}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</h3>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Jump back in
          </div>
        </div>
        <MotionStagger className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
          <QuickAction href="/tutor"      label="Focus Studio" Icon={Timer}     color="violet" />
          <QuickAction href="/quizzes"    label="Take Quiz"    Icon={Target}    color="success" />
          <QuickAction href="/flashcards" label="Review Cards" Icon={Layers}    color="purple" />
          <QuickAction href="/documents"  label="Study Docs"   Icon={FileText}  color="pink" />
          <QuickAction href="/exam-prep"  label="Exam Prep"    Icon={Award}     color="orange" />
        </MotionStagger>
      </MotionFade>
    </div>
  );
}

/* ── Local helpers ───────────────────────────────────────────────────────── */

type Tone = "primary" | "violet" | "success" | "cyan" | "purple" | "pink" | "orange" | "amber";

const toneMap: Record<Tone, { bg: string; text: string; glow: string }> = {
  primary: { bg: "bg-primary",     text: "text-white", glow: "shadow-[0_0_16px_rgba(37,99,235,0.25)]" },
  violet:  { bg: "bg-brand-deep",  text: "text-white", glow: "shadow-[0_0_16px_rgba(30,58,138,0.25)]" },
  success: { bg: "bg-success",     text: "text-white", glow: "shadow-[0_0_16px_rgba(16,185,129,0.25)]" },
  cyan:    { bg: "bg-cyan-500",    text: "text-white", glow: "shadow-[0_0_16px_rgba(6,182,212,0.25)]" },
  purple:  { bg: "bg-purple-500",  text: "text-white", glow: "shadow-[0_0_16px_rgba(168,85,247,0.25)]" },
  pink:    { bg: "bg-pink-500",    text: "text-white", glow: "shadow-[0_0_16px_rgba(236,72,153,0.25)]" },
  orange:  { bg: "bg-orange-500",  text: "text-white", glow: "shadow-[0_0_16px_rgba(249,115,22,0.25)]" },
  amber:   { bg: "bg-amber-500",   text: "text-white", glow: "shadow-[0_0_16px_rgba(245,158,11,0.25)]" },
};

function ActivityTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  tone: Tone;
}) {
  const t = toneMap[tone];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${t.bg} ${t.glow}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold font-mono leading-none">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  Icon,
  color,
}: {
  href: string;
  label: string;
  Icon: typeof Timer;
  color: Tone;
}) {
  const t = toneMap[color];
  return (
    <MotionStaggerItem>
      <Link href={href} className="block h-full">
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
          whileTap={{ scale: 0.97 }}
          className="flex flex-col items-center gap-3 rounded-xl glass-card p-5 h-full group"
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl text-white ${t.bg} ${t.glow} transition-shadow group-hover:shadow-[0_0_28px_rgba(37,99,235,0.45)]`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <span className="text-xs font-semibold text-center">{label}</span>
        </motion.div>
      </Link>
    </MotionStaggerItem>
  );
}
