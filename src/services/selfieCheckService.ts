import { File } from 'expo-file-system/next';

import { ACCESSORY_TYPE_TAGS, BRIGHTNESS_TAGS, PATTERN_TAGS } from '../constants/tagVocabulary';
import { normalizeColor } from './tagService';
import { scoreOutfitAesthetics } from '../utils/outfitAesthetics';
import { DetectedGarment, SelfieCheckResult, SelfieMatchTier } from '../types/selfieCheck';
import { UserProfile, WardrobeItem } from '../types/wardrobe';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

const TOP_BOTTOM_ATTRIBUTES = new Set(['fitted', 'loose', 'lightweight', 'heavyweight']);
const SHOE_ATTRIBUTES = new Set(['canvas', 'leather', 'suede', 'athletic', 'slip-on', 'lace-up']);
const ACCESSORY_MATERIALS = new Set(['leather', 'metal', 'fabric', 'knit', 'woven']);
const PATTERN_VALUES = new Set(PATTERN_TAGS);
const BRIGHTNESS_VALUES = new Set(BRIGHTNESS_TAGS);
const ACCESSORY_TYPES = new Set(ACCESSORY_TYPE_TAGS);

const TOP_BOTTOM_ATTRIBUTES_LIST = [...TOP_BOTTOM_ATTRIBUTES].join(' / ');
const SHOE_ATTRIBUTES_LIST = [...SHOE_ATTRIBUTES].join(' / ');
const ACCESSORY_TYPES_LIST = ACCESSORY_TYPE_TAGS.join(' / ');

// Fixed named slots (top/bottom/shoes), not an open-ended array of garment
// objects — a person wearing an outfit has at most one of each, so this is a
// much more constrained, more reliably-fillable schema for the model than
// asking it to enumerate and label an indefinite list (see tagService.ts's
// buildTagPrompt, which already only handles one isolated garment per photo —
// there was no existing multi-item template to extend). Accessories are the
// one genuinely variable-count category, so that's the only real array.
function buildSelfieDetectionPrompt(): string {
  return `You are a clothing identification expert analyzing a photo of a person wearing a full outfit, to help judge whether the pieces they're wearing match.

STEP 0 — CHECK: If you cannot see a person wearing any visible clothing at all, set every slot's "present" to false, "accessories" to an empty array, and skip the remaining steps.

STEP 1 — FOR EACH SLOT (top, bottom, shoes) that is actually visible in the photo, describe it:
- Colors: 1-2 words from EXACTLY this list: black, white, gray, navy, blue, green, olive, brown, tan, khaki, red, burgundy, pink, purple, yellow, orange. Never a multi-word or modified description like "olive green" or "neon pink" — pick whichever single word above is the closest match.
- Pattern: solid / striped / plaid / checked / floral / textured / graphic
- Brightness: light / dark / vivid / muted
- Attributes: for top/bottom, any that apply from ${TOP_BOTTOM_ATTRIBUTES_LIST}; for shoes, any that apply from ${SHOE_ATTRIBUTES_LIST}.
If a slot genuinely isn't visible (cropped out of frame, or it's a one-piece dress with no separate top+bottom), set that slot's "present" to false and leave colors/attributes as empty arrays — do not guess at something you can't see.

STEP 2 — ACCESSORIES: List any visible accessories. For each, give its type (${ACCESSORY_TYPES_LIST}), 1-2 colors (same color list as Step 1), and material if visible (leather / metal / fabric / knit / woven). Leave the array empty if none are visible.

STEP 3 — OUTPUT: Respond with ONLY a raw JSON object. No markdown, no explanation. Start with { end with }:
{
  "top": { "present": <true|false>, "colors": ["..."], "pattern": "...", "brightness": "...", "attributes": ["..."] },
  "bottom": { "present": <true|false>, "colors": ["..."], "pattern": "...", "brightness": "...", "attributes": ["..."] },
  "shoes": { "present": <true|false>, "colors": ["..."], "pattern": "...", "brightness": "...", "attributes": ["..."] },
  "accessories": [ { "type": "...", "colors": ["..."], "attributes": ["..."] } ]
}`;
}

async function toBase64(photoUri: string): Promise<string> {
  const bytes = await new File(photoUri).bytes();
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function callCloudflare(base64: string, promptText: string): Promise<unknown> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: promptText },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.result?.response;
}

// Multi-slot nested JSON is too fragile to patch key-by-key with per-field
// regexes the way tagService.ts's single-flat-object fallback does — instead,
// strip markdown fences (Llama frequently wraps output despite the "raw JSON
// only" instruction) and attempt one real JSON.parse of the extracted
// {...} block. If that still fails, there's nothing safe to partially
// reconstruct — the caller treats this as a failed detection, same as
// AddItemScreen's "not clothing, retake only" outcome, rather than guessing.
function extractJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as unknown[]).filter(v => typeof v === 'string') as string[] : [];
}

// Builds one garment's tag list from its slot object, validating each field
// against the same vocabulary tagVocabulary.ts already defines — an
// unrecognized word is just dropped rather than kept as a garbage tag, since
// scoring only ever recognizes these exact words anyway. Colors go through
// the same normalizeColor extraction tagService.ts uses, so a compound
// phrase like "olive green" still yields real, recognized color tags instead
// of becoming invisible to scoring (the exact bug fixed in ADR 0017).
function parseFixedSlot(
  value: unknown,
  category: 'top' | 'bottom' | 'shoes',
  attributeVocab: Set<string>,
): DetectedGarment | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (obj.present !== true) return null;

  const colors = stringArray(obj.colors).flatMap(normalizeColor);
  const pattern = typeof obj.pattern === 'string' && PATTERN_VALUES.has(obj.pattern.toLowerCase())
    ? [obj.pattern.toLowerCase()]
    : [];
  const brightness = typeof obj.brightness === 'string' && BRIGHTNESS_VALUES.has(obj.brightness.toLowerCase())
    ? [obj.brightness.toLowerCase()]
    : [];
  const attributes = stringArray(obj.attributes)
    .map(a => a.toLowerCase())
    .filter(a => attributeVocab.has(a));

  return { category, tags: [...colors, ...pattern, ...brightness, ...attributes] };
}

function parseAccessories(value: unknown): DetectedGarment[] {
  if (!Array.isArray(value)) return [];
  const garments: DetectedGarment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const type = typeof obj.type === 'string' && ACCESSORY_TYPES.has(obj.type.toLowerCase())
      ? [obj.type.toLowerCase()]
      : [];
    const colors = stringArray(obj.colors).flatMap(normalizeColor);
    const material = stringArray(obj.attributes)
      .map(a => a.toLowerCase())
      .filter(a => ACCESSORY_MATERIALS.has(a));
    garments.push({ category: 'accessory', tags: [...type, ...colors, ...material] });
  }
  return garments;
}

function parseDetectedGarments(raw: unknown): DetectedGarment[] {
  const obj = extractJsonObject(raw);
  if (!obj) return [];
  const garments: DetectedGarment[] = [];
  const top = parseFixedSlot(obj.top, 'top', TOP_BOTTOM_ATTRIBUTES);
  const bottom = parseFixedSlot(obj.bottom, 'bottom', TOP_BOTTOM_ATTRIBUTES);
  const shoes = parseFixedSlot(obj.shoes, 'shoes', SHOE_ATTRIBUTES);
  if (top) garments.push(top);
  if (bottom) garments.push(bottom);
  if (shoes) garments.push(shoes);
  garments.push(...parseAccessories(obj.accessories));
  return garments;
}

// scoreOutfitAesthetics only ever reads category/tags off each item (see
// outfitAesthetics.ts) — id/photoUri/addedAt are fabricated purely to satisfy
// its existing WardrobeItem[] parameter type, never actually used by scoring.
function toPlaceholderWardrobeItem(garment: DetectedGarment, photoUri: string, index: number): WardrobeItem {
  return {
    id: `selfie-check-${index}`,
    photoUri,
    category: garment.category,
    tags: garment.tags,
    addedAt: Date.now(),
  };
}

// Starting calibration, not a firm spec — same "tune via live testing"
// treatment every other magic number in outfitAesthetics.ts has gotten
// (CLASHING_COLOR_PAIRS, the confidence caps, etc.).
export function tierForScore(score: number): SelfieMatchTier {
  if (score <= -1) return 'strong_match';
  if (score < -0.25) return 'good_match';
  if (score < 0.25) return 'neutral';
  if (score < 2) return 'mild_clash';
  return 'strong_clash';
}

// Generic, tier-based templated text — deliberately not a per-rule "why"
// explanation. scoreOutfitAesthetics only returns a number today, not which
// rule fired; building an accurate per-rule explanation would need either a
// return-shape change to that shared function or duplicating its detection
// logic outside it. Same "less insightful but always accurate" tradeoff
// outfitRecommendation.ts already makes for outfit-generation tips.
const TIER_TIPS: Record<SelfieMatchTier, string> = {
  strong_match: 'This outfit works well together — nothing here clashes.',
  good_match: 'Solid outfit — these pieces pair nicely.',
  neutral: "Wearable, but nothing here stands out as especially matched.",
  mild_clash: 'A couple of things are competing for attention here.',
  strong_clash: 'Several pieces are clashing — consider swapping one out.',
};

export async function checkSelfieOutfit(
  photoUri: string,
  profile?: UserProfile | null,
): Promise<SelfieCheckResult> {
  const base64 = await toBase64(photoUri);
  const raw = await callCloudflare(base64, buildSelfieDetectionPrompt());

  const garments = parseDetectedGarments(raw);
  if (garments.length === 0) {
    throw new Error('No clothing detected in this photo — try again with your outfit clearly visible.');
  }

  const items = garments.map((g, i) => toPlaceholderWardrobeItem(g, photoUri, i));
  const score = scoreOutfitAesthetics(
    items,
    undefined,
    undefined,
    profile?.undertone,
    profile?.contrast,
    profile?.heightRange,
    profile?.build,
  );
  const tier = tierForScore(score);

  return { tier, garments, tip: TIER_TIPS[tier] };
}
