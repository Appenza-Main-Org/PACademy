import type { QueryObserverOptions } from '@tanstack/react-query';

/**
 * Query options for operational records that must reflect the backend on
 * every screen visit: cycles, categories, applicants, and their joined views.
 */
export const noServerStateCacheOptions = {
  staleTime: 0,
  gcTime: 0,
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
