import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { TOK } from '../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  accent?: boolean;
  style?: ViewStyle;
}

export function Card({ children, accent, style }: CardProps) {
  return (
    <View style={[styles.card, accent && styles.accent, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TOK.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOK.border,
    padding: 14,
  },
  accent: {
    borderColor: TOK.primary,
  },
});
