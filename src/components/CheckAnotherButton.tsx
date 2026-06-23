import { StyleSheet, TouchableOpacity } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  onPress: () => void;
}

export function CheckAnotherButton({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.7}>
      <AppText style={styles.text}>Check another</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  text: {
    color: Colors.accentText,
    fontWeight: '600',
    fontSize: 16,
  },
});
