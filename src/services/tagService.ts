import { File } from 'expo-file-system/next';

import { ItemCategory } from '../types/wardrobe';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

export interface TagResult {
  name: string;
  tags: string[];
}

export interface SkinToneResult {
  skinToneDesc: string;
}

function buildTagPrompt(category: ItemCategory): string {
  return `You are a clothing identification expert helping a colorblind user catalog their wardrobe.

STEP 1 — IDENTIFY: What clothing item do you see? Be specific (e.g. "crew-neck knit sweater", "slim-fit chinos", "leather oxford shoes").

STEP 2 — DESCRIBE using only these attributes (never just color names alone):
- Brightness: light / dark / vivid / muted
- Pattern: solid / striped / plaid / checked / floral / textured / graphic
- Tone: warm / cool / neutral
- Style: casual / smart_casual / formal / sporty
- Category confirms: ${category}

STEP 3 — TAGS: Create a tag list. Tags must be short lowercase words or hyphenated phrases. Include as many as are accurate — more tags = better matching later.
Good tag examples: light, dark, warm-tone, cool-tone, neutral-tone, solid, striped, plaid, casual, formal, sporty, smart-casual, textured, fitted, loose, lightweight, heavyweight

STEP 4 — OUTPUT: Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "name": "<specific item name, e.g. 'light-toned solid crew-neck sweater'>",
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
    return {
      name: obj.name,
      tags: (obj.tags as unknown[]).filter(t => typeof t === 'string') as string[],
    };
  }

  // Llama 3.2 (the model Cloudflare runs) frequently ignores the "raw JSON only"
  // instruction and wraps its output in ```json ... ``` markdown fences. When that
  // happens, Cloudflare returns the whole thing as a plain string rather than a
  // pre-parsed object, so the typeof check above fails. We saw this repeatedly in
  // testing. Rather than crashing, we extract name and tags with regex from the raw
  // string — it's not elegant but it handles the model's most common failure mode.
  const text = typeof raw === 'string' ? raw : '';
  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  const tagsMatch = text.match(/"tags"\s*:\s*\[([^\]]+)\]/);
  const tags = tagsMatch
    ? tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) ?? []
    : [];
  return {
    name: nameMatch ? nameMatch[1] : `${category} item`,
    tags,
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
