import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TOK } from '../theme/tokens';

interface ToggleProps {
  value: boolean;
  onValueChange?: (v: boolean) => void;
}

export function Toggle({ value, onValueChange }: ToggleProps) {
  return (
    <TouchableOpacity onPress={() => onValueChange?.(!value)} activeOpacity={0.8}>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOK.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  trackOn: {
    backgroundColor: TOK.primary,
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-start',
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
