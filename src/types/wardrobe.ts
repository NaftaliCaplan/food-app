export type ItemCategory = 'top' | 'bottom' | 'shoes' | 'accessory';

// 'sleepwear' and 'beachwear' are "occasion" categories rather than everyday
// styles — deliberately excluded from the casual-passthrough fallback in
// filterByStyle (outfitService.ts), so pajamas/swimsuits only ever show up
// when specifically requested, never as a default casual substitute (ADR
// 0018). The UI groups them separately (OutfitBuilderScreen's STYLE vs
// OCCASION sections) for the same reason.
export type StylePreference = 'casual' | 'smart_casual' | 'formal' | 'sporty' | 'sleepwear' | 'beachwear';

export interface WardrobeItem {
  id: string;
  photoUri: string;
  name?: string;
  category: ItemCategory;
  tags: string[];
  addedAt: number;
  inLaundry?: boolean;
}

export interface UserProfile {
  photoUri?: string;
  skinToneDesc?: string;
  // Structured form of what skinToneDesc already describes in prose (see
  // tagService.ts's buildSkinTonePrompt) — kept separate so scoring can key
  // off a real value instead of parsing free text. Optional so profiles
  // saved before this field existed still load fine; personalization scoring
  // just no-ops for them (see outfitAesthetics.ts).
  undertone?: 'warm' | 'cool' | 'neutral';
  heightRange: 'petite' | 'average' | 'tall';
  build: 'slim' | 'average' | 'broad';
}

export interface OutfitSuggestion {
  items: WardrobeItem[];
  recommendation: string;
}

export interface SavedOutfit {
  id: string;
  itemIds: string[];
  styleName: string;
  savedAt: number;
  recommendation?: string;
}
