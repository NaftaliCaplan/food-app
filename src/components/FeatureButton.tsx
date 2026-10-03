import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle: string;
  onPress?: () => void;
}

export function FeatureButton({ title, subtitle, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.text}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.subtitle}>{subtitle}</AppText>
      </View>
      <AppText style={styles.arrow}>→</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  text: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  arrow: {
    fontSize: 18,
    color: Colors.accent,
  },
});
