import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  // Most screens go "back"; a couple of steps within a screen cancel/retake
  // instead, which reuses the same slot/position but needs different copy.
  backLabel?: string;
}

// Shared header row used by every screen that has a back button. The title
// sits centered in the remaining space between two equal-width side slots
// (back button on the left, `right` on the right) so it stays centered
// whether or not a screen has right-side content. Callers own horizontal
// padding — this only supplies the row's own vertical padding, so it can be
// dropped into a SafeAreaView(edges=['top']) or a plain View without
// double-padding.
export function ScreenHeader({ title, onBack, right, backLabel = '← Back' }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <TouchableOpacity onPress={onBack}>
          <AppText style={styles.backText}>{backLabel}</AppText>
        </TouchableOpacity>
      </View>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  side: {
    minWidth: 60,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backText: {
    color: Colors.accent,
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
