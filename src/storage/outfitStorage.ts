import AsyncStorage from '@react-native-async-storage/async-storage';

import { SavedOutfit } from '../types/wardrobe';

const OUTFITS_KEY = '@cba_saved_outfits';

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  const raw = await AsyncStorage.getItem(OUTFITS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedOutfit[];
  } catch {
    return [];
  }
}

export async function saveOutfit(outfit: SavedOutfit): Promise<void> {
  const current = await getSavedOutfits();
  current.push(outfit);
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(current));
}

export async function removeOutfit(id: string): Promise<void> {
  const current = await getSavedOutfits();
  const filtered = current.filter(o => o.id !== id);
  await AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(filtered));
}
