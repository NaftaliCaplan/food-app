import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AnalysisResult, RipenessState } from '../types/analysis';
import { AppText } from './AppText';
import { ConfidenceBadge } from './ConfidenceBadge';
import { CueBulletList } from './CueBulletList';

const STATE_ICON: Record<RipenessState, string> = {
  ripe:         '✅',
  unripe:       '⏳',
  overripe:     '⚠️',
  almost_ready: '🕐',
  use_soon:     '⚠️',
  raw:          '❌',
  rare:         '🔶',
  'medium-rare':'🟡',
  medium:       '🟢',
  'well-done':  '✅',
  unknown:      '❓',
};

const STATE_COLOR: Record<RipenessState, string> = {
  ripe:         Colors.stateRipe,
  unripe:       Colors.stateUnripe,
  overripe:     Colors.stateOverripe,
  almost_ready: Colors.stateAlmostReady,
  use_soon:     Colors.stateUseSoon,
  raw:          Colors.stateRaw,
  rare:         Colors.stateRare,
  'medium-rare':Colors.stateMediumRare,
  medium:       Colors.stateMedium,
  'well-done':  Colors.stateWellDone,
  unknown:      Colors.textSecondary,
};

interface Props {
  result: AnalysisResult;
}

export function ResultCard({ result }: Props) {
  const color = STATE_COLOR[result.state];
  const icon = STATE_ICON[result.state];

  return (
    <View style={styles.card}>
      {/* State */}
      <View style={[styles.stateBadge, { borderColor: color }]}>
        <AppText style={styles.stateIcon}>{icon}</AppText>
        <AppText style={[styles.stateLabel, { color }]}>
          {result.stateLabel.toUpperCase()}
        </AppText>
      </View>

      {/* Confidence */}
      <ConfidenceBadge confidencePercent={result.confidencePercent} />

      {/* Visual cues */}
      {result.visualCues.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>VISUAL CUES</AppText>
          <CueBulletList cues={result.visualCues} />
        </View>
      )}

      {/* Mismatch warning — only shown when model says label is wrong */}
      {result.labelMatch === false && !!result.observedFood && (
        <View style={styles.mismatchBanner}>
          <AppText style={styles.mismatchTitle}>Heads up</AppText>
          <AppText style={styles.mismatchText}>
            This looks like: {result.observedFood}
          </AppText>
        </View>
      )}

      {/* Recommendation */}
      {!!result.recommendation && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>RECOMMENDATION</AppText>
          <AppText style={styles.recommendation}>{result.recommendation}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  stateIcon: {
    fontSize: 24,
  },
  stateLabel: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  recommendation: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  mismatchBanner: {
    backgroundColor: Colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: Colors.stateUseSoon,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    gap: 2,
  },
  mismatchTitle: {
    color: Colors.stateUseSoon,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  mismatchText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
