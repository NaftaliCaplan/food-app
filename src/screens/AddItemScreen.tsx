import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CaptureButton } from '../components/CaptureButton';
import { CategoryPicker } from '../components/CategoryPicker';
import { ScreenHeader } from '../components/ScreenHeader';
import { WardrobeItemForm } from '../components/WardrobeItemForm';
import { RootStackParamList } from '../navigation/types';
import { tagClothingItem } from '../services/tagService';
import { addItem, copyPhotoToApp } from '../storage/wardrobeStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory, WardrobeItem } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddItem'>;

type Step = 'camera' | 'tagging' | 'notClothing' | 'review';

export function AddItemScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [category, setCategory] = useState<ItemCategory>('top');
  const [step, setStep] = useState<Step>('camera');
  const [photoUri, setPhotoUri] = useState<string>('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <AppText style={styles.permissionTitle}>Camera access needed</AppText>
          <AppText style={styles.permissionSub}>
            CBA needs your camera to photograph clothing items.
          </AppText>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <AppText style={styles.permissionBtnText}>Grant Permission</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) return;
      setPhotoUri(photo.uri);
      setStep('tagging');
      const result = await tagClothingItem(photo.uri, category);
      if (!result.isClothing) {
        setStep('notClothing');
        return;
      }
      // The AI's category read is advisory — apply it when it disagrees with
      // what was selected before capture, but the chip picker on the review
      // step still lets the user override it either way.
      if (result.detectedCategory && result.detectedCategory !== category) {
        setCategory(result.detectedCategory);
      }
      setName(result.name);
      setTags(result.tags);
      setStep('review');
    } catch (e) {
      console.error('Capture/tag failed', e);
      setStep('camera');
    } finally {
      setCapturing(false);
    }
  }

  function toggleTag(tag: string) {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const id = Date.now().toString();
      const permanentUri = await copyPhotoToApp(photoUri, id);
      const item: WardrobeItem = {
        id,
        photoUri: permanentUri,
        name: name.trim() || undefined,
        category,
        tags,
        addedAt: Date.now(),
      };
      await addItem(item);
      navigation.goBack();
    } catch (e) {
      console.error('Save failed', e);
      setSaving(false);
    }
  }

  // Step: tagging (loading)
  if (step === 'tagging') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <AppText style={styles.loadingText}>Identifying item...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  // Step: not clothing — blocked, no save option, must retake
  if (step === 'notClothing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <AppText style={styles.notClothingIcon}>[NOT CLOTHING]</AppText>
          <AppText style={styles.notClothingText}>
            That doesn't look like a clothing item. Try again with the item clearly in frame.
          </AppText>
          <TouchableOpacity style={styles.permissionBtn} onPress={() => setStep('camera')}>
            <AppText style={styles.permissionBtnText}>Retake Photo</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step: review tags
  if (step === 'review') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <ScreenHeader title="Review Item" onBack={() => setStep('camera')} backLabel="← Retake" />
        </View>

        <ScrollView contentContainerStyle={styles.reviewScroll}>
          <WardrobeItemForm
            category={category}
            onCategoryChange={setCategory}
            name={name}
            onNameChange={setName}
            tags={tags}
            onToggleTag={toggleTag}
            onTagsChange={setTags}
            onSave={handleSave}
            saving={saving}
            saveLabel="✓ Save to Wardrobe"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step: camera
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <ScreenHeader title="Add Item" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.categoryRow}>
        <CategoryPicker category={category} onChange={setCategory} />
      </View>

      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      <View style={styles.bottomBar}>
        <AppText style={styles.hint}>Point at the item — tap to capture</AppText>
        {capturing ? (
          <ActivityIndicator color={Colors.accent} size="large" />
        ) : (
          <CaptureButton onPress={handleCapture} disabled={capturing} />
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
  },
  categoryRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
  },
  notClothingIcon: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.stateError,
  },
  notClothingText: {
    color: Colors.textPrimary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
  reviewScroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
