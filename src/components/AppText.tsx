import { StyleSheet, Text, TextProps } from 'react-native';

import { Colors } from '../theme/colors';

const FONT_REGULAR = 'JetBrainsMono_400Regular';
const FONT_BOLD = 'JetBrainsMono_700Bold';

// Custom fonts ignore the `fontWeight` style prop in React Native — the font
// family itself has to change. Rather than touch every screen's StyleSheet,
// we read the requested weight here and swap in the bold font file for it.
export function AppText({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style);
  const weight = flat?.fontWeight;
  const isBold = weight === 'bold' || Number(weight) >= 600;

  return (
    <Text
      style={[
        { color: Colors.textPrimary, fontSize: 16, fontFamily: isBold ? FONT_BOLD : FONT_REGULAR },
        style,
      ]}
      {...rest}
    />
  );
}
