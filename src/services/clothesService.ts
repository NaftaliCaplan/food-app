import { File } from 'expo-file-system/next';

import { ClothesAnalysisResult, MatchVerdict } from '../types/clothesAnalysis';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

export function labelForVerdict(verdict: MatchVerdict): string {
  const labels: Record<MatchVerdict, string> = {
    strong_match: 'Strong Match',
    good_match:   'Good Match',
    neutral:      'Neutral',
    mild_clash:   'Mild Clash',
    strong_clash: 'Strong Clash',
    unknown:      'Unknown',
  };
  return labels[verdict] ?? 'Unknown';
}

function adjustConfidence(modelConfidence: number, imageSizeBytes: number): number {
  let adjusted = modelConfidence;
  if (adjusted > 85) adjusted = 75 + (adjusted - 85) * 0.4;
  if (imageSizeBytes < 50_000) adjusted = Math.min(adjusted, 55);
  else if (imageSizeBytes < 150_000) adjusted = Math.min(adjusted, 70);
  return Math.round(Math.max(10, Math.min(95, adjusted)));
}

function buildPrompt(): string {
  return `You are an expert clothing stylist and accessibility consultant. A colorblind user is relying entirely on your analysis — they cannot distinguish colors themselves.

IMPORTANT ACCESSIBILITY RULE: Never describe garments by color name alone. Always describe brightness (light/dark/vivid/muted), pattern (solid/striped/plaid/floral/textured), and tone (warm/cool/neutral) together.

STEP 1 — IDENTIFY: Describe each clothing item you see. For each item state: its brightness level, pattern type, and tone. Example: "light-toned solid shirt" or "dark-toned narrow-striped trousers".

STEP 2 — ASSESS on three axes:
- CONTRAST: Do the pieces create a clear light-vs-dark contrast, or do they blend together? Blending can look unintentional.
- PATTERN: Are the patterns compatible? Two busy patterns (stripes + plaid) usually clash. Solid + pattern usually works. Solid + solid always depends on contrast.
- TONE: Do the pieces share a warm (earthy, orange-leaning), cool (blue-leaning), or neutral tone? Mixing warm and cool tones without intention tends to clash.

STEP 3 — VERDICT using this scale:
- strong_match: high harmony across all three axes
- good_match: compatible with one minor mismatch
- neutral: wearable but unremarkable — no strong harmony or clash
- mild_clash: one axis conflicts noticeably
- strong_clash: two or more axes conflict
- unknown: image too unclear or no clothing visible

STEP 4 — CONFIDENCE: Start at 50. Add 10 for each of: full outfit visible, clear lighting, patterns clearly distinguishable, multiple items visible. Never exceed 85 unless perfect conditions.

STEP 5 — OUTPUT: Respond with ONLY a raw JSON object. No markdown, no explanation. Start with { and end with }:
{
  "verdict": "<strong_match|good_match|neutral|mild_clash|strong_clash|unknown>",
  "verdictLabel": "<short label e.g. 'Strong Match'>",
  "confidencePercent": <0-100>,
  "garmentDescriptions": ["<item 1: brightness + pattern + tone>", "<item 2>"],
  "contrastNotes": ["<observation about light/dark contrast between pieces>"],
  "patternNotes": ["<observation about pattern compatibility>"],
  "toneNotes": ["<observation about warm/cool/neutral tone harmony>"],
  "recommendation": "<1-2 sentences of actionable advice for a colorblind user>"
}`;
}

function parseClothesResponse(raw: unknown, imageSizeBytes: number): ClothesAnalysisResult {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;

  if (obj && obj.verdict) {
    const verdict = (obj.verdict as MatchVerdict) ?? 'unknown';
    const rawConfidence = typeof obj.confidencePercent === 'number' ? obj.confidencePercent : 50;
    return {
      verdict,
      verdictLabel: typeof obj.verdictLabel === 'string' ? obj.verdictLabel : labelForVerdict(verdict),
      confidencePercent: adjustConfidence(rawConfidence, imageSizeBytes),
      garmentDescriptions: Array.isArray(obj.garmentDescriptions) ? obj.garmentDescriptions : [],
      contrastNotes: Array.isArray(obj.contrastNotes) ? obj.contrastNotes : [],
      patternNotes: Array.isArray(obj.patternNotes) ? obj.patternNotes : [],
      toneNotes: Array.isArray(obj.toneNotes) ? obj.toneNotes : [],
      recommendation: typeof obj.recommendation === 'string' ? obj.recommendation : '',
    };
  }

  // Fallback: keyword matching on string
  const text = typeof raw === 'string' ? raw.toLowerCase() : '';
  let verdict: MatchVerdict = 'unknown';
  if (text.includes('strong match') || text.includes('strong_match')) verdict = 'strong_match';
  else if (text.includes('good match') || text.includes('good_match')) verdict = 'good_match';
  else if (text.includes('neutral')) verdict = 'neutral';
  else if (text.includes('mild clash') || text.includes('mild_clash')) verdict = 'mild_clash';
  else if (text.includes('strong clash') || text.includes('strong_clash')) verdict = 'strong_clash';

  return {
    verdict,
    verdictLabel: labelForVerdict(verdict),
    confidencePercent: 40,
    garmentDescriptions: [],
    contrastNotes: [],
    patternNotes: [],
    toneNotes: [],
    recommendation: typeof raw === 'string' ? raw.slice(0, 150) : '',
  };
}

export async function analyzeClothes(photoUri: string): Promise<ClothesAnalysisResult> {
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
            { type: 'text', text: buildPrompt() },
          ],
        },
      ],
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return parseClothesResponse(json.result?.response, bytes.length);
}
