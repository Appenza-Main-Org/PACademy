import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicantPortalService } from './applicantPortal.service';
import { noServerStateCacheOptions } from '@/shared/lib/query-options';
import type { ApplicantDraft } from '@/shared/types/domain';

export const apKeys = {
  all: ['applicant-portal'] as const,
  draft: (applicantId: string) => [...apKeys.all, 'draft', applicantId] as const,
  slots: () => [...apKeys.all, 'exam-slots'] as const,
  followUp: (applicantId: string) => [...apKeys.all, 'follow-up', applicantId] as const,
  acquaintanceDoc: (applicantId: string) => [...apKeys.all, 'acquaintance-doc', applicantId] as const,
  acquaintanceDocStatus: (applicantId: string) => [...apKeys.all, 'acquaintance-doc-status', applicantId] as const,
  followUpExamPlan: (cycleId: string, categoryKey: string) =>
    [...apKeys.all, 'follow-up-exam-plan', cycleId, categoryKey] as const,
  applicationInstructions: () => [...apKeys.all, 'application-instructions'] as const,
  examDateSettings: () => [...apKeys.all, 'exam-date-settings'] as const,
  moi: (nid: string) => [...apKeys.all, 'moi', nid] as const,
  adminStatus: (identifier: string) => [...apKeys.all, 'admin-status', identifier] as const,
};

/** Fetch the applicant's MOI-verified identity payload. Disabled until a
 *  NID is available so TanStack Query won't fire on an empty store. */
export function useMoiVerification(nid: string | null) {
  return useQuery({
    queryKey: apKeys.moi(nid ?? ''),
    queryFn: () => applicantPortalService.fetchMoiVerification(nid!),
    enabled: Boolean(nid),
    ...noServerStateCacheOptions,
  });
}

export function useDraft(applicantId: string) {
  return useQuery({
    queryKey: apKeys.draft(applicantId),
    queryFn: () => applicantPortalService.getDraft(applicantId),
    ...noServerStateCacheOptions,
  });
}

export function useSaveDraft(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: Partial<ApplicantDraft>) => applicantPortalService.saveDraft(applicantId, partial),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) }),
  });
}

export function useSubmitStage(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, data }: { stage: number; data: Record<string, unknown> }) =>
      applicantPortalService.submitStage(applicantId, stage, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) }),
  });
}

export function useExamSlots() {
  return useQuery({
    queryKey: apKeys.slots(),
    queryFn: () => applicantPortalService.getExamSlots(),
    ...noServerStateCacheOptions,
  });
}

export function useInitiatePayment(applicantId: string) {
  return useMutation({
    mutationFn: ({ method, amount }: { method: 'fawry' | 'card'; amount: number }) =>
      applicantPortalService.initiatePayment(applicantId, method, amount),
  });
}

export function useVerifyPayment(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refNumber: string) => applicantPortalService.verifyPayment(refNumber),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) }),
  });
}

export function useReserveSlot(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => applicantPortalService.reserveExamSlot(applicantId, slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) });
      qc.invalidateQueries({ queryKey: apKeys.slots() });
    },
  });
}

export function useFollowUp(applicantId: string) {
  return useQuery({
    queryKey: apKeys.followUp(applicantId),
    queryFn: () => applicantPortalService.getFollowUp(applicantId),
    ...noServerStateCacheOptions,
  });
}

export function useAcquaintanceDocStatus(applicantId: string) {
  return useQuery({
    queryKey: apKeys.acquaintanceDocStatus(applicantId),
    queryFn: () => applicantPortalService.getAcquaintanceDocStatus(applicantId),
    ...noServerStateCacheOptions,
  });
}

export function useAcquaintanceDoc(applicantId: string) {
  return useQuery({
    queryKey: apKeys.acquaintanceDoc(applicantId),
    queryFn: () => applicantPortalService.getAcquaintanceDoc(applicantId),
    ...noServerStateCacheOptions,
  });
}

export function useSaveAcquaintanceDoc(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: Parameters<typeof applicantPortalService.saveAcquaintanceDoc>[1]) =>
      applicantPortalService.saveAcquaintanceDoc(applicantId, partial),
    onSuccess: (result) => {
      qc.setQueryData(apKeys.acquaintanceDoc(applicantId), result);
      qc.setQueryData(apKeys.acquaintanceDocStatus(applicantId), result.status);
    },
  });
}

export function usePrintableAcquaintanceDoc(applicantId: string) {
  return useMutation({
    mutationFn: () => applicantPortalService.getPrintableAcquaintanceDoc(applicantId),
  });
}

export function useFollowUpExamPlan(cycleId: string | null, categoryKey: string | null) {
  return useQuery({
    queryKey: apKeys.followUpExamPlan(cycleId ?? '', categoryKey ?? ''),
    queryFn: () =>
      applicantPortalService.getConfiguredFollowUpExamPlan({
        cycleId: cycleId!,
        categoryKey: categoryKey!,
      }),
    enabled: Boolean(cycleId && categoryKey),
    ...noServerStateCacheOptions,
  });
}

export function useApplicationInstructions() {
  return useQuery({
    queryKey: apKeys.applicationInstructions(),
    queryFn: () => applicantPortalService.getApplicationInstructions(),
    ...noServerStateCacheOptions,
  });
}

export function useExamDateSettings() {
  return useQuery({
    queryKey: apKeys.examDateSettings(),
    queryFn: () => applicantPortalService.getExamDateSettings(),
    ...noServerStateCacheOptions,
  });
}

/** Admin-only: resolve a portal applicant by GUID or national ID. Disabled until an
 *  identifier is available so the query won't fire on an empty value. */
export function useAdminPortalStatus(identifier: string | null | undefined) {
  return useQuery({
    queryKey: apKeys.adminStatus(identifier ?? ''),
    queryFn: () => applicantPortalService.getAdminPortalStatus(identifier!),
    enabled: Boolean(identifier),
    retry: false,
    ...noServerStateCacheOptions,
  });
}

export function useUpdateFollowUpMutation(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NonNullable<import('@/shared/types/domain').ApplicantDraft['followUp']>>) =>
      applicantPortalService.updateFollowUp(applicantId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.followUp(applicantId) }),
  });
}

/* ── MOI-aligned mutations ──────────────────────────────────────────── */

export function useVerifyApplicantMutation() {
  return useMutation({
    mutationFn: (input: { nationalId: string; mobile: string }) =>
      applicantPortalService.verifyApplicant(input),
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (input: { method: 'fawry-code' }) =>
      applicantPortalService.createPaymentIntent(input),
  });
}

export function useConfirmPaymentMutation(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { intentId: string }) => applicantPortalService.confirmPayment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) }),
  });
}

export function useApproveParentsMutation(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => applicantPortalService.approveParents(),
    onSuccess: () => qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) }),
  });
}

export function usePickFirstExamDateMutation(applicantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slotId: string }) => applicantPortalService.pickFirstExamDate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apKeys.draft(applicantId) });
      void qc.invalidateQueries({ queryKey: apKeys.acquaintanceDocStatus(applicantId) });
    },
  });
}
