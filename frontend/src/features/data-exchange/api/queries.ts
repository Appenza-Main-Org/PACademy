/**
 * TanStack Query hooks for the Data-Exchange hub. Queries for history; mutations
 * for export / preview / apply (these have side effects or large transient
 * payloads, so they are mutations not queries). No `useEffect` fetching.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataExchangeService, type ExportParams } from './dataExchange.service';
import type {
  ImportApplyRequest,
  ImportSheetInput,
} from '../types';

export const dataExchangeKeys = {
  all: ['data-exchange'] as const,
  history: () => [...dataExchangeKeys.all, 'history'] as const,
};

export function useDataExchangeHistory() {
  return useQuery({
    queryKey: dataExchangeKeys.history(),
    queryFn: () => dataExchangeService.history(),
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
