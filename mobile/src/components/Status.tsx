import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { TOK, StatusKind, STATUS_COLORS } from '../theme/tokens';

interface StatusProps {
  kind: StatusKind | string;
  label?: string;
  style?: ViewStyle;
}

const KIND_LABELS: Record<string, string> = {
  ok: 'In stock',
  out: 'Out of stock',
  soon: 'Back soon',
  muted: '—',
};

export function Status({ kind, label, style }: StatusProps) {
  const color = STATUS_COLORS[kind as StatusKind] ?? TOK.textMuted;
  const text = label ?? KIND_LABELS[kind] ?? kind;
  return (
    <View style={[styles.container, { backgroundColor: `${color}20`, borderColor: `${color}50` }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
