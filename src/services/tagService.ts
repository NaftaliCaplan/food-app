import { File } from 'expo-file-system/next';

import { ItemCategory, StylePreference } from '../types/wardrobe';

const STYLE_KEYS: StylePreference[] = ['casual', 'smart_casual', 'formal', 'sporty'];
const CATEGORY_KEYS: ItemCategory[] = ['top', 'bottom', 'shoes', 'accessory'];

function normalizeStyle(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, '');
}

function isStyleWord(tag: string): boolean {
  const n = normalizeStyle(tag);
  return STYLE_KEYS.some(k => normalizeStyle(k) === n);
}

function parseStyle(value: unknown): StylePreference | undefined {
  return typeof value === 'string' && STYLE_KEYS.some(k => normalizeStyle(k) === normalizeStyle(value))
    ? (value.toLowerCase().replace(/[-\s]+/g, '_') as StylePreference)
    : undefined;
}

function parseCategory(value: unknown): ItemCategory | undefined {
  return typeof value === 'string' && CATEGORY_KEYS.includes(value.toLowerCase() as ItemCategory)
    ? (value.toLowerCase() as ItemCategory)
    : undefined;
}

// The model is asked for a single "style" field precisely so we don't have to
// trust it to keep the free-form tags list internally consistent — we've seen
// it tag the same item both "casual" and "formal". Stripping any style words
// out of the raw tags and re-adding only the one resolved style makes a
// contradictory result structurally impossible, regardless of what the model
// put in the tags array.
function mergeStyleTag(tags: string[], style: StylePreference | undefined): string[] {
  const withoutStyle = tags.filter(t => !isStyleWord(t));
  return style ? [...withoutStyle, style] : withoutStyle;
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
}

function buildTagPrompt(category: ItemCategory): string {
  return `You are a clothing identification expert helping a colorblind user catalog their wardrobe.

STEP 0 — CHECK: Does this photo actually show a piece of clothing or a wearable accessory, being worn or laid out on its own? It does NOT count if the photo shows furniture, walls, appliances, packaging, a sticker, a logo, printed text, a person's face with no clothing in frame, or a blank/blurry shot. If you do not see an actual garment or accessory, set "isClothing" to false, leave "name" as an empty string, "tags" as an empty array, and skip the remaining steps.

STEP 1 — CATEGORY: Independently judge the category from the photo itself — choose exactly one: top, bottom, shoes, accessory. The user had selected "${category}" before taking the photo, but that may be wrong (e.g. they meant to photograph a top but the camera caught pants instead) — trust what you actually see over what they selected, and report your own judgment in the "category" field.

STEP 2 — IDENTIFY: Give the item a SHORT, simple name a person would naturally use — 2 to 3 words, no more. Skip color words and skip technical construction jargon.
Good: "striped sweater", "plaid pajama pants", "canvas sneakers", "denim jacket".
Too complex, avoid: "light-toned solid ribbed crew-neck pullover", "slim-fit mid-rise straight-leg chino trouser".

STEP 3 — DESCRIBE using only these attributes (never color names alone):
- Brightness: light / dark / vivid / muted
- Pattern: solid / striped / plaid / checked / floral / textured / graphic
- Tone: warm / cool / neutral

STEP 4 — STYLE: Pick EXACTLY ONE style — they are mutually exclusive, never pick two:
- casual: relaxed everyday wear — plain t-shirts, jeans, sneakers, hoodies, loungewear, pajamas, sleepwear
- smart_casual: has some polish but isn't formal — polo shirts, collared shirts, button-ups (tucked or untucked), chinos, loafers, casual blazers
- formal: suits, dress shirts with ties, dress shoes, gowns, suit blazers
- sporty: activewear, gym clothes, athletic shoes, performance fabrics
A collared or button-up shirt is smart_casual, not casual, even if it's worn casually. If genuinely unsure between casual and smart_casual, pick casual. Pajamas and sleepwear are always casual, never formal.

STEP 5 — TAGS: Create a tag list of short lowercase words or hyphenated phrases from the Step 3 attributes plus fit/weight/texture words. Do NOT put any style word (casual, smart_casual, formal, sporty) in this list — the style you picked in Step 4 goes in its own "style" field below, not in "tags".
Good tag examples: light, dark, warm-tone, cool-tone, neutral-tone, solid, striped, plaid, textured, fitted, loose, lightweight, heavyweight

STEP 6 — OUTPUT: Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "isClothing": <true|false>,
  "category": "<top|bottom|shoes|accessory>",
  "name": "<short simple name, e.g. 'striped sweater'>",
  "style": "<casual|smart_casual|formal|sporty>",
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
    return {
      isClothing: obj.isClothing !== false,
      name: obj.name,
      tags: mergeStyleTag(rawTags, parseStyle(obj.style)),
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
  const styleMatch = text.match(/"style"\s*:\s*"([^"]+)"/);
  const categoryMatch = text.match(/"category"\s*:\s*"([^"]+)"/);
  const tagsMatch = text.match(/"tags"\s*:\s*\[([^\]]+)\]/);
  const tags = tagsMatch
    ? tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) ?? []
    : [];
  return {
    // Default true (rather than false) on a parse miss — a garbled response
    // shouldn't block a legitimate save more often than it lets a bad one through.
    isClothing: isClothingMatch ? isClothingMatch[1] === 'true' : true,
    name: nameMatch ? nameMatch[1] : `${category} item`,
    tags: mergeStyleTag(tags, parseStyle(styleMatch?.[1])),
    detectedCategory: parseCategory(categoryMatch?.[1]),
  };
}

export async function extractSkinTone(photoUri: string): Promise<SkinToneResult> {
  const { base64 } = await toBase64(photoUri);
  const raw = await callCloudflare(base64, buildSkinTonePrompt(), 200);

  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (obj && typeof obj.skinToneDesc === 'string') {
    return { skinToneDesc: obj.skinToneDesc };
  }

  // Same markdown fallback as above — extract whatever text the model produced
  const text = typeof raw === 'string' ? raw : '';
  return { skinToneDesc: text.slice(0, 200) || 'neutral undertone, medium contrast' };
}
