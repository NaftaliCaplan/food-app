import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface ChipOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  isSelected: (key: T) => boolean;
  onPress: (key: T) => void;
  // 'radio' for single-select (CategoryPicker), 'checkbox' for multi-select
  // (StylePicker) — same chip visuals either way, only the a11y semantics differ.
  variant: 'radio' | 'checkbox';
}

export function ChipPicker<T extends string>({ options, isSelected, onPress, variant }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map(o => {
        const active = isSelected(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onPress(o.key)}
            accessibilityLabel={o.label}
            accessibilityRole={variant}
            accessibilityState={{ checked: active }}
          >
            <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {active ? '[x]' : '[ ]'} {o.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.accent,
  },
  chipLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
});
