import { File } from 'expo-file-system/next';

import { ACCESSORY_TYPE_TAGS, COLOR_TAGS } from '../constants/tagVocabulary';
import { ItemCategory, StylePreference, UserProfile } from '../types/wardrobe';
import { isStyleWord, normalizeStyle, STYLE_KEYS } from '../utils/styleTags';

const CANONICAL_COLORS = new Set(COLOR_TAGS);

const CATEGORY_KEYS: ItemCategory[] = ['top', 'bottom', 'shoes', 'accessory'];

const UNDERTONE_VALUES = new Set(['warm', 'cool', 'neutral']);

function parseUndertone(value: unknown): UserProfile['undertone'] {
  return typeof value === 'string' && UNDERTONE_VALUES.has(value.toLowerCase())
    ? (value.toLowerCase() as UserProfile['undertone'])
    : undefined;
}

// An item can carry 1-2 styles now (ADR 0018 — a plain t-shirt can be both
// casual and beachwear), so this accepts either an array or a lone string
// (the regex-fallback path only ever produces a single string) and resolves
// each to a canonical StylePreference, silently dropping anything that isn't
// a recognized style word.
function parseStyles(value: unknown): StylePreference[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const found: StylePreference[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const match = STYLE_KEYS.find(k => normalizeStyle(k) === normalizeStyle(v));
    if (match && !found.includes(match)) found.push(match);
  }
  return found;
}

function parseCategory(value: unknown): ItemCategory | undefined {
  return typeof value === 'string' && CATEGORY_KEYS.includes(value.toLowerCase() as ItemCategory)
    ? (value.toLowerCase() as ItemCategory)
    : undefined;
}

// The model is asked for a separate "styles" field precisely so we don't have
// to trust it to keep the free-form tags list internally consistent — we've
// seen it tag the same item both "casual" and "formal". Stripping any style
// words out of the raw tags and re-adding only the resolved styles array
// makes a contradictory result structurally impossible, regardless of what
// the model put in the tags array.
function mergeStyleTags(tags: string[], styles: StylePreference[]): string[] {
  return [...tags.filter(t => !isStyleWord(t)), ...styles];
}

// The prompt now instructs a single canonical color word (buildTagPrompt's
// STEP 1), but the model doesn't always comply — it can still return a
// compound/modified phrase like "neon pink" or "olive green". Previously that
// got hyphenated into a single unrecognized tag ("neon-pink"), which never
// matches anything in COLOR_TAGS — the item's color became completely
// invisible to outfit-generation's color-clash scoring (a real bug found via
// live testing, see ADR 0017 follow-up). Instead, extract every canonical
// color word that actually appears in the phrase (as a whole word) and use
// those. Falls back to the old hyphenated-phrase behavior only if the phrase
// contains no recognizable canonical word at all, so we still store
// *something* rather than silently dropping the color.
function normalizeColor(raw: string): string[] {
  const words = raw.toLowerCase().trim().split(/\s+/);
  const matched = words.filter(w => CANONICAL_COLORS.has(w));
  if (matched.length > 0) return matched;
  return [raw.toLowerCase().trim().replace(/\s+/g, '-')].filter(Boolean);
}

// Colors come back as their own field (not folded into the free-form tags
// list by the model) so they get merged in here, deduplicated against
// whatever the model may have also mentioned in tags.
function mergeColorTags(tags: string[], colors: string[]): string[] {
  const normalizedColors = colors.flatMap(normalizeColor);
  const existing = new Set(tags.map(t => t.toLowerCase()));
  const newColors = normalizedColors.filter(c => !existing.has(c));
  return [...tags, ...newColors];
}

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

export interface TagResult {
  isClothing: boolean;
  name: string;
  tags: string[];
  // The AI's own independent read of the category — advisory, not binding.
  // The caller decides whether to override the user's pre-selected category
  // with this when it disagrees.
  detectedCategory?: ItemCategory;
}

export interface SkinToneResult {
  skinToneDesc: string;
  // Structured form of the same undertone the prompt already asks the model
  // to categorize in prose below — parsed out separately so outfit scoring
  // (see outfitAesthetics.ts) has a real value to key off instead of having
  // to parse free text.
  undertone?: UserProfile['undertone'];
}

function buildTagPrompt(category: ItemCategory): string {
  return `You are a clothing identification expert helping a user catalog their wardrobe so an AI stylist can build outfits from it.

STEP 0 — CHECK: Does this photo actually show a piece of clothing or a wearable accessory (something worn on the body — jewelry, a belt, a bag, a hat, a scarf, sunglasses, a watch), being worn or laid out on its own? It does NOT count if the photo shows furniture, walls, appliances, packaging, a sticker, a logo, printed text, a person's face with no clothing in frame, small handheld electronics or gadgets (phones, computer mice, remotes, keys, chargers — these are NOT accessories just because they're small), or a blank/blurry shot. If you do not see an actual garment or wearable accessory, set "isClothing" to false, leave "name" as an empty string, "colors" and "tags" as empty arrays, and skip the remaining steps.

STEP 1 — COLOR: Look at the garment itself, not the background or surroundings. Identify its actual color(s) using EXACTLY ONE WORD from this list: black, white, gray, navy, blue, green, olive, brown, tan, khaki, red, burgundy, pink, purple, yellow, orange. Never use a multi-word or modified description like "olive green", "neon pink", or "bright red" — pick whichever single word above is the closest match, even if it's not perfect. List 1-2 colors — the dominant color first, then a secondary color if the item is clearly two-toned or patterned in a second color. This is the most important thing to get right, since color is the main thing people use to match an outfit.

STEP 2 — CATEGORY: Independently judge the category from the photo itself — choose exactly one: top, bottom, shoes, accessory. The user had selected "${category}" before taking the photo, but that may be wrong (e.g. they meant to photograph a top but the camera caught pants instead) — trust what you actually see over what they selected, and report your own judgment in the "category" field.

STEP 3 — IDENTIFY: Give the item a SHORT, simple name a person would naturally use — 2 to 4 words, including the main color from Step 1. Skip technical construction jargon.
Good: "navy sweater", "plaid pajama pants", "white canvas sneakers", "denim jacket".
Too complex, avoid: "light-toned solid ribbed crew-neck pullover", "slim-fit mid-rise straight-leg chino trouser".

STEP 4 — DESCRIBE the pattern and texture (secondary to color, but still useful for matching):
- Pattern: solid / striped / plaid / checked / floral / textured / graphic
- Brightness: light / dark / vivid / muted
${category === 'top' || category === 'bottom'
    ? '- Weight/fit: lightweight / heavyweight / fitted / loose'
    : category === 'shoes'
      ? '- Material/type: canvas / leather / suede / athletic / slip-on / lace-up'
      : `- Material: leather / metal / fabric / knit / woven\n- Type: ${ACCESSORY_TYPE_TAGS.join(' / ')} (pick whichever fits best; skip this line entirely if genuinely none apply)`}

STEP 5 — STYLE: Pick 1-2 styles that genuinely apply — most items only need one, only add a second if the item genuinely works in two contexts. Judge by garment TYPE first, not vibe:
- First check: does it have a collar, a button placket, or structured tailoring? If yes, it is at minimum smart_casual — never plain casual, even if it's worn in a relaxed way.
- casual: plain basics with no collar and no structure — t-shirts, jeans, hoodies, sweatshirts
- smart_casual: has a collar, buttons, or tailoring but isn't formal-only — polo shirts, collared/button-up shirts, chinos, khakis, loafers, casual blazers
- formal: suits, dress shirts with ties, dress shoes, gowns, suit blazers
- sporty: activewear, gym clothes, athletic shoes, performance fabrics
- sleepwear: items meant specifically for sleeping — pajama sets, nightgowns, robes, sleep shirts
- beachwear: items meant specifically for the beach or pool — swim trunks, bikinis/swimsuits, cover-ups
Sleepwear and beachwear are their own categories, not a flavor of casual — a pajama set is sleepwear ONLY (never casual), a swimsuit is beachwear ONLY (never casual or sporty). Only add casual as a second style when the item is genuinely general-purpose beyond its primary context — e.g. a plain cotton t-shirt can be both casual and beachwear, but plaid pajama pants stay sleepwear only.

STEP 6 — TAGS: Create a tag list combining: the color(s) from Step 1, the words from Step 4 (pattern, brightness, and whichever category-appropriate attribute you used), and any other accurate short descriptive words. Do NOT put any style word (casual, smart_casual, formal, sporty, sleepwear, beachwear) in this list — the style(s) you picked in Step 5 go in their own "styles" field below, not in "tags".
Good tag examples: navy, olive, white, solid, striped, plaid, textured, canvas, leather, fitted, loose, lightweight, heavyweight

STEP 7 — OUTPUT: Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "isClothing": <true|false>,
  "colors": ["<primary color>", "<secondary color if any>"],
  "category": "<top|bottom|shoes|accessory>",
  "name": "<short simple name including the color, e.g. 'navy sweater'>",
  "styles": ["<style1>", "<style2 if applicable>"],
  "tags": ["<tag1>", "<tag2>", "<tag3>", "..."]
}`;
}

function buildSkinTonePrompt(): string {
  return `You are helping a colorblind user set up a style profile.

Look at this photo of a person. Describe their appearance in terms that help an AI stylist pick flattering clothing — focus on complexion undertone, brightness contrast of their features, and general build if visible.

IMPORTANT: Do NOT use specific color names like "brown" or "beige". Instead describe:
- Undertone: warm (golden/peachy) / cool (pink/bluish) / neutral
- Feature contrast: high contrast (very light skin + dark hair) / medium contrast / low contrast (similar lightness)
- Build if visible: slim / average / broad — or "not visible"

OUTPUT: Respond with ONLY a raw JSON object. No markdown:
{
  "undertone": "<warm|cool|neutral>",
  "skinToneDesc": "<2-3 sentence description using only undertone, contrast, and build — no color names>"
}`;
}

async function toBase64(photoUri: string): Promise<{ base64: string; size: number }> {
  const bytes = await new File(photoUri).bytes();
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { base64: btoa(binary), size: bytes.length };
}

async function callCloudflare(base64: string, promptText: string, maxTokens = 400): Promise<unknown> {
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
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.result?.response;
}

export async function tagClothingItem(photoUri: string, category: ItemCategory): Promise<TagResult> {
  const { base64 } = await toBase64(photoUri);
  const raw = await callCloudflare(base64, buildTagPrompt(category));

  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (obj && typeof obj.name === 'string' && Array.isArray(obj.tags)) {
    const rawTags = (obj.tags as unknown[]).filter(t => typeof t === 'string') as string[];
    const rawColors = Array.isArray(obj.colors)
      ? (obj.colors as unknown[]).filter(c => typeof c === 'string') as string[]
      : [];
    return {
      isClothing: obj.isClothing !== false,
      name: obj.name,
      tags: mergeColorTags(mergeStyleTags(rawTags, parseStyles(obj.styles)), rawColors),
      detectedCategory: parseCategory(obj.category),
    };
  }

  // Llama 3.2 (the model Cloudflare runs) frequently ignores the "raw JSON only"
  // instruction and wraps its output in ```json ... ``` markdown fences. When that
  // happens, Cloudflare returns the whole thing as a plain string rather than a
  // pre-parsed object, so the typeof check above fails. We saw this repeatedly in
  // testing. Rather than crashing, we extract name and tags with regex from the raw
  // string — it's not elegant but it handles the model's most common failure mode.
  const text = typeof raw === 'string' ? raw : '';
  const isClothingMatch = text.match(/"isClothing"\s*:\s*(true|false)/);
  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  const stylesMatch = text.match(/"styles"\s*:\s*\[([^\]]+)\]/);
  const categoryMatch = text.match(/"category"\s*:\s*"([^"]+)"/);
  const tagsMatch = text.match(/"tags"\s*:\s*\[([^\]]+)\]/);
  const colorsMatch = text.match(/"colors"\s*:\s*\[([^\]]+)\]/);
  const tags = tagsMatch
    ? tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) ?? []
    : [];
  const colors = colorsMatch
    ? colorsMatch[1].match(/"([^"]+)"/g)?.map(c => c.replace(/"/g, '')) ?? []
    : [];
  const styles = stylesMatch
    ? stylesMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? []
    : [];
  return {
    // Default true (rather than false) on a parse miss — a garbled response
    // shouldn't block a legitimate save more often than it lets a bad one through.
    isClothing: isClothingMatch ? isClothingMatch[1] === 'true' : true,
    name: nameMatch ? nameMatch[1] : `${category} item`,
    tags: mergeColorTags(mergeStyleTags(tags, parseStyles(styles)), colors),
    detectedCategory: parseCategory(categoryMatch?.[1]),
  };
}

export async function extractSkinTone(photoUri: string): Promise<SkinToneResult> {
  const { base64 } = await toBase64(photoUri);
  const raw = await callCloudflare(base64, buildSkinTonePrompt(), 200);

  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (obj && typeof obj.skinToneDesc === 'string') {
    return { skinToneDesc: obj.skinToneDesc, undertone: parseUndertone(obj.undertone) };
  }

  // Same markdown fallback as above — extract whatever text the model produced
  const text = typeof raw === 'string' ? raw : '';
  const undertoneMatch = text.match(/"undertone"\s*:\s*"([^"]+)"/);
  return {
    skinToneDesc: text.slice(0, 200) || 'neutral undertone, medium contrast',
    undertone: parseUndertone(undertoneMatch?.[1]),
  };
}
