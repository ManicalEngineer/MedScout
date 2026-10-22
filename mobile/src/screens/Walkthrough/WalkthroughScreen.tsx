import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOK } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';

interface Slide {
  icon: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: '☎',
    title: 'Call pharmacies, tracked',
    body: 'Start a call with one tap. MedScout times it, lets you log what you heard, and keeps a history of every pharmacy you\'ve called.',
  },
  {
    icon: '⏳',
    title: 'Refill countdown',
    body: 'Set your last fill date once and MedScout counts down to when you\'re eligible to refill, so you know exactly when to start calling.',
  },
  {
    icon: '📝',
    title: 'A script for every call',
    body: 'Before you dial, MedScout gives you exactly what to say, in a tone you pick, so you\'re never caught off guard on the phone.',
  },
  {
    icon: '🗺',
    title: 'See what the community found',
    body: 'Contribute a report and unlock a map of nearby pharmacies with stock reported by other people searching for the same medications.',
  },
];

// No navigation prop needed: dismissWalkthrough() flips AuthContext's
// hasSeenWalkthrough, and AppNavigator's conditional RootStack render swaps
// to Main on its own — same pattern OnboardingScreen uses to hand off to
// Main after refresh() flips hasMedicationProfile.
export function WalkthroughScreen() {
  const { dismissWalkthrough } = useAuth();
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const finish = async () => {
    await dismissWalkthrough();
  };

  const next = () => {
    if (isLast) { finish(); return; }
    setStep(s => s + 1);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.progress}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity
          onPress={finish}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Skip walkthrough"
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{slide.icon}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <Button
          testID="walkthrough-next-button"
          variant="primary"
          size="lg"
          onPress={next}
          accessibilityLabel={isLast ? 'Get started' : 'Next'}
        >
          {isLast ? 'Get Started' : 'Next'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg, padding: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: TOK.border },
  dotActive: { backgroundColor: TOK.primary },
  skip: { fontSize: 14, fontWeight: '600', color: TOK.textMuted, paddingVertical: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8 },
  iconCircle: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: TOK.primaryDim, borderWidth: 2, borderColor: TOK.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  icon: { fontSize: 38 },
  title: { fontSize: 22, fontWeight: '700', color: TOK.text, letterSpacing: -0.4, textAlign: 'center' },
  body: { fontSize: 15, color: TOK.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  footer: { paddingTop: 16 },
});
