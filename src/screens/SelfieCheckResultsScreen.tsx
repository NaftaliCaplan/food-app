import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { PhotoResultLayout } from '../components/PhotoResultLayout';
import { ResultStatusOverlay } from '../components/ResultStatusOverlay';
import { SelfieCheckResultCard } from '../components/SelfieCheckResultCard';
import { useSelfieCheckAnalysis } from '../hooks/useSelfieCheckAnalysis';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../storage/profileStorage';
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
    <PhotoResultLayout title="Outfit Check" onBack={() => navigation.goBack()} photoUri={photoUri}>
      {isLoading || status === 'error' ? (
        <ResultStatusOverlay
          status={isLoading ? 'loading' : 'error'}
          error={error}
          loadingText="Analyzing your outfit..."
        />
      ) : (
        result && <SelfieCheckResultCard result={result} />
      )}

      {!isLoading && status === 'success' && (
        <CheckAnotherButton onPress={() => navigation.navigate('SelfieCheck')} />
      )}
    </PhotoResultLayout>
  );
}
