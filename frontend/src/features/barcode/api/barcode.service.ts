/**
 * Barcode API — Sprint 8 (RFP Scope Document §7).
 *
 * INTEGRATION CONTRACT:
 *   POST   /api/barcode/generate/:applicantId             → BarcodeRecord
 *   GET    /api/barcode/lookup?code=                      → applicant + record
 *   POST   /api/barcode/scan                              → BarcodeScan (logged)
 *   GET    /api/barcode/scans?applicantId=                → BarcodeScan[]
 *   POST   /api/barcode/replace/:applicantId              → BarcodeRecord (old voided)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant, BarcodeRecord, BarcodeScan } from '@/shared/types/domain';

const BARCODES_STATE: BarcodeRecord[] = [...MOCK.barcodes];
const SCANS_STATE: BarcodeScan[] = [...MOCK.barcodeScans];
let scanId = SCANS_STATE.length + 1;

export const barcodeService = {
  async generate(applicantId: string): Promise<BarcodeRecord> {
    await simulateLatency();
    const a = MOCK.applicants.find((x) => x.id === applicantId);
    const code = `26-${(a?.governorate ?? 'XXX').slice(0, 3).toUpperCase()}-${String(BARCODES_STATE.length + 1).padStart(8, '0')}`;
    const next: BarcodeRecord = {
      applicantId,
      code,
      cycleId: 'CYC-2026-M',
      governorateCode: code.split('-')[1] ?? 'XXX',
      issuedAt: Date.now(),
      void: false,
    };
    BARCODES_STATE.unshift(next);
    return next;
  },

  async lookup(code: string): Promise<{ record: BarcodeRecord | null; applicant: Applicant | null }> {
    await simulateLatency();
    const record = BARCODES_STATE.find((b) => b.code === code) ?? BARCODES_STATE[0] ?? null;
    if (!record) return { record: null, applicant: null };
    const applicant = MOCK.applicants.find((a) => a.id === record.applicantId) ?? MOCK.applicants[0]!;
    return { record, applicant };
  },

  async scan(payload: { code: string; scannedBy: string; station: string; action: BarcodeScan['action'] }): Promise<{ scan: BarcodeScan; duplicate: boolean }> {
    await simulateLatency(300, 600);
    const record = BARCODES_STATE.find((b) => b.code === payload.code);
    const applicantId = record?.applicantId ?? 'APP-UNKNOWN';
    const duplicate = SCANS_STATE.some((s) => s.applicantId === applicantId && s.station === payload.station && Date.now() - s.ts < 10_000);
    const scan: BarcodeScan = {
      id: `SCN-${String(scanId++).padStart(5, '0')}`,
      ts: Date.now(),
      scannedBy: payload.scannedBy,
      applicantId,
      station: payload.station,
      action: payload.action,
    };
    SCANS_STATE.unshift(scan);
    return { scan, duplicate };
  },

  async listScans(applicantId?: string): Promise<BarcodeScan[]> {
    await simulateLatency();
    return applicantId ? SCANS_STATE.filter((s) => s.applicantId === applicantId) : [...SCANS_STATE];
  },

  async replace(applicantId: string, reason: string): Promise<BarcodeRecord> {
    await simulateLatency();
    /* Void any existing barcode for this applicant */
    for (const b of BARCODES_STATE) {
      if (b.applicantId === applicantId && !b.void) {
        b.void = true;
        b.voidReason = reason;
      }
    }
    return barcodeService.generate(applicantId);
  },
};
