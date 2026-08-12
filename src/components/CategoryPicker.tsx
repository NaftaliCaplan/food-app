import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory } from '../types/wardrobe';
import { AppText } from './AppText';

const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'top',       label: 'Top' },
  { key: 'bottom',    label: 'Bottom' },
  { key: 'shoes',     label: 'Shoes' },
  { key: 'accessory', label: 'Accessory' },
];

interface Props {
  category: ItemCategory;
  onChange: (category: ItemCategory) => void;
}

export function CategoryPicker({ category, onChange }: Props) {
  return (
    <View style={styles.categoryRow}>
      {CATEGORIES.map(c => {
        const active = category === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            style={[styles.catChip, active && styles.catChipActive]}
            onPress={() => onChange(c.key)}
            accessibilityLabel={c.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <AppText style={[styles.catLabel, active && styles.catLabelActive]}>
              {active ? '(x)' : '( )'} {c.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catChip: {
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  catChipActive: {
    borderColor: Colors.accent,
  },
  catLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  catLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
});
