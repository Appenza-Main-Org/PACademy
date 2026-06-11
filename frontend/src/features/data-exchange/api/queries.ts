/**
 * TanStack Query hooks for the Data-Exchange hub. Queries for history; mutations
 * for export / preview / apply (these have side effects or large transient
 * payloads, so they are mutations not queries). No `useEffect` fetching.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataExchangeService, type ExportParams } from './dataExchange.service';
import type {
  ApplicantReconciliationCommitRequest,
  ImportApplyRequest,
  ImportSheetInput,
} from '../types';

export const dataExchangeKeys = {
  all: ['data-exchange'] as const,
  history: () => [...dataExchangeKeys.all, 'history'] as const,
  applicantsRoster: (cycleId?: string | null) =>
    [...dataExchangeKeys.all, 'applicants-roster', cycleId ?? 'active'] as const,
};

export function useDataExchangeHistory() {
  return useQuery({
    queryKey: dataExchangeKeys.history(),
    queryFn: () => dataExchangeService.history(),
  });
}

export function useBookedApplicantsRoster(cycleId?: string | null) {
  return useQuery({
    queryKey: dataExchangeKeys.applicantsRoster(cycleId),
    queryFn: () => dataExchangeService.listBookedApplicants(cycleId),
  });
}

export function useExportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExportParams) => dataExchangeService.exportData(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dataExchangeKeys.history() });
    },
  });
}

/** Curated full-database snapshot export (the download button). */
export function useExportSnapshotMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExportParams) => dataExchangeService.exportSnapshot(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dataExchangeKeys.history() });
    },
  });
}

export function usePreviewMutation() {
  return useMutation({
    mutationFn: (sheets: ImportSheetInput[]) => dataExchangeService.previewImport(sheets),
  });
}

export function useApplyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: ImportApplyRequest) => dataExchangeService.applyImport(request),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dataExchangeKeys.history() });
    },
  });
}

export function useApplicantsReconciliationPreviewMutation() {
  return useMutation({
    mutationFn: (sheets: ImportSheetInput[]) =>
      dataExchangeService.previewApplicantsReconciliation(sheets),
  });
}

export function useApplicantsReconciliationCommitMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: ApplicantReconciliationCommitRequest) =>
      dataExchangeService.commitApplicantsReconciliation(request),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dataExchangeKeys.history() });
      void qc.invalidateQueries({ queryKey: [...dataExchangeKeys.all, 'applicants-roster'] });
    },
  });
}
