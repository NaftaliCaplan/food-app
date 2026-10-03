import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { ProfileForm } from '../components/ProfileForm';
import { ReferencePhotoCapture } from '../components/ReferencePhotoCapture';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { extractSkinTone } from '../services/tagService';
import { clearUserProfile, getUserProfile, saveUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { UserProfile } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;

type CameraStep = 'preview' | 'capturing' | 'extracting';

export function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();

  // Profile fields
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [skinToneDesc, setSkinToneDesc] = useState<string | undefined>();
  const [undertone, setUndertone] = useState<UserProfile['undertone']>();
  const [contrast, setContrast] = useState<UserProfile['contrast']>();
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
    let cancelled = false;
    getUserProfile().then(p => {
      if (cancelled || !p) return;
      setPhotoUri(p.photoUri);
      setSkinToneDesc(p.skinToneDesc);
      setUndertone(p.undertone);
      setContrast(p.contrast);
      setHeightRange(p.heightRange);
      setBuild(p.build);
    });
    return () => {
      cancelled = true;
    };
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
      setContrast(result.contrast);
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
      const profile: UserProfile = { photoUri, skinToneDesc, undertone, contrast, heightRange, build };
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
    setContrast(undefined);
    setHeightRange('average');
    setBuild('average');
  }

  // Camera view — shown when user taps "Take / Retake Photo"
  if (showCamera) {
    return (
      <ReferencePhotoCapture
        permission={permission}
        requestPermission={requestPermission}
        cameraRef={cameraRef}
        step={cameraStep}
        onCapture={handleCapture}
        onCancel={() => { setShowCamera(false); setCameraStep('preview'); }}
      />
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

        <ProfileForm
          photoUri={photoUri}
          skinToneDesc={skinToneDesc}
          onRetakePhoto={() => setShowCamera(true)}
          heightRange={heightRange}
          onHeightChange={setHeightRange}
          build={build}
          onBuildChange={setBuild}
          onSave={handleSave}
          saving={saving}
          onSkip={() => navigation.goBack()}
          onClear={handleClear}
        />
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
});
