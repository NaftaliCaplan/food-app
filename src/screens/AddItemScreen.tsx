import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { CaptureButton } from '../components/CaptureButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { tagClothingItem } from '../services/tagService';
import { addItem, copyPhotoToApp } from '../storage/wardrobeStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory, WardrobeItem } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddItem'>;

const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'top',       label: 'Top' },
  { key: 'bottom',    label: 'Bottom' },
  { key: 'shoes',     label: 'Shoes' },
  { key: 'accessory', label: 'Accessory' },
];

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
  const [tagInput, setTagInput] = useState('');
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

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
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
          {/* Category row */}
          <AppText style={styles.sectionLabel}>CATEGORY</AppText>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(c => {
              const active = category === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setCategory(c.key)}
                  accessibilityLabel={c.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <AppText style={[styles.catLabel, active && styles.catLabelActive]}>
                    {active ? '(x)' : '( )'} {c.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Name */}
          <AppText style={styles.sectionLabel}>NAME (optional)</AppText>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. white button-up shirt"
            placeholderTextColor={Colors.textDisabled}
            selectionColor={Colors.accent}
          />

          {/* Tags */}
          <AppText style={styles.sectionLabel}>TAGS</AppText>
          <AppText style={styles.tagHint}>Tap to remove · More tags = better outfit matching</AppText>
          <View style={styles.tagWrap}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.tag}
                onPress={() => removeTag(tag)}
                accessibilityLabel={`Remove tag ${tag}`}
              >
                <AppText style={styles.tagText}>{tag} ✕</AppText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add tag */}
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="add a tag..."
              placeholderTextColor={Colors.textDisabled}
              selectionColor={Colors.accent}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
              <AppText style={styles.tagAddText}>＋</AppText>
            </TouchableOpacity>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <AppText style={styles.saveBtnText}>✓ Save to Wardrobe</AppText>
            )}
          </TouchableOpacity>
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

      {/* Category picker */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map(c => {
          const active = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => setCategory(c.key)}
              accessibilityLabel={c.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <AppText style={[styles.catLabel, active && styles.catLabelActive]}>
                {active ? '(x)' : '( )'} {c.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  catChip: {
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  catChipActive: {
    borderColor: Colors.accent,
  },
  catLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  catLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  nameInput: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  tagHint: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  tagText: {
    color: Colors.accent,
    fontSize: 13,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  tagAddBtn: {
    backgroundColor: Colors.accent,
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
