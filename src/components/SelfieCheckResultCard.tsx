import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { SelfieCheckResult, SelfieMatchTier } from '../types/selfieCheck';
import { AppText } from './AppText';
import { CueBulletList } from './CueBulletList';

// Icons are the colorblind-accessible signal — always paired with TIER_COLOR
// but never dependent on it, same convention as the legacy clothes-checker
// this replaces (ClothesResultCard).
const TIER_ICON: Record<SelfieMatchTier, string> = {
  strong_match: '[MATCH]',
  good_match:   '[GOOD]',
  neutral:      '[NEUT]',
  mild_clash:   '[CLASH?]',
  strong_clash: '[CLASH]',
};

const TIER_LABEL: Record<SelfieMatchTier, string> = {
  strong_match: 'Strong Match',
  good_match:   'Good Match',
  neutral:      'Neutral',
  mild_clash:   'Mild Clash',
  strong_clash: 'Strong Clash',
};

const TIER_COLOR: Record<SelfieMatchTier, string> = {
  strong_match: Colors.clothesStrongMatch,
  good_match:   Colors.clothesGoodMatch,
  neutral:      Colors.clothesNeutral,
  mild_clash:   Colors.clothesMildClash,
  strong_clash: Colors.clothesStrongClash,
};

interface Props {
  result: SelfieCheckResult;
}

export function SelfieCheckResultCard({ result }: Props) {
  const color = TIER_COLOR[result.tier];
  const icon = TIER_ICON[result.tier];

  const top = result.garments.find(g => g.category === 'top');
  const bottom = result.garments.find(g => g.category === 'bottom');
  const shoes = result.garments.find(g => g.category === 'shoes');
  const accessories = result.garments.filter(g => g.category === 'accessory');

  return (
    <View style={styles.card}>
      {/* Verdict — icon + label + color border, all three together */}
      <View style={[styles.verdictBadge, { borderColor: color }]}>
        <AppText style={styles.verdictIcon}>{icon}</AppText>
        <AppText style={[styles.verdictLabel, { color }]}>
          {TIER_LABEL[result.tier].toUpperCase()}
        </AppText>
      </View>

      {/* Per-category breakdown — the real detected tags, not AI-written prose */}
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>TOP</AppText>
        {top ? <CueBulletList cues={top.tags} /> : <AppText style={styles.notDetected}>Not detected</AppText>}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>BOTTOM</AppText>
        {bottom ? <CueBulletList cues={bottom.tags} /> : <AppText style={styles.notDetected}>Not detected</AppText>}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>SHOES</AppText>
        {shoes ? <CueBulletList cues={shoes.tags} /> : <AppText style={styles.notDetected}>Not detected</AppText>}
      </View>

      {accessories.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>ACCESSORIES</AppText>
          <CueBulletList cues={accessories.map(a => a.tags.join(', '))} />
        </View>
      )}

      {/* Tip — generic, tier-based templated text, always accurate since it
          never references a specific item that might not really be there */}
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>TIP</AppText>
        <AppText style={styles.tip}>{result.tip}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 0,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  verdictIcon: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  notDetected: {
    color: Colors.textDisabled,
    fontSize: 14,
    fontStyle: 'italic',
  },
  tip: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
