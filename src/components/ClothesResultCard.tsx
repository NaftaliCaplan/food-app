import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ClothesAnalysisResult, MatchVerdict } from '../types/clothesAnalysis';
import { AppText } from './AppText';
import { ConfidenceBadge } from './ConfidenceBadge';
import { CueBulletList } from './CueBulletList';

const VERDICT_ICON: Record<MatchVerdict, string> = {
  strong_match: '✅',
  good_match:   '👍',
  neutral:      '➖',
  mild_clash:   '⚠️',
  strong_clash: '❌',
  unknown:      '❓',
};

const VERDICT_COLOR: Record<MatchVerdict, string> = {
  strong_match: Colors.clothesStrongMatch,
  good_match:   Colors.clothesGoodMatch,
  neutral:      Colors.clothesNeutral,
  mild_clash:   Colors.clothesMildClash,
  strong_clash: Colors.clothesStrongClash,
  unknown:      Colors.textSecondary,
};

interface Props {
  result: ClothesAnalysisResult;
}

export function ClothesResultCard({ result }: Props) {
  const color = VERDICT_COLOR[result.verdict];
  const icon = VERDICT_ICON[result.verdict];

  const patternAndTone = [...result.patternNotes, ...result.toneNotes];

  return (
    <View style={styles.card}>
      {/* Verdict — icon + label + color border, all three together */}
      <View style={[styles.verdictBadge, { borderColor: color }]}>
        <AppText style={styles.verdictIcon}>{icon}</AppText>
        <AppText style={[styles.verdictLabel, { color }]}>
          {result.verdictLabel.toUpperCase()}
        </AppText>
      </View>

      {/* Confidence */}
      <ConfidenceBadge confidencePercent={result.confidencePercent} />

      {/* Garments */}
      {result.garmentDescriptions.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>GARMENTS</AppText>
          <CueBulletList cues={result.garmentDescriptions} />
        </View>
      )}

      {/* Contrast */}
      {result.contrastNotes.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>CONTRAST</AppText>
          <CueBulletList cues={result.contrastNotes} />
        </View>
      )}

      {/* Patterns & Tone */}
      {patternAndTone.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>PATTERNS & TONE</AppText>
          <CueBulletList cues={patternAndTone} />
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
    backgroundColor: Colors.clothesAccentMuted,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  verdictIcon: {
    fontSize: 24,
  },
  verdictLabel: {
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
});
