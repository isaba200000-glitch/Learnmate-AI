import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGetFlashcardDeck } from '@workspace/api-client-react';
import colors from '@/constants/colors';
import { useEffect } from 'react';

const C = colors.dark;

interface Flashcard {
  id: number;
  front: string;
  back: string;
  difficulty: string | null;
  isBookmarked: boolean;
}

export default function FlashcardStudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { data: deck, isLoading } = useGetFlashcardDeck(parseInt(deckId ?? '0', 10));
  const cards = (deck as any)?.cards as Flashcard[] | undefined ?? [];

  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (deck) navigation.setOptions({ title: (deck as any).title ?? 'Flashcards' });
  }, [deck, navigation]);

  function flipCard() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!flipped) {
      Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, tension: 50 }).start();
    } else {
      Animated.spring(flipAnim, { toValue: 0, useNativeDriver: true, tension: 50 }).start();
    }
    setFlipped(!flipped);
  }

  function nextCard(didKnow: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (didKnow) setKnown((k) => k + 1);
    else setUnknown((u) => u + 1);

    if (cardIndex >= cards.length - 1) {
      setCompleted(true);
      return;
    }

    setFlipped(false);
    flipAnim.setValue(0);
    setCardIndex((i) => i + 1);
  }

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = { transform: [{ rotateY: frontInterpolate }] };
  const backAnimatedStyle = { transform: [{ rotateY: backInterpolate }] };

  const botPad = insets.bottom + 24 + (Platform.OS === 'web' ? 34 : 0);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.centered}>
        <Feather name="layers" size={40} color={C.border} />
        <Text style={styles.emptyTitle}>No cards yet</Text>
        <Text style={styles.emptyText}>Add cards to this deck from the web app to start studying</Text>
      </View>
    );
  }

  if (completed) {
    const total = known + unknown;
    const score = total > 0 ? Math.round((known / total) * 100) : 0;
    return (
      <View style={[styles.centered, { paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: 56 }}>🎉</Text>
        <Text style={styles.completedTitle}>Session Complete!</Text>
        <View style={styles.resultsRow}>
          <View style={styles.resultCard}>
            <Text style={[styles.resultNum, { color: C.success }]}>{known}</Text>
            <Text style={styles.resultLabel}>Got it</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={[styles.resultNum, { color: '#EF4444' }]}>{unknown}</Text>
            <Text style={styles.resultLabel}>Review</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={[styles.resultNum, { color: C.primary }]}>{score}%</Text>
            <Text style={styles.resultLabel}>Score</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.restartBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setCardIndex(0);
            setFlipped(false);
            flipAnim.setValue(0);
            setCompleted(false);
            setKnown(0);
            setUnknown(0);
          }}
        >
          <Text style={styles.restartBtnText}>Study Again</Text>
        </Pressable>
      </View>
    );
  }

  const card = cards[cardIndex];
  const progress = (cardIndex + 1) / cards.length;

  return (
    <View style={[styles.root, { paddingBottom: botPad }]}>
      {/* Progress bar */}
      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <Text style={styles.progressText}>{cardIndex + 1} / {cards.length}</Text>

      {/* Flip card */}
      <View style={styles.cardContainer}>
        {/* Front */}
        <Animated.View style={[styles.card, frontAnimatedStyle]}>
          <Text style={styles.cardSide}>Question</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardContent}>
            <Text style={styles.cardText}>{card.front}</Text>
          </ScrollView>
          <Text style={styles.tapHint}>Tap to reveal answer</Text>
        </Animated.View>

        {/* Back */}
        <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
          <Text style={[styles.cardSide, { color: C.success }]}>Answer</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardContent}>
            <Text style={styles.cardText}>{card.back}</Text>
          </ScrollView>
        </Animated.View>
      </View>

      <Pressable style={styles.flipBtn} onPress={flipCard}>
        <Feather name="refresh-cw" size={16} color={C.mutedForeground} />
        <Text style={styles.flipBtnText}>{flipped ? 'Show Question' : 'Show Answer'}</Text>
      </Pressable>

      {/* Know / Don't know buttons */}
      {flipped && (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.dontKnowBtn, pressed && { opacity: 0.8 }]}
            onPress={() => nextCard(false)}
          >
            <Feather name="x" size={22} color="#EF4444" />
            <Text style={styles.dontKnowText}>Again</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.knowBtn, pressed && { opacity: 0.8 }]}
            onPress={() => nextCard(true)}
          >
            <Feather name="check" size={22} color={C.success} />
            <Text style={styles.knowText}>Got it</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background, paddingHorizontal: 20, paddingTop: 16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.background,
    gap: 14,
    padding: 32,
  },
  progressBg: {
    height: 4,
    backgroundColor: C.secondary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 20, textAlign: 'center' },
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  card: {
    width: '100%',
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBack: { backgroundColor: C.card },
  cardSide: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  cardContent: { flexGrow: 1, justifyContent: 'center' },
  cardText: { fontSize: 20, color: C.foreground, fontFamily: 'Inter_500Medium', lineHeight: 30, textAlign: 'center' },
  tapHint: { fontSize: 12, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 16 },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.secondary,
    borderRadius: 20,
    marginBottom: 20,
  },
  flipBtnText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_500Medium' },
  actionRow: { flexDirection: 'row', gap: 12 },
  dontKnowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF444422',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EF444444',
  },
  dontKnowText: { fontSize: 16, fontWeight: '600', color: '#EF4444', fontFamily: 'Inter_600SemiBold' },
  knowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.success + '22',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.success + '44',
  },
  knowText: { fontSize: 16, fontWeight: '600', color: C.success, fontFamily: 'Inter_600SemiBold' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  completedTitle: { fontSize: 26, fontWeight: '700', color: C.foreground, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  resultsRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  resultCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 4,
  },
  resultNum: { fontSize: 28, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  resultLabel: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  restartBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  restartBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
});
