import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
  useFonts,
} from '@expo-google-fonts/jetbrains-mono';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Colors } from './src/theme/colors';

// No-ops safely with no DSN set (confirmed in @sentry/react-native's own
// types: "If omitted, the SDK will not send any data to Sentry") — local
// dev naturally stays quiet since EXPO_PUBLIC_SENTRY_DSN is only ever set
// for real EAS environments (same eas env:set pattern already used for
// EXPO_PUBLIC_PROXY_URL/EXPO_PUBLIC_APP_SHARED_SECRET), never in a local
// .env. tracesSampleRate: 0 because only crash/error reporting is wanted
// here, not performance tracing — tracing would burn Sentry's free-tier
// span quota for no benefit to this app.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});

function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

// Sentry.wrap (not a plain export) adds automatic instrumentation — app
// start timing and touch-event breadcrumbs — so a crash report actually
// shows what the user was doing right before it happened, not just the
// stack trace alone.
export default Sentry.wrap(App);
