import * as FileSystem from 'expo-file-system';

import { AnalysisResult } from '../types/analysis';
import { parseOllamaResponse } from '../utils/parseOllamaResponse';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
import { Platform } from 'react-native';
const BASE_URL = process.env.EXPO_PUBLIC_OLLAMA_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:11434' : 'http://localhost:11434');

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

  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava',
      prompt: buildPrompt(foodLabel),
      images: [base64],
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`Ollama error ${response.status}`);

  const json = await response.json();
  return parseOllamaResponse(json.response ?? '');
}
