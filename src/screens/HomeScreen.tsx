import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureButton } from '../components/FeatureButton';
import { AppText } from '../components/AppText';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AppText style={styles.appName}>CBA</AppText>
        <AppText style={styles.tagline}>color-blind assist</AppText>
      </View>

      <View style={styles.cards}>
        <FeatureButton
          title="Is it ready?"
          subtitle="Check if your food is ripe, done, or safe to eat"
          onPress={() => navigation.navigate('FoodChecker')}
        />
        <FeatureButton
          title="Does it match?"
          subtitle="Check if your clothes go together"
          onPress={() => navigation.navigate('ClothesChecker')}
        />
      </View>

      <AppText style={styles.taglineBottom}>Point. Capture. Know.</AppText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.textPrimary,
  },
  tagline: {
    fontSize: 13,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  cards: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  taglineBottom: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
