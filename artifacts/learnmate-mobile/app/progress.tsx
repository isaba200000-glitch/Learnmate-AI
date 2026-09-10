import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetProgressStats } from '@workspace/api-client-react';
import colors from '@/constants/colors';

const C = colors.dark;

const CHART_COLORS = ['#4D93F5', '#10B981', '#F59E0B', '#A78BFA', '#EC4899', '#06B6D4'];

export default function ProgressScreen() {
  const { data, isLoading, error, refetch } = useGetProgressStats();
  const stats = data as unknown as {
    xp: number;
    level: number;
    streak: number;
    coins: number;
    totalStudyMinutes: number;
    flashcardsReviewed: number;
    quizzesCompleted: number;
    averageQuizScore: number;
    subjectBreakdown: { subject: string; count: number }[];
    recentActivity: { type: string; description: string; createdAt: string; xpEarned: number }[];
    achievements: { id: string | number; icon: string; title: string; description: string }[];
  } | undefined;

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.mutedText}>Failed to load progress</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const currentLevelXp = stats.xp % 1000;
  const pct = Math.round((currentLevelXp / 1000) * 100);
  const maxSubject = Math.max(...stats.subjectBreakdown.map((s) => s.count), 1);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Level banner */}
      <View style={styles.levelCard}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNum}>{stats.level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.levelTitle}>Level {stats.level} Scholar</Text>
          <Text style={styles.levelSub}>
            {stats.xp} total XP · {1000 - currentLevelXp} XP to next level
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>
      </View>

      {/* Streak + coins */}
      <View style={styles.row}>
        <MiniStat icon="zap" color="#F59E0B" value={`${stats.streak}`} label="Day Streak" />
        <MiniStat icon="star" color="#10B981" value={`${stats.coins}`} label="Coins" />
      </View>

      {/* Lifetime stats */}
      <Text style={styles.sectionTitle}>Lifetime Stats</Text>
      <View style={styles.row}>
        <MiniStat icon="clock" color="#4D93F5" value={`${Math.round(stats.totalStudyMinutes / 60)}h`} label="Study Time" />
        <MiniStat icon="layers" color="#A78BFA" value={`${stats.flashcardsReviewed}`} label="Cards Reviewed" />
      </View>
      <View style={styles.row}>
        <MiniStat icon="target" color="#10B981" value={`${stats.quizzesCompleted}`} label="Quizzes Passed" />
        <MiniStat icon="trending-up" color="#F59E0B" value={`${stats.averageQuizScore}%`} label="Avg Quiz Score" />
      </View>

      {/* Subject breakdown */}
      <Text style={styles.sectionTitle}>Subject Breakdown</Text>
      <View style={styles.card}>
        {stats.subjectBreakdown.length === 0 ? (
          <Text style={styles.mutedText}>Not enough data yet.</Text>
        ) : (
          stats.subjectBreakdown.map((s, i) => (
            <View key={s.subject} style={styles.subjectRow}>
              <Text style={styles.subjectName} numberOfLines={1}>{s.subject}</Text>
              <View style={styles.subjectBarBg}>
                <View
                  style={[
                    styles.subjectBar,
                    {
                      width: `${Math.max((s.count / maxSubject) * 100, 6)}%` as any,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    },
                  ]}
                />
              </View>
              <Text style={styles.subjectCount}>{s.count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.card}>
        {stats.recentActivity.length === 0 ? (
          <Text style={styles.mutedText}>No recent activity.</Text>
        ) : (
          stats.recentActivity.map((a, i) => (
            <View key={i} style={[styles.activityRow, i > 0 && styles.activityDivider]}>
              <View style={styles.activityIcon}>
                <Feather
                  name={a.type === 'quiz' ? 'target' : a.type === 'flashcard' ? 'layers' : a.type === 'note' ? 'book-open' : 'file-text'}
                  size={16}
                  color={C.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityDesc} numberOfLines={2}>{a.description}</Text>
                <Text style={styles.activityDate}>
                  {new Date(a.createdAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.activityXp}>+{a.xpEarned} XP</Text>
            </View>
          ))
        )}
      </View>

      {/* Achievements */}
      <Text style={styles.sectionTitle}>Achievements</Text>
      {stats.achievements.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.mutedText}>Complete quizzes and study plans to unlock achievements!</Text>
        </View>
      ) : (
        <View style={styles.achievementsGrid}>
          {stats.achievements.map((a) => (
            <View key={String(a.id)} style={styles.achievementCard}>
              <View style={styles.achievementIconWrap}>
                <Feather
                  name={(a.icon in Feather.glyphMap ? a.icon : 'award') as any}
                  size={26}
                  color="#F59E0B"
                />
              </View>
              <Text style={styles.achievementTitle}>{a.title}</Text>
              <Text style={styles.achievementDesc} numberOfLines={2}>{a.description}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function MiniStat({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 20, paddingBottom: 60 },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  levelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontSize: 26, color: C.primary, fontFamily: 'Inter_700Bold' },
  levelTitle: { fontSize: 18, color: '#fff', fontFamily: 'Inter_700Bold' },
  levelSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter_400Regular', marginTop: 2, marginBottom: 10 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, color: C.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  sectionTitle: { fontSize: 17, color: C.foreground, fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 10 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
  },
  mutedText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  subjectName: { width: 90, fontSize: 13, color: C.foreground, fontFamily: 'Inter_500Medium' },
  subjectBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.secondary, overflow: 'hidden' },
  subjectBar: { height: '100%', borderRadius: 5 },
  subjectCount: { width: 28, fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  activityDivider: { borderTopWidth: 1, borderTopColor: C.border },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDesc: { fontSize: 13, color: C.foreground, fontFamily: 'Inter_500Medium' },
  activityDate: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  activityXp: { fontSize: 12, color: C.success, fontFamily: 'Inter_700Bold' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  achievementCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  achievementIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  achievementTitle: { fontSize: 13, color: C.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  achievementDesc: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
