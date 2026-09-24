import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  label: string;
  sublabel: string;
  value: boolean;
  onToggle: () => void;
}

export function ToggleRow({ label, sublabel, value, onToggle }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <View style={styles.text}>
        <AppText style={styles.title}>
          {value ? '[x]' : '[ ]'} {label}
        </AppText>
        <AppText style={styles.sub}>{sublabel}</AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
