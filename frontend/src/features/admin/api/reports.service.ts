/**
 * Reports command center — super_admin admissions overview.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/admin/reports/cycle-snapshot
 *   GET /api/admin/reports/funnel
 *   GET /api/admin/reports/by-department
 *   GET /api/admin/reports/test-results
 *   GET /api/admin/reports/operational-status
 *   GET /api/admin/reports/governance
 *   GET /api/admin/reports/integrations
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  CycleSnapshot,
  DepartmentReport,
  GovernanceReport,
  IntegrationStatus,
  OperationalStatus,
  StageFunnelPoint,
  TestResultsReport,
} from '@/shared/types/domain';

export const NOW = new Date('2026-05-15T10:00:00+02:00');

export const reportsService = {
  async getCycleSnapshot(): Promise<CycleSnapshot> {
    return apiClient.get('/api/admin/reports/cycle-snapshot');
  },

  async getStageFunnel(): Promise<StageFunnelPoint[]> {
    return apiClient.get('/api/admin/reports/funnel');
  },

  async getDepartmentReport(): Promise<DepartmentReport> {
    return apiClient.get('/api/admin/reports/by-department');
  },

  async getTestResultsReport(): Promise<TestResultsReport> {
    return apiClient.get('/api/admin/reports/test-results');
  },

  async getOperationalStatus(): Promise<OperationalStatus> {
    return apiClient.get('/api/admin/reports/operational-status');
  },

  async getGovernanceReport(): Promise<GovernanceReport> {
    return apiClient.get('/api/admin/reports/governance');
  },

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    return apiClient.get('/api/admin/reports/integrations');
  },
};
