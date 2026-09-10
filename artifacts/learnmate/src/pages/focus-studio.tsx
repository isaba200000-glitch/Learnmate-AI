import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FocusModeCard } from "@/components/focus/focus-mode-card";
import { motion } from "framer-motion";
import { MotionFade } from "@/components/motion";

// ─── Types & Constants ───────────────────────────────────────────────────────

type Mode = "focus" | "short" | "long";
type SoundId = "coffee" | "ocean" | "fireplace" | "waterfall" | "nightbreeze";

interface ModeConfig {
  label: string;
  minutes: number;
  color: string;
  hex: string;
  description: string;
}

const MODES: Record<Mode, ModeConfig> = {
  focus: { label: "Focus", minutes: 25, color: "text-violet-500", hex: "#7c3aed", description: "Deep work session" },
  short: { label: "Short Break", minutes: 5, color: "text-emerald-500", hex: "#059669", description: "Quick recharge" },
  long:  { label: "Long Break",  minutes: 15, color: "text-sky-500",    hex: "#0284c7", description: "Rest & refresh" },
};

const RING_R = 108;
const RING_C = 2 * Math.PI * RING_R;

const SOUNDS = [
  { id: "coffee"      as SoundId, label: "Coffee Shop",  emoji: "☕", desc: "Café background",      color: "bg-amber-500"   },
  { id: "ocean"       as SoundId, label: "Ocean Waves",  emoji: "🌊", desc: "Gentle waves",          color: "bg-blue-500"    },
  { id: "fireplace"   as SoundId, label: "Fireplace",    emoji: "🔥", desc: "Warm crackling fire",   color: "bg-orange-500"  },
  { id: "waterfall"   as SoundId, label: "Waterfall",    emoji: "💧", desc: "Distant waterfall",     color: "bg-cyan-500"    },
  { id: "nightbreeze" as SoundId, label: "Night Breeze", emoji: "🌙", desc: "Calm night air",        color: "bg-indigo-500"  },
];

// ─── Web Audio Sound Engine ───────────────────────────────────────────────────

class SoundEngine {
  private ctx: AudioContext | null = null;
  private active = new Map<SoundId, { gain: GainNode; stop: () => void }>();
  private msDest: MediaStreamAudioDestinationNode | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.msDest = null;
    }
    return this.ctx;
  }

  private getOutput(ctx: AudioContext): AudioNode {
    if (this.msDest && this.msDest.context === ctx) return this.msDest;
    try {
      const dest = ctx.createMediaStreamDestination();
      const el = this.audioEl ?? new Audio();
      el.srcObject = dest.stream;
      (el as any).playsInline = true;
      el.loop = true;
      void el.play().catch(() => {});
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: "Focus Sounds",
            artist: "Learnova AI",
          });
        } catch {}
      }
      this.msDest = dest;
      this.audioEl = el;
      return dest;
    } catch {
      return ctx.destination;
    }
  }

  async resume() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private makeWhiteBuffer(ctx: AudioContext, sec = 3): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeBrownBuffer(ctx: AudioContext, sec = 3): AudioBuffer {
    const size = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < size; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return buf;
  }

  private makeCrackleBuffer(ctx: AudioContext, sec = 5): AudioBuffer {
    const size = ctx.sampleRate * sec;
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let i = 0;
    while (i < size) {
      i += Math.floor(ctx.sampleRate * (0.06 + Math.random() * 0.5));
      const popLen = Math.floor(ctx.sampleRate * (0.004 + Math.random() * 0.02));
      const amp = 0.25 + Math.random() * 0.55;
      for (let j = 0; j < popLen && i + j < size; j++) {
        d[i + j] = (Math.random() * 2 - 1) * amp * (1 - j / popLen);
      }
      i += popLen;
    }
    return buf;
  }

  async play(id: SoundId, vol: number) {
    if (this.active.has(id)) return;
    const ctx = this.getCtx();
    await this.resume();

    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, vol));
    master.connect(this.getOutput(ctx));
    if (this.audioEl) void this.audioEl.play().catch(() => {});

    let stop: () => void;

    if (id === "coffee") {
      const bb   = this.makeBrownBuffer(ctx);
      const lp   = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 550;
      const base = ctx.createBufferSource(); base.buffer = bb; base.loop = true;
      base.connect(lp); lp.connect(master);

      const murmur = ctx.createBufferSource(); murmur.buffer = this.makeWhiteBuffer(ctx); murmur.loop = true;
      const bp1 = ctx.createBiquadFilter(); bp1.type = "bandpass"; bp1.frequency.value = 420; bp1.Q.value = 2;
      const bp2 = ctx.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = 760; bp2.Q.value = 2;
      const g1  = ctx.createGain(); g1.gain.value = 0.12;
      const g2  = ctx.createGain(); g2.gain.value = 0.10;
      const lfo1 = ctx.createOscillator(); lfo1.frequency.value = 0.17; lfo1.type = "sine";
      const l1g  = ctx.createGain(); l1g.gain.value = 0.06;
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; lfo2.type = "sine";
      const l2g  = ctx.createGain(); l2g.gain.value = -0.05;
      murmur.connect(bp1); bp1.connect(g1); g1.connect(master);
      murmur.connect(bp2); bp2.connect(g2); g2.connect(master);
      lfo1.connect(l1g); l1g.connect(g1.gain);
      lfo2.connect(l2g); l2g.connect(g2.gain);
      base.start(); murmur.start(); lfo1.start(); lfo2.start();
      stop = () => { try { base.stop(); murmur.stop(); lfo1.stop(); lfo2.stop();
        [base,lp,murmur,bp1,bp2,g1,g2,l1g,l2g].forEach(n=>n.disconnect()); } catch {} };

    } else if (id === "ocean") {
      const src  = ctx.createBufferSource(); src.buffer = this.makeWhiteBuffer(ctx); src.loop = true;
      const lp   = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
      const wave = ctx.createGain();         wave.gain.value = 0.5;
      const lfo  = ctx.createOscillator();   lfo.frequency.value = 0.12; lfo.type = "sine";
      const lfoG = ctx.createGain();         lfoG.gain.value = 0.4;
      src.connect(lp); lp.connect(wave); wave.connect(master);
      lfo.connect(lfoG); lfoG.connect(wave.gain);
      src.start(); lfo.start();
      stop = () => { try { src.stop(); lfo.stop(); [src,lp,wave,lfoG].forEach(n=>n.disconnect()); } catch {} };

    } else if (id === "fireplace") {
      const bb   = this.makeBrownBuffer(ctx);
      const lp   = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
      const rumb = ctx.createGain(); rumb.gain.value = 0.7;
      const base = ctx.createBufferSource(); base.buffer = bb; base.loop = true;
      base.connect(lp); lp.connect(rumb); rumb.connect(master);

      const crk  = ctx.createBufferSource(); crk.buffer = this.makeCrackleBuffer(ctx); crk.loop = true;
      const chp  = ctx.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 1200;
      const cg   = ctx.createGain(); cg.gain.value = 0.5;
      crk.connect(chp); chp.connect(cg); cg.connect(master);
      base.start(); crk.start();
      stop = () => { try { base.stop(); crk.stop(); [base,lp,rumb,crk,chp,cg].forEach(n=>n.disconnect()); } catch {} };

    } else if (id === "waterfall") {
      const bb   = this.makeBrownBuffer(ctx);
      const lp   = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      const body = ctx.createBufferSource(); body.buffer = bb; body.loop = true;
      body.connect(lp); lp.connect(master);

      const hiss = ctx.createBufferSource(); hiss.buffer = this.makeWhiteBuffer(ctx); hiss.loop = true;
      const bp   = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.7;
      const hg   = ctx.createGain(); hg.gain.value = 0.10;
      hiss.connect(bp); bp.connect(hg); hg.connect(master);
      body.start(); hiss.start();
      stop = () => { try { body.stop(); hiss.stop(); [body,lp,hiss,bp,hg].forEach(n=>n.disconnect()); } catch {} };

    } else {
      const src  = ctx.createBufferSource(); src.buffer = this.makeWhiteBuffer(ctx); src.loop = true;
      const bpLo = ctx.createBiquadFilter(); bpLo.type = "bandpass"; bpLo.frequency.value = 240; bpLo.Q.value = 1.2;
      const bpHi = ctx.createBiquadFilter(); bpHi.type = "bandpass"; bpHi.frequency.value = 480; bpHi.Q.value = 1.2;
      const gLo  = ctx.createGain(); gLo.gain.value = 0.4;
      const gHi  = ctx.createGain(); gHi.gain.value = 0.25;
      const swell  = ctx.createOscillator(); swell.frequency.value = 0.06; swell.type = "sine";
      const sLoG   = ctx.createGain(); sLoG.gain.value = 0.22;
      const sHiG   = ctx.createGain(); sHiG.gain.value = -0.18;
      src.connect(bpLo); bpLo.connect(gLo); gLo.connect(master);
      src.connect(bpHi); bpHi.connect(gHi); gHi.connect(master);
      swell.connect(sLoG); sLoG.connect(gLo.gain);
      swell.connect(sHiG); sHiG.connect(gHi.gain);
      src.start(); swell.start();
      stop = () => { try { src.stop(); swell.stop();
        [src,bpLo,bpHi,gLo,gHi,sLoG,sHiG].forEach(n=>n.disconnect()); } catch {} };
    }

    this.active.set(id, { gain: master, stop });
  }

  setVolume(id: SoundId, vol: number) {
    const s = this.active.get(id);
    if (s && this.ctx) s.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.05);
  }

  stop(id: SoundId) {
    const s = this.active.get(id);
    if (!s) return;
    s.stop();
    try { s.gain.disconnect(); } catch {}
    this.active.delete(id);
    if (this.active.size === 0 && this.audioEl) this.audioEl.pause();
  }

  stopAll() { SOUNDS.forEach(s => this.stop(s.id)); }

  playBeep() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = "sine";
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.start(); osc.stop(ctx.currentTime + 1.1);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FocusStudioPage() {
  const { toast } = useToast();
  const engineRef = useRef<SoundEngine | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef  = useRef(0);

  const [mode,         setMode]         = useState<Mode>("focus");
  const [durations,    setDurations]    = useState({ focus: 25, short: 5, long: 15 });
  const [secondsLeft,  setSecondsLeft]  = useState(25 * 60);
  const [running,      setRunning]      = useState(false);
  const [sessionsDone, setSessionsDone] = useState(0);
  const [totalXP,      setTotalXP]      = useState(0);

  const [strikes, setStrikes] = useState(0);
  const MAX_STRIKES = 3;
  const runningRef = useRef(false);
  const modeRef = useRef<Mode>("focus");
  const strikesRef = useRef(0);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { strikesRef.current = strikes; }, [strikes]);

  const [sounds, setSounds] = useState<Record<SoundId, { on: boolean; vol: number }>>({
    coffee:      { on: false, vol: 0.5 },
    ocean:       { on: false, vol: 0.5 },
    fireplace:   { on: false, vol: 0.5 },
    waterfall:   { on: false, vol: 0.45 },
    nightbreeze: { on: false, vol: 0.5 },
  });

  useEffect(() => {
    engineRef.current = new SoundEngine();
    return () => { engineRef.current?.stopAll(); };
  }, []);

  // ── Distraction watcher ──────────────────────────────────────────────────
  useEffect(() => {
    let lastInteraction = 0;
    const isPhone = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const noteInteraction = () => { lastInteraction = Date.now(); };
    const onHide = () => {
      if (!document.hidden) return;
      if (!runningRef.current || modeRef.current !== "focus") return;
      if (isPhone && Date.now() - lastInteraction >= 3000) return;
      const next = strikesRef.current + 1;
      strikesRef.current = next;
      setStrikes(next);
      if (next >= MAX_STRIKES) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRunning(false);
        setSecondsLeft(durations.focus * 60);
        engineRef.current?.playBeep();
        toast({ title: "❌ Session failed", description: `You left the app ${MAX_STRIKES} times. Start a new focus session!`, variant: "destructive" });
      } else {
        toast({ title: `⚠️ Distraction! Strike ${next} of ${MAX_STRIKES}`, description: `You left the app. ${MAX_STRIKES - next} more and this session fails.`, variant: "destructive" });
      }
    };
    window.addEventListener("pointerdown", noteInteraction, true);
    window.addEventListener("touchstart", noteInteraction, { capture: true, passive: true });
    window.addEventListener("keydown", noteInteraction, true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pointerdown", noteInteraction, true);
      window.removeEventListener("touchstart", noteInteraction, true);
      window.removeEventListener("keydown", noteInteraction, true);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [durations.focus, toast]);

  const switchMode = useCallback((m: Mode) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRunning(false);
    setMode(m);
    setSecondsLeft(durations[m] * 60);
    setStrikes(0); strikesRef.current = 0;
  }, [durations]);

  useEffect(() => {
    if (!running) return;
    let done = false;
    const update = () => {
      if (done) return;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        done = true;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRunning(false);
        engineRef.current?.playBeep();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("⏰ Time's up!", {
            body: mode === "focus" ? "Great work! Take a well-deserved break." : "Break over — ready to focus again?",
          });
        }
        if (mode === "focus") {
          setSessionsDone(c => c + 1);
          setTotalXP(t => t + 50);
          setStrikes(0); strikesRef.current = 0;
          toast({ title: "Focus session complete! 🍅", description: "+50 XP earned. Time for a break." });
        } else {
          toast({ title: "Break over!", description: "Ready to start your next focus session?" });
        }
      }
    };
    timerRef.current = setInterval(update, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, mode, toast]);

  const handleStartPause = async () => {
    if (!running && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    await engineRef.current?.resume();
    if (!running && secondsLeft === durations[mode] * 60) {
      setStrikes(0); strikesRef.current = 0;
    }
    if (!running) {
      endAtRef.current = Date.now() + secondsLeft * 1000;
    } else {
      setSecondsLeft(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    }
    setRunning(r => !r);
  };

  const handleReset = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
    setStrikes(0); strikesRef.current = 0;
  };

  const toggleSound = async (id: SoundId) => {
    const cur = sounds[id];
    if (cur.on) {
      engineRef.current?.stop(id);
      setSounds(s => ({ ...s, [id]: { ...s[id], on: false } }));
    } else {
      await engineRef.current?.play(id, cur.vol);
      setSounds(s => ({ ...s, [id]: { ...s[id], on: true } }));
    }
  };

  const setVolume = (id: SoundId, vol: number) => {
    engineRef.current?.setVolume(id, vol);
    setSounds(s => ({ ...s, [id]: { ...s[id], vol } }));
  };

  // Ring math
  const totalSec   = durations[mode] * 60;
  const progress   = secondsLeft / totalSec;
  const dashOffset = RING_C * (1 - progress);
  const mins       = Math.floor(secondsLeft / 60);
  const secs       = secondsLeft % 60;
  const timeStr    = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  const cfg        = MODES[mode];
  const pomodoros  = sessionsDone % 4;
  const activeSoundsCount = Object.values(sounds).filter(s => s.on).length;

  return (
    <MotionFade className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,0.4)]">
          <Timer className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Focus Studio</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pomodoro timer &amp; ambient soundscapes</p>
        </div>
      </div>

      <FocusModeCard />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

        {/* ── Timer Panel ── */}
        <div className="glass-card rounded-3xl p-7 flex flex-col items-center gap-6">

          {/* Mode Tabs */}
          <div className="flex w-full gap-1 rounded-full bg-secondary/50 p-1 relative">
            {(Object.entries(MODES) as [Mode, ModeConfig][]).map(([m, c]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 rounded-full py-2 text-sm font-medium relative z-10 transition-colors",
                  mode === m
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
            {mode && (
              <motion.div
                layoutId="focus-mode-pill"
                className="absolute inset-y-1 rounded-full bg-background shadow-sm"
                style={{ left: 4, right: 4 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
          </div>

          {/* SVG Ring */}
          <div className="relative w-full max-w-[260px] mx-auto aspect-square">
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full opacity-20 blur-xl"
              style={{ backgroundColor: cfg.hex }}
              animate={{ opacity: running ? 0.35 : 0.2 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            <svg viewBox="0 0 272 272" className="w-full h-full relative z-10" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="136" cy="136" r={RING_R} fill="none" stroke="currentColor"
                strokeWidth="10" className="text-secondary/60" />
              <motion.circle
                cx="136" cy="136" r={RING_R} fill="none"
                stroke={cfg.hex} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={RING_C}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: running ? 0.95 : 0.4, ease: running ? "linear" : [0.22, 1, 0.36, 1] }}
                style={{ filter: `drop-shadow(0 0 8px ${cfg.hex}80)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <span className="text-5xl sm:text-6xl font-bold tracking-tighter tabular-nums font-mono">{timeStr}</span>
              <span className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider font-medium">{cfg.description}</span>
              {mode === "focus" && secondsLeft < totalSec && (
                <span className="text-xs text-muted-foreground mt-1" data-testid="text-studio-studied-so-far">
                  Studied:{" "}
                  <span className="font-semibold font-mono text-foreground">
                    {String(Math.floor((totalSec - secondsLeft) / 60)).padStart(2, "0")}:
                    {String((totalSec - secondsLeft) % 60).padStart(2, "0")}
                  </span>
                </span>
              )}
              {running && (
                <span className={cn("text-[10px] font-semibold mt-2 px-2.5 py-0.5 rounded-full uppercase tracking-wider", cfg.color, "bg-current/10")}>
                  {mode === "focus" ? "Focusing…" : "Resting…"}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-border/60" onClick={handleReset} title="Reset timer">
              <RotateCcw className="h-5 w-5" />
            </Button>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={handleStartPause}
              className="flex items-center gap-2 rounded-full px-10 h-14 text-base font-bold text-white shadow-lg"
              style={{ backgroundColor: cfg.hex, boxShadow: `0 0 24px ${cfg.hex}50` }}
            >
              {running
                ? <><Pause className="h-5 w-5" /> Pause</>
                : <><Play  className="h-5 w-5" /> {secondsLeft === totalSec ? "Start" : "Resume"}</>
              }
            </motion.button>
          </div>

          {/* Distraction strikes */}
          {mode === "focus" && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2.5">
                {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                  <span
                    key={i}
                    className={cn("text-xl transition-all duration-300", i < strikes ? "opacity-100 scale-110" : "opacity-25")}
                  >
                    {i < strikes ? "💔" : "❤️"}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                {strikes === 0
                  ? "Leave the app 3× and your session fails — stay focused!"
                  : `${MAX_STRIKES - strikes} ${MAX_STRIKES - strikes === 1 ? "strike" : "strikes"} left — stay in the app!`}
              </p>
            </div>
          )}

          {/* Session tracker */}
          <div className="w-full border-t border-border/50 pt-5 space-y-4">
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="text-2xl"
                  animate={{ scale: i < pomodoros ? [0.5, 1.2, 1] : 1, opacity: i < pomodoros ? 1 : 0.2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  🍅
                </motion.span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="glass-card rounded-xl py-3">
                <motion.p
                  className="text-xl font-bold font-mono"
                  animate={{ scale: sessionsDone > 0 ? [1, 1.08, 1] : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  key={sessionsDone}
                >
                  {sessionsDone}
                </motion.p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Sessions</p>
              </div>
              <div className="glass-card rounded-xl py-3">
                <motion.p
                  className="text-xl font-bold font-mono text-emerald-500"
                  animate={{ scale: totalXP > 0 ? [1, 1.08, 1] : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  key={totalXP}
                >
                  +{totalXP}
                </motion.p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">XP Earned</p>
              </div>
              <div className="glass-card rounded-xl py-3">
                <motion.p
                  className="text-xl font-bold font-mono"
                  animate={{ scale: sessionsDone > 0 ? [1, 1.06, 1] : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  key={sessionsDone * durations.focus}
                >
                  {sessionsDone * durations.focus}m
                </motion.p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Focus Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex flex-col gap-4">

          {/* Ambient Sound Mixer */}
          <div className="glass-card rounded-3xl p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ambient Sounds</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeSoundsCount > 0 ? `${activeSoundsCount} sound${activeSoundsCount > 1 ? "s" : ""} active` : "Mix sounds for your ideal study environment"}
                </p>
              </div>
              {activeSoundsCount > 0 && (
                <div className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
              )}
            </div>

            <div className="flex flex-col gap-2">
              {SOUNDS.map(({ id, label, emoji, desc, color }) => {
                const state = sounds[id];
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded-2xl border transition-all duration-200",
                      state.on
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/40 bg-secondary/15 hover:bg-secondary/30"
                    )}
                  >
                    <div className="flex items-center justify-between px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm text-base", color)}>
                          {emoji}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleSound(id)}
                        className={cn(
                          "relative h-5.5 w-10 shrink-0 rounded-full transition-colors duration-200",
                          state.on ? "bg-primary" : "bg-secondary border border-border/60"
                        )}
                        style={{ height: '22px', width: '40px' }}
                        aria-label={`${state.on ? "Disable" : "Enable"} ${label}`}
                      >
                        <span className={cn(
                          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all duration-200",
                          state.on ? "left-[18px]" : "left-0.5"
                        )} />
                      </button>
                    </div>

                    {state.on && (
                      <div className="flex items-center gap-2 px-3.5 pb-3">
                        <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input
                          type="range"
                          min={0} max={1} step={0.05}
                          value={state.vol}
                          onChange={e => setVolume(id, parseFloat(e.target.value))}
                          className="flex-1 h-1 cursor-pointer"
                          style={{ accentColor: cfg.hex }}
                        />
                        <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technique Guide */}
          <div className="glass-card rounded-2xl p-4 text-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">The Pomodoro Technique</p>
            <ol className="text-muted-foreground space-y-1.5 list-none">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold mt-0.5">1</span>
                <span>Focus for <strong className="text-foreground">25 minutes</strong> without interruption</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold mt-0.5">2</span>
                <span>Take a <strong className="text-foreground">5-minute</strong> short break</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold mt-0.5">3</span>
                <span>Repeat <strong className="text-foreground">4 times</strong></span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold mt-0.5">4</span>
                <span>Take a <strong className="text-foreground">15-minute</strong> long break</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </MotionFade>
  );
}
