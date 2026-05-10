/**
 * Biometric API — Sprint 8 (RFP Scope Document §8).
 *
 * INTEGRATION CONTRACT:
 *   POST   /api/biometric/enroll                         → BiometricEnrollment
 *   POST   /api/biometric/verify                         → VerifyResult
 *   GET    /api/biometric/verifications?station=&since=  → BiometricVerification[]
 *   GET    /api/biometric/monitoring                     → live counts per station
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { BiometricEnrollment, BiometricVerification } from '@/shared/types/domain';

const ENROLL_STATE: BiometricEnrollment[] = [...MOCK.biometricEnrollments];
const VERIFY_STATE: BiometricVerification[] = [...MOCK.biometricVerifications];
let bId = ENROLL_STATE.length + 1;
let vId = VERIFY_STATE.length + 1;

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  matchScore?: number;
  applicant?: { id: string; name: string; nationalId: string; photo: string | null };
  timestamp: number;
}

export const biometricService = {
  async verify(input: { nationalId?: string; barcode?: string; station?: 'gate' | 'exam-room' | 'committee'; method?: 'face' | 'fingerprint' | 'barcode' }): Promise<VerifyResult> {
    await simulateLatency(600, 1200);
    const target = MOCK.applicants.find((a) => a.nationalId === input.nationalId || a.id === input.barcode);
    if (!target) return { ok: false, reason: 'لم يتم العثور على المتقدم', timestamp: Date.now() };
    const matchScore = 0.88 + Math.random() * 0.1;
    /* Log the verification attempt. */
    VERIFY_STATE.unshift({
      id: `VER-${String(vId++).padStart(5, '0')}`,
      applicantId: target.id,
      station: input.station ?? 'gate',
      ts: Date.now(),
      method: input.method ?? 'face',
      match: matchScore >= 0.85,
      confidence: Math.floor(matchScore * 100),
    });
    return {
      ok: true,
      matchScore,
      applicant: { id: target.id, name: target.name, nationalId: target.nationalId, photo: target.photo },
      timestamp: Date.now(),
    };
  },

  async enroll(applicantId: string): Promise<BiometricEnrollment> {
    await simulateLatency(600, 1100);
    const next: BiometricEnrollment = {
      id: `BIO-${String(bId++).padStart(5, '0')}`,
      applicantId,
      enrolledAt: Date.now(),
      faceCaptured: true,
      fingerprintCaptured: true,
      livenessConfirmed: true,
      templateRef: `tmpl/${applicantId}`,
    };
    ENROLL_STATE.unshift(next);
    return next;
  },

  async listVerifications(filters: { station?: 'gate' | 'exam-room' | 'committee'; since?: number } = {}): Promise<BiometricVerification[]> {
    await simulateLatency();
    let out = VERIFY_STATE;
    if (filters.station) out = out.filter((v) => v.station === filters.station);
    if (filters.since) out = out.filter((v) => v.ts >= filters.since!);
    return [...out];
  },

  async monitoring(): Promise<{
    last24h: { ts: number; count: number }[];
    perStation: Record<string, { total: number; match: number; failed: number }>;
    recentFailures: BiometricVerification[];
  }> {
    await simulateLatency();
    const oneDay = 24 * 3600_000;
    const since = Date.now() - oneDay;
    const recent = VERIFY_STATE.filter((v) => v.ts >= since);
    const buckets = new Map<number, number>();
    for (const v of recent) {
      const hour = Math.floor((Date.now() - v.ts) / 3600_000);
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
    }
    const last24h = Array.from({ length: 24 }, (_, h) => ({ ts: Date.now() - h * 3600_000, count: buckets.get(h) ?? 0 }));
    const perStation: Record<string, { total: number; match: number; failed: number }> = { gate: { total: 0, match: 0, failed: 0 }, 'exam-room': { total: 0, match: 0, failed: 0 }, committee: { total: 0, match: 0, failed: 0 } };
    for (const v of recent) {
      perStation[v.station].total += 1;
      if (v.match) perStation[v.station].match += 1;
      else perStation[v.station].failed += 1;
    }
    const recentFailures = recent.filter((v) => !v.match).slice(0, 10);
    return { last24h, perStation, recentFailures };
  },
};
