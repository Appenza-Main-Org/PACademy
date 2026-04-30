/**
 * Barcode API
 *   POST /api/barcode/generate/:applicantId
 *   GET  /api/barcode/lookup?code=
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant } from '@/shared/types/domain';

export interface BarcodeRecord {
  applicantId: string;
  code: string;
  issuedAt: number;
  validUntil: number;
}

export const barcodeService = {
  async generate(applicantId: string): Promise<BarcodeRecord> {
    await simulateLatency();
    const code = `${applicantId.replace('APP-', '')}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    const now = Date.now();
    return { applicantId, code, issuedAt: now, validUntil: now + 90 * 86_400_000 };
  },
  async lookup(code: string): Promise<Applicant | null> {
    await simulateLatency();
    const target = MOCK.applicants.find((a) => a.id.endsWith(code.slice(0, 7))) ?? MOCK.applicants[0]!;
    return target;
  },
};
