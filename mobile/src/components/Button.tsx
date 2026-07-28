import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { TOK } from '../theme/tokens';

type Variant = 'primary' | 'ghost' | 'dark' | 'outline' | 'success' | 'danger';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  full?: boolean;
  testID?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  full = true,
  testID,
}: ButtonProps) {
  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        vs.btn,
        ss.btn,
        full && styles.full,
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.75}
    >
      <View style={styles.inner}>
        {loading
          ? <ActivityIndicator size="small" color={vs.textColor} />
          : typeof children === 'string'
            ? <Text style={[styles.text, vs.text, ss.text, textStyle]}>{children}</Text>
            : children
        }
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  full: { width: '100%' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<Variant, { btn: ViewStyle; text: TextStyle; textColor: string }> = {
  primary: {
    btn: { backgroundColor: TOK.primary, borderColor: TOK.primary },
    text: { color: TOK.bg },
    textColor: TOK.bg,
  },
  ghost: {
    btn: { backgroundColor: 'transparent', borderColor: TOK.border },
    text: { color: TOK.textMuted },
    textColor: TOK.textMuted,
  },
  dark: {
    btn: { backgroundColor: TOK.surface2, borderColor: TOK.border },
    text: { color: TOK.text },
    textColor: TOK.text,
  },
  outline: {
    btn: { backgroundColor: 'transparent', borderColor: TOK.primary },
    text: { color: TOK.primary },
    textColor: TOK.primary,
  },
  success: {
    btn: { backgroundColor: TOK.successDim, borderColor: TOK.success },
    text: { color: TOK.success },
    textColor: TOK.success,
  },
  danger: {
    btn: { backgroundColor: TOK.dangerDim, borderColor: TOK.danger },
    text: { color: TOK.danger },
    textColor: TOK.danger,
  },
};

const sizeStyles: Record<Size, { btn: ViewStyle; text: TextStyle }> = {
  lg: { btn: { paddingVertical: 16, paddingHorizontal: 20 }, text: { fontSize: 16 } },
  md: { btn: { paddingVertical: 12, paddingHorizontal: 16 }, text: { fontSize: 15 } },
  sm: { btn: { paddingVertical: 8,  paddingHorizontal: 12 }, text: { fontSize: 13 } },
};
