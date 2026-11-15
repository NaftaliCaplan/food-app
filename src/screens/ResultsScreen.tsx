import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';

import { AppText } from '../components/AppText';
import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { PhotoResultLayout } from '../components/PhotoResultLayout';
import { ResultCard } from '../components/ResultCard';
import { ResultStatusOverlay } from '../components/ResultStatusOverlay';
import { useAnalysis } from '../hooks/useAnalysis';
import { Colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Results'>;
type Route = RouteProp<RootStackParamList, 'Results'>;

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { photoUri, foodLabel } = params;

  const { status, result, error } = useAnalysis(photoUri, foodLabel);
  const titleLabel = foodLabel.replace(/\b\w/g, c => c.toUpperCase());

  return (
    <PhotoResultLayout title={titleLabel} onBack={() => navigation.goBack()} photoUri={photoUri}>
      <AppText style={styles.foodLabel}>{foodLabel}</AppText>

      {status === 'loading' || status === 'error' ? (
        <ResultStatusOverlay status={status} error={error} loadingText={`Analyzing ${foodLabel}...`} />
      ) : (
        result && <ResultCard result={result} />
      )}

      {status === 'success' && (
        <CheckAnotherButton onPress={() => navigation.navigate('FoodChecker')} />
      )}
    </PhotoResultLayout>
  );
}

const styles = StyleSheet.create({
  foodLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
});
