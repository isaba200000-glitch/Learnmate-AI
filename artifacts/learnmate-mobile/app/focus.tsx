import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;
const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width - 80, 280);
const RADIUS = CIRCLE_SIZE / 2 - 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SESSIONS = [
  { label: 'Focus', duration: 25 * 60, color: C.primary },
  { label: 'Short Break', duration: 5 * 60, color: C.success },
  { label: 'Long Break', duration: 15 * 60, color: '#A78BFA' },
];

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sessionIdx, setSessionIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SESSIONS[0].duration);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [completed, setCompleted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const session = SESSIONS[sessionIdx];

  const totalSeconds = session.duration;
  const elapsed = totalSeconds - secondsLeft;
  const progress = elapsed / totalSeconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now() - (totalSeconds - secondsLeft) * 1000;
      intervalRef.current = setInterval(() => {
        const elapsedMs = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, totalSeconds - Math.floor(elapsedMs / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setCompleted(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (sessionIdx === 0) saveSession();
        }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  async function saveSession() {
    if (!startedAt) return;
    const durationMins = Math.round((Date.now() - startedAt.getTime()) / 60000);
    if (durationMins < 1) return;
    try {
      await apiFetch('/api/focus/sessions', {
        method: 'POST',
        body: JSON.stringify({
          durationMinutes: durationMins,
          distractionCount: 0,
          sessionType: 'focus',
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {}
  }

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!running) {
      if (secondsLeft === totalSeconds) setStartedAt(new Date());
      startTimeRef.current = Date.now() - (totalSeconds - secondsLeft) * 1000;
    }
    setRunning((r) => !r);
  }, [running, secondsLeft, totalSeconds]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(false);
    setSecondsLeft(totalSeconds);
    setStartedAt(null);
    setCompleted(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [totalSeconds]);

  function switchSession(idx: number) {
    setSessionIdx(idx);
    setRunning(false);
    setSecondsLeft(SESSIONS[idx].duration);
    setStartedAt(null);
    setCompleted(false);
  }

  const topPad = insets.top + 20 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 20 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Feather name="x" size={22} color={C.mutedForeground} />
      </Pressable>

      <Text style={styles.title}>Focus Mode</Text>

      {/* Session type selector */}
      <View style={styles.sessionTabs}>
        {SESSIONS.map((s, i) => (
          <Pressable
            key={s.label}
            style={[styles.sessionTab, sessionIdx === i && { backgroundColor: s.color + '22', borderColor: s.color }]}
            onPress={() => switchSession(i)}
          >
            <Text style={[styles.sessionTabText, sessionIdx === i && { color: s.color }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Circular timer */}
      <View style={styles.timerContainer}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          {/* Background track */}
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={C.secondary}
            strokeWidth={10}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={session.color}
            strokeWidth={10}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.timerInner}>
          <Text style={styles.timerDisplay}>{mins}:{secs}</Text>
          <Text style={styles.timerSession}>{session.label}</Text>
          {completed && <Text style={styles.timerDone}>✓ Done!</Text>}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Feather name="rotate-ccw" size={22} color={C.mutedForeground} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: session.color },
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleToggle}
        >
          <Feather name={running ? 'pause' : 'play'} size={28} color="#fff" />
        </Pressable>

        <View style={{ width: 52 }} />
      </View>

      {/* Session label */}
      <Text style={styles.motivationText}>
        {running
          ? 'Stay focused. You\'re doing great!'
          : completed
          ? 'Great work! Take a break.'
          : `${Math.floor(totalSeconds / 60)} minutes of focused studying`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 20,
  },
  sessionTabs: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  sessionTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  sessionTabText: {
    fontSize: 13,
    color: C.mutedForeground,
    fontFamily: 'Inter_500Medium',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  timerInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -2,
  },
  timerSession: {
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  timerDone: {
    fontSize: 16,
    color: C.success,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 24,
  },
  resetBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  motivationText: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
});
