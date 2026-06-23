import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  confidencePercent: number;
}

export function ConfidenceBadge({ confidencePercent }: Props) {
  return (
    <View style={styles.pill}>
      <AppText style={styles.text}>{confidencePercent}% confident</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  text: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '700',
  },
});
