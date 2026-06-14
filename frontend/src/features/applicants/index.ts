/**
 * Public API for the cross-feature applicants module.
 * Consumed by admin/, committee/, and other features that need typed
 * applicant access. Stays lightweight — UI lives under the consuming feature.
 */

export { applicantService, ApplicantTransitionError, diffApplicants } from './api/applicant.service';
export type { ApplicantFilters, AdminAcquaintanceDoc } from './api/applicant.service';

export {
  applicantKeys,
  useApplicants,
  useApplicant,
  useApplicantStats,
  useApplicantTimeline,
  useApplicantAcquaintanceDoc,
  useApplicantDistribution,
  useApplicantProgress,
  useApplicantWorkflow,
  useApplicantAudit,
  useAuditDiff,
  useCreateApplicant,
  useUpdateApplicant,
  useTransitionApplicant,
} from './api/applicant.queries';

export {
  applicantInputSchema,
  identitySchema,
  addressSchema,
  contactSchema,
  departmentSchema,
  educationSchema,
  familySchema,
  EDUCATION_KIND_BY_DEPT,
  SECTION_ORDER,
  SECTION_LABELS,
} from './schemas';
export type { ApplicantInput, SectionKey } from './schemas';

export { getAllowedTransitions, getNextStageSuggestion } from './lib/transitions';
export type { AllowedTransition } from './lib/transitions';
