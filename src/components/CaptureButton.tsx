import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.outer, disabled && styles.outerDisabled]}
      testID="capture-button"
    >
      <View style={[styles.inner, disabled && styles.innerDisabled]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerDisabled: {
    borderColor: Colors.textDisabled,
  },
  inner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  innerDisabled: {
    backgroundColor: Colors.textDisabled,
  },
});
