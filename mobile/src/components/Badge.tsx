import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { TOK } from '../theme/tokens';

type BadgeKind = 'success' | 'danger' | 'primary' | 'vault' | 'muted';

interface BadgeProps {
  children: React.ReactNode;
  kind?: BadgeKind;
  style?: ViewStyle;
}

const KIND_COLORS: Record<BadgeKind, string> = {
  success: TOK.success,
  danger: TOK.danger,
  primary: TOK.primary,
  vault: TOK.vault,
  muted: TOK.textMuted,
};

export function Badge({ children, kind = 'primary', style }: BadgeProps) {
  const color = KIND_COLORS[kind];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: `${color}50` }, style]}>
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
