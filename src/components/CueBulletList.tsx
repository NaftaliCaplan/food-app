import { StyleSheet, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  cues: string[];
}

export function CueBulletList({ cues }: Props) {
  if (!cues.length) return null;

  return (
    <View style={styles.container}>
      {cues.map((cue, i) => (
        <View key={i} style={styles.row}>
          <AppText style={styles.bullet}>•</AppText>
          <AppText style={styles.text}>{cue}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bullet: {
    color: Colors.accent,
    fontSize: 15,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: 15,
    flex: 1,
  },
});
