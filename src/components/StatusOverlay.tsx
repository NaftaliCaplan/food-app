import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  status: 'loading' | 'error';
  error?: string | null;
  foodLabel?: string;
}

export function StatusOverlay({ status, error, foodLabel }: Props) {
  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <AppText style={styles.loadingText}>
          Analyzing {foodLabel ?? 'food'}...
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.errorIcon}>⚠️</AppText>
      <AppText style={styles.errorTitle}>Analysis failed</AppText>
      <AppText style={styles.errorMessage}>{error}</AppText>
      <AppText style={styles.errorHint}>
        Check your connection and try again
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  errorIcon: {
    fontSize: 32,
  },
  errorTitle: {
    color: Colors.stateError,
    fontWeight: '700',
    fontSize: 16,
  },
  errorMessage: {
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  errorHint: {
    color: Colors.textDisabled,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
