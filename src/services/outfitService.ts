import { ItemCategory, OutfitSuggestion, StylePreference, UserProfile, WardrobeItem } from '../types/wardrobe';

// top/bottom/shoes are always required-if-available. Accessory joins that
// list only when the user has opted into accessories — when they have, "let
// suggestions add hats, scarves, etc." should mean the outfit actually tries
// to include one whenever the candidate pool has one, not just "allowed to."
function requiredCategoriesFor(includeAccessories: boolean): ItemCategory[] {
  return includeAccessories
    ? ['top', 'bottom', 'shoes', 'accessory']
    : ['top', 'bottom', 'shoes'];
}

// You wear exactly one bottom and one pair of shoes — never two. Tops are the
// one exception: a base layer plus one outer layer (t-shirt under a sweater,
// shirt under a jacket) is normal, so top allows up to 2. Accessories are
// uncapped (a hat + a bag + a belt is normal). This is enforced in code, not
// just requested in the prompt, because the prompt already asks for this
// ("one top, one bottom...") and the AI has ignored explicit singular wording
// before (see ADR 0009's khakis case).
const CATEGORY_MAX: Partial<Record<ItemCategory, number>> = {
  bottom: 1,
  shoes: 1,
  top: 2,
};

// The prompt requires any item the recommendation names specifically to be
// quoted with its exact inventory name in single quotes (buildOutfitPrompt's
// STEP 2). Extracted here so capDuplicateCategories can use it as a
// tie-breaker signal, not just to validate the text after the fact.
function extractQuotedNames(text: string): Set<string> {
  const matches = text.match(/'([^']+)'/g) ?? [];
  return new Set(matches.map(m => m.slice(1, -1).toLowerCase()));
}

// When the AI over-selects a capped category (e.g. two bottoms), which
// duplicate should survive isn't arbitrary: the recommendation text is the
// AI's own record of which one it actually meant to build the outfit around.
// Preferring whichever duplicate the recommendation names keeps the final
// item set consistent with the tip instead of silently dropping the item the
// tip is actually about in favor of whichever happened to come first in the
// AI's itemIds array. Falls back to array order when nothing is named (or
// the named item isn't among the duplicates), same as the old behavior.
function capDuplicateCategories(items: WardrobeItem[], recommendation: string): WardrobeItem[] {
  const namedItems = extractQuotedNames(recommendation);
  const byCategory = new Map<ItemCategory, WardrobeItem[]>();
  for (const item of items) {
    const group = byCategory.get(item.category) ?? [];
    group.push(item);
    byCategory.set(item.category, group);
  }

  const kept = new Set<string>();
  for (const [category, group] of byCategory) {
    const max = CATEGORY_MAX[category];
    if (max === undefined) {
      group.forEach(i => kept.add(i.id));
      continue;
    }
    const named = group.filter(i => namedItems.has((i.name ?? '').toLowerCase()));
    const unnamed = group.filter(i => !named.includes(i));
    [...named, ...unnamed].slice(0, max).forEach(i => kept.add(i.id));
  }

  return items.filter(i => kept.has(i.id));
}

// Only flags a category as missing if the candidate pool could have supplied
// one — asking the AI to include a bottom when the filtered wardrobe has none
// would be an impossible, wasted retry.
function missingRequiredCategories(
  selected: WardrobeItem[],
  candidatePool: WardrobeItem[],
  required: ItemCategory[],
): ItemCategory[] {
  const available = new Set(candidatePool.map(i => i.category));
  const chosen = new Set(selected.map(i => i.category));
  return required.filter(c => available.has(c) && !chosen.has(c));
}

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
  requiredCategories: ItemCategory[],
  missingCategories: ItemCategory[] = [],
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

  const correctionBlock =
    missingCategories.length > 0
      ? `CORRECTION — Your previous attempt was missing required categories: ${missingCategories.join(', ')}. This time you MUST include at least one item from each of: ${missingCategories.join(', ')}.

`
      : '';

  const requirementLine = requiredCategories.includes('accessory')
    ? `You must include at least one item from each of these categories: ${requiredCategories.join(', ')}.`
    : `You must include at least one top and one bottom. Accessories are optional.`;

  const groundingBlock = `GROUNDING — Do not suggest adding, pairing with, or wearing any garment that is not one of the ids you put in "itemIds" — if you think of something that would improve the outfit, either select it (if it's in the inventory) or leave it unmentioned entirely.

`;

  return `You are a personal stylist helping a colorblind user build an outfit from their wardrobe.

INVENTORY — Here are the available clothing items. Each line: [id] category (name) — tags:
${inventory}

STYLE GOAL — The user wants an outfit that feels: ${stylePrefs.join(', ').replace(/_/g, ' ')}.
Pick items that work well together for this style. ${requirementLine}

${personBlock}${groundingBlock}${correctionBlock}${rejectedBlock}STEP 1 — Select the items for one coherent outfit: exactly one bottom and one pair of shoes when available and appropriate, one top (a second top ONLY if it's a genuine layering piece over the first, like a sweater or jacket over a t-shirt or button-up — never two of the same kind of top, and never two bottoms or two pairs of shoes), plus any accessories that genuinely complement it (a hat, bag, belt, watch, etc.). Include as many accessories as actually make sense together — do not force one in just to add it, but do not artificially cap the total item count either. A minimal outfit (e.g. a swimsuit plus sandals) can be as few as 2 items; a fully accessorized outfit can be 6 or more. Let the wardrobe and style goal decide, not a fixed number.

STEP 2 — Write a single short, actionable tip (1 sentence) about how to WEAR the items you selected (tucking, rolling sleeves, layering, etc.) — not a suggestion to add a different garment. If you name a specific item, use its exact name from the inventory above in single quotes, e.g. 'navy polo' — never double quotes (this text goes inside a JSON string, and a double quote would break it), and never paraphrase it into a different garment or color.

OUTPUT — Respond with ONLY a raw JSON object. No markdown. Start with { end with }:
{
  "itemIds": ["<id1>", "<id2>", "<id3>"],
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
  recommendation: string;
}

function parseOutfitResponse(raw: unknown): RawOutfitResponse | null {
  // Try direct object parse — Llama occasionally returns a pre-parsed object
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.itemIds) && typeof obj.recommendation === 'string') {
      return {
        itemIds: (obj.itemIds as unknown[]).filter(id => typeof id === 'string') as string[],
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
  const recommendationMatch = text.match(/"recommendation"\s*:\s*"([^"]+)"/);

  if (!itemIdsMatch) return null;

  const itemIds = itemIdsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) ?? [];

  return {
    itemIds,
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

  const idMap = new Map(wardrobe.map(item => [item.id, item]));
  const requiredCategories = requiredCategoriesFor(includeAccessories);

  // Up to one retry: if the first attempt is missing a required category that
  // was actually available, ask again with an explicit correction. We keep the
  // best result seen so far so a still-imperfect retry doesn't throw away a
  // perfectly usable (if incomplete) outfit from the first attempt.
  let best: OutfitSuggestion | null = null;
  let missingCategories: ItemCategory[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildOutfitPrompt(filtered, stylePrefs, rejectedIdSets, profile, requiredCategories, missingCategories);
    const raw = await callCloudflareText(prompt);
    const parsed = parseOutfitResponse(raw);

    if (!parsed || parsed.itemIds.length === 0) {
      if (best) break;
      throw new Error('The AI could not generate an outfit from your current wardrobe. Try a different style.');
    }

    // Map the IDs the AI returned back to full WardrobeItem objects.
    // We look up from the full wardrobe (not just filtered) in case the AI picked
    // an item the filter didn't include — it shouldn't, but defensive lookup is free.
    const selectedItems = capDuplicateCategories(
      parsed.itemIds
        .map(id => idMap.get(id))
        .filter((item): item is WardrobeItem => item !== undefined),
      parsed.recommendation,
    );

    if (selectedItems.length === 0) {
      if (best) break;
      throw new Error('The AI returned item IDs that do not match your wardrobe. Please try again.');
    }

    best = {
      items: selectedItems,
      recommendation: parsed.recommendation,
    };

    missingCategories = missingRequiredCategories(selectedItems, filtered, requiredCategories);
    if (missingCategories.length === 0) break;
  }

  // Structural guarantee: recompute what's still missing directly from the
  // final selection (not the loop's filtered-only tracking above) and fill
  // every gap in code rather than trusting a third AI call. Try a style-
  // matching candidate from `filtered` first, but fall back to the full
  // wardrobe if the style filter left zero candidates for that category —
  // a small wardrobe can easily have no item of some category that also
  // matches the requested style, and a whole missing category is worse than
  // one item that doesn't perfectly match the style goal.
  if (best) {
    const selectedIds = new Set(best.items.map(i => i.id));
    const chosenCategories = new Set(best.items.map(i => i.category));
    const stillMissing = requiredCategories.filter(c => !chosenCategories.has(c));

    for (const cat of stillMissing) {
      const fallbackItem =
        filtered.find(i => i.category === cat && !selectedIds.has(i.id)) ??
        wardrobe.find(i => i.category === cat && !selectedIds.has(i.id));
      if (fallbackItem) {
        best.items.push(fallbackItem);
        selectedIds.add(fallbackItem.id);
      }
    }
  }

  return best!;
}
