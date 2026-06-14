import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { TOK } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { login, register } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export function LoginScreen({ navigation }: Props) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { Alert.alert('Missing fields'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
        navigation.navigate('Onboarding');
        return;
      }
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>💊</Text>
          <Text style={styles.logoText}>MedScout</Text>
          <Text style={styles.tagline}>Find your meds without the dread.</Text>
        </View>

        <View style={styles.toggle}>
          {(['login', 'register'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={TOK.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={TOK.textDim}
            secureTextEntry
          />
        </View>

        <Button variant="primary" size="lg" onPress={handleSubmit} loading={loading} style={styles.cta}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 20 },
  logo: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoIcon: { fontSize: 56 },
  logoText: { fontSize: 32, fontWeight: '700', color: TOK.text, letterSpacing: -1 },
  tagline: { fontSize: 14, color: TOK.textMuted },
  toggle: {
    flexDirection: 'row',
    backgroundColor: TOK.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: TOK.borderSoft,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleActive: { backgroundColor: TOK.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: TOK.textMuted },
  toggleTextActive: { color: TOK.bg },
  form: { gap: 4 },
  label: { fontSize: 11, fontWeight: '600', color: TOK.textDim, letterSpacing: 0.6, marginBottom: 6 },
  input: {
    backgroundColor: TOK.surface,
    borderWidth: 1,
    borderColor: TOK.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: TOK.text,
  },
  cta: { marginTop: 8 },
});
