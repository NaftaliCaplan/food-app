import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureButton } from '../components/FeatureButton';
import { AppText } from '../components/AppText';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Both the App Store and Google Play require this to be reachable from
// inside the app, not just linked from the store listing metadata — see
// docs/privacy-policy.html (hosted via this repo's own GitHub Pages site,
// independent of the user's personal GitHub Pages site in a different repo).
const PRIVACY_POLICY_URL = 'https://naftalicaplan.github.io/food-app/privacy-policy.html';

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
          subtitle="Build outfits from your wardrobe"
          onPress={() => navigation.navigate('Wardrobe')}
        />
        <FeatureButton
          title="How's my outfit?"
          subtitle="Check what you're wearing right now"
          onPress={() => navigation.navigate('SelfieCheck')}
        />
        <FeatureButton
          title="What color is it?"
          subtitle="Check the color of a status or indicator light"
          onPress={() => navigation.navigate('LightChecker')}
        />
      </View>

      <AppText style={styles.taglineBottom}>Point. Capture. Know.</AppText>
      <TouchableOpacity
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
        accessibilityRole="link"
      >
        <AppText style={styles.privacyLink}>Privacy Policy</AppText>
      </TouchableOpacity>
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
  privacyLink: {
    fontSize: 11,
    color: Colors.textDisabled,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: Spacing.xs,
  },
});
