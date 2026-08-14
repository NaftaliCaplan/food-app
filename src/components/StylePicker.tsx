import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { StylePreference } from '../types/wardrobe';
import { STYLE_KEYS, STYLE_LABELS } from '../utils/styleTags';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  // undefined means no style tag is currently set on the item.
  style: StylePreference | undefined;
  onChange: (style: StylePreference) => void;
}

export function StylePicker({ style, onChange }: Props) {
  return (
    <View style={styles.row}>
      {STYLE_KEYS.map(key => {
        const active = style === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(key)}
            accessibilityLabel={STYLE_LABELS[key]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {active ? '(x)' : '( )'} {STYLE_LABELS[key]}
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
