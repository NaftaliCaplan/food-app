import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

interface Props extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function PrimaryInput({ value, onChangeText, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, focused && styles.containerFocused]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
        returnKeyType="done"
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  containerFocused: {
    borderColor: Colors.accent,
  },
  input: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
});
