import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { getSavedOutfits, removeOutfit } from '../storage/outfitStorage';
import { getWardrobe } from '../storage/wardrobeStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory, SavedOutfit, WardrobeItem } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SavedOutfits'>;

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

function formatSavedDate(savedAt: number): string {
  return new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SavedOutfitsScreen() {
  const navigation = useNavigation<Nav>();
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, WardrobeItem>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSavedOutfits().then(setOutfits);
      getWardrobe().then(w => setItemMap(new Map(w.map(i => [i.id, i]))));
    }, []),
  );

  async function handleDelete(id: string) {
    await removeOutfit(id);
    setOutfits(prev => prev.filter(o => o.id !== id));
  }

  if (outfits.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <ScreenHeader title="Saved Outfits" onBack={() => navigation.goBack()} />
        </View>
        <View style={styles.emptyState}>
          <AppText style={styles.emptyIcon}>[EMPTY]</AppText>
          <AppText style={styles.emptyTitle}>No saved outfits yet</AppText>
          <AppText style={styles.emptySub}>
            Build an outfit and tap Keep This Outfit to save it here
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <ScreenHeader title="Saved Outfits" onBack={() => navigation.goBack()} />
      </View>

      <FlatList
        data={outfits}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: outfit }) => {
          const expanded = expandedId === outfit.id;
          const hasLaundryItem = outfit.itemIds.some(id => itemMap.get(id)?.inLaundry);
          return (
            <TouchableOpacity
              style={[styles.card, hasLaundryItem && styles.cardLaundry]}
              activeOpacity={0.7}
              onPress={() => setExpandedId(expanded ? null : outfit.id)}
              accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${outfit.styleName} outfit from ${formatSavedDate(outfit.savedAt)}`}
            >
              <View style={styles.cardHeader}>
                <AppText style={styles.styleName} numberOfLines={1}>
                  {outfit.styleName}
                </AppText>
                <AppText style={styles.dateText}>{formatSavedDate(outfit.savedAt)}</AppText>
                <TouchableOpacity
                  onPress={() => handleDelete(outfit.id)}
                  accessibilityLabel={`Delete saved outfit from ${formatSavedDate(outfit.savedAt)}`}
                  style={styles.deleteBtn}
                >
                  <AppText style={styles.deleteIcon}>✕</AppText>
                </TouchableOpacity>
              </View>
              <View style={styles.itemRow}>
                {outfit.itemIds.map(id => {
                  const item = itemMap.get(id);
                  if (!item) {
                    return (
                      <View key={id} style={styles.missingTile}>
                        <AppText style={styles.missingText}>[MISSING]</AppText>
                      </View>
                    );
                  }
                  if (item.inLaundry) {
                    return (
                      <View key={id} style={styles.laundryTile}>
                        <Image
                          source={{ uri: item.photoUri }}
                          style={[styles.itemThumb, styles.itemThumbDimmed]}
                          resizeMode="cover"
                        />
                        <AppText style={styles.laundryLabel}>[LAUNDRY]</AppText>
                      </View>
                    );
                  }
                  return (
                    <Image
                      key={id}
                      source={{ uri: item.photoUri }}
                      style={styles.itemThumb}
                      resizeMode="cover"
                    />
                  );
                })}
              </View>

              {expanded && (
                <View style={styles.detailBox}>
                  {outfit.itemIds.map(id => {
                    const item = itemMap.get(id);
                    return (
                      <AppText key={id} style={styles.detailItemText}>
                        {item
                          ? `${CATEGORY_ICON[item.category]} ${item.name ?? CATEGORY_LABEL[item.category]}${item.inLaundry ? ' — [LAUNDRY]' : ''}`
                          : '[MISSING] Item no longer in wardrobe'}
                      </AppText>
                    );
                  })}
                  {outfit.recommendation ? (
                    <AppText style={styles.detailTipText}>TIP: {outfit.recommendation}</AppText>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    paddingHorizontal: Spacing.lg,
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
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cardLaundry: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  styleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  deleteBtn: {
    padding: 2,
  },
  deleteIcon: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  itemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  itemThumb: {
    width: 72,
    height: 72,
    borderRadius: 0,
  },
  itemThumbDimmed: {
    opacity: 0.4,
  },
  laundryTile: {
    width: 72,
  },
  laundryLabel: {
    fontSize: 8,
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: 2,
  },
  missingTile: {
    width: 72,
    height: 72,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    fontSize: 9,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  detailBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  detailItemText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  detailTipText: {
    fontSize: 13,
    color: Colors.accent,
    lineHeight: 19,
    marginTop: 4,
  },
});
