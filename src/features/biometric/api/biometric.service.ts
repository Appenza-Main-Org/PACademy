/**
 * Biometric API
 *   POST /api/biometric/verify
 *   POST /api/biometric/enroll
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  matchScore?: number;
  applicant?: { id: string; name: string; nationalId: string; photo: string | null };
  timestamp: number;
}

export const biometricService = {
  async verify(input: { nationalId?: string; barcode?: string }): Promise<VerifyResult> {
    await simulateLatency(800, 1400);
    const target = MOCK.applicants.find(
      (a) => a.nationalId === input.nationalId || a.id === input.barcode,
    );
    if (!target) {
      return { ok: false, reason: 'لم يتم العثور على المتقدم', timestamp: Date.now() };
    }
    const matchScore = 0.92 + Math.random() * 0.07;
    return {
      ok: true,
      matchScore,
      applicant: { id: target.id, name: target.name, nationalId: target.nationalId, photo: target.photo },
      timestamp: Date.now(),
    };
  },
  async enroll(applicantId: string, type: 'face' | 'fingerprint') {
    await simulateLatency(800, 1200);
    return { ok: true, applicantId, type, enrolledAt: Date.now() };
  },
};
