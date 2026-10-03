import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CameraPermissionGate } from '../components/CameraPermissionGate';
import { CaptureButton } from '../components/CaptureButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ToggleRow } from '../components/ToggleRow';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SelfieCheck'>;

export function SelfieCheckScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [useProfile, setUseProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Same convention as OutfitBuilderScreen: only offer the toggle when a
  // profile actually exists, reset to off each visit — personalization is
  // opt-in per check, not a sticky setting.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getUserProfile().then(p => {
        if (cancelled) return;
        const exists = p !== null;
        setHasProfile(exists);
        if (!exists) setUseProfile(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        navigation.navigate('SelfieCheckResults', { photoUri: photo.uri, useProfile });
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
      message="CBA needs your camera to check your outfit."
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <ScreenHeader title="How's my outfit?" onBack={() => navigation.goBack()} />
        </SafeAreaView>

        <CameraView ref={cameraRef} style={styles.camera} facing="front" />

        <View style={styles.bottomBar}>
          {hasProfile && (
            <ToggleRow
              label="Personalize for me"
              sublabel="Use your style profile to tailor the result"
              value={useProfile}
              onToggle={() => setUseProfile(v => !v)}
            />
          )}
          <AppText style={styles.hint}>Frame your outfit — tap to capture</AppText>
          {capturing ? (
            <ActivityIndicator color={Colors.accent} size="large" />
          ) : (
            <CaptureButton onPress={handleCapture} disabled={capturing} />
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
  camera: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: Spacing.lg,
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
