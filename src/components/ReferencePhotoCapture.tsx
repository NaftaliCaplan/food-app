import { CameraView, useCameraPermissions } from 'expo-camera';
import { RefObject } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';
import { CameraPermissionGate } from './CameraPermissionGate';
import { CaptureButton } from './CaptureButton';
import { ScreenHeader } from './ScreenHeader';

type Step = 'preview' | 'capturing' | 'extracting';

interface Props {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  cameraRef: RefObject<CameraView | null>;
  step: Step;
  onCapture: () => void;
  onCancel: () => void;
}

export function ReferencePhotoCapture({
  permission,
  requestPermission,
  cameraRef,
  step,
  onCapture,
  onCancel,
}: Props) {
  // step can only reach 'extracting' after a successful capture, which
  // itself requires permission to already be granted — so checking this
  // before the permission gate is safe, never reachable with permission
  // ungranted.
  if (step === 'extracting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centreBox}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <AppText style={styles.subText}>Reading complexion details...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <CameraPermissionGate
      permission={permission}
      requestPermission={requestPermission}
      message="CBA needs your camera to take a reference photo."
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <ScreenHeader title="Reference Photo" onBack={onCancel} backLabel="← Cancel" />
        </SafeAreaView>

        <CameraView ref={cameraRef} style={styles.camera} facing="front" />

        <View style={styles.bottomBar}>
          <AppText style={styles.hint}>Face the camera — tap to capture</AppText>
          {step === 'capturing' ? (
            <ActivityIndicator color={Colors.accent} size="large" />
          ) : (
            <CaptureButton onPress={onCapture} disabled={step !== 'preview'} />
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
  centreBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  subText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  camera: {
    flex: 1,
    borderRadius: 0,
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
});
