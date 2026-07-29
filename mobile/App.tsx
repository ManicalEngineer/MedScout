import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { configureForegroundNotifications } from './src/services/pushNotifications';

configureForegroundNotifications();

// Only initializes if the DSN is set — local/dev runs without it are
// unaffected, mirroring the backend's inert-until-configured pattern.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.1,
  });
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default sentryDsn ? Sentry.wrap(App) : App;
