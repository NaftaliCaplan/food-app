import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  status: 'loading' | 'error';
  error?: string | null;
  // Previously 3 near-identical components (StatusOverlay, LightStatusOverlay,
  // SelfieCheckStatusOverlay) differing only in this one loading-copy string —
  // see docs/AUDIT-2026-11-15.md's Duplication findings. Callers compute their
  // own domain-specific copy (e.g. `Analyzing ${foodLabel}...`) rather than
  // this component guessing at it.
  loadingText: string;
}

export function ResultStatusOverlay({ status, error, loadingText }: Props) {
  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <AppText style={styles.loadingText}>{loadingText}</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.errorIcon}>[ERROR]</AppText>
      <AppText style={styles.errorTitle}>Analysis failed</AppText>
      <AppText style={styles.errorMessage}>{error}</AppText>
      <AppText style={styles.errorHint}>Check your connection and try again</AppText>
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.stateError,
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
