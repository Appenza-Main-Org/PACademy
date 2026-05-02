import { useMutation, useQuery } from '@tanstack/react-query';
import { reportsService } from './reports.service';
import type { ReportTemplateKey } from '@/shared/types/domain';

export const reportsKeys = {
  all: ['reports'] as const,
  doc: (key: ReportTemplateKey, cycleId: string | null) =>
    [...reportsKeys.all, key, cycleId] as const,
};

export function useReportDocument(key: ReportTemplateKey, cycleId: string | null = null) {
  return useQuery({
    queryKey: reportsKeys.doc(key, cycleId),
    queryFn: () => reportsService.generate(key, cycleId),
  });
}

export function useExportCsv() {
  return useMutation({
    mutationFn: ({ key, cycleId }: { key: ReportTemplateKey; cycleId: string | null }) =>
      reportsService.exportCsv(key, cycleId),
  });
}

export function useExportRtf() {
  return useMutation({
    mutationFn: ({ key, cycleId }: { key: ReportTemplateKey; cycleId: string | null }) =>
      reportsService.exportRtf(key, cycleId),
  });
}

export function useExportPdf() {
  return useMutation({ mutationFn: () => reportsService.exportPdf() });
}
