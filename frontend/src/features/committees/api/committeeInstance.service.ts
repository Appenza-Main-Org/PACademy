/**
 * Committee Instances — cycle-bound, dated, capacity-bearing committee
 * assignments for `/admin/committees-exam-config`.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/committee-instances
 *   POST   /api/committee-instances
 *   PATCH  /api/committee-instances/:id
 *   DELETE /api/committee-instances/:id
 *   POST   /api/committee-instances/refresh-reserved
 *   DELETE /api/committee-instances
 *   POST   /api/committee-instances/transfer-day
 *   POST   /api/committee-instances/:id/transfer
 */

import { apiClient } from '@/shared/lib/api-client';
import type { CommitteeInstance } from '@/shared/types/domain';

export interface CommitteeInstanceListFilters {
  cycleId?: string;
  categoryKey?: string;
  definitionCode?: string;
}

export interface CommitteeInstanceAddInput {
  cycleId: string;
  categoryKey: string;
  definitionCode: string;
  date: string;
  capacity: number;
}

export type CommitteeInstancePatch = Partial<Pick<CommitteeInstance, 'date' | 'capacity'>>;
export type TransferCapacityMode = 'move-only' | 'move-and-add-capacity';

export interface ReservationTransferConflict {
  committeeName: string;
  categoryKey: string;
  sourceInstanceId: string;
  destinationInstanceId: string;
  sourceReserved: number;
  destinationCapacity: number;
  destinationReserved: number;
  freeSeats: number;
  requiredCapacity: number;
}

export const committeeInstanceService = {
  async list(filters: CommitteeInstanceListFilters = {}): Promise<CommitteeInstance[]> {
    return apiClient.get('/api/committee-instances', { query: filters });
  },

  async addMany(input: ReadonlyArray<CommitteeInstanceAddInput>): Promise<CommitteeInstance[]> {
    return apiClient.post('/api/committee-instances', input);
  },

  async update(id: string, patch: CommitteeInstancePatch): Promise<CommitteeInstance> {
    return apiClient.patch(`/api/committee-instances/${encodeURIComponent(id)}`, patch);
  },

  async refreshReservedCounts(
    filters: CommitteeInstanceListFilters = {},
  ): Promise<CommitteeInstance[]> {
    return apiClient.post('/api/committee-instances/refresh-reserved', filters);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/committee-instances/${encodeURIComponent(id)}`);
  },

  async removeDay(input: { cycleId: string; date: string }): Promise<CommitteeInstance[]> {
    return apiClient.delete('/api/committee-instances', { query: input });
  },

  async transferDay(input: {
    cycleId: string;
    fromDate: string;
    toDate: string;
    capacityMode?: TransferCapacityMode;
    capacityBumps?: Record<string, number>;
  }): Promise<{
    transferred: CommitteeInstance[];
    createdAtDestination: CommitteeInstance[];
    bumped: CommitteeInstance[];
    totalReservationsMoved: number;
  }> {
    return apiClient.post('/api/committee-instances/transfer-day', input);
  },

  async transferOne(input: {
    id: string;
    toDate: string;
    capacityMode?: TransferCapacityMode;
    capacityBumps?: Record<string, number>;
  }): Promise<{
    transferred: CommitteeInstance[];
    createdAtDestination: CommitteeInstance[];
    bumped: CommitteeInstance[];
    totalReservationsMoved: number;
  }> {
    return apiClient.post(`/api/committee-instances/${encodeURIComponent(input.id)}/transfer`, input);
  },
};
