import type { QueryObserverOptions } from '@tanstack/react-query';

/**
 * Query options for operational records that must reflect the backend on
 * every screen visit: cycles, categories, applicants, and their joined views.
 *
 * `staleTime: 0` + `refetchOnMount: 'always'` already guarantees a fresh
 * fetch every time a screen mounts. `gcTime` is kept at 5 minutes (not 0)
 * so the cached value survives a brief unmount/remount window — without
 * that buffer the cache evicts mid-render, queries restart from `undefined`,
 * and downstream `useEffect`s keyed on derived ids oscillate (seen on the
 * admission-setup wizard as a refetch loop).
 */
export const noServerStateCacheOptions = {
  staleTime: 0,
  gcTime: 5 * 60 * 1000,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  refetchOnReconnect: 'always',
} satisfies Pick<
  QueryObserverOptions,
  | 'staleTime'
  | 'gcTime'
  | 'refetchOnMount'
  | 'refetchOnWindowFocus'
  | 'refetchOnReconnect'
>;
