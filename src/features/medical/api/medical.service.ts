/**
 * Medical API
 *   GET /api/medical/stations
 *   GET /api/medical/queue?stationId=
 *   POST /api/medical/results
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant, MedicalStation, ResultOutcome } from '@/shared/types/domain';

export const medicalService = {
  async getStations(): Promise<MedicalStation[]> {
    await simulateLatency();
    return MOCK.medicalStations;
  },
  async getQueue(stationId: string): Promise<Array<Applicant & { orderNumber: number }>> {
    await simulateLatency();
    const station = MOCK.medicalStations.find((s) => s.id === stationId);
    if (!station) return [];
    return MOCK.applicants
      .slice(0, station.queue)
      .map((a, i) => ({ ...a, orderNumber: i + 1 }));
  },
  async recordResult(applicantId: string, stationId: string, result: Exclude<ResultOutcome, null>) {
    await simulateLatency();
    return { ok: true, applicantId, stationId, result, timestamp: Date.now() };
  },
};
