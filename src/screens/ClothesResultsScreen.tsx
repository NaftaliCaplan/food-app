import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CheckAnotherButton } from '../components/CheckAnotherButton';
import { ClothesResultCard } from '../components/ClothesResultCard';
import { ClothesStatusOverlay } from '../components/ClothesStatusOverlay';
import { useClothesAnalysis } from '../hooks/useClothesAnalysis';
import { RootStackParamList } from '../navigation/types';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClothesResults'>;
type Route = RouteProp<RootStackParamList, 'ClothesResults'>;

export function ClothesResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { photoUri } = params;

  const { status, result, error } = useClothesAnalysis(photoUri);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={styles.backText}>← Back</AppText>
        </TouchableOpacity>
        <AppText style={styles.screenTitle}>Outfit Check</AppText>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <AppText style={styles.photoPlaceholderIcon}>👕</AppText>
            <AppText style={styles.photoPlaceholderText}>Photo captured</AppText>
          </View>
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>

        <View style={styles.content}>
          {status === 'loading' || status === 'error' ? (
            <ClothesStatusOverlay status={status} error={error} />
          ) : (
            result && <ClothesResultCard result={result} />
          )}

          {status === 'success' && (
            <CheckAnotherButton onPress={() => navigation.navigate('ClothesChecker')} />
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
    color: Colors.clothesAccent,
    fontSize: 14,
  },
  screenTitle: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
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
