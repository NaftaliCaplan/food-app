// Own types file, same convention as types/selfieCheck.ts — each AI-calling
// feature gets its own narrow result shape rather than folding into
// types/analysis.ts (which is food-specific, built around RipenessState).
export type LightColor = 'red' | 'green' | 'amber' | 'unclear';

export interface LightCheckResult {
  color: LightColor;
  colorLabel: string; // 'Red' | 'Green' | 'Amber' | 'Unclear'
  // Only populated when color === 'unclear' — a short factual reason the
  // color couldn't be determined, never an interpretation of what a color
  // means (the user explicitly wants color-only output, no meaning gloss).
  detail?: string;
  // The model's own forced-reasoning sentence about what it saw before
  // committing to a color (see buildLightPrompt's STEP 1) — never shown in
  // the app UI, kept only for testing/diagnostic visibility (see
  // testing/run-light.ts, which logs it) into *why* a color was picked.
  observation?: string;
}
