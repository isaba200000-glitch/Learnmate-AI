import { memo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-url";
import { motion } from "framer-motion";
import { usePremium } from "@/hooks/use-premium";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Pencil,
  Trash2,
  Wand2,
  Lock,
  Plus,
  Bell,
  BellOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  format,
  differenceInCalendarDays,
  startOfWeek,
  endOfWeek,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamEvent {
  id: number;
  userId: string;
  subject: string;
  examDate: string;
  notes: string;
  routine: string;
  color: string;
  createdAt: string;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "blue-500",
  green: "emerald-500",
  red: "red-500",
  purple: "purple-500",
  amber: "amber-500",
  rose: "rose-500",
};

function colorDotClass(color: string): string {
  return `bg-${COLOR_MAP[color] ?? "blue-500"}`;
}
function colorBgClass(color: string): string {
  const c = COLOR_MAP[color] ?? "blue-500";
  return `bg-${c}/20 text-${c}`;
}
function colorBorderClass(color: string): string {
  return `border-${COLOR_MAP[color] ?? "blue-500"}`;
}

// ─── VAPID key helper ─────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
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
  if (!res.ok)
    throw Object.assign(
      new Error((body as { error?: string }).error ?? "Request failed"),
      { status: res.status, data: body },
    );
  return body as T;
}

// ─── Countdown helper ─────────────────────────────────────────────────────────

function countdown(examDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(exam, today);
  if (diff === 0) return "Today!";
  if (diff < 0) return "Past";
  return `${diff} day${diff === 1 ? "" : "s"} away`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExamCalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isPremium, isOwner } = usePremium();

 const canUseRoutineGenerator = isOwner || isPremium;
  // Calendar navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamEvent | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [color, setColor] = useState("blue");
  const [notes, setNotes] = useState("");
  const [routine, setRoutine] = useState("");

  // AI Routine state
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [routineText, setRoutineText] = useState<string | null>(null);
  const [selectedExamForRoutine, setSelectedExamForRoutine] =
    useState<number | null>(null);

  // ─── Push notification state ────────────────────────────────────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [currentSub, setCurrentSub] = useState<PushSubscription | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);

  // On mount: read current permission & check existing subscription
  useEffect(() => {
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setCurrentSub(sub);
        });
      });
    }
  }, []);

  async function subscribeToPush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== "granted") {
        toast({ title: "Notifications blocked", description: "Enable them in your browser settings.", variant: "destructive" });
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      }

      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiFetch("/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subJson),
      });

      setCurrentSub(sub);
      toast({ title: "Exam reminders enabled! 🔔", description: "You'll get notified 7, 3, and 1 day before each exam." });
    } catch (err) {
      toast({ title: "Couldn't enable notifications", variant: "destructive" });
    } finally {
      setNotifLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    if (!currentSub) return;
    setNotifLoading(true);
    try {
      await apiFetch("/push/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: currentSub.endpoint }),
      });
      await currentSub.unsubscribe();
      setCurrentSub(null);
      toast({ title: "Exam reminders turned off" });
    } catch {
      toast({ title: "Couldn't turn off notifications", variant: "destructive" });
    } finally {
      setNotifLoading(false);
    }
  }

  // ─── Data ───────────────────────────────────────────────────────────────────

  const { data: exams = [], isLoading } = useQuery<ExamEvent[]>({
    queryKey: ["exam-calendar"],
    queryFn: () =>
      apiFetch<{ events: ExamEvent[] }>("/exam-calendar").then((r) => r.events),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<ExamEvent, "id" | "userId" | "createdAt">) =>
      apiFetch<{ event: ExamEvent }>("/exam-calendar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-calendar"] });
      toast({ title: "Exam added!" });
      closeDialog();
    },
    onError: () =>
      toast({ title: "Failed to save exam", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<ExamEvent> & { id: number }) =>
      apiFetch<{ event: ExamEvent }>(`/exam-calendar/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-calendar"] });
      toast({ title: "Exam updated!" });
      closeDialog();
    },
    onError: () =>
      toast({ title: "Failed to update exam", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/exam-calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-calendar"] });
      toast({ title: "Exam deleted" });
    },
    onError: () =>
      toast({ title: "Failed to delete exam", variant: "destructive" }),
  });

  // ─── Dialog helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditingExam(null);
    setSubject("");
    setExamDate("");
    setColor("blue");
    setNotes("");
    setRoutine("");
    setDialogOpen(true);
  }

  function openEdit(exam: ExamEvent) {
    setEditingExam(exam);
    setSubject(exam.subject);
    setExamDate(exam.examDate.slice(0, 10));
    setColor(exam.color || "blue");
    setNotes(exam.notes || "");
    setRoutine(exam.routine || "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingExam(null);
  }

  function handleSave() {
    if (!subject.trim() || !examDate) {
      toast({ title: "Subject and date are required", variant: "destructive" });
      return;
    }
    const payload = { subject, examDate, color, notes, routine };
    if (editingExam) {
      updateMutation.mutate({ id: editingExam.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ─── AI Routine ──────────────────────────────────────────────────────────────

  async function generateRoutine(examId: number) {
    setSelectedExamForRoutine(examId);
    setRoutineLoading(true);
    setRoutineText(null);
    try {
      const result = await apiFetch<{ routine: string }>(
        `/exam-calendar/generate-routine`,
        {
          method: "POST",
          body: JSON.stringify({
            examEvents: exams.filter((e) => e.id === examId),
            hoursPerDay,
          }),
        },
      );
      setRoutineText(result.routine);
    } catch {
      toast({ title: "Failed to generate routine", variant: "destructive" });
    } finally {
      setRoutineLoading(false);
    }
  }

  // ─── Calendar helpers ─────────────────────────────────────────────────────────

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  const sortedExams = [...exams].sort(
    (a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
  );

  const notifEnabled = currentSub !== null && notifPermission === "granted";
  const notifSupported = notifPermission !== "unsupported" && "serviceWorker" in navigator;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-4xl space-y-8 pb-12"
    >

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exam Calendar</h1>
            <p className="text-sm text-muted-foreground">Pin exam dates and stay prepared</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification bell toggle */}
          {notifSupported && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2 rounded-full",
                notifEnabled && "border-primary/40 bg-primary/5 text-primary",
              )}
              onClick={notifEnabled ? unsubscribeFromPush : subscribeToPush}
              disabled={notifLoading || notifPermission === "denied"}
              title={
                notifPermission === "denied"
                  ? "Notifications blocked in browser settings"
                  : notifEnabled
                    ? "Turn off exam reminders"
                    : "Enable exam reminders"
              }
            >
              {notifEnabled ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {notifEnabled ? "Reminders on" : "Remind me"}
              </span>
            </Button>
          )}

          <Button
            onClick={openAdd}
            className="gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Exam
          </Button>
        </div>
      </div>

      {/* Notification prompt banner — show if supported but not yet asked */}
      {notifSupported && notifPermission === "default" && !currentSub && exams.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Get reminders before your exams</p>
            <p className="text-xs text-muted-foreground">We'll notify you 7, 3, and 1 day before each exam — even when the app is closed.</p>
          </div>
          <Button
            size="sm"
            className="rounded-full shrink-0 bg-gradient-to-r from-primary to-blue-600 text-white hover:opacity-90"
            onClick={subscribeToPush}
            disabled={notifLoading}
          >
            Enable
          </Button>
        </div>
      )}

      {/* Month Calendar */}
      <Card className="glass-card border-border/50 overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);
              const dayExams = exams.filter((e) =>
                isSameDay(new Date(e.examDate + "T00:00:00"), day),
              );

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "rounded-lg p-1 text-center min-h-[44px] flex flex-col items-center justify-start",
                    isToday && "ring-2 ring-primary bg-primary/10 rounded-lg",
                    !isCurrentMonth && "opacity-30",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium leading-5",
                      isToday && "text-primary font-bold",
                      !isCurrentMonth && "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayExams.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                      {dayExams.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn("w-2 h-2 rounded-full", colorDotClass(e.color))}
                          title={e.subject}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Exams */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Upcoming Exams</h2>
          <Badge variant="secondary" className="rounded-full">
            {exams.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : sortedExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <CalendarCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">No exams yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Track your exam dates and stay prepared
              </p>
            </div>
            <Button
              onClick={openAdd}
              className="gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600"
            >
              <Plus className="h-4 w-4" /> Add your first exam
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedExams.map((exam) => {
              const cd = countdown(exam.examDate);
              const isPast = cd === "Past";
              return (
                <div
                  key={exam.id}
                  className={cn(
                    "glass-card p-4 flex items-start gap-3 rounded-2xl border-l-4",
                    colorBorderClass(exam.color),
                  )}
                >
                  {/* Icon tile */}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      colorBgClass(exam.color),
                    )}
                  >
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{exam.subject}</p>
                      <span
                        className={cn(
                          "text-xs rounded-full px-2 py-0.5 font-medium",
                          isPast
                            ? "bg-muted text-muted-foreground"
                            : cd === "Today!"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : "bg-primary/10 text-primary",
                        )}
                      >
                        {cd}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(exam.examDate + "T00:00:00"), "MMMM d, yyyy")}
                    </p>
                    {exam.notes && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {exam.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(exam)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(exam.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Routine Generator */}
      {canUseRoutineGenerator ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/15 text-primary">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Routine Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Generate a personalised study routine for any exam
                </p>
              </div>
            </div>

            {sortedExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add an exam above to generate a routine.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Select exam
                    </label>
                    <Select
                      value={selectedExamForRoutine?.toString() ?? ""}
                      onValueChange={(v) => setSelectedExamForRoutine(Number(v))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Choose exam…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedExams.map((e) => (
                          <SelectItem key={e.id} value={e.id.toString()}>
                            {e.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Hours per day
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={hoursPerDay}
                      onChange={(e) => setHoursPerDay(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>

                  <Button
                    onClick={() =>
                      selectedExamForRoutine !== null &&
                      generateRoutine(selectedExamForRoutine)
                    }
                    disabled={routineLoading || selectedExamForRoutine === null}
                    className="gap-2 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white hover:opacity-90"
                  >
                    <Wand2 className="h-4 w-4" />
                    {routineLoading ? "Generating…" : "Generate Routine"}
                  </Button>
                </div>

                {routineText && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <Markdown content={routineText} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card border-border/50">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">AI Routine Generator</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Premium access required for personalised AI study routines
              </p>
            </div>
            <Button asChild className="rounded-full shrink-0" variant="outline">
              <Link href="/premium">Get Premium</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Exam Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExam ? "Edit Exam" : "Add Exam"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject *</label>
              <Input
                placeholder="e.g. Mathematics, Biology…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exam Date *</label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="rose">Rose</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Topics to study, past papers…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Study Routine</label>
              <Textarea
                placeholder="Your study routine for this exam…"
                value={routine}
                onChange={(e) => setRoutine(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving…"
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
export default memo(ExamCalendarPage);
