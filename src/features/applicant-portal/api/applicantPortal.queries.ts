import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicantPortalService } from './applicantPortal.service';
import type { ApplicantDraft } from '@/shared/types/domain';

export const apKeys = {
  all: ['applicant-portal'] as const,
  draft: (applicantId: string) => [...apKeys.all, 'draft', applicantId] as const,
  slots: () => [...apKeys.all, 'exam-slots'] as const,
  followUp: (applicantId: string) => [...apKeys.all, 'follow-up', applicantId] as const,
};

export function useDraft(applicantId: string) {
  return useQuery({
    queryKey: apKeys.draft(applicantId),
    queryFn: () => applicantPortalService.getDraft(applicantId),
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
  return useQuery({ queryKey: apKeys.slots(), queryFn: () => applicantPortalService.getExamSlots() });
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
  });
}
