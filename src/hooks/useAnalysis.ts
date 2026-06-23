import { useEffect, useState } from 'react';

import { analyzeFood } from '../services/ollamaService';
import { AnalysisResult } from '../types/analysis';

type Status = 'loading' | 'success' | 'error';

export function useAnalysis(photoUri: string, foodLabel: string) {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    analyzeFood(photoUri, foodLabel)
      .then((data) => {
        setResult(data);
        setStatus('success');
      })
      .catch((e: Error) => {
        setError(e.message ?? 'Something went wrong');
        setStatus('error');
      });
  }, [photoUri, foodLabel]);

  return { status, result, error };
}
