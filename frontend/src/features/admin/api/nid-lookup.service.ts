/**
 * NID lookup service — admin-create NID flow.
 *
 * The admin user-creation form requires a National ID first; this service
 * resolves it to a candidate row from the officer / civilian / contractor
 * directory so the form auto-fills the next four fields. Distinct from
 * `authService.lookupOfficer` (Gap B) — that one is keyed on `(nid, code)`
 * and used by login flows; this one is keyed on `nid` alone and used by
 * the admin directory.
 *
 * INTEGRATION CONTRACT:
 *   GET /v1/officers/lookup?nationalId={nid}
 *   Response 200: OfficerCandidate
 *   Response 404: { code: 'NOT_FOUND', nationalId }
 *   Response 400: { code: 'INVALID_NID', nationalId, reason: 'format' | 'checksum' }
 *
 * Caller branches on `result.status` (discriminated union); errors never
 * propagate as throws so the React form can render every state without
 * a try/catch dance. If `authService.lookupOfficer` becomes the single
 * source of truth for the directory at integration time, this service
 * composes over it (the caller-facing shape stays the same).
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { findOfficerByNid } from '@/shared/mock-data';
import { parseNationalId } from '@/shared/lib/national-id';
import type { UserType } from '@/shared/types/domain';

export interface OfficerCandidate {
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
}

export type NidLookupResult =
  | { status: 'found'; data: OfficerCandidate }
  | { status: 'not_found'; nationalId: string }
  | { status: 'invalid'; nationalId: string; reason: 'format' | 'checksum' };

/** Typed not-found error — kept for contract symmetry with Gap B's
 *  authService. Service body never throws this in mock mode (returns
 *  `{ status: 'not_found' }` instead) but the type lives here so the
 *  integration handshake stays explicit. */
export class NidLookupNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(public readonly nationalId: string) {
    super(`No officer found for NID ${nationalId}`);
    this.name = 'NidLookupNotFoundError';
  }
}

export class InvalidNidError extends Error {
  readonly code = 'INVALID_NID' as const;
  constructor(
    public readonly nationalId: string,
    public readonly reason: 'format' | 'checksum',
  ) {
    super(`Invalid national ID: ${reason}`);
    this.name = 'InvalidNidError';
  }
}

export const nidLookupService = {
  /**
   * INTEGRATION CONTRACT
   * Real endpoint: GET /v1/officers/lookup?nationalId={nid}
   * Response shape (200): OfficerCandidate
   * Response shape (404): { code: 'NOT_FOUND', nationalId }
   * Response shape (400): { code: 'INVALID_NID', nationalId, reason: 'format'|'checksum' }
   * Errors: NidLookupNotFoundError (caller maps to status:'not_found'), InvalidNidError
   *
   * If Gap B's `authService.lookupOfficer` is canonical at integration
   * time, this service composes over it; do NOT duplicate the directory.
   */
  async lookup(nationalId: string): Promise<NidLookupResult> {
    /* Mimic real network — between 300 and 900ms so the loading state
     * is visible. The lower bound stays >300 so the spinner never feels
     * jittery on fast renders. */
    await simulateLatency(300, 900);

    const trimmed = nationalId.trim();

    /* Format check first — 14 ASCII digits. */
    if (!/^\d{14}$/.test(trimmed)) {
      return { status: 'invalid', nationalId: trimmed, reason: 'format' };
    }

    /* Checksum / DOB-validity check via the existing parser. */
    const parsed = parseNationalId(trimmed);
    if (!parsed.valid) {
      return { status: 'invalid', nationalId: trimmed, reason: 'checksum' };
    }

    const match = findOfficerByNid(trimmed);
    if (!match) return { status: 'not_found', nationalId: trimmed };

    return {
      status: 'found',
      data: {
        nationalId: match.nationalId,
        fullArabicName: match.fullArabicName,
        officerCode: match.officerCode,
        mobileNumber: match.mobileNumber,
        userType: match.userType,
      },
    };
  },
};
