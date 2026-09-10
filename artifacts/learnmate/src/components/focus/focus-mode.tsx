import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSaveFocusSession,
  getGetFocusOverviewQueryKey,
  type FocusSessionItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Flag, ShieldAlert, X } from "lucide-react";

// Strict mode fails a session after this many distractions (matches server).
export const STRICT_MAX_DISTRACTIONS = 3;

export interface FocusOptions {
  minutes: number;
  strict?: boolean;
}

interface FocusModeContextValue {
  startFocus: (opts: FocusOptions) => void;
  active: boolean;
}

const FocusModeContext = createContext<FocusModeContextValue | null>(null);

export function useFocusMode(): FocusModeContextValue {
  const ctx = useContext(FocusModeContext);
  if (!ctx) throw new Error("useFocusMode must be used inside FocusModeProvider");
  return ctx;
}

type Phase = "idle" | "running" | "summary";

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveSession = useSaveFocusSession();

  const [phase, setPhase] = useState<Phase>("idle");
  const [opts, setOpts] = useState<FocusOptions>({ minutes: 25 });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [distractions, setDistractions] = useState(0);
  const [warning, setWarning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<FocusSessionItem | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Wall-clock focused time captured at finish — the same value that is saved,
  // so the summary always matches the persisted session.
  const [finishedFocusedSeconds, setFinishedFocusedSeconds] = useState(0);

  // Refs so event handlers see current values without re-subscribing.
  const stateRef = useRef({ phase, distractions, strict: false, plannedSeconds: 0, secondsLeft: 0 });
  stateRef.current = {
    phase,
    distractions,
    strict: opts.strict === true,
    plannedSeconds: opts.minutes * 60,
    secondsLeft,
  };

  // Guards against double-saving: finish() can be triggered by the countdown,
  // strict-mode failure, and the manual button — only the first one wins.
  const finishedRef = useRef(false);

  // Wall-clock anchors. Mobile browsers throttle/pause setInterval when the
  // screen is off or the app is backgrounded, so counting ticks loses nearly
  // all the time on phones. Real elapsed time must come from Date.now().
  const startAtRef = useRef(0);
  const endAtRef = useRef(0);

  const finish = useCallback(
    (didFail: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const s = stateRef.current;
      const focusedSeconds = Math.min(
        s.plannedSeconds,
        Math.max(0, Math.round((Date.now() - startAtRef.current) / 1000)),
      );
      setFinishedFocusedSeconds(focusedSeconds);
      setFailed(didFail);
      setPhase("summary");
      setSaved(null);
      setSaveError(null);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      saveSession.mutate(
        {
          data: {
            plannedMinutes: s.plannedSeconds / 60,
            focusedSeconds,
            distractions: s.distractions,
            strict: s.strict,
          },
        },
        {
          onSuccess: (session) => {
            setSaved(session);
            queryClient.invalidateQueries({ queryKey: getGetFocusOverviewQueryKey() });
          },
          onError: (err) => {
            setSaveError(
              (err as { data?: { error?: string } | null } | null)?.data?.error ??
                "Could not save this session.",
            );
          },
        },
      );
    },
    [queryClient, saveSession],
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Countdown — derived from the wall clock, not tick counting, so throttled
  // or paused timers (screen off, backgrounded app) never lose elapsed time.
  useEffect(() => {
    if (phase !== "running") return;
    let done = false;
    const update = () => {
      if (done) return;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        done = true;
        clearInterval(id);
        setTimeout(() => finishRef.current(false), 0);
      }
    };
    const id = setInterval(update, 1000);
    // When the screen comes back on, immediately resync the display.
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase]);

  // Distraction detection: leaving the app / tab counts — ALWAYS, for everyone.
  // Screen-off does NOT count. Heuristic: leaving the app on a phone always
  // requires touching the screen (home gesture, recents, notification tap)
  // right before the page goes hidden, while the power button / screen timeout
  // is hardware — no touch. So: hidden + recent interaction = app switch;
  // hidden with no recent interaction = screen off (allowed).
  // (The old blur-only heuristic failed because many mobile browsers never
  // fire blur on app switch — pointer/touch events are far more reliable.)
  useEffect(() => {
    if (phase !== "running") return;
    let lastHit = 0;
    let lastInteraction = 0;
    const isPhone = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const noteInteraction = () => { lastInteraction = Date.now(); };
    const onDistracted = () => {
      const s = stateRef.current;
      if (s.phase !== "running") return;
      // visibilitychange + blur often fire together — count once per 2s.
      const now = Date.now();
      if (now - lastHit < 2000) return;
      lastHit = now;
      setDistractions((d) => {
        const next = d + 1;
        if (next >= STRICT_MAX_DISTRACTIONS) {
          setTimeout(() => finishRef.current(true), 0);
        }
        return next;
      });
      setWarning(true);
    };
    const onBlur = () => {
      // NOTE: blur must NOT count as a "user interaction" — some phone
      // browsers fire blur right before screen-off's visibilitychange, which
      // would make screen-off look like an app switch and cause a false strike.
      // Desktop: clicking into another window keeps the page visible — count it.
      setTimeout(() => {
        if (document.visibilityState === "visible") onDistracted();
      }, 300);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (isPhone) {
        // Phone: only count if the student touched the screen just before —
        // that's an app switch. Screen off (power button/timeout) has no touch.
        if (Date.now() - lastInteraction < 3000) onDistracted();
      } else {
        onDistracted();
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", noteInteraction, true);
    window.addEventListener("touchstart", noteInteraction, { capture: true, passive: true });
    window.addEventListener("keydown", noteInteraction, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", noteInteraction, true);
      window.removeEventListener("touchstart", noteInteraction, true);
      window.removeEventListener("keydown", noteInteraction, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase]);

  const startFocus = useCallback(
    (o: FocusOptions) => {
      setOpts(o);
      setSecondsLeft(o.minutes * 60);
      setDistractions(0);
      setWarning(false);
      setFailed(false);
      setSaved(null);
      setSaveError(null);
      finishedRef.current = false;
      startAtRef.current = Date.now();
      endAtRef.current = Date.now() + o.minutes * 60 * 1000;
      setPhase("running");
      document.documentElement.requestFullscreen?.().catch(() => {
        // Fullscreen can be blocked — the overlay still covers the app.
      });
      toast({
        title: "Focus Mode on",
        description:
          "Turning your screen off is fine — sounds keep playing. But leaving the app counts, and 3 distractions fail the session.",
      });
    },
    [toast],
  );

  const close = () => {
    setPhase("idle");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  // Live "studied so far" — derived from the same wall-clock countdown, so it
  // stays accurate even when timers are throttled (screen off / backgrounded).
  const focusedSeconds = phase === "summary"
    ? finishedFocusedSeconds
    : Math.max(0, opts.minutes * 60 - secondsLeft);
  const studiedMins = Math.floor(focusedSeconds / 60);
  const studiedSecs = focusedSeconds % 60;

  return (
    <FocusModeContext.Provider value={{ startFocus, active: phase !== "idle" }}>
      {children}
      {phase !== "idle" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
            {phase === "running" && (
              <div className="flex w-full max-w-md flex-col items-center gap-6 p-6 text-center">
                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                  <ShieldAlert className="h-3.5 w-3.5" />{" "}
                  {Math.max(0, STRICT_MAX_DISTRACTIONS - distractions)} strikes left — leaving the app counts
                </span>
                <p className="text-sm text-muted-foreground">Focus session · {opts.minutes} min</p>
                <p className="text-7xl font-bold tabular-nums tracking-tight" data-testid="text-focus-timer">
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-studied-so-far">
                  Studied so far:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {String(studiedMins).padStart(2, "0")}:{String(studiedSecs).padStart(2, "0")}
                  </span>
                </p>
                {warning ? (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
                    data-testid="banner-distraction-warning"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      Come back to studying! Distraction <b>{distractions}</b> of {STRICT_MAX_DISTRACTIONS} —{" "}
                      {Math.max(0, STRICT_MAX_DISTRACTIONS - distractions)} more and the session fails.
                    </span>
                    <button onClick={() => setWarning(false)} className="ml-1 opacity-70 hover:opacity-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-distraction-count">
                    Distractions: {distractions}
                  </p>
                )}
                <Button variant="outline" onClick={() => finish(false)} data-testid="button-end-session">
                  <Flag className="mr-1 h-4 w-4" /> End session early
                </Button>
              </div>
            )}

            {phase === "summary" && (
              <div className="flex w-full max-w-md flex-col items-center gap-4 p-6 text-center" data-testid="card-focus-summary">
                {failed ? (
                  <>
                    <ShieldAlert className="h-12 w-12 text-destructive" />
                    <h2 className="text-2xl font-bold">Session failed</h2>
                    <p className="text-sm text-muted-foreground">
                      You left the app {STRICT_MAX_DISTRACTIONS} times — the session failed. Try again and stay focused!
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    <h2 className="text-2xl font-bold">Session complete!</h2>
                  </>
                )}
                <div className="grid w-full grid-cols-3 gap-3">
                  <SummaryStat label="Focused" value={`${Math.round(focusedSeconds / 60)}m`} testid="text-summary-focused" />
                  <SummaryStat label="Distractions" value={String(distractions)} testid="text-summary-distractions" />
                  <SummaryStat
                    label="Focus score"
                    value={saved ? `${saved.score}` : saveSession.isPending ? "…" : "—"}
                    testid="text-summary-score"
                  />
                </div>
                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                <Button onClick={close} data-testid="button-close-summary">
                  Done
                </Button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </FocusModeContext.Provider>
  );
}

function SummaryStat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className={cn("rounded-lg border p-3")}>
      <p className="text-xl font-bold tabular-nums" data-testid={testid}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
