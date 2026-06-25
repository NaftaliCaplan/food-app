import * as FileSystem from 'expo-file-system';

import { AnalysisResult } from '../types/analysis';
import { parseOllamaResponse } from '../utils/parseOllamaResponse';

const ACCOUNT_ID = process.env.EXPO_PUBLIC_CF_ACCOUNT_ID;
const API_TOKEN = process.env.EXPO_PUBLIC_CF_API_TOKEN;
const MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

function buildPrompt(foodLabel: string): string {
  return `You are a food ripeness expert. The user is asking about: ${foodLabel}.

Look at this image and assess the ripeness or doneness of the ${foodLabel}.

Respond with ONLY a JSON object in this exact format, no other text:
{
  "state": "<ripe|unripe|overripe|almost_ready|use_soon|raw|rare|medium-rare|medium|well-done|unknown>",
  "stateLabel": "<short human-readable label>",
  "confidencePercent": <0-100>,
  "visualCues": ["<cue 1>", "<cue 2>", "<cue 3>"],
  "recommendation": "<one or two sentence recommendation>"
}`;
}

export async function analyzeFood(
  photoUri: string,
  foodLabel: string,
): Promise<AnalysisResult> {
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: buildPrompt(foodLabel),
      image: base64,
    }),
  });

  if (!response.ok) throw new Error(`Cloudflare AI error ${response.status}`);

  const json = await response.json();
  return parseOllamaResponse(json.result?.description ?? '');
}
