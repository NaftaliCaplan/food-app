// Pure prompt-building and response-parsing for the food checker — zero
// React Native dependency, split out of cloudflareService.ts (2026-11-03) so
// the batch-testing harness (testing/) can import it directly in plain Node.
// cloudflareService.ts's analyzeFood() is the only thing that still needs
// the RN-specific photoToBase64 step; everything here runs anywhere.
import { AnalysisResult } from '../types/analysis';
import { parseLLMResponse, labelForState } from '../utils/parseLLMResponse';

// Model always over-reports confidence — apply a realistic correction
function adjustConfidence(modelConfidence: number, imageSizeBytes: number): number {
  let adjusted = modelConfidence;

  // Model scores above 85 are almost always inflated — pull them down
  if (adjusted > 85) adjusted = 75 + (adjusted - 85) * 0.4;

  // Very small images (< 50kb) are likely blurry or dark
  if (imageSizeBytes < 50_000) adjusted = Math.min(adjusted, 55);
  // Small images (< 150kb) — moderate penalty
  else if (imageSizeBytes < 150_000) adjusted = Math.min(adjusted, 70);

  return Math.round(Math.max(10, Math.min(99, adjusted)));
}

// Crude singular/plural stemmer — not linguistically rigorous, just enough to
// stop an exact-substring check from failing on the most common case: "ripe
// cherry" vs. an observedFood of "a cluster of bright red cherries" used to
// come back labelMatch: false purely because "cherry" isn't a literal
// substring of "cherries" (confirmed via the testing/ batch harness, see
// project memory). Comparing word-by-word (both sides stemmed) rather than
// one word against the whole raw string also avoids accidental substring
// hits across word boundaries as a side effect.
function stem(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 2) return word.slice(0, -1);
  return word;
}

function foodLabelMatchesObserved(label: string, observed: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '');
  const toStems = (s: string) => normalize(s).split(/\s+/).filter(w => w.length > 2).map(stem);
  const labelStems = toStems(label);
  const observedStems = toStems(observed);
  return labelStems.some(word => observedStems.some(ow => ow.includes(word) || word.includes(ow)));
}

// foodLabel is deliberately withheld until STEP 3 (COMPARE), after the model
// has already committed to its own observedFood in STEP 2 — revealing the
// label any earlier anchors the model's own "observation" toward agreeing
// with it (seen live: a photo of a person labeled "banana" came back as an
// observed, confident banana). foodLabelMatchesObserved() can only catch a
// mismatch if observedFood is actually independent; this ordering is what
// makes that check meaningful rather than a no-op.
export function buildPrompt(foodLabel: string): string {
  return `You are a food safety and readiness expert with sharp vision. A colorblind user is relying entirely on your analysis — they cannot distinguish colors themselves. Your visual cues must describe texture, shape, surface condition, and pattern — not just color names alone.

STEP 1 — OBSERVE: Look carefully at the image. Describe exactly what you see: shape, texture, surface condition, visible markings, any signs of cooking or preparation. Be specific. Do this before considering any label the user may have given — judge purely from what's visible.

STEP 2 — IDENTIFY: Based only on your own observation above, identify what the food actually is. Record this as "observedFood". Do not let anything else bias this step — describe only the conclusion you'd reach from the image alone.

STEP 3 — COMPARE: The user labeled this photo as "${foodLabel}". Compare your independent observedFood from Step 2 against this label. If they clearly don't match — the label names a food but your observation is a different food, or isn't food at all — say so plainly in the recommendation. Do not go back and change observedFood to match the label just because the user said so; observedFood must stay what you actually concluded in Step 2.

STEP 4 — CLASSIFY THE FOOD TYPE and pick the right scale:
- RAW MEAT / FISH / EGGS → use: raw, rare, medium-rare, medium, well-done
- COOKED MEAT that is already fully cooked → use: well-done, and note it is cooked in stateLabel
- FRESH PRODUCE (fruits, most vegetables) → use: unripe, almost_ready, ripe, use_soon, overripe
- PEPPER VARIETIES: a green bell pepper, green jalapeño, or green serrano can be fully ripe and ready — judge by firmness and freshness, not by color alone. Only call a pepper unripe if it appears underdeveloped or shriveled.
- TOMATOES: green tomatoes may be intentionally used green (e.g. fried green tomatoes) — if they look firm and fresh, use almost_ready not unripe
- COOKED OR PROCESSED FOOD (leftovers, cooked grains, bread, pasta, noodles, rice, etc.) → assess freshness: ripe = fresh and good, use_soon = eat today, overripe = spoiling. This bucket applies whether the food is currently raw/uncooked (e.g. dry or fresh uncooked pasta) or already cooked — it is still food either way, never "not food."
- NOT FOOD AT ALL → set state to "unknown", stateLabel to "Not food", confidencePercent to 100, and explain in recommendation

STEP 5 — CONFIDENCE: You must be conservative. Start at 50 and only go higher if you have specific visual evidence.
- Add 10 points if the food is fully visible with no obstruction
- Add 10 points if the lighting is clear and even
- Add 10 points if the surface texture is clearly visible
- Add 10 points if you can see both the color and the firmness/condition clearly
- Add up to 10 more points if everything is perfect and unambiguous
So the maximum is 100 but most real photos will land between 50-80. Never start above 50. If the food is partially covered, in shadow, or you are inferring rather than seeing — stay at or below 60.

STEP 6 — OUTPUT: You MUST respond with ONLY a raw JSON object. No markdown, no bold text, no bullet points, no explanation. Start your response with { and end with }. Nothing else.
{
  "observedFood": "<what you actually see in the image, e.g. 'a yellow banana with brown spots'>",
  "state": "<ripe|unripe|overripe|almost_ready|use_soon|raw|rare|medium-rare|medium|well-done|unknown>",
  "stateLabel": "<short human-readable label, e.g. 'Ripe', 'Medium-rare', 'Cooked', 'Not food'>",
  "confidencePercent": <0-100>,
  "visualCues": ["<observation about the food itself only — texture, skin, surface, firmness — not the background or surroundings>", "<second observation about the food>", "<third observation about the food>"],
  "recommendation": "<one or two sentences telling the user exactly what to do with this food right now>"
}`;
}

// Split out of analyzeFood so the batch-testing harness (testing/) can reuse
// this exact parsing path against a raw response it fetched itself — no
// duplicated parsing logic, same fidelity as the real app.
export function parseAnalyzeFoodResponse(
  raw: unknown,
  size: number,
  foodLabel: string,
): AnalysisResult {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  // Model returns response as a pre-parsed object — use directly
  if (obj && obj.state) {
    const observedFood = typeof obj.observedFood === 'string' ? obj.observedFood : '';
    const labelMatch = observedFood
      ? foodLabelMatchesObserved(foodLabel, observedFood)
      : true;
    const rawConfidence = typeof obj.confidencePercent === 'number' ? obj.confidencePercent : 50;
    const confidencePercent = adjustConfidence(rawConfidence, size);
    const state = obj.state as AnalysisResult['state'];
    return {
      state,
      stateLabel: typeof obj.stateLabel === 'string' ? obj.stateLabel : labelForState(state),
      confidencePercent,
      visualCues: Array.isArray(obj.visualCues) ? obj.visualCues : [],
      recommendation: typeof obj.recommendation === 'string' ? obj.recommendation : '',
      observedFood: observedFood || undefined,
      labelMatch,
    };
  }
  // Fallback: parse as string. parseLLMResponse() only receives raw text, not
  // foodLabel or size, so it can extract observedFood/confidencePercent but
  // structurally can't compute labelMatch or apply the image-size confidence
  // correction itself — confirmed via the testing/ batch harness that this
  // path is hit often enough (3 of 17 photos in one real run) to matter, not
  // just a theoretical gap. Both are applied here instead, same semantics as
  // the main path above, so results are consistent regardless of which parse
  // path a response takes.
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  const fallbackResult = parseLLMResponse(text);
  const labelMatch = fallbackResult.observedFood
    ? foodLabelMatchesObserved(foodLabel, fallbackResult.observedFood)
    : true;
  return {
    ...fallbackResult,
    confidencePercent: adjustConfidence(fallbackResult.confidencePercent, size),
    labelMatch,
  };
}
