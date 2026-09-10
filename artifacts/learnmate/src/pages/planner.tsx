import { useState } from "react";
import { motion } from "framer-motion";
import {
  useListStudyPlans,
  useCreateStudyPlan,
  useUpdateStudyTask,
  getListStudyPlansQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";
import { FocusModeButton } from "@/components/focus/focus-mode-card";
import {
  CalendarDays, Plus, Calendar as CalendarIcon, CheckCircle2, Circle,
  Clock, Target, Crown, Sparkles, Lock, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isPast } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";

interface PlanLimits {
  isPremium: boolean;
  dailyLimit: number | null;
  used: number;
  remaining: number | null;
}

async function fetchPlanLimits(): Promise<PlanLimits> {
  const res = await fetch(apiUrl("/study-plans/limits"), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch limits");
  return res.json();
}

export default function PlannerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [planTitle,    setPlanTitle]    = useState("");
  const [examDate,     setExamDate]     = useState("");
  const [subjectsRaw,  setSubjectsRaw]  = useState("");
  const [hoursPerDay,  setHoursPerDay]  = useState("2");

  const { data: plans, isLoading } = useListStudyPlans({
    query: { queryKey: getListStudyPlansQueryKey() },
  });

  const { data: limits, refetch: refetchLimits } = useQuery<PlanLimits>({
    queryKey: ["study-plans-limits"],
    queryFn: fetchPlanLimits,
  });

  const createPlan = useCreateStudyPlan();
  const updateTask = useUpdateStudyTask();

  const canCreate = !limits || limits.isPremium || (limits.remaining !== null && limits.remaining > 0);

  const handleOpenCreate = () => {
    if (!canCreate) {
      toast({
        title: "Daily limit reached",
        description: "Free plan allows 1 AI study plan per 24 hours. Upgrade to Premium for unlimited.",
        variant: "destructive",
      });
      return;
    }
    setIsCreateOpen(true);
  };

  const handleGenerate = () => {
    if (!planTitle.trim() || !subjectsRaw.trim()) {
      toast({ title: "Please fill in the plan title and at least one subject.", variant: "destructive" });
      return;
    }
    const subjects = subjectsRaw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    createPlan.mutate(
      {
        data: {
          title: planTitle.trim(),
          examDate: examDate || undefined,
          subjects,
          studyHoursPerDay: parseInt(hoursPerDay),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Study plan created!",
            description: "Your personalised schedule is ready. Good luck!",
          });
          setIsCreateOpen(false);
          setPlanTitle(""); setExamDate(""); setSubjectsRaw(""); setHoursPerDay("2");
          queryClient.invalidateQueries({ queryKey: getListStudyPlansQueryKey() });
          refetchLimits();
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? "Failed to create plan. Please try again.";
          const isLimit = err?.status === 429;
          toast({
            title: isLimit ? "Daily limit reached" : "Failed to create plan",
            description: isLimit
              ? "Free plan allows 1 AI study plan per 24 hours. Upgrade to Premium for unlimited."
              : msg,
            variant: "destructive",
          });
          if (isLimit) {
            setIsCreateOpen(false);
            refetchLimits();
          }
        },
      }
    );
  };

  const handleToggleTask = (taskId: number, completed: boolean, planId: number) => {
    updateTask.mutate(
      { id: planId, taskId, data: { completed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudyPlansQueryKey() });
        },
        onError: () => {
          toast({ title: "Couldn't update the task. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const allTasks =
    plans
      ?.filter(p => p.status === "active")
      .flatMap(plan =>
        (plan.tasks ?? []).map(task => ({ ...task, planTitle: plan.title }))
      )
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()) ?? [];

  const todayTasks    = allTasks.filter(t => isToday(new Date(t.scheduledDate)));
  const upcomingTasks = allTasks
    .filter(t => !isToday(new Date(t.scheduledDate)) && !isPast(new Date(t.scheduledDate)))
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 max-w-6xl mx-auto overflow-x-hidden"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Study Planner</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set your exam date and subjects — AI builds a structured month-long schedule for you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Limit badge */}
          {limits && !limits.isPremium && (
            <Badge
              variant={limits.remaining === 0 ? "destructive" : "secondary"}
              className="gap-1"
            >
              <Sparkles className="h-3 w-3" />
              {limits.remaining === 0
                ? "Limit reached today"
                : `${limits.remaining} AI plan left today`}
            </Badge>
          )}
          {limits?.isPremium && (
            <Badge variant="secondary" className="gap-1">
              <Crown className="h-3 w-3 text-amber-500" /> Unlimited
            </Badge>
          )}

          <FocusModeButton />

          {/* Create button or upgrade */}
          {canCreate ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full shadow-sm gap-2 gradient-btn" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4" /> Generate Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
                <DialogHeader>
                  <DialogTitle>Create AI Study Plan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your exam details and we'll generate a day-by-day 30-day schedule covering
                    Foundation, Practice, and Review phases.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Plan Title <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={planTitle}
                      onChange={e => setPlanTitle(e.target.value)}
                      placeholder="e.g. Final Exam Prep — June"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Subjects <span className="text-destructive">*</span>
                      <span className="text-muted-foreground font-normal"> (comma-separated)</span>
                    </label>
                    <Input
                      value={subjectsRaw}
                      onChange={e => setSubjectsRaw(e.target.value)}
                      placeholder="Math, Biology, History"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Exam Date{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      type="date"
                      value={examDate}
                      onChange={e => setExamDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hours to study per day</label>
                    <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Hour</SelectItem>
                        <SelectItem value="2">2 Hours</SelectItem>
                        <SelectItem value="3">3 Hours</SelectItem>
                        <SelectItem value="4">4 Hours</SelectItem>
                        <SelectItem value="5">5+ Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={createPlan.isPending || !planTitle.trim() || !subjectsRaw.trim()}
                  >
                    {createPlan.isPending ? "Creating…" : "Create Plan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button asChild className="rounded-full gap-2">
              <Link href="/premium">
                <Crown className="h-4 w-4" /> Upgrade for More Plans
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Limit exceeded notice */}
      {limits && !limits.isPremium && limits.remaining === 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Daily AI plan limit reached</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Free plan: 1 AI study plan per 24 hours. Come back tomorrow or upgrade to Premium for unlimited plans.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 gap-1.5 rounded-xl self-start sm:self-auto">
            <Link href="/premium"><Crown className="h-3.5 w-3.5" /> Upgrade</Link>
          </Button>
        </div>
      )}

      {/* Main content: stacks on mobile, side-by-side on large screens */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Active Plans */}
        <div className="space-y-4 min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Active Plans
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
            </div>
          ) : plans?.filter(p => p.status === "active").length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border-dashed">
              <div className="icon-tile rounded-2xl h-16 w-16 mx-auto mb-4 bg-amber-500/10 text-amber-500/50">
                <CalendarDays className="h-8 w-8" />
              </div>
              <h3 className="font-medium text-lg mb-1">No active study plans</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create a plan to get a structured day-by-day study schedule.
              </p>
              {canCreate && (
                <Button onClick={() => setIsCreateOpen(true)} className="gradient-btn rounded-full">
                  <Plus className="h-4 w-4 mr-2" /> Create Plan
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {plans?.filter(p => p.status === "active").map(plan => {
                const daysLeft = plan.examDate ? Math.max(0, Math.ceil((new Date(plan.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                return (
                <Card key={plan.id} className="glass-card overflow-hidden hover:scale-[1.01] transition-all">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="icon-tile rounded-xl h-11 w-11 shrink-0 bg-amber-500 text-white">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base leading-snug break-words font-bold mb-1.5">{plan.title}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          {plan.subjects.slice(0, 2).map(s => (
                            <Badge key={s} variant="secondary" className="text-xs bg-primary/20 text-primary border-0">{s}</Badge>
                          ))}
                          {plan.subjects.length > 2 && (
                            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">+{plan.subjects.length - 2}</Badge>
                          )}
                          {daysLeft !== null && (
                            <span className="text-xs text-muted-foreground">{daysLeft}d remaining</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{plan.completedTaskCount}/{plan.taskCount} tasks</span>
                        <span className="font-bold text-primary">{Math.round((plan.completedTaskCount / Math.max(1, plan.taskCount)) * 100)}%</span>
                      </div>
                      <Progress value={(plan.completedTaskCount / Math.max(1, plan.taskCount)) * 100} className="h-1.5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 py-3 flex items-center justify-between border-t border-border/30">
                    {plan.examDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> {format(new Date(plan.examDate), "MMM d, yyyy")}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto">
                      View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </div>

        {/* Right: Today & Upcoming — on mobile comes after plans */}
        <div className="space-y-5 min-w-0">
          <Card className="glass-card flex flex-col max-h-[420px]">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {todayTasks.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {todayTasks.map((task: any) => (
                    <div key={task.id} className="p-3 flex gap-3 hover:bg-secondary/20 transition-colors items-start">
                      <button
                        className="mt-0.5 shrink-0 transition-transform active:scale-90"
                        onClick={() => handleToggleTask(task.id, !task.completed, task.planId)}
                      >
                        {task.completed
                          ? <CheckCircle2 className="h-5 w-5 text-primary" />
                          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium leading-snug mb-1 break-words ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="glass-card text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.durationMinutes}m
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{task.planTitle}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No tasks scheduled for today.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Coming Up
            </h3>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">No upcoming tasks.</p>
            ) : (
              upcomingTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card"
                >
                  <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-secondary/80 shrink-0 text-xs font-medium">
                    {format(new Date(task.scheduledDate), "d")}
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(task.scheduledDate), "MMM")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words leading-snug">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.planTitle}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
