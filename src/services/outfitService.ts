import { OutfitSuggestion, StylePreference, UserProfile, WardrobeItem } from '../types/wardrobe';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

// Each wardrobe item is serialised as one line of text so the AI can reason
// about the whole wardrobe without seeing images. Category + tags are what
// the AI uses; the id is included so we can map the AI's chosen items back
// to the actual WardrobeItem objects after parsing.
function serializeItem(item: WardrobeItem): string {
  const name = item.name ? ` (${item.name})` : '';
  return `[${item.id}] ${item.category}${name} — tags: ${item.tags.join(', ')}`;
}

// Pre-filter: only send items whose tags overlap with the requested style prefs.
// This keeps the prompt tight when the wardrobe is large. We always include
// items tagged 'casual' (the universal base), then add anything tagged with the
// user's explicit preference. Without this, a 100-item wardrobe would send the
// entire inventory every call.
//
// Accessories normally complement any style and pass through unconditionally.
// When includeAccessories is false, the user has asked for an outfit without
// accessories, so we drop the whole category before the AI ever sees it.
// Style prefs use underscores ('smart_casual') but the tagger emits hyphens
// ('smart-casual'), so we normalise separators and case before comparing —
// otherwise multi-word styles would never match their tags.
function normalizeStyle(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, '');
}

function filterByStyle(
  items: WardrobeItem[],
  prefs: StylePreference[],
  includeAccessories: boolean,
): WardrobeItem[] {
  const prefSet = new Set(prefs.map(normalizeStyle));
  return items.filter(item => {
    if (item.category === 'accessory') return includeAccessories;
    return item.tags.some(t => {
      const n = normalizeStyle(t);
      return prefSet.has(n) || n === 'casual';
    });
  });
}

function buildOutfitPrompt(
  items: WardrobeItem[],
  stylePrefs: StylePreference[],
  rejectedIdSets: string[][],
  profile: UserProfile | null,
): string {
  const inventory = items.map(serializeItem).join('\n');

  const personBlock = profile
    ? `PERSON — The wearer has the following profile. Factor this into proportion, contrast, and formality choices:
- Complexion: ${profile.skinToneDesc ?? 'not specified'}
- Height: ${profile.heightRange}
- Build: ${profile.build}

`
    : '';

  const rejectedBlock =
    rejectedIdSets.length > 0
      ? `CONSTRAINTS — The user has already rejected these combinations. Do NOT reuse any of them:
${rejectedIdSets.map((ids, i) => `  Rejected ${i + 1}: ${ids.join(', ')}`).join('\n')}

`
      : '';

  return `You are a personal stylist helping a colorblind user build an outfit from their wardrobe.

INVENTORY — Here are the available clothing items. Each line: [id] category (name) — tags:
${inventory}

STYLE GOAL — The user wants an outfit that feels: ${stylePrefs.join(', ').replace(/_/g, ' ')}.
Pick items that work well together for this style. You must include at least one top and one bottom. Accessories are optional.

${personBlock}${rejectedBlock}STEP 1 — Select 2–5 items from the inventory that make a coherent outfit.
STEP 2 — Explain in 1–2 sentences why these items work together (focus on contrast, pattern balance, style alignment — no color names).
STEP 3 — List 2–4 style notes (short bullet points about what makes this combination work for a colorblind wearer — brightness contrast, texture mix, pattern rule, etc.).
STEP 4 — Write a 1–2 sentence recommendation the user can act on (e.g. "pair with clean shoes for a smart finish").

OUTPUT — Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "itemIds": ["<id1>", "<id2>", "<id3>"],
  "reasoning": "<why this works>",
  "styleNotes": ["<note1>", "<note2>"],
  "recommendation": "<actionable tip>"
}`;
}

// ---------------------------------------------------------------------------
// Cloudflare call — text only (no image for outfit generation)
// ---------------------------------------------------------------------------

// Outfit generation sends no image — the wardrobe items are described in text
// using their tags. Using the vision model's text-only path (single text message)
// avoids the cost of encoding a dummy image.
async function callCloudflareText(promptText: string, maxTokens = 500): Promise<unknown> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: promptText }],
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

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

interface RawOutfitResponse {
  itemIds: string[];
  reasoning: string;
  styleNotes: string[];
  recommendation: string;
}

function parseOutfitResponse(raw: unknown): RawOutfitResponse | null {
  // Try direct object parse — Llama occasionally returns a pre-parsed object
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (
      Array.isArray(obj.itemIds) &&
      typeof obj.reasoning === 'string' &&
      Array.isArray(obj.styleNotes) &&
      typeof obj.recommendation === 'string'
    ) {
      return {
        itemIds: (obj.itemIds as unknown[]).filter(id => typeof id === 'string') as string[],
        reasoning: obj.reasoning,
        styleNotes: (obj.styleNotes as unknown[]).filter(n => typeof n === 'string') as string[],
        recommendation: obj.recommendation,
      };
    }
  }

  // Llama 3.2 on Cloudflare regularly wraps its output in ```json ... ``` fences
  // even when the prompt says "raw JSON only". The result arrives as a plain string
  // from the API. We extract fields with regex rather than crashing — the same
  // fallback pattern used in tagService.ts.
  const text = typeof raw === 'string' ? raw : '';
  const itemIdsMatch = text.match(/"itemIds"\s*:\s*\[([^\]]+)\]/);
  const reasoningMatch = text.match(/"reasoning"\s*:\s*"([^"]+)"/);
  const styleNotesMatch = text.match(/"styleNotes"\s*:\s*\[([^\]]+)\]/);
  const recommendationMatch = text.match(/"recommendation"\s*:\s*"([^"]+)"/);

  if (!itemIdsMatch || !reasoningMatch) return null;

  const itemIds = itemIdsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? [];
  const styleNotes =
    styleNotesMatch?.[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? [];

  return {
    itemIds,
    reasoning: reasoningMatch[1],
    styleNotes,
    recommendation: recommendationMatch?.[1] ?? '',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateOutfitOptions {
  wardrobe: WardrobeItem[];
  stylePrefs: StylePreference[];
  // Each inner array is a previously rejected combination's item IDs.
  // The prompt tells the AI to not reuse any of them.
  rejectedIdSets?: string[][];
  // When provided (B1 path), the wearer's profile is injected into the prompt.
  profile?: UserProfile | null;
  // When false, accessory-category items are excluded from the candidate pool.
  includeAccessories?: boolean;
}

export async function generateOutfit(options: GenerateOutfitOptions): Promise<OutfitSuggestion> {
  const { wardrobe, stylePrefs, rejectedIdSets = [], profile = null, includeAccessories = true } = options;

  // Filter wardrobe to style-relevant items before building prompt
  const filtered = filterByStyle(wardrobe, stylePrefs, includeAccessories);

  if (filtered.length < 2) {
    throw new Error(
      'Not enough wardrobe items match the selected style. Add more items or choose a broader style.',
    );
  }

  const prompt = buildOutfitPrompt(filtered, stylePrefs, rejectedIdSets, profile);
  const raw = await callCloudflareText(prompt);
  const parsed = parseOutfitResponse(raw);

  if (!parsed || parsed.itemIds.length === 0) {
    throw new Error('The AI could not generate an outfit from your current wardrobe. Try a different style.');
  }

  // Map the IDs the AI returned back to full WardrobeItem objects.
  // We look up from the full wardrobe (not just filtered) in case the AI picked
  // an item the filter didn't include — it shouldn't, but defensive lookup is free.
  const idMap = new Map(wardrobe.map(item => [item.id, item]));
  const selectedItems = parsed.itemIds
    .map(id => idMap.get(id))
    .filter((item): item is WardrobeItem => item !== undefined);

  if (selectedItems.length === 0) {
    throw new Error('The AI returned item IDs that do not match your wardrobe. Please try again.');
  }

  return {
    items: selectedItems,
    reasoning: parsed.reasoning,
    styleNotes: parsed.styleNotes,
    recommendation: parsed.recommendation,
  };
}
