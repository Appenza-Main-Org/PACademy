/**
 * useNidLookup — TanStack Query mutation wrapper around `nidLookupService.lookup`.
 *
 * Manual trigger only (the create form has a "بحث" button that fires
 * `mutate(nid)`). Returns the discriminated `NidLookupResult` directly
 * via `data` so consumers branch on `data.status` without unwrapping.
 *
 * Cache key uses the trimmed NID so accidental double-clicks dedupe
 * via React Query's in-flight tracking.
 */

import { useMutation } from '@tanstack/react-query';
import { nidLookupService, type NidLookupResult } from '../api/nid-lookup.service';

export interface UseNidLookupReturn {
  mutate: (nationalId: string) => void;
  mutateAsync: (nationalId: string) => Promise<NidLookupResult>;
  data: NidLookupResult | undefined;
  status: 'idle' | 'pending' | 'success' | 'error';
  reset: () => void;
  isPending: boolean;
  error: Error | null;
}

export function useNidLookup(): UseNidLookupReturn {
  const mutation = useMutation<NidLookupResult, Error, string>({
    mutationKey: ['admin', 'nid-lookup'],
    mutationFn: (nationalId: string) => nidLookupService.lookup(nationalId.trim()),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    status: mutation.status,
    reset: mutation.reset,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
