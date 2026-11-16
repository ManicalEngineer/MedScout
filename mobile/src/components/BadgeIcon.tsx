import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TOK } from '../theme/tokens';

// Keyed by the backend's badge keys (gamification.BADGES). Unknown keys from a
// newer backend fall back to a generic medal rather than crashing.
const EMOJI: Record<string, string> = {
  founding_contributor: '🏅',
  first_report: '📍',
  made_the_call: '📞',
  pup: '🐶',
  tracker: '🐕',
  bloodhound: '🦮',
  quiet_hero: '🤫',
  steady_nose_3: '👃',
  steady_nose_6: '👃',
  steady_nose_12: '👃',
  year_one: '🎂',
};

const TIER: Record<string, string> = { steady_nose_6: 'II', steady_nose_12: 'III' };

export function badgeEmoji(key: string): string {
  return EMOJI[key] ?? '🏅';
}

interface Props {
  badgeKey: string;
  size?: number;
  locked?: boolean;
}

export function BadgeIcon({ badgeKey, size = 48, locked = false }: Props) {
  const tier = TIER[badgeKey];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        locked ? styles.locked : styles.earned,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.48, opacity: locked ? 0.35 : 1 }}>{badgeEmoji(badgeKey)}</Text>
      {tier && (
        <View style={styles.tier}>
          <Text style={styles.tierText}>{tier}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  earned: { backgroundColor: TOK.primaryDim, borderColor: 'rgba(249,115,22,0.45)' },
  locked: { backgroundColor: TOK.surface2, borderColor: TOK.border, borderStyle: 'dashed' },
  tier: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: TOK.primary, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1,
  },
  tierText: { fontSize: 9, fontWeight: '800', color: TOK.bg },
});
