import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { TOK } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { login, register, oauthLogin } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

// Dismisses the system browser sheet once Google redirects back into the app.
// Wrapped defensively: expo-web-browser/expo-auth-session/expo-apple-authentication
// are new native modules that won't exist in a dev client built before they
// were added — without the try/catch, this call throws at module load and
// crashes the whole app (not just this screen) until a fresh `eas build` runs.
try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Native module not linked yet — social login will no-op until rebuilt.
}

// expo-auth-session's Google provider requires iosClientId (or androidClientId
// on Android) and throws synchronously during render if it's missing, rather
// than degrading gracefully — so this hook must never be called at all until
// the client ID is configured. Isolating it in its own component means the
// parent can choose not to mount it (and thus never call the hook) instead of
// crashing the whole Login screen when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is unset.
function GoogleSignInButton({
  onIdToken,
  disabled,
}: {
  onIdToken: (idToken: string) => void;
  disabled: boolean;
}) {
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.id_token) {
      onIdToken(googleResponse.params.id_token);
    } else if (googleResponse?.type === 'error') {
      Alert.alert('Google sign-in failed', googleResponse.error?.message || 'Something went wrong');
    }
  }, [googleResponse]);

  return (
    <TouchableOpacity
      style={styles.googleBtn}
      disabled={!googleRequest || disabled}
      onPress={() => promptGoogleAsync().catch((e: any) =>
        Alert.alert('Sign-in failed', e?.message || 'Something went wrong'))}
    >
      <Text style={styles.googleBtnText}>Continue with Google</Text>
    </TouchableOpacity>
  );
}

const GOOGLE_CONFIGURED = !!(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
);

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export function LoginScreen({ navigation }: Props) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // The submit button sits below the form fields, so once the keyboard opens
  // it can cover the button entirely with no way to scroll it into view —
  // nudge the scroll down whenever the keyboard appears.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // KeyboardAvoidingView's padding animation hasn't finished resizing the
      // scroll area yet when this event fires — scrolling immediately measures
      // against the pre-keyboard layout and undershoots. Let it settle first.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      // Guarded: throws if expo-apple-authentication isn't compiled into the
      // running dev client yet (new native module, needs an EAS rebuild).
      try {
        AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
      } catch {
        setAppleAvailable(false);
      }
    }
  }, []);

  const handleOAuth = async (provider: 'google' | 'apple', idToken: string) => {
    setLoading(true);
    try {
      await oauthLogin(provider, idToken);
      await refresh();
    } catch (e: any) {
      Alert.alert('Sign-in failed', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token');
      await handleOAuth('apple', credential.identityToken);
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign-in failed', e.message || 'Something went wrong');
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) { Alert.alert('Missing fields'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      // AppNavigator routes to Onboarding vs Main based on the on-device
      // medication-profile store, so refreshing here is what actually
      // navigates a freshly-registered user into Onboarding.
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Image source={require('../../../assets/dog-mark.png')} style={styles.logoIcon} resizeMode="contain" />
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
            testID="login-email-input"
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
            testID="login-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={TOK.textDim}
            // Maestro/XCUITest cannot type into secureTextEntry fields on iOS —
            // a known tooling limitation, not a security concern to work around
            // in real builds. EXPO_PUBLIC_E2E_TEST is only ever set for local
            // Maestro runs (see mobile/.maestro/), never in dev or prod builds.
            secureTextEntry={process.env.EXPO_PUBLIC_E2E_TEST !== 'true'}
          />
        </View>

        <Button testID="login-submit-button" variant="primary" size="lg" onPress={handleSubmit} loading={loading} style={styles.cta}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={10}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />
        )}

        {GOOGLE_CONFIGURED && (
          <GoogleSignInButton
            disabled={loading}
            onIdToken={(idToken) => handleOAuth('google', idToken)}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOK.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: TOK.borderSoft },
  dividerText: { fontSize: 12, color: TOK.textDim },
  appleBtn: { height: 46, width: '100%' },
  googleBtn: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: TOK.border,
    backgroundColor: TOK.surface, alignItems: 'center', justifyContent: 'center',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: TOK.text },
  logo: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoIcon: { width: 108, height: 108 },
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
