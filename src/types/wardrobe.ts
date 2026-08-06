export type ItemCategory = 'top' | 'bottom' | 'shoes' | 'accessory';

export type StylePreference = 'casual' | 'smart_casual' | 'formal' | 'sporty';

export interface WardrobeItem {
  id: string;
  photoUri: string;
  name?: string;
  category: ItemCategory;
  tags: string[];
  addedAt: number;
}

export interface UserProfile {
  photoUri?: string;
  skinToneDesc?: string;
  heightRange: 'petite' | 'average' | 'tall';
  build: 'slim' | 'average' | 'broad';
}

export interface OutfitSuggestion {
  items: WardrobeItem[];
  reasoning: string;
  styleNotes: string[];
  recommendation: string;
}

export interface SavedOutfit {
  id: string;
  itemIds: string[];
  styleName: string;
  savedAt: number;
}
