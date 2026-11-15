import { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  title: string;
  onBack: () => void;
  photoUri: string;
  // Each checker's status-overlay-or-result-card plus its "check another"
  // button — the one part of this screen shape that's genuinely
  // domain-specific, so it stays a children slot rather than more props.
  children: ReactNode;
}

// The shared photo-header/scroll/content shell behind the food, light, and
// selfie-outfit result screens — previously 3 byte-identical copies of this
// exact layout and StyleSheet (see docs/AUDIT-2026-11-15.md's Duplication
// finding #1, which crossed from a 2-way to a 3-way duplicate once the light
// checker shipped — the prior audit had explicitly declined to merge the
// first 2 for not being a strong-enough rule-of-three case at the time).
export function PhotoResultLayout({ title, onBack, photoUri, children }: Props) {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <ScreenHeader title={title} onBack={onBack} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <AppText style={styles.photoPlaceholderIcon}>[PHOTO]</AppText>
            <AppText style={styles.photoPlaceholderText}>Photo captured</AppText>
          </View>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        </View>

        <View style={styles.content}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
  },
  scroll: {
    flexGrow: 1,
  },
  photoContainer: {
    width: '100%',
    height: 280,
    backgroundColor: Colors.surface,
  },
  photo: {
    position: 'absolute',
    width: '100%',
    height: 280,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  photoPlaceholder: {
    position: 'absolute',
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  photoPlaceholderIcon: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  photoPlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
