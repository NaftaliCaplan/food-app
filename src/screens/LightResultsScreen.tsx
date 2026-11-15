import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { LightResultCard } from '../components/LightResultCard';
import { PhotoResultLayout } from '../components/PhotoResultLayout';
import { ResultStatusOverlay } from '../components/ResultStatusOverlay';
import { useLightAnalysis } from '../hooks/useLightAnalysis';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LightResults'>;
type Route = RouteProp<RootStackParamList, 'LightResults'>;

export function LightResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { photoUri } = params;

  const { status, result, error } = useLightAnalysis(photoUri);

  return (
    <PhotoResultLayout title="Light Check" onBack={() => navigation.goBack()} photoUri={photoUri}>
      {status === 'loading' || status === 'error' ? (
        <ResultStatusOverlay status={status} error={error} loadingText="Reading the light..." />
      ) : (
        result && <LightResultCard result={result} />
      )}

      {status === 'success' && (
        <CheckAnotherButton onPress={() => navigation.navigate('LightChecker')} />
      )}
    </PhotoResultLayout>
  );
}
