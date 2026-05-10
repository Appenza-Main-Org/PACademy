export { CommitteeLayout } from './CommitteeLayout';
export { CommitteeOverviewPage } from './pages/CommitteeOverviewPage';
export { CommitteeListPage } from './pages/CommitteeListPage';
export { CommitteeSchedulePage } from './pages/CommitteeSchedulePage';
export { CommitteeDetailPage } from './pages/CommitteeDetailPage';
export { CommitteeCreatePage } from './pages/CommitteeCreatePage';

/* Cross-feature exports for admission-setup composition (Phase 4). */
export { committeeService, type CommitteePayload } from './api/committee.service';
export {
  committeeKeys,
  useCommittee,
  useCommittees,
  useCommitteeUpdate,
} from './api/committee.queries';
