import { ItemCategory } from '../types/wardrobe';

// Shared by every screen that lists wardrobe/outfit items — was
// independently redefined in WardrobeScreen.tsx, OutfitResultsScreen.tsx,
// and SavedOutfitsScreen.tsx.
export const CATEGORY_ICON: Record<ItemCategory, string> = {
  top:       '[TOP]',
  bottom:    '[BOT]',
  shoes:     '[SHOE]',
  accessory: '[ACC]',
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  top:       'Top',
  bottom:    'Bottom',
  shoes:     'Shoes',
  accessory: 'Accessory',
};
