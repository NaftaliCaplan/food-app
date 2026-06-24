import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { ResultCard } from '../components/ResultCard';
import { StatusOverlay } from '../components/StatusOverlay';
import { useAnalysis } from '../hooks/useAnalysis';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Results'>;
type Route = RouteProp<RootStackParamList, 'Results'>;

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { photoUri, foodLabel } = params;

  const { status, result, error } = useAnalysis(photoUri, foodLabel);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={styles.backText}>← Back</AppText>
        </TouchableOpacity>
        <AppText style={styles.screenTitle}>{foodLabel}</AppText>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <AppText style={styles.photoPlaceholderIcon}>📷</AppText>
            <AppText style={styles.photoPlaceholderText}>Photo captured</AppText>
          </View>
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>

        <View style={styles.content}>
          <AppText style={styles.foodLabel}>{foodLabel}</AppText>

          {status === 'loading' || status === 'error' ? (
            <StatusOverlay status={status} error={error} foodLabel={foodLabel} />
          ) : (
            result && <ResultCard result={result} />
          )}

          {status === 'success' && (
            <CheckAnotherButton onPress={() => navigation.navigate('FoodChecker')} />
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
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backText: {
    color: Colors.accent,
    fontSize: 14,
  },
  screenTitle: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    textTransform: 'capitalize',
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  foodLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    textTransform: 'capitalize',
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
    fontSize: 40,
  },
  photoPlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
