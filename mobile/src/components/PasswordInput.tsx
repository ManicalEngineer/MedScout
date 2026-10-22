import React, { useState } from 'react';
import { TextInput, TextInputProps, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TOK } from '../theme/tokens';

// Maestro/XCUITest cannot type into secureTextEntry fields on iOS -- a known
// tooling limitation, not a security concern to work around in real builds.
// EXPO_PUBLIC_E2E_TEST is only ever set for local Maestro runs, never in dev
// or prod builds -- when set, the field ignores the toggle and stays plain.
const IS_E2E = process.env.EXPO_PUBLIC_E2E_TEST === 'true';

type Props = Omit<TextInputProps, 'secureTextEntry'>;

/** A password TextInput with a show/hide eye toggle. Defaults to hidden. */
export function PasswordInput({ style, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[style, styles.input]}
        placeholderTextColor={TOK.textDim}
        secureTextEntry={!visible && !IS_E2E}
        {...props}
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible(v => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={TOK.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  toggle: { position: 'absolute', right: 12 },
});
