import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CaptureButton } from '../components/CaptureButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { extractSkinTone } from '../services/tagService';
import { clearUserProfile, getUserProfile, saveUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { UserProfile } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;

// Height and build use labelled chip rows — not dropdowns — so the user
// can see all options at once and tap without reading a hidden list.
const HEIGHT_OPTIONS: { key: UserProfile['heightRange']; label: string }[] = [
  { key: 'petite',  label: 'Petite' },
  { key: 'average', label: 'Average' },
  { key: 'tall',    label: 'Tall' },
];

const BUILD_OPTIONS: { key: UserProfile['build']; label: string }[] = [
  { key: 'slim',    label: 'Slim' },
  { key: 'average', label: 'Average' },
  { key: 'broad',   label: 'Broad' },
];

type CameraStep = 'preview' | 'capturing' | 'extracting';

export function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();

  // Profile fields
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [skinToneDesc, setSkinToneDesc] = useState<string | undefined>();
  const [undertone, setUndertone] = useState<UserProfile['undertone']>();
  const [heightRange, setHeightRange] = useState<UserProfile['heightRange']>('average');
  const [build, setBuild] = useState<UserProfile['build']>('average');

  // Camera state — kept separate from profile fields because the camera
  // is only shown when the user actively wants to (re)take a photo.
  // showCamera starts false so the screen opens on the review/edit view
  // when a profile already exists.
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStep, setCameraStep] = useState<CameraStep>('preview');
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Load existing profile on mount so the user can update rather than re-enter
  useEffect(() => {
    getUserProfile().then(p => {
      if (p) {
        setPhotoUri(p.photoUri);
        setSkinToneDesc(p.skinToneDesc);
        setUndertone(p.undertone);
        setHeightRange(p.heightRange);
        setBuild(p.build);
      }
    });
  }, []);

  async function handleCapture() {
    if (!cameraRef.current || cameraStep !== 'preview') return;
    setCameraStep('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) { setCameraStep('preview'); return; }
      setCameraStep('extracting');
      // extractSkinTone sends the photo to Cloudflare and returns a plain-language
      // description of undertone and contrast — never color names, so the output
      // is usable in an outfit prompt for a colorblind user.
      const result = await extractSkinTone(photo.uri);
      setPhotoUri(photo.uri);
      setSkinToneDesc(result.skinToneDesc);
      setUndertone(result.undertone);
      setShowCamera(false);
      setCameraStep('preview');
    } catch (e) {
      console.error('Profile photo failed', e);
      setCameraStep('preview');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const profile: UserProfile = { photoUri, skinToneDesc, undertone, heightRange, build };
      await saveUserProfile(profile);
      navigation.goBack();
    } catch (e) {
      console.error('Save profile failed', e);
      setSaving(false);
    }
  }

  async function handleClear() {
    await clearUserProfile();
    setPhotoUri(undefined);
    setSkinToneDesc(undefined);
    setUndertone(undefined);
    setHeightRange('average');
    setBuild('average');
  }

  // Camera view — shown when user taps "Take / Retake Photo"
  if (showCamera) {
    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.centreBox}>
            <AppText style={styles.permTitle}>Camera access needed</AppText>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <AppText style={styles.primaryBtnText}>Grant Permission</AppText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (cameraStep === 'extracting') {
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
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <ScreenHeader
            title="Reference Photo"
            onBack={() => { setShowCamera(false); setCameraStep('preview'); }}
            backLabel="← Cancel"
          />
        </SafeAreaView>

        <CameraView ref={cameraRef} style={styles.camera} facing="front" />

        <View style={styles.bottomBar}>
          <AppText style={styles.hint}>Face the camera — tap to capture</AppText>
          {cameraStep === 'capturing' ? (
            <ActivityIndicator color={Colors.accent} size="large" />
          ) : (
            <CaptureButton onPress={handleCapture} disabled={cameraStep !== 'preview'} />
          )}
        </View>
      </View>
    );
  }

  // Main profile edit view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScreenHeader title="Style Profile" onBack={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText style={styles.intro}>
          Your profile helps personalise outfit suggestions for your complexion and proportions.
          It is optional — you can skip it and still build outfits.
        </AppText>

        {/* Reference photo */}
        <AppText style={styles.sectionLabel}>REFERENCE PHOTO</AppText>
        <AppText style={styles.sectionHint}>
          Used to read your complexion undertone and contrast — not stored on any server.
        </AppText>

        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <View style={styles.photoInfo}>
              {skinToneDesc ? (
                <AppText style={styles.skinDesc}>{skinToneDesc}</AppText>
              ) : null}
              <TouchableOpacity onPress={() => setShowCamera(true)}>
                <AppText style={styles.retakeLink}>Retake photo</AppText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={() => setShowCamera(true)}>
            <AppText style={styles.photoPlaceholderIcon}>[CAMERA]</AppText>
            <AppText style={styles.photoPlaceholderText}>Tap to take reference photo</AppText>
          </TouchableOpacity>
        )}

        {/* Height */}
        <AppText style={styles.sectionLabel}>YOUR HEIGHT</AppText>
        <View style={styles.chipRow}>
          {HEIGHT_OPTIONS.map(o => {
            const active = heightRange === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setHeightRange(o.key)}
                accessibilityLabel={o.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {active ? '(x)' : '( )'} {o.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Build */}
        <AppText style={styles.sectionLabel}>YOUR BUILD</AppText>
        <View style={styles.chipRow}>
          {BUILD_OPTIONS.map(o => {
            const active = build === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setBuild(o.key)}
                accessibilityLabel={o.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {active ? '(x)' : '( )'} {o.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <AppText style={styles.primaryBtnText}>✓ Save Profile</AppText>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
          <AppText style={styles.skipText}>Skip for now</AppText>
        </TouchableOpacity>

        {photoUri || skinToneDesc ? (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <AppText style={styles.clearText}>✕ Clear profile</AppText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: Colors.surface,
  },
  photoInfo: {
    flex: 1,
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  skinDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  retakeLink: {
    color: Colors.accent,
    fontSize: 13,
  },
  photoPlaceholder: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoPlaceholderIcon: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  photoPlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.accent,
  },
  chipLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  clearBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  clearText: {
    color: Colors.stateError,
    fontSize: 13,
  },
  centreBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
