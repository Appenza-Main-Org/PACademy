import type { Pagination } from '@/shared/types/api';

export type ReportsFilters = {
  cycleId?: string;
  dateRange?: { from: string; to: string };
  ageMin?: number;
  ageMax?: number;
  categoryKey?: string;
  applicantType?: 'civilian' | 'officer' | 'specialized' | 'doctorate' | 'law';
  gender?: 'male' | 'female';
  committeeId?: string | 'all';
  specializationCode?: string;
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded';
  stoppedAtStage?: number;
};

export type GroupByDimension =
  | 'committee'
  | 'specialization'
  | 'category'
  | 'gender'
  | 'paymentStatus'
  | 'ageBracket';

export type DataAvailabilityReport = {
  ok: boolean;
  cycleId: string;
  cycleExists: boolean;
  cycleStatus: 'active' | 'closed' | 'draft' | 'archived' | 'missing';
  totals: {
    applicantsInCycle: number;
    paidApplicants: number;
    committeesConfigured: number;
    specializationsConfigured: number;
  };
  missingReferences: Array<{
    kind: 'committee' | 'specialization' | 'category' | 'governorate';
    id: string;
    requestedFrom: 'filter' | 'data';
  }>;
  appliedFiltersMatchCount: number;
  generatedAt: string;
};

export type ApplicantReportAggregateRow = {
  dimensionKey: string;
  dimensionLabelAr: string;
  total: number;
  paid: number;
  unpaid: number;
  percentage: number;
};

export type ApplicantReportAggregate = {
  groupBy: GroupByDimension;
  rows: ApplicantReportAggregateRow[];
  grandTotal: { total: number; paid: number; unpaid: number };
  generatedAt: string;
};

export type ApplicantReportRow = {
  id: string;
  index?: number;
  nationalId: string;
  nameAr: string;
  gender: 'male' | 'female' | string;
  age: number | null;
  categoryLabelAr: string;
  applicantTypeLabelAr: string;
  specializationLabelAr: string;
  committeeLabelAr: string;
  currentStage: number;
  currentStageLabelAr: string;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | string;
  submittedAt: string;
  lastActivityAt?: string;
};

export type StuckApplicantRow = {
  id: string;
  index?: number;
  nationalId: string;
  nameAr: string;
  stoppedAtStage: number;
  stoppedAtStageLabelAr: string;
  lastActivityAt: string;
  staleDays: number;
  categoryLabelAr: string;
  committeeLabelAr: string;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | string;
};

export type StageDropoffReport = Pagination<StuckApplicantRow> & {
  funnel: Array<{
    stageIndex: number;
    stageLabel: string;
    count: number;
    percentOfTotal: number;
    staleCount: number;
  }>;
  generatedAt: string;
};

export type ReportsExportFormat = 'xlsx' | 'docx' | 'pdf' | 'csv';
export type ReportsExportKind = 'aggregate' | 'detail' | 'dropoff';
