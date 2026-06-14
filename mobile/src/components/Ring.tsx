import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { TOK } from '../theme/tokens';

interface RingProps {
  days: number;
  color: string;
  runOutDate?: string;
}

export function Ring({ days, color, runOutDate }: RingProps) {
  const size = 168;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(days, 0) / 14, 1);
  const dash = c * pct;

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TOK.surface} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.days, { color: TOK.text }]}>{days}</Text>
        <Text style={styles.label}>days ahead</Text>
        {runOutDate && <Text style={styles.date}>est. {formatDate(runOutDate)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 168,
    height: 168,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  days: {
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  label: {
    fontSize: 10,
    color: TOK.textMuted,
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  date: {
    fontSize: 10,
    color: TOK.textDim,
    marginTop: 4,
  },
});
