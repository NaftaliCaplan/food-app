import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function FeatureButton({ title, subtitle, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.text}>
        <AppText style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </AppText>
        <AppText style={[styles.subtitle, disabled && styles.subtitleDisabled]}>
          {subtitle}
        </AppText>
        {disabled && (
          <AppText style={styles.comingSoon}>Coming soon</AppText>
        )}
      </View>
      <AppText style={[styles.arrow, disabled && styles.arrowDisabled]}>→</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardDisabled: {
    opacity: 0.5,
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
  titleDisabled: {
    color: Colors.textDisabled,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  subtitleDisabled: {
    color: Colors.textDisabled,
  },
  comingSoon: {
    fontSize: 12,
    color: Colors.textDisabled,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  arrow: {
    fontSize: 18,
    color: Colors.accent,
  },
  arrowDisabled: {
    color: Colors.textDisabled,
  },
});
