import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
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

// Front-only was the deliberate v1 scope cut (see ADR 0022) — live testing
// confirmed the predicted gap: a full outfit rarely fits in frame at
// front-camera arm's length. Back camera + a timer (so there's time to prop
// the phone up and step back) addresses that.
const TIMER_OPTIONS: { key: number; label: string }[] = [
  { key: 0, label: 'Off' },
  { key: 3, label: '3s' },
  { key: 10, label: '10s' },
];

export function SelfieCheckScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [useProfile, setUseProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Clears a countdown left running if the screen unmounts mid-timer.
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  async function actuallyCapture() {
    if (!cameraRef.current) return;
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

  function handleCapture() {
    // No cameraRef check here — the countdown is pure UI/timing and doesn't
    // need a live ref; actuallyCapture() below guards the ref at the one
    // point it's actually needed (the takePictureAsync call itself).
    if (capturing || countdown !== null) return;
    if (timerSeconds === 0) {
      actuallyCapture();
      return;
    }
    let remaining = timerSeconds;
    setCountdown(remaining);
    countdownTimer.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        actuallyCapture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
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

        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))}
            accessibilityLabel="Switch camera"
          >
            <AppText style={styles.flipBtnText}>[FLIP]</AppText>
          </TouchableOpacity>

          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <AppText style={styles.countdownText}>{countdown}</AppText>
            </View>
          )}
        </View>

        <View style={styles.bottomBar}>
          {hasProfile && (
            <ToggleRow
              label="Personalize for me"
              sublabel="Use your style profile to tailor the result"
              value={useProfile}
              onToggle={() => setUseProfile(v => !v)}
            />
          )}

          <View style={styles.timerSection}>
            <AppText style={styles.timerLabel}>TIMER</AppText>
            <View style={styles.timerRow}>
              {TIMER_OPTIONS.map(o => {
                const active = timerSeconds === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.timerChip, active && styles.timerChipActive]}
                    onPress={() => setTimerSeconds(o.key)}
                    accessibilityLabel={`Timer ${o.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <AppText style={[styles.timerChipText, active && styles.timerChipTextActive]}>
                      {active ? '(x)' : '( )'} {o.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <AppText style={styles.hint}>
            {countdown !== null ? 'Get in position...' : 'Frame your outfit — tap to capture'}
          </AppText>
          {capturing ? (
            <ActivityIndicator color={Colors.accent} size="large" />
          ) : (
            <CaptureButton onPress={handleCapture} disabled={capturing || countdown !== null} />
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
  flipBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  flipBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timerSection: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textDisabled,
    letterSpacing: 1,
  },
  timerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timerChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  timerChipActive: {
    borderColor: Colors.accent,
  },
  timerChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timerChipTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  hint: {
    color: Colors.textDisabled,
    fontSize: 13,
  },
});
