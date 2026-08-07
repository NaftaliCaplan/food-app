import { File } from 'expo-file-system/next';

import { ItemCategory, StylePreference } from '../types/wardrobe';

const STYLE_KEYS: StylePreference[] = ['casual', 'smart_casual', 'formal', 'sporty'];

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
}

export interface SkinToneResult {
  skinToneDesc: string;
}

function buildTagPrompt(category: ItemCategory): string {
  return `You are a clothing identification expert helping a colorblind user catalog their wardrobe.

STEP 0 — CHECK: Does this photo actually show a piece of clothing or an accessory (not a face, a room, a random object, or a blank/blurry shot)? If it does NOT, set "isClothing" to false, leave "name" as an empty string and "tags" as an empty array, and skip the remaining steps.

STEP 1 — IDENTIFY: What clothing item do you see? Be specific (e.g. "crew-neck knit sweater", "slim-fit chinos", "leather oxford shoes").

STEP 2 — DESCRIBE using only these attributes (never just color names alone):
- Brightness: light / dark / vivid / muted
- Pattern: solid / striped / plaid / checked / floral / textured / graphic
- Tone: warm / cool / neutral
- Category confirms: ${category}

STEP 3 — STYLE: Pick EXACTLY ONE style — they are mutually exclusive, never pick two:
- casual: everyday wear — t-shirts, jeans, sneakers, hoodies, loungewear, pajamas, sleepwear
- smart_casual: polished but not formal — chinos, untucked button-ups, loafers, casual blazers
- formal: suits, dress shirts, ties, dress shoes, gowns, suit blazers
- sporty: activewear, gym clothes, athletic shoes, performance fabrics
If genuinely unsure, pick casual — it is the safer, more common bucket. Pajamas and sleepwear are always casual, never formal.

STEP 4 — TAGS: Create a tag list of short lowercase words or hyphenated phrases from the Step 2 attributes plus fit/weight/texture words. Do NOT put any style word (casual, smart_casual, formal, sporty) in this list — the style you picked in Step 3 goes in its own "style" field below, not in "tags".
Good tag examples: light, dark, warm-tone, cool-tone, neutral-tone, solid, striped, plaid, textured, fitted, loose, lightweight, heavyweight

STEP 5 — OUTPUT: Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "isClothing": <true|false>,
  "name": "<specific item name, e.g. 'light-toned solid crew-neck sweater'>",
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
