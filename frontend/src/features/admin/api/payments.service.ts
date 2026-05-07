/**
 * Admin Payments API — Gap K (admin-gaps).
 *
 * Surfaces the Fawry-only payment ledger to super_admin and finance_review
 * roles (gated by `payments:review` permission). The Fawry sync is
 * intentionally a thin placeholder — real integration runs through the
 * vendor's special API.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/payments?status=&search=        → AdminPaymentRow[]
 *   GET    /api/admin/payments/:reference             → AdminPaymentRow
 *   POST   /api/admin/payments/:reference/sync        → AdminPaymentRow   (Fawry pull)
 *   POST   /api/admin/payments/:reference/refund      → AdminPaymentRow
 *   GET    /api/admin/payments/refund-eligible        → AdminPaymentRow[]
 *
 * Real Fawry endpoint (vendor-supplied; currently sealed):
 *   POST https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/status/v2
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import type { AdminPaymentRow, FawryPaymentStatus } from '@/shared/types/domain';

const STATE: AdminPaymentRow[] = MOCK.adminPayments.map((r) => ({ ...r }));

export interface PaymentFilters {
  status?: FawryPaymentStatus | 'all';
  search?: string;
  cycleId?: string | 'all';
}

export const paymentsService = {
  async list(filters: PaymentFilters = {}): Promise<AdminPaymentRow[]> {
    await simulateLatency();
    const { status = 'all', search = '', cycleId = 'all' } = filters;
    let rows = STATE;
    if (status !== 'all') rows = rows.filter((r) => r.status === status);
    if (cycleId !== 'all') rows = rows.filter((r) => r.cycleId === cycleId);
    if (search.trim()) {
      const q = search.trim();
      rows = rows.filter(
        (r) =>
          r.applicantName.includes(q) ||
          r.nationalId.includes(q) ||
          r.fawryReference.toLowerCase().includes(q.toLowerCase()),
      );
    }
    return [...rows].sort((a, b) => new Date(b.lastSyncAt).getTime() - new Date(a.lastSyncAt).getTime());
  },

  async getByReference(reference: string): Promise<AdminPaymentRow | null> {
    await simulateLatency();
    return STATE.find((r) => r.fawryReference === reference) ?? null;
  },

  /**
   * Fawry status pull placeholder. Real backend hits the vendor endpoint
   * and updates `status` + `lastSyncAt`. Mock just refreshes the
   * `lastSyncAt` to "now" and emits an audit row so the demo flow shows
   * the action in the audit log.
   */
  async syncFawryStatus(reference: string): Promise<AdminPaymentRow> {
    await simulateLatency(300, 600);
    const idx = STATE.findIndex((r) => r.fawryReference === reference);
    if (idx === -1) throw new Error('مرجع فوري غير موجود');
    const before = { ...STATE[idx]! };
    STATE[idx] = { ...before, lastSyncAt: new Date().toISOString() };
    emitAudit({
      action: 'payment_status_changed',
      module: 'payments',
      entityType: 'AdminPayment',
      entityLabel: 'دفعة',
      entityId: STATE[idx]!.id,
      details: `مزامنة حالة فوري للمرجع ${reference}`,
      before: { status: before.status, lastSyncAt: before.lastSyncAt },
      after: { status: STATE[idx]!.status, lastSyncAt: STATE[idx]!.lastSyncAt },
    });
    return STATE[idx]!;
  },

  async setStatus(
    reference: string,
    status: FawryPaymentStatus,
    options: { reason?: string } = {},
  ): Promise<AdminPaymentRow> {
    await simulateLatency();
    const idx = STATE.findIndex((r) => r.fawryReference === reference);
    if (idx === -1) throw new Error('مرجع فوري غير موجود');
    const before = { ...STATE[idx]! };
    STATE[idx] = {
      ...before,
      status,
      lastSyncAt: new Date().toISOString(),
      paidAt: status === 'paid' ? new Date().toISOString() : before.paidAt,
    };
    emitAudit({
      action: status === 'refunded' ? 'payment_refunded' : 'payment_status_changed',
      module: 'payments',
      entityType: 'AdminPayment',
      entityLabel: 'دفعة',
      entityId: STATE[idx]!.id,
      details: options.reason
        ? `${reference}: ${before.status} → ${status} (${options.reason})`
        : `${reference}: ${before.status} → ${status}`,
      before,
      after: STATE[idx]!,
    });
    return STATE[idx]!;
  },

  /**
   * Refund-eligibility view — Gap K (RFP §p.42 صلاحية إعادة المقابل المالي).
   * Read-only filtered list where status = paid AND cycle.status = archived.
   */
  async listRefundEligible(): Promise<AdminPaymentRow[]> {
    await simulateLatency();
    const archivedCycleIds = new Set(
      MOCK.cycles.filter((c) => c.status === 'archived' || c.status === 'finalized').map((c) => c.id),
    );
    return STATE.filter((r) => r.status === 'paid' && archivedCycleIds.has(r.cycleId));
  },
};
