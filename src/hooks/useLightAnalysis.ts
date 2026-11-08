import { useEffect, useState } from 'react';

import { checkLight } from '../services/lightCheckerService';
import { LightCheckResult } from '../types/light';

type Status = 'loading' | 'success' | 'error';

export function useLightAnalysis(photoUri: string) {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<LightCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkLight(photoUri)
      .then((data) => {
        setResult(data);
        setStatus('success');
      })
      .catch((e: Error) => {
        setError(e.message ?? 'Something went wrong');
        setStatus('error');
      });
  }, [photoUri]);

  return { status, result, error };
}
