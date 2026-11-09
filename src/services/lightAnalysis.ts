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

STEP 1 — LOCATE: Find the single most prominent illuminated indicator light in the image — the brightest, clearest glowing or lit element that looks like a status/signal light (a small LED, bulb, or lit icon), not a screen, not a reflection, and not ambient room lighting. If several lit indicators are visible, choose only the one that is largest, most central, or most clearly in focus — ignore the rest.

STEP 2 — CLASSIFY COLOR: Judge only that one light's actual illuminated color — not the color of its case, label, or background. Classify it as exactly one of: red, green, amber.
- "amber" covers yellow, orange, and amber/gold lights — any light that isn't clearly red or clearly green belongs here, not just lights that look literally orange.

STEP 3 — DEFENSIVE CHECK: Set color to "unclear" if any of these apply — do not guess:
- No light in the image appears to be actually illuminated (the panel is off, or what's visible is an unlit bulb/lens)
- The image is too blurry, dark, glared-out, or distant to tell the light's true color
- You cannot tell a camera flash reflection or lens artifact apart from a real indicator light
- You are genuinely torn between two colors

STEP 4 — OUTPUT: Respond with ONLY a raw JSON object. No markdown, no explanation. Start with { and end with }:
{
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

  return {
    color,
    colorLabel: COLOR_LABELS[color],
    detail: color === 'unclear' ? (rawDetail || 'Could not clearly identify a lit indicator light.') : undefined,
  };
}

// Majority-vote across N independent single-shot results (see
// lightCheckerService.ts's checkLight, which calls the model 3x on the same
// photo+prompt and feeds the parsed results here). Batch-testing this
// feature (2026-11-08) showed the single-shot model isn't reliable enough on
// borderline photos to trust one call's confident-sounding answer — the same
// ambiguous photo would flip between colors (and even between a real color
// and "unclear") across repeated identical calls. Run-to-run disagreement on
// a genuinely clear photo is rare; on a genuinely ambiguous one it's common —
// so disagreement across repeats is itself a usable signal that a human
// "plainly and confidently" framing shouldn't be trusted, rather than
// something to paper over with more prompt wording.
export function voteLightResults(results: LightCheckResult[]): LightCheckResult {
  const counts: Record<LightColor, number> = { red: 0, green: 0, amber: 0, unclear: 0 };
  for (const r of results) counts[r.color] += 1;

  const [topColor, topCount] = (Object.entries(counts) as [LightColor, number][])
    .sort((a, b) => b[1] - a[1])[0];

  if (topCount > results.length / 2) {
    if (topColor === 'unclear') {
      const detail = results.find(r => r.color === 'unclear')?.detail
        ?? 'Could not clearly identify a lit indicator light.';
      return { color: 'unclear', colorLabel: COLOR_LABELS.unclear, detail };
    }
    return { color: topColor, colorLabel: COLOR_LABELS[topColor] };
  }

  // No color won a majority — the repeated calls disagree with each other,
  // which is exactly the case a single confident-sounding call would have
  // hidden. Report that honestly instead of picking one arbitrarily.
  return {
    color: 'unclear',
    colorLabel: COLOR_LABELS.unclear,
    detail: 'Got inconsistent readings across repeated checks — try again with a clearer, closer shot of just one light.',
  };
}
