import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { WardrobeItemForm } from '../components/WardrobeItemForm';
import { RootStackParamList } from '../navigation/types';
import { updateItem } from '../storage/wardrobeStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EditItem'>;
type Rt = RouteProp<RootStackParamList, 'EditItem'>;

export function EditItemScreen() {
  const navigation = useNavigation<Nav>();
  const { item } = useRoute<Rt>().params;

  const [category, setCategory] = useState<ItemCategory>(item.category);
  const [name, setName] = useState(item.name ?? '');
  const [tags, setTags] = useState<string[]>(item.tags);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateItem(item.id, {
        category,
        name: name.trim() || undefined,
        tags,
      });
      navigation.goBack();
    } catch (e) {
      console.error('Update item failed', e);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScreenHeader title="Edit Item" onBack={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: item.photoUri }} style={styles.photo} resizeMode="cover" />

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
          saveLabel="✓ Save Changes"
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
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
    backgroundColor: Colors.surface,
  },
});
