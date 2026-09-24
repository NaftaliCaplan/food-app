import { useEffect, useState } from 'react';

import { checkSelfieOutfit } from '../services/selfieCheckService';
import { SelfieCheckResult } from '../types/selfieCheck';
import { UserProfile } from '../types/wardrobe';

type Status = 'loading' | 'success' | 'error';

// profile is resolved by the screen (SelfieCheckResultsScreen), same split as
// OutfitResultsScreen/useOutfitGenerator — this hook stays thin (just the
// async call + status), storage access lives one layer up.
//
// `ready` defaults to true (matching useClothesAnalysis's always-fire-on-mount
// shape) but the results screen passes false until it's actually resolved
// the profile from storage — without this, the effect would fire once
// immediately with `profile: null` and then again once the real profile
// loaded, wasting a network call and briefly showing the wrong result. Same
// "don't fire until the inputs are actually ready" problem OutfitResultsScreen
// already solved with its own ready flag.
export function useSelfieCheckAnalysis(photoUri: string, profile: UserProfile | null, ready = true) {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<SelfieCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setStatus('loading');
    checkSelfieOutfit(photoUri, profile)
      .then((data) => {
        setResult(data);
        setStatus('success');
      })
      .catch((e: Error) => {
        setError(e.message ?? 'Something went wrong');
        setStatus('error');
      });
  }, [photoUri, profile, ready]);

  return { status, result, error };
}
