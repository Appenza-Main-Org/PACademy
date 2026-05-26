/**
 * TanStack Query hooks for the reports command center.
 * One hook per service method; the page calls them all in parallel.
 */

import { useQuery } from '@tanstack/react-query';
import { NotFoundError } from '@/shared/lib/errors';
import { reportsService } from './reports.service';
import type { GroupByDimension, ReportsFilters } from '../reports/types';

export const reportsKeys = {
  all: ['reports'] as const,
  cycleSnapshot: () => [...reportsKeys.all, 'cycle-snapshot'] as const,
  funnel: () => [...reportsKeys.all, 'funnel'] as const,
  byDepartment: () => [...reportsKeys.all, 'by-department'] as const,
  testResults: () => [...reportsKeys.all, 'test-results'] as const,
  operational: () => [...reportsKeys.all, 'operational-status'] as const,
  governance: () => [...reportsKeys.all, 'governance'] as const,
  integrations: () => [...reportsKeys.all, 'integrations'] as const,
  applicantsAggregate: (filters: ReportsFilters, groupBy: GroupByDimension) =>
    [...reportsKeys.all, 'applicants-aggregate', filters, groupBy] as const,
  applicantsDetail: (filters: ReportsFilters, opts: { page: number; pageSize: number; sort?: string; search?: string }) =>
    [...reportsKeys.all, 'applicants-detail', filters, opts] as const,
  stageDropoff: (filters: ReportsFilters, opts: { page: number; pageSize: number; staleDays: number }) =>
    [...reportsKeys.all, 'stage-dropoff', filters, opts] as const,
  dataAvailability: (filters: ReportsFilters) => [...reportsKeys.all, 'data-availability', filters] as const,
};

const reportRetry = (failureCount: number, error: Error): boolean =>
  !(error instanceof NotFoundError) && failureCount < 2;

export function useCycleSnapshot() {
  return useQuery({
    queryKey: reportsKeys.cycleSnapshot(),
    queryFn: () => reportsService.getCycleSnapshot(),
  });
}

export function useStageFunnel() {
  return useQuery({
    queryKey: reportsKeys.funnel(),
    queryFn: () => reportsService.getStageFunnel(),
  });
}

export function useDepartmentReports() {
  return useQuery({
    queryKey: reportsKeys.byDepartment(),
    queryFn: () => reportsService.getDepartmentReport(),
  });
}

export function useTestResultsReport() {
  return useQuery({
    queryKey: reportsKeys.testResults(),
    queryFn: () => reportsService.getTestResultsReport(),
  });
}

export function useOperationalStatus() {
  return useQuery({
    queryKey: reportsKeys.operational(),
    queryFn: () => reportsService.getOperationalStatus(),
  });
}

export function useGovernanceReport() {
  return useQuery({
    queryKey: reportsKeys.governance(),
    queryFn: () => reportsService.getGovernanceReport(),
  });
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: reportsKeys.integrations(),
    queryFn: () => reportsService.getIntegrationStatus(),
  });
}

export function useApplicantsAggregateQuery(filters: ReportsFilters, groupBy: GroupByDimension) {
  return useQuery({
    queryKey: reportsKeys.applicantsAggregate(filters, groupBy),
    queryFn: () => reportsService.getApplicantsAggregate(filters, groupBy),
    enabled: Boolean(filters.cycleId),
    retry: reportRetry,
  });
}

export function useApplicantsDetailQuery(
  filters: ReportsFilters,
  opts: { page: number; pageSize: number; sort?: string; search?: string },
) {
  return useQuery({
    queryKey: reportsKeys.applicantsDetail(filters, opts),
    queryFn: () => reportsService.getApplicantsDetail(filters, opts),
    enabled: Boolean(filters.cycleId),
    retry: reportRetry,
  });
}

export function useStageDropoffQuery(
  filters: ReportsFilters,
  opts: { page: number; pageSize: number; staleDays: number },
) {
  return useQuery({
    queryKey: reportsKeys.stageDropoff(filters, opts),
    queryFn: () => reportsService.getStageDropoff(filters, opts),
    enabled: Boolean(filters.cycleId),
    retry: reportRetry,
  });
}

export function useDataAvailabilityProbeQuery(filters: ReportsFilters) {
  return useQuery({
    queryKey: reportsKeys.dataAvailability(filters),
    queryFn: () => reportsService.getDataAvailability(filters),
    enabled: Boolean(filters.cycleId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: reportRetry,
  });
}
