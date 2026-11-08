import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CameraPermissionGate } from '../components/CameraPermissionGate';
import { CaptureButton } from '../components/CaptureButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LightChecker'>;

// Back camera, immediate capture, no label input — closer to FoodCheckerScreen
// than SelfieCheckScreen in this respect. No front/back toggle or timer:
// those exist on SelfieCheckScreen for arm's-length full-body framing from
// the front camera, which doesn't apply to a nearby indicator light.
export function LightCheckerScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        navigation.navigate('LightResults', { photoUri: photo.uri });
      }
    } catch (e) {
      console.error('Capture failed', e);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <CameraPermissionGate
      permission={permission}
      requestPermission={requestPermission}
      message="CBA needs your camera to check the light's color."
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <ScreenHeader title="What color is it?" onBack={() => navigation.goBack()} />
        </SafeAreaView>

        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        </View>

        <View style={styles.bottomBar}>
          <AppText style={styles.hint}>Point at the light — tap to capture</AppText>
          {capturing ? (
            <ActivityIndicator color={Colors.accent} size="large" />
          ) : (
            <CaptureButton onPress={handleCapture} />
          )}
        </View>
      </View>
    </CameraPermissionGate>
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
  cameraWrap: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: Spacing.lg,
  },
  camera: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hint: {
    color: Colors.textDisabled,
    fontSize: 13,
  },
});
