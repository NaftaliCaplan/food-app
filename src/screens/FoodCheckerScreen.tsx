import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CaptureButton } from '../components/CaptureButton';
import { PrimaryInput } from '../components/PrimaryInput';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FoodChecker'>;

export function FoodCheckerScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [foodLabel, setFoodLabel] = useState('');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <AppText style={styles.permissionTitle}>Camera access needed</AppText>
          <AppText style={styles.permissionSub}>
            CBA needs your camera to analyze food.
          </AppText>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <AppText style={styles.permissionBtnText}>Grant Permission</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || !foodLabel.trim()) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        navigation.navigate('Results', {
          photoUri: photo.uri,
          foodLabel: foodLabel.trim(),
        });
      }
    } catch (e) {
      console.error('Capture failed', e);
    } finally {
      setCapturing(false);
    }
  }

  const canCapture = foodLabel.trim().length > 0 && !capturing;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={styles.backText}>← Back</AppText>
        </TouchableOpacity>
        <AppText style={styles.label}>What are you checking?</AppText>
        <PrimaryInput
          value={foodLabel}
          onChangeText={setFoodLabel}
          placeholder="e.g. avocado, steak, banana..."
          testID="food-label-input"
        />
      </SafeAreaView>

      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      <View style={styles.bottomBar}>
        <AppText style={styles.hint}>
          {foodLabel.trim()
            ? 'Ready — tap to capture'
            : 'Enter a food name above to enable capture'}
        </AppText>
        {capturing ? (
          <ActivityIndicator color={Colors.accent} size="large" />
        ) : (
          <CaptureButton onPress={handleCapture} disabled={!canCapture} />
        )}
      </View>
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
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backText: {
    color: Colors.accent,
    fontSize: 14,
    paddingVertical: Spacing.xs,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  camera: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: Spacing.lg,
  },
  bottomBar: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hint: {
    color: Colors.textDisabled,
    fontSize: 13,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionSub: {
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  permissionBtnText: {
    color: '#000',
    fontWeight: '600',
  },
});
