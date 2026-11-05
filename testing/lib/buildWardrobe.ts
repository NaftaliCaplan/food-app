// Shared by run-wardrobe.ts and run-outfit.ts — tags every photo under
// photos/wardrobe/<category>/ via the real tagging pipeline and returns both
// the raw per-item tagging detail (for run-wardrobe.ts's reporting) and a
// ready-to-use WardrobeItem[] (for run-outfit.ts's outfit generation).
//
// Mirrors AddItemScreen's own behavior: the AI's detectedCategory overrides
// the folder/selected category when they disagree, and an item the model
// flagged as not-clothing (isClothing: false) is skipped entirely — the real
// app would block saving it via the "not clothing, retake only" flow, so
// including it in a test wardrobe wouldn't reflect anything a real wardrobe
// could actually contain.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { photoToBase64 } from './readPhoto';
import { callCloudflareVision } from '../../src/services/visionClient';
import { buildTagPrompt, parseTagResponse, TagResult } from '../../src/services/tagAnalysis';
import { ItemCategory, WardrobeItem } from '../../src/types/wardrobe';

const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;
export const WARDROBE_CATEGORIES: ItemCategory[] = ['top', 'bottom', 'shoes', 'accessory'];

export interface TaggedTestItem {
  file: string;
  folderCategory: ItemCategory;
  // Exactly one of tagResult/error is set. item is non-null only when
  // tagResult is set and tagResult.isClothing is true.
  tagResult: TagResult | null;
  item: WardrobeItem | null;
  error: string | null;
}

export async function buildTestWardrobe(photosDir: string): Promise<TaggedTestItem[]> {
  const results: TaggedTestItem[] = [];
  let idCounter = 0;

  for (const folderCategory of WARDROBE_CATEGORIES) {
    const dir = join(photosDir, folderCategory);
    let files: string[];
    try {
      files = readdirSync(dir).filter(f => IMAGE_PATTERN.test(f));
    } catch {
      continue;
    }

    for (const file of files) {
      try {
        const { base64, mimeType } = photoToBase64(join(dir, file));
        const raw = await callCloudflareVision(base64, buildTagPrompt(folderCategory), 400, mimeType);
        const tagResult = parseTagResponse(raw, folderCategory);

        let item: WardrobeItem | null = null;
        if (tagResult.isClothing) {
          idCounter += 1;
          item = {
            id: `test-item-${idCounter}`,
            photoUri: join(dir, file),
            name: tagResult.name,
            category: tagResult.detectedCategory ?? folderCategory,
            tags: tagResult.tags,
            addedAt: Date.now(),
          };
        }

        results.push({ file, folderCategory, tagResult, item, error: null });
      } catch (e) {
        results.push({ file, folderCategory, tagResult: null, item: null, error: (e as Error).message });
      }
    }
  }

  return results;
}
