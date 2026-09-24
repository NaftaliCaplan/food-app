import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelfieCheckResultCard } from '../components/SelfieCheckResultCard';
import { SelfieCheckStatusOverlay } from '../components/SelfieCheckStatusOverlay';
import { useSelfieCheckAnalysis } from '../hooks/useSelfieCheckAnalysis';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { UserProfile } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SelfieCheckResults'>;
type Route = RouteProp<RootStackParamList, 'SelfieCheckResults'>;

export function SelfieCheckResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { photoUri, useProfile } = params;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  // Same split as OutfitResultsScreen: this screen resolves the profile from
  // storage (only when the capture screen's toggle asked for it), the hook
  // itself stays a thin async-call-plus-status wrapper.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = useProfile ? await getUserProfile() : null;
      if (cancelled) return;
      setProfile(p);
      setProfileReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [useProfile]);

  const { status, result, error } = useSelfieCheckAnalysis(photoUri, profile, profileReady);
  const isLoading = !profileReady || status === 'loading';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <ScreenHeader title="Outfit Check" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <AppText style={styles.photoPlaceholderIcon}>[PHOTO]</AppText>
            <AppText style={styles.photoPlaceholderText}>Photo captured</AppText>
          </View>
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>

        <View style={styles.content}>
          {isLoading || status === 'error' ? (
            <SelfieCheckStatusOverlay status={isLoading ? 'loading' : 'error'} error={error} />
          ) : (
            result && <SelfieCheckResultCard result={result} />
          )}

          {!isLoading && status === 'success' && (
            <CheckAnotherButton onPress={() => navigation.navigate('SelfieCheck')} />
          )}
        </View>
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
