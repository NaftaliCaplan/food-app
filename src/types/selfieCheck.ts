import { ItemCategory } from './wardrobe';

// Deliberately NOT a WardrobeItem — scoreOutfitAesthetics only ever reads
// `category`/`tags` off each item (confirmed by reading outfitAesthetics.ts
// directly), so a detected-in-a-selfie garment has no need for id/photoUri/
// addedAt. Those get fabricated as placeholders only at the scoreOutfitAesthetics
// call site, purely to satisfy that function's existing WardrobeItem[] parameter
// type — this type itself stays minimal.
export interface DetectedGarment {
  category: ItemCategory;
  tags: string[];
}

// Mirrors the legacy clothes-checker's MatchVerdict tiers/labels/colors
// (theme/colors.ts's clothesStrongMatch..clothesStrongClash), but derived
// from a real computed score (see selfieCheckService.ts's tierForScore)
// rather than an AI-self-reported verdict.
export type SelfieMatchTier = 'strong_match' | 'good_match' | 'neutral' | 'mild_clash' | 'strong_clash';

export interface SelfieCheckResult {
  tier: SelfieMatchTier;
  // Whichever of top/bottom/shoes/accessories were actually detected —
  // absent categories are simply missing from this array, not padded with
  // placeholders, matching scoreOutfitAesthetics's own tolerance for a
  // missing category.
  garments: DetectedGarment[];
  // Generic, tier-based templated text — deliberately not a per-rule "why"
  // explanation (scoreOutfitAesthetics only returns a number, not which rule
  // fired), same "less insightful but always accurate" tradeoff as
  // outfitRecommendation.ts.
  tip: string;
}
