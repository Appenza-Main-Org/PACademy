/**
 * Admin Payments API — Gap K (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/admin/payments?status=&search=&cycleId= → AdminPaymentRow[]
 *   GET  /api/admin/payments/refund-eligible          → AdminPaymentRow[]
 *   GET  /api/admin/payments/:reference               → AdminPaymentRow | null
 *   POST /api/admin/payments/:reference/sync          → AdminPaymentRow
 *   POST /api/admin/payments/:reference/status        → AdminPaymentRow
 *   POST /api/admin/payments/:reference/refund        → AdminPaymentRow
 */

import { apiClient } from '@/shared/lib/api-client';
import type { AdminPaymentRow, FawryPaymentStatus } from '@/shared/types/domain';

export interface PaymentFilters {
  status?: FawryPaymentStatus | 'all';
  search?: string;
  cycleId?: string | 'all';
}

export const paymentsService = {
  async list(filters: PaymentFilters = {}): Promise<AdminPaymentRow[]> {
    return apiClient.get('/api/admin/payments', { query: filters });
  },

  async getByReference(reference: string): Promise<AdminPaymentRow | null> {
    return apiClient.get(`/api/admin/payments/${encodeURIComponent(reference)}`);
  },

  async syncFawryStatus(reference: string): Promise<AdminPaymentRow> {
    return apiClient.post(`/api/admin/payments/${encodeURIComponent(reference)}/sync`);
  },

  async setStatus(
    reference: string,
    status: FawryPaymentStatus,
    options: { reason?: string } = {},
  ): Promise<AdminPaymentRow> {
    const action = status === 'refunded' ? 'refund' : 'status';
    return apiClient.post(`/api/admin/payments/${encodeURIComponent(reference)}/${action}`, {
      status,
      reason: options.reason,
    });
  },

  async listRefundEligible(): Promise<AdminPaymentRow[]> {
    return apiClient.get('/api/admin/payments/refund-eligible');
  },
};
