import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { WardrobeItem } from '../types/wardrobe';

const WARDROBE_KEY = '@cba_wardrobe';
const WARDROBE_DIR = FileSystem.documentDirectory + 'wardrobe/';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(WARDROBE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(WARDROBE_DIR, { intermediates: true });
  }
}

export async function copyPhotoToApp(tempUri: string, id: string): Promise<string> {
  await ensureDir();
  const dest = WARDROBE_DIR + id + '.jpg';
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

export async function getWardrobe(): Promise<WardrobeItem[]> {
  const raw = await AsyncStorage.getItem(WARDROBE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WardrobeItem[];
  } catch {
    return [];
  }
}

export async function addItem(item: WardrobeItem): Promise<void> {
  const current = await getWardrobe();
  current.push(item);
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(current));
}

export async function removeItem(id: string): Promise<void> {
  const current = await getWardrobe();
  const filtered = current.filter(i => i.id !== id);
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(filtered));
  const photoPath = WARDROBE_DIR + id + '.jpg';
  const info = await FileSystem.getInfoAsync(photoPath);
  if (info.exists) {
    await FileSystem.deleteAsync(photoPath, { idempotent: true });
  }
}

export async function updateItem(id: string, updates: Partial<WardrobeItem>): Promise<void> {
  const current = await getWardrobe();
  const idx = current.findIndex(i => i.id === id);
  if (idx === -1) return;
  current[idx] = { ...current[idx], ...updates };
  await AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(current));
}
