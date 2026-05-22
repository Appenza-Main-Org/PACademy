/**
 * Lookup Management Module — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/lookups/:key
 *   POST   /api/lookups/:key
 *   PATCH  /api/lookups/:key/:code
 *   DELETE /api/lookups/:key/:code
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  DeleteResult,
  LookupKey,
  LookupRow,
  LookupRowMap,
} from '../types';

export const lookupsService = {
  async listLookup<K extends LookupKey>(key: K): Promise<LookupRow<K>[]> {
    return apiClient.get(`/api/lookups/${encodeURIComponent(key)}`);
  },

  async createLookupRow<K extends LookupKey>(
    key: K,
    input: Omit<LookupRow<K>, 'code'> & { code?: string },
  ): Promise<LookupRow<K>> {
    return apiClient.post(`/api/lookups/${encodeURIComponent(key)}`, input as Record<string, unknown>);
  },

  async updateLookupRow<K extends LookupKey>(
    key: K,
    code: string,
    patch: Partial<LookupRow<K>>,
  ): Promise<LookupRow<K>> {
    return apiClient.patch(
      `/api/lookups/${encodeURIComponent(key)}/${encodeURIComponent(code)}`,
      patch as Record<string, unknown>,
    );
  },

  async deleteLookupRow<K extends LookupKey>(key: K, code: string): Promise<DeleteResult> {
    return apiClient.delete(`/api/lookups/${encodeURIComponent(key)}/${encodeURIComponent(code)}`);
  },
};

export type LookupsService = typeof lookupsService;
export type { LookupRowMap };
