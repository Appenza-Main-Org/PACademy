/**
 * TanStack Query bindings for `admissionSetupService`.
 *
 * Convention matches the rest of the admin feature: `useFooQuery` for reads,
 * `useFooMutation` for writes, `keys` factory for cache invalidation. The
 * cycleId is part of every key so switching the cycle context (via
 * `useAdmissionSetupCycle`) re-fetches without manual invalidation.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { admissionSetupService } from './admission-setup.service';
import type { ApplicantCategoryKey } from '@/shared/types/domain';

export const admissionSetupKeys = {
  all: ['admission-setup'] as const,
  examDates: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'exam-dates', cycleId] as const,
  declaration: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'declaration', cycleId] as const,
  committeeBindings: (cycleId: string | null, categoryId?: ApplicantCategoryKey | null) =>
    [...admissionSetupKeys.all, 'committee-bindings', cycleId, categoryId ?? null] as const,
};

function invalidateCycle(qc: QueryClient, cycleId: string | null): void {
  qc.invalidateQueries({ queryKey: admissionSetupKeys.examDates(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.declaration(cycleId) });
  qc.invalidateQueries({
    queryKey: [...admissionSetupKeys.all, 'committee-bindings', cycleId],
  });
}

/* ── Exam dates ─────────────────────────────────────────────────────── */

export function useExamDateConfig(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.examDates(cycleId),
    queryFn: () => admissionSetupService.getExamDateConfig(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetExamDateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admissionSetupService.setExamDateConfig,
    onSuccess: (cfg) => invalidateCycle(qc, cfg.cycleId),
  });
}

/* ── Electronic declaration ─────────────────────────────────────────── */

export function useElectronicDeclaration(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.declaration(cycleId),
    queryFn: () => admissionSetupService.getDeclaration(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admissionSetupService.setDeclaration,
    onSuccess: (dec) => invalidateCycle(qc, dec.cycleId),
  });
}

export function usePublishDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (declarationId: string) => admissionSetupService.publishDeclaration(declarationId),
    onSuccess: (dec) => invalidateCycle(qc, dec.cycleId),
  });
}

/* ── Committee ↔ category bindings ──────────────────────────────────── */

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
      invalidateCycle(qc, vars.cycleId);
    },
  });
}

