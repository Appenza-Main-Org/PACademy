export { CommitteeLayout } from './CommitteeLayout';
export { CommitteeOverviewPage } from './pages/CommitteeOverviewPage';
export { CommitteeListPage } from './pages/CommitteeListPage';
export { CommitteeSchedulePage } from './pages/CommitteeSchedulePage';
export { CommitteeDetailPage } from './pages/CommitteeDetailPage';
export { CommitteeCreatePage } from './pages/CommitteeCreatePage';
export { CommitteeEditPage } from './pages/CommitteeEditPage';
export { CommitteeApplicantsPage } from './pages/CommitteeApplicantsPage';

/* Cross-feature exports for admission-setup composition (Phase 4). */
export { committeeService, committeeAcceptsApplicant, type CommitteePayload } from './api/committee.service';
export {
  committeeKeys,
  useCommittee,
  useCommittees,
  useCommitteeUpdate,
  useCommitteeSetStatus,
  useCommitteeSpecializations,
  useCommitteeEducationTypes,
  useCommitteeAssignedApplicants,
} from './api/committee.queries';
export { useApproveResults, useEnterResult, useRejectResult } from './api/committee.queries';
export { deriveCommitteeGender } from '@/shared/lib/committee-gender';
