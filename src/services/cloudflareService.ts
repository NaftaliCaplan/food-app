import { File } from 'expo-file-system/next';

import { AnalysisResult } from '../types/analysis';
import { parseLLMResponse, labelForState } from '../utils/parseLLMResponse';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

function buildPrompt(foodLabel: string): string {
  return `You are a food safety and readiness expert with sharp vision. A colorblind user is relying entirely on your analysis — they cannot distinguish colors themselves. Your visual cues must describe texture, shape, surface condition, and pattern — not just color names alone.

STEP 1 — OBSERVE: Look carefully at the image. Describe exactly what you see: shape, texture, surface condition, visible markings, any signs of cooking or preparation. Be specific.

STEP 2 — IDENTIFY: Based only on what you see, identify what the food actually is. Record this as "observedFood". The user said it is "${foodLabel}" — if what you see clearly does not match, note the mismatch in your recommendation. Do not blindly trust the label.

STEP 3 — CLASSIFY THE FOOD TYPE and pick the right scale:
- RAW MEAT / FISH / EGGS → use: raw, rare, medium-rare, medium, well-done
- COOKED MEAT that is already fully cooked → use: well-done, and note it is cooked in stateLabel
- FRESH PRODUCE (fruits, most vegetables) → use: unripe, almost_ready, ripe, use_soon, overripe
- PEPPER VARIETIES: a green bell pepper, green jalapeño, or green serrano can be fully ripe and ready — judge by firmness and freshness, not by color alone. Only call a pepper unripe if it appears underdeveloped or shriveled.
- TOMATOES: green tomatoes may be intentionally used green (e.g. fried green tomatoes) — if they look firm and fresh, use almost_ready not unripe
- COOKED OR PROCESSED FOOD (leftovers, cooked grains, bread, etc.) → assess freshness: ripe = fresh and good, use_soon = eat today, overripe = spoiling
- NOT FOOD AT ALL → set state to "unknown", stateLabel to "Not food", confidencePercent to 100, and explain in recommendation

STEP 4 — LIGHTING CHECK: If the image is dark, blurry, or overexposed, reduce confidencePercent and mention the lighting issue in visualCues.

STEP 5 — OUTPUT: You MUST respond with ONLY a raw JSON object. No markdown, no bold text, no bullet points, no explanation. Start your response with { and end with }. Nothing else.
{
  "observedFood": "<what you actually see in the image>",
  "state": "<ripe|unripe|overripe|almost_ready|use_soon|raw|rare|medium-rare|medium|well-done|unknown>",
  "stateLabel": "<short human-readable label, e.g. 'Ripe', 'Medium-rare', 'Cooked', 'Not food'>",
  "confidencePercent": <0-100>,
  "visualCues": ["<texture/pattern/condition detail>", "<second observation>", "<third observation>"],
  "recommendation": "<one or two sentences telling the user exactly what to do with this food right now>"
}`;
}

export async function analyzeFood(
  photoUri: string,
  foodLabel: string,
): Promise<AnalysisResult> {
  const bytes = await new File(photoUri).bytes();
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

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
            { type: 'text', text: buildPrompt(foodLabel) },
          ],
        },
      ],
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const raw = json.result?.response;
  // Model returns response as a pre-parsed object — use directly
  if (raw && typeof raw === 'object' && raw.state) {
    return {
      state: raw.state ?? 'unknown',
      stateLabel: raw.stateLabel ?? labelForState(raw.state),
      confidencePercent: raw.confidencePercent ?? 50,
      visualCues: Array.isArray(raw.visualCues) ? raw.visualCues : [],
      recommendation: raw.recommendation ?? '',
      ...(raw.observedFood ? { observedFood: raw.observedFood } : {}),
    };
  }
  // Fallback: parse as string
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  return parseLLMResponse(text);
}
