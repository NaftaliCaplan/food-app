import { useCallback, useRef, useState } from 'react';

import { generateOutfit } from '../services/outfitService';
import { StylePreference, UserProfile, WardrobeItem, OutfitSuggestion } from '../types/wardrobe';

export type GeneratorStatus = 'idle' | 'loading' | 'success' | 'error';

export interface OutfitGeneratorState {
  status: GeneratorStatus;
  suggestion: OutfitSuggestion | null;
  error: string | null;
  // How many times the user has rejected and regenerated in this session.
  // Shown in OutfitResultsScreen so the user knows the loop is progressing.
  attemptCount: number;
}

export interface UseOutfitGeneratorResult extends OutfitGeneratorState {
  // Start the first generation. Call once when the screen mounts.
  generate: () => void;
  // Called when the user taps "Try again". Accepts optional text feedback
  // (used to give the AI a hint on the next call — currently stored for
  // future use; the main rejection signal is the excluded combo).
  reject: (feedback?: string) => void;
}

export function useOutfitGenerator(
  wardrobe: WardrobeItem[],
  stylePrefs: StylePreference[],
  profile: UserProfile | null,
  includeAccessories: boolean = true,
  temperatureF?: number,
): UseOutfitGeneratorResult {
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // rejectedIdSets is stored in a ref, not state, because:
  // 1. It never needs to drive a re-render on its own — only the new suggestion does.
  // 2. Using a ref avoids the stale-closure problem in `reject`: if we stored
  //    rejectedIdSets in state and read it inside the async callback, we'd read
  //    the value at the time the closure was created, not the current value.
  //    A ref is always current.
  const rejectedIdSetsRef = useRef<string[][]>([]);

  // Only the most recent MAX_REMEMBERED_REJECTIONS combinations stay
  // excluded — a rolling window, not a permanent blacklist. With outfit
  // selection now fully enumerating every valid combination (see ADR 0016),
  // a small wardrobe can have very few genuinely good options; a
  // never-forgetting rejection list would let a few Try-Agains permanently
  // exhaust them, leaving nothing but worse options for the rest of the
  // session. A combo that was "solid but not the vibe right then" becomes
  // eligible again once it's aged out of the window.
  const MAX_REMEMBERED_REJECTIONS = 3;

  const run = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await generateOutfit({
        wardrobe,
        stylePrefs,
        rejectedIdSets: rejectedIdSetsRef.current,
        profile,
        includeAccessories,
        temperatureF,
      });
      setSuggestion(result);
      setStatus('success');
      setAttemptCount(prev => prev + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong generating your outfit.';
      setError(msg);
      setStatus('error');
    }
  }, [wardrobe, stylePrefs, profile, includeAccessories, temperatureF]);

  const generate = useCallback(() => {
    run();
  }, [run]);

  const reject = useCallback(
    (_feedback?: string) => {
      // Record the current suggestion's item IDs as a rejected combination.
      // generateOutfit excludes any exact match to these when picking the
      // next-best candidate (falling back to ignoring them if that would
      // leave nothing at all — see selectBestOutfit).
      if (suggestion) {
        rejectedIdSetsRef.current = [
          ...rejectedIdSetsRef.current,
          suggestion.items.map(i => i.id),
        ].slice(-MAX_REMEMBERED_REJECTIONS);
      }
      run();
    },
    [suggestion, run],
  );

  return { status, suggestion, error, attemptCount, generate, reject };
}
