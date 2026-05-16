/**
 * TanStack Query bindings for `admissionSetupService`.
 *
 * Convention: `useFooQuery` for reads, `useFooMutation` for writes,
 * `keys` factory for cache invalidation. cycleId is part of every key
 * so switching cycles re-fetches without manual invalidation.
 *
 * 409 conflicts from any mutation propagate as `RowVersionConflictError`.
 * Pages call `reportConflict(err)` from `useConflictDialog` (lib/) in
 * their mutation `onError` to surface `<RowVersionConflictDialog>`.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { admissionSetupService } from './admission-setup.service';
import type { ApplicantCategoryKey } from '@/shared/types/domain';
import type {
  ApplyMergeSplitRuleResult,
  CommitteeMergeSplitRule,
  CommitteeScoreThresholdRow,
  ElectronicDeclaration,
  ExamDateConfig,
  TotalScoreComponent,
  TotalScoreConfig,
  WizardStepStatusRow,
} from '../types';

/* ─────────────────────────────────────────────────────────────────────── */
/* Cache key factories                                                       */
/* ─────────────────────────────────────────────────────────────────────── */

export const admissionSetupKeys = {
  all: ['admission-setup'] as const,
  examDates: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'exam-dates', cycleId] as const,
  declaration: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'declaration', cycleId] as const,
  declarationVersions: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'declaration-versions', cycleId] as const,
  committeeBindings: (cycleId: string | null, categoryId?: ApplicantCategoryKey | null) =>
    [...admissionSetupKeys.all, 'committee-bindings', cycleId, categoryId ?? null] as const,
  mergeSplitRules: (cycleId: string | null, opts?: { status?: string }) =>
    [...admissionSetupKeys.all, 'merge-split-rules', cycleId, opts?.status ?? null] as const,
  mergeSplitRule: (id: string) =>
    [...admissionSetupKeys.all, 'merge-split-rule', id] as const,
  scoreThresholds: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'score-thresholds', cycleId] as const,
  scoreThreshold: (cycleId: string | null, committeeId: string | null) =>
    [...admissionSetupKeys.all, 'score-threshold', cycleId, committeeId] as const,
  totalScoreConfigs: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'total-score', cycleId] as const,
  totalScoreConfig: (cycleId: string | null, stream: string | null) =>
    [...admissionSetupKeys.all, 'total-score', cycleId, stream] as const,
  stepStatuses: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'step-statuses', cycleId] as const,
};

function invalidateCycleDeclaration(qc: QueryClient, cycleId: string | null): void {
  qc.invalidateQueries({ queryKey: admissionSetupKeys.declaration(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.declarationVersions(cycleId) });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §3 Exam dates                                                             */
/* ─────────────────────────────────────────────────────────────────────── */

export function useExamDateConfig(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.examDates(cycleId),
    queryFn: () => admissionSetupService.getExamDateConfig(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetExamDateConfig() {
  const qc = useQueryClient();
  return useMutation<
    ExamDateConfig,
    unknown,
    Parameters<typeof admissionSetupService.setExamDateConfig>[0]
  >({
    mutationFn: admissionSetupService.setExamDateConfig,
    onSuccess: (cfg) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.examDates(cfg.cycleId) });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §5 Electronic declaration                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

export function useElectronicDeclaration(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.declaration(cycleId),
    queryFn: () => admissionSetupService.getDeclaration(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useDeclarationVersions(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.declarationVersions(cycleId),
    queryFn: () => admissionSetupService.listDeclarationVersions(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetDeclaration() {
  const qc = useQueryClient();
  return useMutation<
    ElectronicDeclaration,
    unknown,
    Parameters<typeof admissionSetupService.setDeclaration>[0]
  >({
    mutationFn: admissionSetupService.setDeclaration,
    onSuccess: (dec) => invalidateCycleDeclaration(qc, dec.cycleId),
  });
}

export function useUpdateDeclaration() {
  const qc = useQueryClient();
  return useMutation<
    ElectronicDeclaration,
    unknown,
    Parameters<typeof admissionSetupService.updateDeclaration>[0]
  >({
    mutationFn: admissionSetupService.updateDeclaration,
    onSuccess: (dec) => invalidateCycleDeclaration(qc, dec.cycleId),
  });
}

export function usePublishDeclaration() {
  const qc = useQueryClient();
  return useMutation<ElectronicDeclaration, unknown, { id: string; rowVersion: string }>({
    mutationFn: ({ id, rowVersion }) => admissionSetupService.publishDeclaration(id, rowVersion),
    onSuccess: (dec) => invalidateCycleDeclaration(qc, dec.cycleId),
  });
}

export function useArchiveDeclaration() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string; cycleId: string; reason: string }>({
    mutationFn: ({ id, reason }) => admissionSetupService.archiveDeclaration(id, reason),
    onSuccess: (_v, vars) => invalidateCycleDeclaration(qc, vars.cycleId),
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §1 Committee merge/split rules                                            */
/* ─────────────────────────────────────────────────────────────────────── */

export function useMergeSplitRules(
  cycleId: string | null,
  opts?: { status?: string; includeArchived?: boolean },
) {
  return useQuery({
    queryKey: admissionSetupKeys.mergeSplitRules(cycleId, opts),
    queryFn: () => admissionSetupService.listMergeSplitRules(cycleId!, opts),
    enabled: Boolean(cycleId),
  });
}

export function useMergeSplitRule(id: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.mergeSplitRule(id!),
    queryFn: () => admissionSetupService.getMergeSplitRule(id!),
    enabled: Boolean(id),
  });
}

export function useCreateMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation<
    CommitteeMergeSplitRule,
    unknown,
    Parameters<typeof admissionSetupService.createMergeSplitRule>[0]
  >({
    mutationFn: admissionSetupService.createMergeSplitRule,
    onSuccess: (rule) => {
      qc.invalidateQueries({
        queryKey: admissionSetupKeys.mergeSplitRules(rule.cycleId),
      });
    },
  });
}

export function useUpdateMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation<
    CommitteeMergeSplitRule,
    unknown,
    Parameters<typeof admissionSetupService.updateMergeSplitRule>[0]
  >({
    mutationFn: admissionSetupService.updateMergeSplitRule,
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRules(rule.cycleId) });
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRule(rule.id) });
    },
  });
}

export function useCancelMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation<
    CommitteeMergeSplitRule,
    unknown,
    Parameters<typeof admissionSetupService.cancelMergeSplitRule>[0]
  >({
    mutationFn: admissionSetupService.cancelMergeSplitRule,
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRules(rule.cycleId) });
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRule(rule.id) });
    },
  });
}

export function usePreviewMergeSplitRule() {
  return useMutation({
    mutationFn: (id: string) => admissionSetupService.previewMergeSplitRule(id),
  });
}

export function useApplyMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation<
    ApplyMergeSplitRuleResult,
    unknown,
    Parameters<typeof admissionSetupService.applyMergeSplitRule>[0] & { cycleId: string }
  >({
    mutationFn: ({ cycleId: _cycleId, ...input }) =>
      admissionSetupService.applyMergeSplitRule(input),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRules(vars.cycleId) });
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRule(vars.id) });
    },
  });
}

export function useArchiveMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string; cycleId: string; reason: string }>({
    mutationFn: ({ id, reason }) => admissionSetupService.archiveMergeSplitRule({ id, reason }),
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplitRules(vars.cycleId) });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §2 Committee score thresholds                                             */
/* ─────────────────────────────────────────────────────────────────────── */

export function useScoreThresholds(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.scoreThresholds(cycleId),
    queryFn: () => admissionSetupService.listScoreThresholds(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useScoreThreshold(
  cycleId: string | null,
  committeeId: string | null,
) {
  return useQuery({
    queryKey: admissionSetupKeys.scoreThreshold(cycleId, committeeId),
    queryFn: () => admissionSetupService.getScoreThreshold(cycleId!, committeeId!),
    enabled: Boolean(cycleId) && Boolean(committeeId),
  });
}

export function useUpsertScoreThreshold() {
  const qc = useQueryClient();
  return useMutation<
    CommitteeScoreThresholdRow,
    unknown,
    Parameters<typeof admissionSetupService.upsertScoreThreshold>[0]
  >({
    mutationFn: admissionSetupService.upsertScoreThreshold,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.scoreThresholds(t.cycleId) });
      qc.invalidateQueries({
        queryKey: admissionSetupKeys.scoreThreshold(t.cycleId, t.committeeId),
      });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §4 Total score config                                                     */
/* ─────────────────────────────────────────────────────────────────────── */

export function useTotalScoreConfigs(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.totalScoreConfigs(cycleId),
    queryFn: () => admissionSetupService.listTotalScoreConfigs(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useTotalScoreConfig(cycleId: string | null, stream: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.totalScoreConfig(cycleId, stream),
    queryFn: () => admissionSetupService.getTotalScoreConfig(cycleId!, stream!),
    enabled: Boolean(cycleId) && Boolean(stream),
  });
}

export function useUpsertTotalScoreConfig() {
  const qc = useQueryClient();
  return useMutation<
    TotalScoreConfig,
    unknown,
    { cycleId: string; stream: string; components: TotalScoreComponent[]; totalScoreOutOf: number; rowVersion?: string }
  >({
    mutationFn: admissionSetupService.upsertTotalScoreConfig,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.totalScoreConfigs(t.cycleId) });
      qc.invalidateQueries({
        queryKey: admissionSetupKeys.totalScoreConfig(t.cycleId, t.applicantStream),
      });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §6 Wizard step statuses                                                   */
/* ─────────────────────────────────────────────────────────────────────── */

export function useWizardStepStatuses(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.stepStatuses(cycleId),
    queryFn: () => admissionSetupService.getWizardStepStatuses(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useCompleteWizardStep() {
  const qc = useQueryClient();
  return useMutation<WizardStepStatusRow, unknown, { cycleId: string; stepKey: string; rowVersion?: string }>({
    mutationFn: ({ cycleId, stepKey, rowVersion }) =>
      admissionSetupService.completeWizardStep(cycleId, stepKey, rowVersion),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.stepStatuses(vars.cycleId) });
    },
  });
}

export function useReopenWizardStep() {
  const qc = useQueryClient();
  return useMutation<WizardStepStatusRow, unknown, { cycleId: string; stepKey: string; rowVersion: string }>({
    mutationFn: ({ cycleId, stepKey, rowVersion }) =>
      admissionSetupService.reopenWizardStep(cycleId, stepKey, rowVersion),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: admissionSetupKeys.stepStatuses(vars.cycleId) });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────── */
/* §10 Committee ↔ category bindings                                         */
/* ─────────────────────────────────────────────────────────────────────── */

export function useCommitteeBindings(
  cycleId: string | null,
  categoryId?: ApplicantCategoryKey | null,
) {
  return useQuery({
    queryKey: admissionSetupKeys.committeeBindings(cycleId, categoryId),
    queryFn: () =>
      admissionSetupService.listCommitteeBindings({
        cycleId: cycleId!,
        ...(categoryId ? { categoryId } : {}),
      }),
    enabled: Boolean(cycleId),
  });
}

export function useSetCommitteeBindings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      academicYearId: string;
      categoryId?: ApplicantCategoryKey;
      committeeIds: string[];
      actorUserId?: string;
    }) => admissionSetupService.setCommitteeBindings(input),
    onSuccess: (_rows, vars) => {
      qc.invalidateQueries({
        queryKey: admissionSetupKeys.committeeBindings(vars.cycleId),
      });
    },
  });
}
