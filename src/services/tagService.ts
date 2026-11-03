import { ItemCategory } from '../types/wardrobe';
import { buildSkinTonePrompt, buildTagPrompt, parseSkinToneResponse, parseTagResponse, SkinToneResult, TagResult } from './tagAnalysis';
import { photoToBase64 } from './cloudflareVision';
import { callCloudflareVision } from './visionClient';

export async function tagClothingItem(photoUri: string, category: ItemCategory): Promise<TagResult> {
  const { base64 } = await photoToBase64(photoUri);
  const raw = await callCloudflareVision(base64, buildTagPrompt(category));
  return parseTagResponse(raw, category);
}

export async function extractSkinTone(photoUri: string): Promise<SkinToneResult> {
  const { base64 } = await photoToBase64(photoUri);
  const raw = await callCloudflareVision(base64, buildSkinTonePrompt(), 200);
  return parseSkinToneResponse(raw);
}
