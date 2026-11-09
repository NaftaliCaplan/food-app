// Pure prompt-building and response-parsing for the light checker — zero
// React Native dependency, same split as foodAnalysis.ts/selfieAnalysis.ts,
// so the batch-testing harness (testing/) can import this directly in plain
// Node. lightCheckerService.ts is the only thing that still needs the
// RN-specific photoToBase64 step.
import { LightCheckResult, LightColor } from '../types/light';

const COLOR_LABELS: Record<LightColor, string> = {
  red: 'Red',
  green: 'Green',
  amber: 'Amber',
  unclear: 'Unclear',
};

const VALID_COLORS = new Set<LightColor>(['red', 'green', 'amber', 'unclear']);

export function buildLightPrompt(): string {
  return `You are a precision color-identification expert helping a colorblind user who cannot distinguish red from green on their own. They are pointing their camera at a single status or indicator light (for example, on a piece of equipment, an appliance, or a control panel) and need to know its exact color. Nothing else about the image matters.

STEP 1 — OBSERVE (write this out before doing anything else): Look at the single brightest, most eye-catching colored element in the image that could plausibly be a status/signal light. In one factual sentence, describe exactly what you see:
- Is it genuinely EMITTING light — a soft glow, halo, or bloom, brighter than its immediate surroundings, maybe with a slightly overexposed core? Or is it just colored MATERIAL with flat, even coloring and no brightness gradient — a plastic casing, button, lens, trim, or vent/grille — that merely happens to be red, green, or another color?
- How many genuinely glowing lights, if any, are visible anywhere in the whole image?
Answer honestly based only on what's visually there — do not assume something is a light just because it's a color you'd expect a light to be.

STEP 2 — LOCATE: Using only what you just wrote in STEP 1, find the single most prominent GENUINELY glowing indicator light — something you already described as actually emitting light, never something you described as colored-but-unlit material. If your STEP 1 observation found no genuinely glowing light, or found more than one comparably prominent glowing light with no single clear winner (e.g. two different lit lights of similar size/position), there is no single light to classify — skip straight to STEP 4 with color "unclear".

STEP 3 — CLASSIFY COLOR: Judge only that one light's actual illuminated color — not the color of its case, label, or background. Classify it as exactly one of: red, green, amber.
- "amber" covers yellow, orange, and amber/gold lights — any light that isn't clearly red or clearly green belongs here, not just lights that look literally orange.
- Set color to "unclear" instead if the image is too blurry, dark, glared-out, or distant to tell the true color, if you can't tell a camera flash reflection or lens artifact apart from a real indicator light, or if you're genuinely torn between two colors. Do not guess.

STEP 4 — OUTPUT: Respond with ONLY a raw JSON object. No markdown, no explanation. Start with { and end with }:
{
  "observation": "<your one-sentence STEP 1 answer>",
  "color": "<red|green|amber|unclear>",
  "detail": "<if color is 'unclear', one short factual sentence describing why, e.g. 'No illuminated light visible in the photo'; otherwise an empty string>"
}`;
}

// Mirrors selfieAnalysis.ts's extractJsonObject — strips markdown fences
// (Llama frequently wraps output despite the "raw JSON only" instruction)
// and attempts one real JSON.parse of the extracted {...} block. Each
// *Analysis.ts file owns its own small parsing helpers rather than sharing a
// cross-file util (same convention as foodAnalysis.ts/selfieAnalysis.ts).
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

// Split out so the batch-testing harness (testing/) can reuse this exact
// parsing path against a raw response it fetched itself. `unclear` is the
// safe default on anything missing/malformed/out-of-vocabulary — same
// convention as labelMatch/isClothing elsewhere in the codebase — and this
// is a real result, not a thrown error, since "couldn't tell" is itself a
// valid outcome for this feature, not a failure.
export function parseLightResponse(raw: unknown): LightCheckResult {
  const obj = extractJsonObject(raw);
  const rawColor = typeof obj?.color === 'string' ? obj.color.toLowerCase() : '';
  const color: LightColor = VALID_COLORS.has(rawColor as LightColor) ? (rawColor as LightColor) : 'unclear';
  const rawDetail = typeof obj?.detail === 'string' ? obj.detail.trim() : '';
  const observation = typeof obj?.observation === 'string' ? obj.observation.trim() : undefined;

  return {
    color,
    colorLabel: COLOR_LABELS[color],
    detail: color === 'unclear' ? (rawDetail || 'Could not clearly identify a lit indicator light.') : undefined,
    observation: observation || undefined,
  };
}
