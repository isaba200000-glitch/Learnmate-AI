/**
 * Premium features screen.
 *
 * This screen is purely informational — it displays which features require
 * Premium and which are free.  No price is shown and no purchase is initiated
 * inside the native binary, keeping the app compliant with App Store and
 * Google Play billing policies.
 *
 * Students who want Premium visit learnmate.ai in a browser; their entitlement
 * is then reflected here automatically on next sign-in (the backend endpoint
 * GET /api/premium/subscription is the authoritative source).
 *
 * If in-app purchases are added in the future (StoreKit 2 / Google Play
 * Billing Library), replace the "visit website" note below with the
 * appropriate IAP SDK flow and add server-side receipt verification.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGetSubscription } from '@workspace/api-client-react';
import colors from '@/constants/colors';

const C = colors.dark;

const FEATURES: { icon: string; text: string; premium: boolean }[] = [
  { icon: 'book-open',      text: 'All 84 lessons across 6 courses',       premium: true  },
  { icon: 'message-circle', text: 'Unlimited AI tutor questions',           premium: true  },
  { icon: 'zap',            text: 'Smart Notes – AI-generated summaries',   premium: true  },
  { icon: 'target',         text: 'Exam prep & important questions',        premium: true  },
  { icon: 'clock',          text: 'Unlimited Focus sessions',               premium: true  },
  { icon: 'layers',         text: 'Flashcard deck creation',                premium: false },
  { icon: 'file-text',      text: 'Unlimited notes',                        premium: false },
  { icon: 'bar-chart-2',    text: 'Progress tracking',                      premium: false },
  { icon: 'check-circle',   text: '3 free lessons per course',              premium: false },
];

type FeatherIconName =
  | 'book-open' | 'message-circle' | 'zap' | 'target' | 'clock'
  | 'layers' | 'file-text' | 'bar-chart-2' | 'check-circle';

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: sub } = useGetSubscription();

  const subInfo = sub as unknown as { status?: string; isOwner?: boolean } | undefined;
  const isPremium = subInfo?.status === 'active' || subInfo?.isOwner === true;

  const topPad = insets.top + 20 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 20 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Close */}
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={C.mutedForeground} />
        </Pressable>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={{ fontSize: 40 }}>⚡</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isPremium ? 'You\'re Premium!' : 'Premium Features'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isPremium
              ? 'You have full access to all LearnMate AI features.'
              : 'See what\'s included with Premium and what\'s always free.'}
          </Text>
        </View>

        {/* Feature list */}
        <Text style={styles.sectionTitle}>What's included</Text>

        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View
              style={[
                styles.featureIcon,
                f.premium ? styles.featureIconPremium : styles.featureIconFree,
              ]}
            >
              <Feather
                name={f.icon as FeatherIconName}
                size={16}
                color={f.premium ? '#F59E0B' : C.success}
              />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
            <View style={f.premium ? styles.premiumTag : styles.freeTag}>
              <Text style={f.premium ? styles.premiumTagText : styles.freeTagText}>
                {f.premium ? 'Premium' : 'Free'}
              </Text>
            </View>
          </View>
        ))}

        {/* Status */}
        {isPremium ? (
          <View style={styles.statusBox}>
            <Feather name="check-circle" size={20} color={C.success} />
            <Text style={styles.statusText}>Premium is active on your account</Text>
          </View>
        ) : (
          <View style={styles.statusBox}>
            <Feather name="info" size={20} color={C.mutedForeground} />
            <Text style={styles.statusText}>
              Premium is managed at learnmate.ai.{'\n'}
              After subscribing on the website, sign out and back in to activate it here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 24 },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 12 },
  hero: { alignItems: 'center', marginBottom: 28 },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#F59E0B22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B44',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconPremium: { backgroundColor: '#F59E0B22' },
  featureIconFree: { backgroundColor: C.success + '22' },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  premiumTag: {
    backgroundColor: '#F59E0B22',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumTagText: { fontSize: 10, color: '#F59E0B', fontFamily: 'Inter_600SemiBold' },
  freeTag: {
    backgroundColor: C.success + '22',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  freeTagText: { fontSize: 10, color: C.success, fontFamily: 'Inter_600SemiBold' },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 28,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});
