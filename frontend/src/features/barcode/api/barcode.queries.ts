/**
 * Barcode query/mutation hooks — TanStack Query wrappers over
 * `barcodeService`. Pages never call the service directly; every fetch and
 * mutation flows through a hook here (no `useEffect`-based fetching).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { barcodeService } from './barcode.service';
import type { BarcodeScan } from '@/shared/types/domain';

/** Query-key factory for the barcode feature. */
export const barcodeKeys = {
  all: ['barcode'] as const,
  scans: (applicantId?: string) => ['barcode', 'scans', applicantId ?? 'all'] as const,
};

/** List scan-log rows (optionally scoped to one applicant). */
export function useBarcodeScans(applicantId?: string) {
  return useQuery({
    queryKey: barcodeKeys.scans(applicantId),
    queryFn: () => barcodeService.listScans(applicantId),
  });
}

/** Generate a fresh barcode for an applicant. */
export function useGenerateBarcodeMutation() {
  return useMutation({
    mutationFn: (applicantId: string) => barcodeService.generate(applicantId),
  });
}

/** Record a barcode scan at a station. */
export function useScanBarcodeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { code: string; scannedBy: string; station: string; action: BarcodeScan['action'] }) =>
      barcodeService.scan(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: barcodeKeys.all });
    },
  });
}

/** Issue a replacement barcode (voids the old code, mints a new one). */
export function useReplaceBarcodeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicantId: string; reason: string }) =>
      barcodeService.replace(vars.applicantId, vars.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: barcodeKeys.all });
    },
  });
}
