import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { RootStackParamList } from '../navigation/types';
import { getWardrobe, removeItem } from '../storage/wardrobeStorage';
import { getUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { WardrobeItem, ItemCategory } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Wardrobe'>;

const CATEGORY_ICON: Record<ItemCategory, string> = {
  top:       '[TOP]',
  bottom:    '[BOT]',
  shoes:     '[SHOE]',
  accessory: '[ACC]',
};

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  top:       'Top',
  bottom:    'Bottom',
  shoes:     'Shoes',
  accessory: 'Accessory',
};

export function WardrobeScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [hasProfile, setHasProfile] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getWardrobe().then(setItems);
      getUserProfile().then(p => setHasProfile(p !== null));
    }, []),
  );

  async function handleDelete(id: string) {
    await removeItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const canBuild = items.length >= 2;

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AppText style={styles.backText}>← Back</AppText>
          </TouchableOpacity>
          <AppText style={styles.screenTitle}>My Wardrobe</AppText>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('UserProfile')}
            accessibilityLabel="Set up style profile"
          >
            <AppText style={styles.profileIcon}>
              {hasProfile ? '[P✓]' : '[P]'}
            </AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <AppText style={styles.emptyIcon}>[ EMPTY ]</AppText>
          <AppText style={styles.emptyTitle}>Your wardrobe is empty</AppText>
          <AppText style={styles.emptySub}>
            Add your clothes to get outfit suggestions
          </AppText>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddItem')}
          >
            <AppText style={styles.addBtnText}>+ Add your first item</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={styles.backText}>← Back</AppText>
        </TouchableOpacity>
        <AppText style={styles.screenTitle}>My Wardrobe</AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('UserProfile')}
            accessibilityLabel="Set up style profile"
          >
            <AppText style={styles.profileIcon}>
              {hasProfile ? '[P✓]' : '[P]'}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => navigation.navigate('AddItem')}
            accessibilityLabel="Add item to wardrobe"
          >
            <AppText style={styles.addIconText}>＋</AppText>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.photoUri }} style={styles.thumb} resizeMode="cover" />
            <View style={styles.cardFooter}>
              <AppText style={styles.cardIcon}>{CATEGORY_ICON[item.category]}</AppText>
              <AppText style={styles.cardLabel} numberOfLines={1}>
                {item.name ?? CATEGORY_LABEL[item.category]}
              </AppText>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                accessibilityLabel={`Remove ${item.name ?? item.category}`}
                style={styles.deleteBtn}
              >
                <AppText style={styles.deleteIcon}>✕</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        {!canBuild && (
          <AppText style={styles.buildHint}>
            Add at least 2 items to build an outfit
          </AppText>
        )}
        <TouchableOpacity
          style={[styles.buildBtn, !canBuild && styles.buildBtnDisabled]}
          onPress={() => canBuild && navigation.navigate('OutfitBuilder')}
          disabled={!canBuild}
          accessibilityLabel="Build an outfit"
          accessibilityState={{ disabled: !canBuild }}
        >
          <AppText style={[styles.buildBtnText, !canBuild && styles.buildBtnTextDisabled]}>
            Build an Outfit →
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backText: {
    color: Colors.clothesAccent,
    fontSize: 14,
  },
  screenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  profileBtn: {
    padding: Spacing.xs,
  },
  profileIcon: {
    fontSize: 20,
  },
  addIconBtn: {
    backgroundColor: Colors.clothesAccent,
    width: 32,
    height: 32,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.textDisabled,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: Colors.clothesAccent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    marginTop: Spacing.sm,
  },
  addBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  grid: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    gap: Spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  cardIcon: {
    fontSize: 14,
  },
  cardLabel: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deleteBtn: {
    padding: 2,
  },
  deleteIcon: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  bottomBar: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  buildHint: {
    fontSize: 12,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  buildBtn: {
    backgroundColor: Colors.clothesAccent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
  },
  buildBtnDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buildBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  buildBtnTextDisabled: {
    color: Colors.textDisabled,
  },
});
