// Shared by every *Analysis.ts file's response parser (foodAnalysis.ts via
// parseLLMResponse.ts, selfieAnalysis.ts, lightAnalysis.ts) — previously an
// identical ~11-line helper independently copied into 2 of those 3 files,
// plus a 3rd variant inline in parseLLMResponse.ts (see
// docs/AUDIT-2026-11-15.md's Duplication finding #1). Strips markdown code
// fences (Llama frequently wraps output in them despite "raw JSON only"
// instructions) and attempts one real JSON.parse of the extracted {...}
// block — if that still fails, there's nothing safe to partially
// reconstruct, so callers treat a null return as a failed detection rather
// than guessing.
export function extractJsonObject(raw: unknown): Record<string, unknown> | null {
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
