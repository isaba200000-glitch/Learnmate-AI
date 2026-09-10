import { useState } from "react";
import { Link } from "wouter";
import {
  useListExamPlans,
  getListExamPlansQueryKey,
  useCreateExamPlan,
  useGetExamPlan,
  getGetExamPlanQueryKey,
  useDeleteExamPlan,
  useRegenerateExamPlan,
  useUpdateExamPlanDay,
  type ExamPlanSummary,
  type ExamPlanDay,
  type CreateExamPlanInputBatch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isPast, differenceInCalendarDays } from "date-fns";
import {
  CalendarClock,
  ChevronDown,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { FocusModeButton } from "@/components/focus/focus-mode-card";

const BATCHES: { id: CreateExamPlanInputBatch; name: string; note: string }[] = [
  { id: "gcse", name: "GCSE", note: "UK secondary (AQA, Edexcel, OCR)" },
  { id: "a-level", name: "A Level", note: "UK advanced qualifications" },
  { id: "ssc", name: "SSC", note: "Bangladesh secondary (NCTB)" },
  { id: "hsc", name: "HSC", note: "Bangladesh higher secondary (NCTB)" },
];

const batchName = (id: string) => BATCHES.find((b) => b.id === id)?.name ?? id.toUpperCase();

function errText(err: unknown, fallback: string): string {
  return (err as { data?: { error?: string } | null } | null)?.data?.error ?? fallback;
}

export default function ExamPlannerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const list = useListExamPlans({ query: { queryKey: getListExamPlansQueryKey() } });
  const plans = list.data?.plans ?? [];
  const limits = list.data?.limits;

  const activeId = selectedId ?? plans[0]?.id ?? null;
  const detail = useGetExamPlan(activeId ?? 0, {
    query: { queryKey: getGetExamPlanQueryKey(activeId ?? 0), enabled: activeId !== null },
  });

  const invalidateAll = (planId?: number) => {
    queryClient.invalidateQueries({ queryKey: getListExamPlansQueryKey() });
    if (planId) queryClient.invalidateQueries({ queryKey: getGetExamPlanQueryKey(planId) });
  };

  // ── Wizard state ──
  const [batch, setBatch] = useState<CreateExamPlanInputBatch | null>(null);
  const [subjectsRaw, setSubjectsRaw] = useState("");
  const [examDate, setExamDate] = useState("");
  const [weakRaw, setWeakRaw] = useState("");

  const createPlan = useCreateExamPlan();
  const deletePlan = useDeleteExamPlan();
  const regenerate = useRegenerateExamPlan();
  const updateDay = useUpdateExamPlanDay();
  const [adjustment, setAdjustment] = useState("");

  const openWizard = () => {
    if (limits && !limits.canCreate) {
      toast({
        title: "Free accounts can have 1 active exam plan",
        description: "Upgrade to Premium for unlimited plans, longer schedules and deeper explanations.",
        variant: "destructive",
      });
      return;
    }
    setWizardOpen(true);
  };

  const handleCreate = () => {
    const subjects = subjectsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!batch) {
      toast({ title: "Please pick your batch", variant: "destructive" });
      return;
    }
    if (subjects.length === 0) {
      toast({ title: "Please add at least one subject", variant: "destructive" });
      return;
    }
    if (!examDate) {
      toast({ title: "Please pick your exam date", variant: "destructive" });
      return;
    }

    createPlan.mutate(
      {
        data: {
          batch,
          subjects,
          examDate,
          weakTopics: weakRaw.split(",").map((s) => s.trim()).filter(Boolean),
        },
      },
      {
        onSuccess: (res) => {
          setWizardOpen(false);
          setSubjectsRaw("");
          setWeakRaw("");
          setSelectedId(res.plan.id);
          invalidateAll(res.plan.id);
          toast({ title: "Your study plan is ready!", description: `${res.days.length} study days planned.` });
        },
        onError: (err) =>
          toast({ title: errText(err, "Plan generation failed. Please try again."), variant: "destructive" }),
      },
    );
  };

  const handleToggleDay = (day: ExamPlanDay) => {
    if (!activeId) return;
    updateDay.mutate(
      { planId: activeId, dayId: day.id, data: { completed: !day.completed } },
      {
        onSuccess: () => invalidateAll(activeId),
        onError: (err) => toast({ title: errText(err, "Could not update the day"), variant: "destructive" }),
      },
    );
  };

  const handleRegenerate = () => {
    if (!activeId) return;
    regenerate.mutate(
      { planId: activeId, data: { adjustment: adjustment.trim() || undefined } },
      {
        onSuccess: () => {
          setRegenOpen(false);
          setAdjustment("");
          invalidateAll(activeId);
          toast({ title: "Plan regenerated!" });
        },
        onError: (err) =>
          toast({ title: errText(err, "Regeneration failed. Please try again."), variant: "destructive" }),
      },
    );
  };

  const handleDelete = (plan: ExamPlanSummary) => {
    deletePlan.mutate(
      { planId: plan.id },
      {
        onSuccess: () => {
          if (selectedId === plan.id) setSelectedId(null);
          invalidateAll(plan.id);
          toast({ title: "Plan deleted" });
        },
        onError: (err) => toast({ title: errText(err, "Could not delete the plan"), variant: "destructive" }),
      },
    );
  };

  const isPremiumish = limits ? limits.plan !== "free" : false;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold" data-testid="text-page-title">
            <CalendarClock className="h-6 w-6 text-primary" /> Exam Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-built day-by-day study plans for GCSE, A Level, SSC &amp; HSC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FocusModeButton />
          <Button onClick={openWizard} data-testid="button-new-plan">
            <Plus className="mr-1 h-4 w-4" /> New plan
          </Button>
        </div>
      </div>

      {limits && !isPremiumish && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-free-limits">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              Free plan: <b>1 active exam plan</b>, up to <b>{limits.maxHorizonDays} study days</b> with basic
              explanations. Premium unlocks unlimited plans, up to 60 days, deeper explanations and regeneration.
            </p>
            <Button asChild size="sm" variant="default" data-testid="button-upgrade-premium">
              <Link href="/premium">
                <Crown className="mr-1 h-4 w-4" /> Upgrade
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="py-12 text-center" data-testid="card-empty-state">
          <CardContent className="space-y-3">
            <Sparkles className="mx-auto h-10 w-10 text-primary" />
            <h2 className="text-lg font-semibold">Plan your way to exam day</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Tell us your batch, subjects, exam date and weak topics — the AI builds a day-by-day study
              schedule with clear explanations for every topic.
            </p>
            <Button onClick={openWizard} data-testid="button-create-first-plan">
              <Plus className="mr-1 h-4 w-4" /> Create my study plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  activeId === p.id && "border-primary bg-accent",
                )}
                data-testid={`card-plan-${p.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{batchName(p.batch)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.examDate), "d MMM")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{p.title}</p>
                <Progress className="mt-2 h-1.5" value={p.dayCount ? (p.completedDayCount / p.dayCount) * 100 : 0} />
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {detail.isLoading || !detail.data ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <PlanDetail
                plan={detail.data.plan}
                days={detail.data.days}
                isPremiumish={isPremiumish}
                onToggleDay={handleToggleDay}
                onDelete={() => handleDelete(detail.data.plan)}
                onRegenerate={() =>
                  isPremiumish
                    ? setRegenOpen(true)
                    : toast({
                        title: "Plan regeneration is a Premium feature",
                        description: "Upgrade to adjust and regenerate your plans anytime.",
                        variant: "destructive",
                      })
                }
                deleting={deletePlan.isPending}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Create wizard ── */}
      <Dialog open={wizardOpen} onOpenChange={(o) => !createPlan.isPending && setWizardOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create your exam plan</DialogTitle>
            <DialogDescription>The AI will build a day-by-day schedule for your batch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Your batch</p>
              <div className="grid grid-cols-2 gap-2">
                {BATCHES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBatch(b.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                      batch === b.id && "border-primary bg-accent",
                    )}
                    data-testid={`button-batch-${b.id}`}
                  >
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.note}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Subjects (comma-separated)</p>
              <Input
                placeholder="e.g. Physics, Chemistry, Maths"
                value={subjectsRaw}
                onChange={(e) => setSubjectsRaw(e.target.value)}
                data-testid="input-subjects"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Exam date</p>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                data-testid="input-exam-date"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">
                Weak topics <span className="text-muted-foreground">(optional, comma-separated)</span>
              </p>
              <Input
                placeholder="e.g. Vectors, Organic chemistry"
                value={weakRaw}
                onChange={(e) => setWeakRaw(e.target.value)}
                data-testid="input-weak-topics"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createPlan.isPending} data-testid="button-generate-plan">
              {createPlan.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building your plan… (up to a minute)
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" /> Generate plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Regenerate dialog (Premium) ── */}
      <Dialog open={regenOpen} onOpenChange={(o) => !regenerate.isPending && setRegenOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate this plan</DialogTitle>
            <DialogDescription>
              Optionally tell the AI how to adjust it. Progress check-offs will reset.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder='e.g. "more time on Physics", "shorter daily topics"'
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            data-testid="input-adjustment"
          />
          <DialogFooter>
            <Button onClick={handleRegenerate} disabled={regenerate.isPending} data-testid="button-confirm-regenerate">
              {regenerate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 h-4 w-4" /> Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanDetail({
  plan,
  days,
  isPremiumish,
  onToggleDay,
  onDelete,
  onRegenerate,
  deleting,
}: {
  plan: ExamPlanSummary;
  days: ExamPlanDay[];
  isPremiumish: boolean;
  onToggleDay: (day: ExamPlanDay) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  deleting: boolean;
}) {
  const pct = plan.dayCount ? Math.round((plan.completedDayCount / plan.dayCount) * 100) : 0;
  const daysLeft = differenceInCalendarDays(new Date(plan.examDate), new Date());

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg" data-testid="text-plan-title">
              {plan.title}
            </CardTitle>
            <CardDescription>
              {batchName(plan.batch)} · exam {format(new Date(plan.examDate), "d MMMM yyyy")}
              {daysLeft >= 0 && <> · {daysLeft} day{daysLeft === 1 ? "" : "s"} left</>}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRegenerate} data-testid="button-regenerate">
              {isPremiumish ? (
                <RefreshCw className="mr-1 h-4 w-4" />
              ) : (
                <Crown className="mr-1 h-4 w-4 text-amber-500" />
              )}
              Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting} data-testid="button-delete-plan">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-plan-progress">
              {plan.completedDayCount} of {plan.dayCount} days done
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {days.map((day) => {
          const date = new Date(day.date);
          return (
            <Collapsible key={day.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  day.completed && "bg-muted/50",
                  isToday(date) && "border-primary",
                )}
              >
                <Checkbox
                  checked={day.completed}
                  onCheckedChange={() => onToggleDay(day)}
                  data-testid={`checkbox-day-${day.id}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Day {day.dayIndex} · {format(date, "EEE d MMM")}
                    </span>
                    {isToday(date) && <Badge className="h-5">Today</Badge>}
                    {!day.completed && !isToday(date) && isPast(date) && (
                      <Badge variant="outline" className="h-5 text-amber-600">
                        Missed
                      </Badge>
                    )}
                    <Badge variant="secondary" className="h-5 max-w-[120px] truncate">
                      {day.subject}
                    </Badge>
                  </div>
                  <p className={cn("mt-0.5 break-words text-sm font-medium leading-snug", day.completed && "line-through opacity-60")}>
                    {day.topic}
                  </p>
                  {day.focus && (
                    <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">{day.focus}</p>
                  )}
                  {day.explanation && (
                    <CollapsibleTrigger asChild>
                      <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" data-testid={`button-expand-day-${day.id}`}>
                        Explain <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
              </div>
              {day.explanation && (
                <CollapsibleContent>
                  <div className="rounded-b-lg border border-t-0 bg-muted/30 px-4 py-3">
                    <Markdown content={day.explanation} className="text-sm" />
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
