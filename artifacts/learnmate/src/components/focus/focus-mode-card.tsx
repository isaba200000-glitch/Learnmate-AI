import { useState } from "react";
import { Link } from "wouter";
import {
  useGetFocusOverview,
  getGetFocusOverviewQueryKey,
} from "@workspace/api-client-react";
import { useFocusMode, STRICT_MAX_DISTRACTIONS } from "./focus-mode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Crown, Flame, MonitorX, Play, ShieldAlert, Timer } from "lucide-react";

const DURATIONS = [10, 15, 25, 30, 45, 60, 90, 120];

export function FocusModeCard() {
  const { startFocus } = useFocusMode();
  const overview = useGetFocusOverview({ query: { queryKey: getGetFocusOverviewQueryKey() } });
  const [minutes, setMinutes] = useState(25);

  if (overview.isLoading || !overview.data) {
    return <Skeleton className="h-48 w-full rounded-3xl" />;
  }

  const { limits, todaySessions, stats, sessions } = overview.data;
  const premiumish = limits.plan !== "free";

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl" data-testid="card-focus-mode">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorX className="h-5 w-5 text-primary" /> Focus Mode
          </CardTitle>
          <CardDescription>
            Fullscreen study session that catches you when you switch tabs or leave — every escape counts
            as a distraction. {todaySessions > 0 && <>You've done {todaySessions} session{todaySessions === 1 ? "" : "s"} today.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Session length</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => {
                const locked = d > limits.maxMinutes;
                return (
                  <button
                    key={d}
                    onClick={() => !locked && setMinutes(d)}
                    disabled={locked}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition-colors",
                      minutes === d && !locked && "border-primary bg-primary/10 font-semibold",
                      locked ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
                    )}
                    data-testid={`button-duration-${d}`}
                  >
                    {d}m{locked && <Crown className="ml-1 inline h-3 w-3 text-amber-500" />}
                  </button>
                );
              })}
            </div>
            {!premiumish && (
              <p className="mt-1 text-xs text-muted-foreground">
                Sessions over {limits.maxMinutes} minutes are a Premium feature.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border p-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">3-strike rule (always on):</span> leaving
              the app counts as a distraction — {STRICT_MAX_DISTRACTIONS} and the session fails. Turning
              the screen off is fine.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => startFocus({ minutes, strict: true })}
            data-testid="button-start-focus"
          >
            <Play className="mr-1 h-4 w-4" /> Start Focus Mode ({minutes} min)
          </Button>
        </CardContent>
      </Card>

      {premiumish && stats ? (
        <Card className="rounded-3xl" data-testid="card-focus-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-primary" /> Your focus stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Sessions" value={String(stats.totalSessions)} />
              <Stat label="Focused" value={`${stats.totalFocusedMinutes}m`} />
              <Stat label="Avg score" value={String(stats.avgScore)} />
              <Stat label="Streak" value={`${stats.streak}🔥`} testid="text-focus-streak" />
              <Stat label="Best streak" value={String(stats.bestStreak)} />
            </div>
            {sessions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Recent sessions</p>
                {sessions.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    data-testid={`row-session-${s.id}`}
                  >
                    <span className="text-muted-foreground">
                      {format(new Date(s.completedAt), "d MMM, HH:mm")}
                    </span>
                    <span>
                      {Math.round(s.focusedSeconds / 60)}m · {s.distractions} distraction
                      {s.distractions === 1 ? "" : "s"}
                    </span>
                    {s.failed ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="secondary">Score {s.score}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-primary/30 bg-primary/5" data-testid="card-focus-upgrade">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Flame className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-semibold">Focus history &amp; streaks</p>
                <p className="text-xs text-muted-foreground">
                  Premium tracks your focus over time: stats, daily streaks and longer sessions.
                </p>
              </div>
            </div>
            <Button asChild size="sm" data-testid="button-focus-upgrade">
              <Link href="/premium">
                <Crown className="mr-1 h-4 w-4" /> Upgrade
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-lg font-bold tabular-nums" data-testid={testid}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Compact "Focus Mode" starter for other study pages (25-min default). */
export function FocusModeButton({ minutes = 25 }: { minutes?: number }) {
  const { startFocus } = useFocusMode();
  return (
    <Button variant="outline" size="sm" onClick={() => startFocus({ minutes })} data-testid="button-quick-focus">
      <MonitorX className="mr-1 h-4 w-4" /> Focus Mode
    </Button>
  );
}
