import { useEffect, useState } from 'react';

import { analyzeClothes } from '../services/clothesService';
import { ClothesAnalysisResult } from '../types/clothesAnalysis';

type Status = 'loading' | 'success' | 'error';

export function useClothesAnalysis(photoUri: string) {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<ClothesAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    analyzeClothes(photoUri)
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
