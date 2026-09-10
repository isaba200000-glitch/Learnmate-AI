import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useGetProgressStats, useGetSubscription, getGetProgressStatsQueryKey } from '@workspace/api-client-react';
import colors from '@/constants/colors';

const C = colors.dark;

const LEVEL_XP = (level: number) => level * 500;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetProgressStats();
  const { data: sub } = useGetSubscription();

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const subInfo = sub as unknown as { status?: string; isOwner?: boolean } | undefined;
  const isPremium = subInfo?.status === 'active' || subInfo?.isOwner === true;
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const xpForLevel = LEVEL_XP(level);
  const xpPrev = LEVEL_XP(level - 1);
  const xpProgress = xpForLevel > xpPrev ? (xp - xpPrev) / (xpForLevel - xpPrev) : 0;

  const initials = (user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsLoading}
            onRefresh={refetchStats}
            tintColor={C.primary}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.fullName ?? 'Student'}</Text>
            <Text style={styles.email}>
              {user?.emailAddresses?.[0]?.emailAddress ?? ''}
            </Text>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Feather name="star" size={12} color="#F59E0B" />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
        </View>

        {/* XP Progress */}
        <View style={styles.xpCard}>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>Level {level}</Text>
            <Text style={styles.xpValue}>{xp} XP</Text>
          </View>
          <View style={styles.xpBg}>
            <View style={[styles.xpFill, { width: `${Math.min(xpProgress * 100, 100)}%` as any }]} />
          </View>
          <Text style={styles.xpNext}>{xpForLevel - xp} XP to Level {level + 1}</Text>
        </View>

        {statsLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />}

        {stats && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <StatTile icon="flame" label="Streak" value={`${stats.streak}d`} color="#EF4444" />
              <StatTile icon="book-open" label="Notes" value={String(stats.notesCreated)} color={C.primary} />
              <StatTile icon="check-circle" label="Quizzes" value={String(stats.quizzesCompleted)} color={C.success} />
              <StatTile icon="bar-chart-2" label="Avg Score" value={`${Math.round(stats.averageQuizScore)}%`} color="#A78BFA" />
              <StatTile icon="clock" label="Study hrs" value={`${Math.round(stats.totalStudyMinutes / 60)}h`} color="#F59E0B" />
              <StatTile icon="layers" label="Flashcards" value={String(stats.flashcardsReviewed)} color="#EC4899" />
            </View>

            {/* Achievements */}
            {stats.achievements.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Achievements</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}>
                  <View style={styles.achievementRow}>
                    {stats.achievements.map((ach) => (
                      <View key={ach.id} style={styles.achievementCard}>
                        <Text style={styles.achievementIcon}>{ach.icon}</Text>
                        <Text style={styles.achievementTitle} numberOfLines={1}>{ach.title}</Text>
                        <Text style={styles.achievementDesc} numberOfLines={2}>{ach.description}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Subject Breakdown */}
            {stats.subjectBreakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Subjects</Text>
                {stats.subjectBreakdown.slice(0, 5).map((s) => (
                  <View key={s.subject} style={styles.subjectRow}>
                    <Text style={styles.subjectName}>{s.subject}</Text>
                    <View style={styles.subjectBarBg}>
                      <View
                        style={[
                          styles.subjectBar,
                          { width: `${s.percentage}%` as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.subjectPct}>{Math.round(s.percentage)}%</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* Premium */}
        {!isPremium && (
          <Pressable
            style={({ pressed }) => [styles.premiumBtn, pressed && styles.pressed]}
            onPress={() => router.push('/premium')}
          >
            <View>
              <Text style={styles.premiumBtnTitle}>Upgrade to Premium</Text>
              <Text style={styles.premiumBtnSub}>Unlock all courses & AI features</Text>
            </View>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        )}

        {/* Settings / Sign Out */}
        <View style={styles.settingsSection}>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
            onPress={() => router.push('/premium')}
          >
            <Feather name="star" size={18} color={C.mutedForeground} />
            <Text style={styles.settingsLabel}>Subscription</Text>
            <Feather name="chevron-right" size={16} color={C.mutedForeground} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.settingsRow, styles.signOutRow, pressed && styles.pressed]}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={18} color={C.destructive} />
            <Text style={[styles.settingsLabel, { color: C.destructive }]}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statTile, { borderColor: color + '33' }]}>
      <Feather name={icon as any} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 20 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 26, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  name: { fontSize: 20, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  email: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  premiumBadgeText: { fontSize: 12, color: '#F59E0B', fontFamily: 'Inter_600SemiBold' },
  xpCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 24,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  xpLabel: { fontSize: 16, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  xpValue: { fontSize: 16, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  xpBg: {
    height: 8,
    backgroundColor: C.secondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  xpFill: { height: '100%', backgroundColor: C.primary, borderRadius: 4 },
  xpNext: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statTile: {
    width: '30%',
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    minWidth: 90,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  achievementRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 4 },
  achievementCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    width: 130,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  achievementIcon: { fontSize: 28 },
  achievementTitle: { fontSize: 12, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  achievementDesc: { fontSize: 11, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  subjectName: { fontSize: 13, color: C.foreground, fontFamily: 'Inter_500Medium', width: 80 },
  subjectBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: C.secondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  subjectBar: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
  subjectPct: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', width: 32, textAlign: 'right' },
  premiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.primary,
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
  },
  premiumBtnTitle: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  premiumBtnSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  settingsSection: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  signOutRow: { borderBottomWidth: 0 },
  settingsLabel: { flex: 1, fontSize: 15, color: C.foreground, fontFamily: 'Inter_500Medium' },
  pressed: { opacity: 0.7 },
});
