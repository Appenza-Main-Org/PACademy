/**
 * TanStack Query hooks for the reports command center.
 * One hook per service method; the page calls them all in parallel.
 */

import { useQuery } from '@tanstack/react-query';
import { reportsService } from './reports.service';

export const reportsKeys = {
  all: ['reports'] as const,
  cycleSnapshot: () => [...reportsKeys.all, 'cycle-snapshot'] as const,
  funnel: () => [...reportsKeys.all, 'funnel'] as const,
  byDepartment: () => [...reportsKeys.all, 'by-department'] as const,
  testResults: () => [...reportsKeys.all, 'test-results'] as const,
  operational: () => [...reportsKeys.all, 'operational-status'] as const,
  governance: () => [...reportsKeys.all, 'governance'] as const,
  integrations: () => [...reportsKeys.all, 'integrations'] as const,
};

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
