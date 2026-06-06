/**
 * Barcode API — Sprint 8 (RFP Scope Document §7).
 *
 * INTEGRATION CONTRACT:
 *   POST   /api/barcode/generate/:applicantId             → BarcodeRecord
 *   GET    /api/barcode/lookup?code=                      → applicant + record
 *   GET    /api/barcode/search?mode=&q=                   → BarcodeSearchHit[]
 *   POST   /api/barcode/scan                              → BarcodeScan (logged)
 *   GET    /api/barcode/scans?applicantId=                → BarcodeScan[]
 *   POST   /api/barcode/replace/:applicantId              → BarcodeRecord (old voided)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { normalizeArabic } from '@/shared/lib/arabic';
import type { Applicant, BarcodeRecord, BarcodeScan } from '@/shared/types/domain';

const BARCODES_STATE: BarcodeRecord[] = [...MOCK.barcodes];
const SCANS_STATE: BarcodeScan[] = [...MOCK.barcodeScans];
let scanId = SCANS_STATE.length + 1;

/** The dimension a barcode search runs over (US-BC-004/005/006). */
export type BarcodeSearchMode = 'barcode' | 'national-id' | 'name';

/** A single search hit pairing the applicant with their active card. */
export interface BarcodeSearchHit {
  applicant: Applicant;
  /** The applicant's active (non-void) card, or `null` if none issued. */
  record: BarcodeRecord | null;
}

/** Newest non-void card for an applicant, falling back to the newest of
 *  any state, or `null` when the applicant has no card yet. */
function activeRecordFor(applicantId: string): BarcodeRecord | null {
  const mine = BARCODES_STATE.filter((b) => b.applicantId === applicantId);
  return mine.find((b) => !b.void) ?? mine[0] ?? null;
}

/** Cap on name-search hits so the results panel stays responsive. */
const NAME_SEARCH_LIMIT = 25;

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

  /**
   * Unified retrieval across the three RFP search dimensions:
   *   - `barcode`     — exact card-code match (US-BC-004)
   *   - `national-id` — exact 14-digit NID match (US-BC-005)
   *   - `name`        — Arabic-normalized substring match (US-BC-006)
   *
   * Returns every matching applicant paired with their active card. The
   * caller validates the NID / name before calling (the page blocks an
   * invalid NID at the form layer).
   */
  async search(mode: BarcodeSearchMode, query: string): Promise<BarcodeSearchHit[]> {
    await simulateLatency();
    const q = query.trim();
    if (q.length === 0) return [];

    if (mode === 'barcode') {
      const record = BARCODES_STATE.find((b) => b.code.toUpperCase() === q.toUpperCase());
      if (!record) return [];
      const applicant = MOCK.applicants.find((a) => a.id === record.applicantId);
      return applicant ? [{ applicant, record }] : [];
    }

    if (mode === 'national-id') {
      const applicant = MOCK.applicants.find((a) => a.nationalId === q);
      return applicant ? [{ applicant, record: activeRecordFor(applicant.id) }] : [];
    }

    /* name */
    const nq = normalizeArabic(q);
    if (nq.length === 0) return [];
    return MOCK.applicants
      .filter((a) => normalizeArabic(a.name).includes(nq))
      .slice(0, NAME_SEARCH_LIMIT)
      .map((applicant) => ({ applicant, record: activeRecordFor(applicant.id) }));
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
