/**
 * Admin payment seed — Gap K (admin-gaps).
 *
 * Derives a deterministic payment row per applicant from the existing
 * MOCK.applicants seed. Status distribution mirrors the legacy
 * paymentStatus 'paid' / 'pending' (~80/20) plus a synthetic ~5%
 * 'refunded' for archived-cycle applicants.
 */

import { rng, reseed } from './seed';
import type { AdminPaymentRow, FawryPaymentStatus } from '@/shared/types/domain';
import type { Applicant } from '@/shared/types/domain';

export function buildAdminPayments(applicants: Applicant[]): AdminPaymentRow[] {
  reseed(2026);
  const out: AdminPaymentRow[] = [];
  applicants.forEach((ap, i) => {
    let status: FawryPaymentStatus;
    if (ap.paymentStatus === 'paid') {
      const r = rng();
      status = r < 0.05 ? 'refunded' : 'paid';
    } else {
      const r = rng();
      status = r < 0.7 ? 'pending' : r < 0.9 ? 'failed' : 'expired';
    }
    const ref = `FWRY-${String(2026000 + i).padStart(8, '0')}`;
    out.push({
      id: `PAY-${String(i + 1).padStart(6, '0')}`,
      applicantId: ap.id,
      applicantName: ap.name,
      nationalId: ap.nationalId,
      cycleId: ap.cycleId ?? 'CYC-2026-M-1',
      fawryReference: ref,
      amount: ap.paymentAmount,
      status,
      lastSyncAt: new Date(Date.now() - Math.floor(rng() * 12 * 3600 * 1000)).toISOString(),
      paidAt: status === 'paid' ? new Date(Date.now() - Math.floor(rng() * 7 * 86400 * 1000)).toISOString() : undefined,
    });
  });
  reseed(42);
  return out;
}
