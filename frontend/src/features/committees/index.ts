export { CommitteeLayout } from './CommitteeLayout';
export { CommitteeOverviewPage } from './pages/CommitteeOverviewPage';
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

/* Committee instances — cycle-bound, dated, capacity-bearing committee
 * assignments. Authored by the admission-setup wizard step + the
 * `/admin/committees-exam-config` management page; both surfaces share the same
 * underlying record set. */
export {
  committeeInstanceService,
  type CommitteeInstanceAddInput,
  type CommitteeInstanceListFilters,
  type CommitteeInstancePatch,
} from './api/committeeInstance.service';
export {
  committeeInstanceKeys,
  useCommitteeInstances,
  useAddCommitteeInstancesMutation,
  useUpdateCommitteeInstanceMutation,
  useRemoveCommitteeInstanceMutation,
  useRemoveCommitteeInstanceDayMutation,
  useTransferCommitteeInstanceDayMutation,
} from './api/committeeInstance.queries';
