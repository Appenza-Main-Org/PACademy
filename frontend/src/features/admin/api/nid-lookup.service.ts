/**
 * NID lookup service — admin-create NID flow.
 *
 * INTEGRATION CONTRACT:
 *   GET /v1/officers/lookup?nationalId={nid}
 */

import { apiClient } from '@/shared/lib/api-client';
import { isNotFoundError, isValidationError } from '@/shared/lib/errors';
import { isValidNationalId } from '@/shared/lib/national-id';
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
  async lookup(nationalId: string): Promise<NidLookupResult> {
    const trimmed = nationalId.trim();
    if (!/^\d{14}$/.test(trimmed) || !isValidNationalId(trimmed)) {
      return { status: 'invalid', nationalId: trimmed, reason: 'format' };
    }
    try {
      const data = await apiClient.get<OfficerCandidate>('/v1/officers/lookup', {
        query: { nationalId: trimmed },
      });
      return { status: 'found', data };
    } catch (err) {
      if (isNotFoundError(err)) return { status: 'not_found', nationalId: trimmed };
      if (isValidationError(err) || (err instanceof Error && err.name === 'INVALID_NID')) {
        return { status: 'invalid', nationalId: trimmed, reason: 'checksum' };
      }
      throw err;
    }
  },
};
