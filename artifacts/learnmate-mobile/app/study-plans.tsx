import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

const SUBJECT_OPTIONS = ['Math', 'Science', 'English', 'History', 'Geography', 'Computer'];
const HOURS_OPTIONS = [1, 2, 3, 4];

interface StudyTask {
  id: number;
  planId: number;
  title: string;
  subject: string | null;
  scheduledDate: string;
  durationMinutes: number;
  completed: boolean;
}

interface StudyPlan {
  id: number;
  title: string;
  examDate: string | null;
  subjects: string[];
  studyHoursPerDay: number;
  goals: string | null;
  status: string;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  tasks: StudyTask[];
}

export default function StudyPlansScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hours, setHours] = useState(2);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Study Plans' });
  }, [navigation]);

  const { data: plans, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['study-plans'],
    queryFn: () => apiFetch<StudyPlan[]>('/api/study-plans'),
  });

  const createPlan = useMutation({
    mutationFn: () =>
      apiFetch<StudyPlan>('/api/study-plans', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), subjects, studyHoursPerDay: hours }),
      }),
    onSuccess: (plan) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreate(false);
      setTitle('');
      setSubjects([]);
      setExpandedPlan(plan.id);
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: ({ planId, taskId, completed }: { planId: number; taskId: number; completed: boolean }) =>
      apiFetch<StudyTask>(`/api/study-plans/${planId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const botPad = insets.bottom + 24;
  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (error && !plans) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Feather name="alert-circle" size={36} color={C.mutedForeground} />
        <Text style={styles.errorTitle}>Couldn't load study plans</Text>
        <Pressable style={styles.primaryBtnSmall} onPress={() => refetch()}>
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />
      }
    >
      {/* Create button / form */}
      {!showCreate ? (
        <Pressable
          style={({ pressed }) => [styles.newPlanBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCreate(true);
          }}
        >
          <Feather name="plus" size={18} color={C.primary} />
          <Text style={styles.newPlanText}>New study plan</Text>
        </Pressable>
      ) : (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Create a study plan</Text>
          <TextInput
            style={styles.input}
            placeholder="Plan name (e.g. Final Exam Prep)"
            placeholderTextColor={C.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.label}>Subjects</Text>
          <View style={styles.chipRow}>
            {SUBJECT_OPTIONS.map((s) => {
              const active = subjects.includes(s);
              return (
                <Pressable
                  key={s}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setSubjects((cur) => (active ? cur.filter((x) => x !== s) : [...cur, s]))
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Hours per day</Text>
          <View style={styles.chipRow}>
            {HOURS_OPTIONS.map((h) => (
              <Pressable
                key={h}
                style={[styles.chip, hours === h && styles.chipActive]}
                onPress={() => setHours(h)}
              >
                <Text style={[styles.chipText, hours === h && styles.chipTextActive]}>{h}h</Text>
              </Pressable>
            ))}
          </View>

          {createPlan.error ? (
            <Text style={styles.errorMsg}>{(createPlan.error as Error).message}</Text>
          ) : null}

          <View style={styles.createActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setShowCreate(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtnSmall,
                (!title.trim() || subjects.length === 0) && styles.disabledBtn,
              ]}
              disabled={createPlan.isPending || !title.trim() || subjects.length === 0}
              onPress={() => createPlan.mutate()}
            >
              {createPlan.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Create</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Plans */}
      {(plans ?? []).length === 0 && !showCreate && (
        <View style={styles.empty}>
          <Feather name="calendar" size={32} color={C.border} />
          <Text style={styles.emptyTitle}>No study plans yet</Text>
          <Text style={styles.emptyText}>
            Create a plan and we'll build a day-by-day study schedule for you.
          </Text>
        </View>
      )}

      {(plans ?? [])
        .slice()
        .reverse()
        .map((plan) => {
          const expanded = expandedPlan === plan.id;
          const progress =
            plan.taskCount > 0 ? Math.round((plan.completedTaskCount / plan.taskCount) * 100) : 0;
          const todayTasks = plan.tasks.filter((t) => t.scheduledDate === today);

          return (
            <View key={plan.id} style={styles.planCard}>
              <Pressable
                style={styles.planHeader}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedPlan(expanded ? null : plan.id);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planMeta}>
                    {plan.subjects.join(', ')} · {plan.completedTaskCount}/{plan.taskCount} tasks
                    {todayTasks.length > 0 ? ` · ${todayTasks.length} today` : ''}
                  </Text>
                </View>
                <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={C.mutedForeground} />
              </Pressable>

              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>

              {expanded &&
                plan.tasks.map((task) => {
                  const isToday = task.scheduledDate === today;
                  const isPast = task.scheduledDate < today;
                  return (
                    <Pressable
                      key={task.id}
                      style={styles.taskRow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleTask.mutate({
                          planId: plan.id,
                          taskId: task.id,
                          completed: !task.completed,
                        });
                      }}
                    >
                      <View style={[styles.check, task.completed && styles.checkDone]}>
                        {task.completed && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
                          numberOfLines={2}
                        >
                          {task.title}
                        </Text>
                        <Text style={styles.taskMeta}>
                          {task.subject ?? 'General'} · {task.durationMinutes}m ·{' '}
                          {isToday ? 'Today' : task.scheduledDate}
                          {isPast && !task.completed ? ' · overdue' : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  scroll: { padding: 20 },
  errorTitle: { fontSize: 16, color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  newPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.primary + '55',
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginBottom: 16,
  },
  newPlanText: { fontSize: 14, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  createCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 16,
  },
  createTitle: { fontSize: 16, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  input: {
    backgroundColor: C.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.foreground,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { fontSize: 13, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.background,
  },
  chipActive: { backgroundColor: C.primary + '22', borderColor: C.primary },
  chipText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: C.primary },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  primaryBtnSmall: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#fff', fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.background,
  },
  secondaryBtnText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  disabledBtn: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  errorMsg: { fontSize: 13, color: '#EF4444', fontFamily: 'Inter_400Regular', marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  planCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 12,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { fontSize: 16, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  planMeta: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 3 },
  progressBg: { height: 4, backgroundColor: C.secondary, borderRadius: 2, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: C.success, borderColor: C.success },
  taskTitle: { fontSize: 14, color: C.foreground, fontFamily: 'Inter_500Medium', lineHeight: 19 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.mutedForeground },
  taskMeta: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
