import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { LightCheckResult, LightColor } from '../types/light';
import { AppText } from './AppText';

// Icon is identical/neutral across red/green/amber on purpose — unlike
// SelfieCheckResultCard's TIER_ICON, these must NOT encode meaning (no
// [STOP]/[GO]), since this feature explicitly never states what a color
// commonly means. The big uppercase text label is the real accessibility
// mechanism; only "unclear" gets a distinct icon.
const COLOR_ICON: Record<LightColor, string> = {
  red: '[LIGHT]',
  green: '[LIGHT]',
  amber: '[LIGHT]',
  unclear: '[?]',
};

const COLOR_SWATCH: Record<LightColor, string> = {
  red: Colors.lightRed,
  green: Colors.lightGreen,
  amber: Colors.lightAmber,
  unclear: Colors.lightUnclear,
};

interface Props {
  result: LightCheckResult;
}

export function LightResultCard({ result }: Props) {
  const color = COLOR_SWATCH[result.color];
  const icon = COLOR_ICON[result.color];

  return (
    <View style={styles.card}>
      <View style={[styles.colorBadge, { borderColor: color }]}>
        <AppText style={styles.icon}>{icon}</AppText>
        <AppText style={[styles.colorLabel, { color }]}>
          {result.colorLabel.toUpperCase()}
        </AppText>
      </View>

      {result.color === 'unclear' && !!result.detail && (
        <AppText style={styles.detail}>{result.detail}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 0,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  colorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  colorLabel: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detail: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
