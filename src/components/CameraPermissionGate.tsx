import { useCameraPermissions } from 'expo-camera';
import { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

// Was independently duplicated (near-verbatim) across FoodCheckerScreen,
// AddItemScreen, SelfieCheckScreen, and a reduced variant in
// UserProfileScreen — see docs/AUDIT-2026-09-24.md. `permission` typed off
// useCameraPermissions's own return rather than importing an expo-camera
// type name directly, so this doesn't need updating if that type is ever
// renamed upstream.
type CameraPermission = ReturnType<typeof useCameraPermissions>[0];

interface Props {
  permission: CameraPermission;
  requestPermission: () => void;
  message: string;
  children: ReactNode;
}

export function CameraPermissionGate({ permission, requestPermission, message, children }: Props) {
  if (!permission) {
    return <View style={styles.loading} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <AppText style={styles.permissionTitle}>Camera access needed</AppText>
          <AppText style={styles.permissionSub}>{message}</AppText>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <AppText style={styles.permissionBtnText}>Grant Permission</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    borderRadius: 0,
    marginTop: Spacing.sm,
  },
  permissionBtnText: {
    color: '#000',
    fontWeight: '600',
  },
});
