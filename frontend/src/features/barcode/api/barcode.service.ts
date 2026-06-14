/**
 * Barcode API — Sprint 8 (RFP Scope Document §7).
 *
 * INTEGRATION CONTRACT:
 *   POST   /api/barcode/generate/:applicantId             → BarcodeRecord
 *   GET    /api/barcode/lookup?code=                      → applicant + record
 *   GET    /api/barcode/search?mode=&q=                   → BarcodeSearchHit[]
 *   GET    /api/barcode/group?category=&examType=&committee=&qualification=
 *                                                          → BarcodeGroupCandidate[]
 *   POST   /api/barcode/scan                              → BarcodeScan (logged)
 *   GET    /api/barcode/scans?applicantId=                → BarcodeScan[]
 *   POST   /api/barcode/reprint/:applicantId             → BarcodeRecord (SAME code)
 *   POST   /api/barcode/replace/:applicantId              → BarcodeRecord (old voided)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { normalizeArabic } from '@/shared/lib/arabic';
import {
  batchCardCode,
  categoryLabel,
  examTypeLabel,
  matchesGroupSelection,
  resolveGroupValues,
  type GroupSelection,
} from '../lib/barcodeGroups';
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

/** Cap on a single group-print batch so the preview stays printable. */
const GROUP_PRINT_LIMIT = 60;

/** One applicant queued for group/bulk card printing (US-BC-003). */
export interface BarcodeGroupCandidate {
  applicant: Applicant;
  cardCode: string;
  categoryLabel: string;
  examTypeLabel: string;
  committee: string;
  qualification: string;
}

export const barcodeService = {
  async generate(applicantId: string): Promise<BarcodeRecord> {
    await simulateLatency();
    const a = MOCK.applicants.find((x) => x.id === applicantId);
    /* Codes are encoded into Code 128, so they must be ASCII — derive the
     * governorate segment from the National ID digits (07–09). */
    const govCode = (a?.nationalId ?? '').slice(7, 9) || '00';
    const code = `26-${govCode}-${String(BARCODES_STATE.length + 1).padStart(8, '0')}`;
    const next: BarcodeRecord = {
      applicantId,
      code,
      cycleId: 'CYC-2026-M',
      governorateCode: govCode,
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
   * Only applicants that already have a generated barcode are retrievable
   * (Barcode-Lookup business rule 1) — applicants without a card are filtered
   * out, so a lookup never surfaces (or reprints) a card-less applicant. The
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
      const record = applicant ? activeRecordFor(applicant.id) : null;
      return applicant && record ? [{ applicant, record }] : [];
    }

    /* name */
    const nq = normalizeArabic(q);
    if (nq.length === 0) return [];
    return MOCK.applicants
      .filter((a) => normalizeArabic(a.name).includes(nq))
      .map((applicant) => ({ applicant, record: activeRecordFor(applicant.id) }))
      .filter((hit): hit is { applicant: Applicant; record: BarcodeRecord } => hit.record !== null)
      .slice(0, NAME_SEARCH_LIMIT);
  },

  /**
   * Group/bulk-print candidates (US-BC-003). Filters the applicant pool by
   * any combination of Category / Exam Type / Committee / Qualification
   * (each an unset dimension = "all"), capped at {@link GROUP_PRINT_LIMIT}.
   */
  async listGroupPrint(selection: GroupSelection): Promise<BarcodeGroupCandidate[]> {
    await simulateLatency();
    return MOCK.applicants
      .filter((a) => matchesGroupSelection(a, selection))
      .slice(0, GROUP_PRINT_LIMIT)
      .map((applicant) => {
        const resolved = resolveGroupValues(applicant);
        return {
          applicant,
          cardCode: batchCardCode(applicant),
          categoryLabel: categoryLabel(resolved.category),
          examTypeLabel: examTypeLabel(resolved.examType),
          committee: resolved.committee,
          qualification: resolved.qualification,
        };
      });
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

  /**
   * Reprint (US-BC-007) — reissue the applicant's EXISTING active card with
   * the SAME code. Use when a printout is lost/damaged but the identity is
   * unchanged. Unlike {@link replace}, the code is NOT regenerated and the
   * old record is NOT voided. Throws when no active card exists.
   */
  async reprint(applicantId: string): Promise<BarcodeRecord> {
    await simulateLatency();
    const record = activeRecordFor(applicantId);
    if (!record || record.void) {
      throw new Error('لا يوجد كارت سارٍ لإعادة طباعته — استخدم «توليد كارت التردد» أو «إصدار بدل فاقد».');
    }
    return record;
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
