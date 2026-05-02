/**
 * Medical Commission API — Sprint 4 (KARASA §6).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/medical/stations                              → MedicalStation[]
 *   GET    /api/medical/queue?stationId=                      → applicants
 *   GET    /api/medical/results?applicantId=&station=         → MedicalExamResult[]
 *   POST   /api/medical/results                               → MedicalExamResult (preliminary)
 *   POST   /api/medical/results/:id/approve                   → MedicalExamResult (final)
 *   GET    /api/medical/certificate/:applicantId              → master verdict
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  Applicant,
  MedicalExamResult,
  MedicalStation,
  MedicalStationKey,
  MedicalVerdict,
  ResultOutcome,
} from '@/shared/types/domain';

const STATIONS_STATE: MedicalStation[] = [...MOCK.medicalStations];
const RESULTS_STATE: MedicalExamResult[] = [...MOCK.medicalResults];
let mrId = RESULTS_STATE.length + 1;

export const STATION_LABELS: Record<MedicalStationKey, string> = {
  eye: 'العيون',
  ent: 'الأنف والأذن والحنجرة',
  internal: 'الباطنة',
  orthopedic: 'العظام',
  neuro: 'الأعصاب',
  psychology: 'الاتزان النفسي',
  surgery: 'الجراحة العامة',
  bmi: 'القياسات (BMI)',
};

export const ALL_STATION_KEYS: readonly MedicalStationKey[] = [
  'eye', 'ent', 'internal', 'orthopedic', 'neuro', 'psychology', 'surgery', 'bmi',
];

export const medicalService = {
  async getStations(): Promise<MedicalStation[]> {
    await simulateLatency();
    return [...STATIONS_STATE];
  },

  async getQueue(stationId: string): Promise<Array<Applicant & { orderNumber: number }>> {
    await simulateLatency();
    const station = STATIONS_STATE.find((s) => s.id === stationId);
    if (!station) return [];
    return MOCK.applicants.slice(0, station.queue).map((a, i) => ({ ...a, orderNumber: i + 1 }));
  },

  async getResultsForStation(station: MedicalStationKey): Promise<MedicalExamResult[]> {
    await simulateLatency();
    return RESULTS_STATE.filter((r) => r.station === station);
  },

  async getResultsForApplicant(applicantId: string): Promise<MedicalExamResult[]> {
    await simulateLatency();
    return RESULTS_STATE.filter((r) => r.applicantId === applicantId);
  },

  async recordExam(payload: {
    applicantId: string;
    applicantName: string;
    station: MedicalStationKey;
    doctor: string;
    verdict: MedicalVerdict;
    fields: Record<string, string | number | boolean>;
    notes?: string;
  }): Promise<MedicalExamResult> {
    await simulateLatency();
    const next: MedicalExamResult = {
      id: `RES-M-${String(mrId++).padStart(5, '0')}`,
      applicantId: payload.applicantId,
      applicantName: payload.applicantName,
      station: payload.station,
      doctor: payload.doctor,
      enteredAt: Date.now(),
      phase: 'preliminary',
      verdict: payload.verdict,
      fields: payload.fields,
      notes: payload.notes,
    };
    RESULTS_STATE.unshift(next);
    return next;
  },

  async approveResult(resultId: string): Promise<MedicalExamResult | null> {
    await simulateLatency();
    const r = RESULTS_STATE.find((x) => x.id === resultId);
    if (!r) return null;
    r.phase = 'final';
    return r;
  },

  /**
   * Master medical certificate aggregator.
   * Auto-rule per §6.2.D: any FAIL → overall FAIL; any conditional → board review.
   */
  async getCertificate(applicantId: string): Promise<{
    applicantId: string;
    perStation: Partial<Record<MedicalStationKey, { verdict: MedicalVerdict; doctor: string }>>;
    overall: 'pass' | 'fail' | 'board-review' | 'incomplete';
  }> {
    await simulateLatency();
    const all = RESULTS_STATE.filter((r) => r.applicantId === applicantId);
    const perStation: Partial<Record<MedicalStationKey, { verdict: MedicalVerdict; doctor: string }>> = {};
    for (const r of all) perStation[r.station] = { verdict: r.verdict, doctor: r.doctor };
    const have = ALL_STATION_KEYS.filter((s) => perStation[s]).length;
    if (have < ALL_STATION_KEYS.length) return { applicantId, perStation, overall: 'incomplete' };
    const verdicts = ALL_STATION_KEYS.map((s) => perStation[s]!.verdict);
    if (verdicts.includes('fail')) return { applicantId, perStation, overall: 'fail' };
    if (verdicts.includes('conditional')) return { applicantId, perStation, overall: 'board-review' };
    return { applicantId, perStation, overall: 'pass' };
  },

  async recordResult(applicantId: string, stationId: string, result: Exclude<ResultOutcome, null>) {
    await simulateLatency();
    return { ok: true, applicantId, stationId, result, timestamp: Date.now() };
  },
};
