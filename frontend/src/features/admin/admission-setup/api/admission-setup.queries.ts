/**
 * TanStack Query bindings for `admissionSetupService`.
 *
 * Convention matches the rest of the admin feature: `useFooQuery` for reads,
 * `useFooMutation` for writes, `keys` factory for cache invalidation. The
 * cycleId is part of every key so switching the cycle context (via
 * `useAdmissionSetupCycle`) re-fetches without manual invalidation.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { committeeKeys } from '@/features/committees';
import { admissionSetupService } from './admission-setup.service';
import type { ApplicantStream, TotalScoreComponent } from '../types';

export const admissionSetupKeys = {
  all: ['admission-setup'] as const,
  mergeSplit: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'merge-split', cycleId] as const,
  scoreThresholds: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'score-thresholds', cycleId] as const,
  examDates: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'exam-dates', cycleId] as const,
  totalScore: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'total-score', cycleId] as const,
  declaration: (cycleId: string | null) =>
    [...admissionSetupKeys.all, 'declaration', cycleId] as const,
};

function invalidateCycle(qc: QueryClient, cycleId: string | null): void {
  qc.invalidateQueries({ queryKey: admissionSetupKeys.mergeSplit(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.scoreThresholds(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.examDates(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.totalScore(cycleId) });
  qc.invalidateQueries({ queryKey: admissionSetupKeys.declaration(cycleId) });
}

/* ── Step 9 ─────────────────────────────────────────────────────────── */

export function useAdmissionMergeSplitRules(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.mergeSplit(cycleId),
    queryFn: () => admissionSetupService.listMergeSplitRules(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useCreateMergeSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admissionSetupService.createMergeOrSplit,
    onSuccess: (rule) => invalidateCycle(qc, rule.cycleId),
  });
}

export function useDeleteMergeSplitRule(cycleId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, reason }: { ruleId: string; reason: string }) =>
      admissionSetupService.softDeleteMergeSplit(ruleId, reason),
    onSuccess: () => invalidateCycle(qc, cycleId),
  });
}

/* ── Step 10 ────────────────────────────────────────────────────────── */

export function useScoreThresholds(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.scoreThresholds(cycleId),
    queryFn: () => admissionSetupService.listScoreThresholds(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetCommitteeScoreThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admissionSetupService.setCommitteeScoreThresholds,
    onSuccess: (row) => {
      invalidateCycle(qc, row.cycleId);
      /* Committees are the source of truth for `scoreCriteria.magmoo3`; bust their cache too. */
      qc.invalidateQueries({ queryKey: committeeKeys.detail(row.committeeId) });
      qc.invalidateQueries({ queryKey: [...committeeKeys.all, 'list'] });
    },
  });
}

/* ── Step 11 ────────────────────────────────────────────────────────── */

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

/* ── Step 13 ────────────────────────────────────────────────────────── */

export function useTotalScoreConfigs(cycleId: string | null) {
  return useQuery({
    queryKey: admissionSetupKeys.totalScore(cycleId),
    queryFn: () => admissionSetupService.listTotalScoreConfigs(cycleId!),
    enabled: Boolean(cycleId),
  });
}

export function useSetTotalScoreConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      applicantStream: ApplicantStream;
      components: TotalScoreComponent[];
      totalScoreOutOf: number;
    }) => admissionSetupService.setTotalScoreConfig(input),
    onSuccess: (cfg) => invalidateCycle(qc, cfg.cycleId),
  });
}

/* ── Step 15 ────────────────────────────────────────────────────────── */

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
