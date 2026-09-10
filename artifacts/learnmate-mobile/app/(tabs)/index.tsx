import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useGetDashboard } from '@workspace/api-client-react';
import colors from '@/constants/colors';

const C = colors.dark;

const QUICK_ACTIONS = [
  { icon: 'message-circle', label: 'AI Chat', route: '/chat', color: '#4D93F5' },
  { icon: 'book-open', label: 'Courses', route: '/courses', color: '#22C55E' },
  { icon: 'clock', label: 'Focus', route: '/focus', color: '#F59E0B' },
  { icon: 'layers', label: 'Flashcards', route: '/flashcards', color: '#EC4899' },
  { icon: 'help-circle', label: 'Quiz', route: '/quiz', color: '#A78BFA' },
  { icon: 'calendar', label: 'Study Plans', route: '/study-plans', color: '#10B981' },
  { icon: 'globe', label: 'Language', route: '/language', color: '#06B6D4' },
  { icon: 'calendar', label: 'Exams', route: '/exams', color: '#F43F5E' },
  { icon: 'trending-up', label: 'Progress', route: '/progress', color: '#4D93F5' },
  { icon: 'file-text', label: 'Documents', route: '/documents', color: '#6366F1' },
] as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useGetDashboard();

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.userName}>
              {isLoading ? 'Loading…' : (data?.userName ?? 'Student')}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/premium')} style={styles.premiumBadge}>
            <Text style={styles.premiumText}>⚡ Premium</Text>
          </Pressable>
        </View>

        {isLoading && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        )}

        {!isLoading && data && (
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <StatCard icon="zap" label="XP" value={String(data.xp)} color="#F59E0B" />
              <StatCard icon="flame" label="Streak" value={`${data.streak}d`} color="#EF4444" />
              <StatCard icon="star" label="Level" value={String(data.level)} color={C.primary} />
              <StatCard icon="award" label="Coins" value={String(data.coins)} color="#A78BFA" />
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {QUICK_ACTIONS.map((a) => (
                <Pressable
                  key={a.label}
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Navigate within tabs or to modals
                    if (a.route === '/chat') router.push('/(tabs)/chat');
                    else if (a.route === '/courses') router.push('/(tabs)/courses');
                    else router.push(a.route as any);
                  }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
                    <Feather name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Weekly XP Chart */}
            {data.weeklyXp.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Weekly XP</Text>
                <View style={styles.chartCard}>
                  <WeeklyChart data={data.weeklyXp} />
                </View>
              </>
            )}

            {/* Today's Tasks */}
            {data.todayTasks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Today's Tasks</Text>
                {data.todayTasks.map((task) => (
                  <View key={task.id} style={styles.taskCard}>
                    <View
                      style={[
                        styles.taskCheck,
                        task.completed && { backgroundColor: C.success },
                      ]}
                    >
                      {task.completed && (
                        <Feather name="check" size={12} color="#fff" />
                      )}
                    </View>
                    <View style={styles.taskInfo}>
                      <Text
                        style={[styles.taskTitle, task.completed && styles.taskDone]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      <Text style={styles.taskMeta}>
                        {task.subject ?? 'General'} · {task.durationMinutes}m
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Recent Quizzes */}
            {data.recentQuizSessions.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recent Quizzes</Text>
                {data.recentQuizSessions.slice(0, 3).map((quiz) => (
                  <View key={quiz.id} style={styles.quizCard}>
                    <Text style={styles.quizSubject} numberOfLines={1}>
                      {quiz.subject}
                    </Text>
                    {quiz.score != null && (
                      <View
                        style={[
                          styles.scoreBadge,
                          { backgroundColor: quiz.score >= 70 ? C.success + '22' : '#EF4444' + '22' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scoreText,
                            { color: quiz.score >= 70 ? C.success : '#EF4444' },
                          ]}
                        >
                          {Math.round(quiz.score)}%
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Failed to load dashboard</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '33' }]}>
      <Feather name={icon as any} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WeeklyChart({ data }: { data: { day: string; xp: number }[] }) {
  const max = Math.max(...data.map((d) => d.xp), 1);
  return (
    <View style={styles.chart}>
      {data.map((item, i) => (
        <View key={i} style={styles.chartCol}>
          <View style={styles.barBg}>
            <View
              style={[
                styles.bar,
                { height: `${(item.xp / max) * 100}%` as any },
              ]}
            />
          </View>
          <Text style={styles.chartDay}>{item.day.slice(0, 3)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  userName: { fontSize: 24, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold', marginTop: 2 },
  premiumBadge: {
    backgroundColor: '#F59E0B22',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F59E0B44',
  },
  premiumText: { fontSize: 13, color: '#F59E0B', fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  actionCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 10,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.7 },
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 28,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  barBg: {
    flex: 1,
    width: '100%',
    backgroundColor: C.secondary,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: C.primary, borderRadius: 6, minHeight: 4 },
  chartDay: { fontSize: 10, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 12,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: C.foreground, fontFamily: 'Inter_500Medium' },
  taskDone: { textDecorationLine: 'line-through', color: C.mutedForeground },
  taskMeta: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  quizSubject: { fontSize: 14, color: C.foreground, fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },
  scoreBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  errorBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  errorText: { fontSize: 15, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
