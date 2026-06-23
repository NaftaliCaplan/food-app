import { Text, TextProps } from 'react-native';

import { Colors } from '../theme/colors';

export function AppText({ style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ color: Colors.textPrimary, fontSize: 16 }, style]}
      {...rest}
    />
  );
}
