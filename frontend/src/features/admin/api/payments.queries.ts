import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsService, type PaymentFilters } from './payments.service';
import type { FawryPaymentStatus } from '@/shared/types/domain';

export const paymentsKeys = {
  all: ['admin-payments'] as const,
  list: (filters: PaymentFilters) => [...paymentsKeys.all, 'list', filters] as const,
  detail: (reference: string) => [...paymentsKeys.all, 'detail', reference] as const,
  refundEligible: () => [...paymentsKeys.all, 'refund-eligible'] as const,
};

export function useAdminPayments(filters: PaymentFilters = {}) {
  return useQuery({ queryKey: paymentsKeys.list(filters), queryFn: () => paymentsService.list(filters) });
}

export function useRefundEligiblePayments() {
  return useQuery({
    queryKey: paymentsKeys.refundEligible(),
    queryFn: () => paymentsService.listRefundEligible(),
  });
}

export function useSyncFawryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => paymentsService.syncFawryStatus(reference),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentsKeys.all }),
  });
}

export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reference,
      status,
      reason,
    }: {
      reference: string;
      status: FawryPaymentStatus;
      reason?: string;
    }) => paymentsService.setStatus(reference, status, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentsKeys.all }),
  });
}
