/**
 * TanStack Query hooks for the exams feature.
 *
 * Existing pages still call `useQuery({ queryKey: ['exams', ...] })` inline;
 * these hooks live alongside that pattern for the two new surfaces (bulk
 * import + live proctor) where the query key matters across components.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { examsService } from './exams.service';
import type {
  BatchCreateResult,
  ElectronicExamResult,
  ExamAuditRecord,
  ExamAuthorizedDevice,
  ExamCommitteeUser,
  ExamConfig,
  LiveSessionsResponse,
  QuestionDraft,
} from '@/shared/types/domain';

export const examsKeys = {
  all: ['exams'] as const,
  questions: () => [...examsKeys.all, 'questions'] as const,
  list: () => [...examsKeys.all, 'list'] as const,
  users: () => [...examsKeys.all, 'committee-users'] as const,
  devices: () => [...examsKeys.all, 'devices'] as const,
  results: () => [...examsKeys.all, 'results'] as const,
  audit: () => [...examsKeys.all, 'audit'] as const,
  liveSessions: (examId: string) =>
    [...examsKeys.all, 'sessions', 'live', examId] as const,
};

export function useExamsList(): UseQueryResult<ExamConfig[]> {
  return useQuery({
    queryKey: examsKeys.list(),
    queryFn: () => examsService.listExams(),
  });
}

export function useExamCommitteeUsers(): UseQueryResult<ExamCommitteeUser[]> {
  return useQuery({
    queryKey: examsKeys.users(),
    queryFn: () => examsService.listCommitteeUsers(),
  });
}

export function useExamDevices(): UseQueryResult<ExamAuthorizedDevice[]> {
  return useQuery({
    queryKey: examsKeys.devices(),
    queryFn: () => examsService.listDevices(),
  });
}

export function useExamResults(): UseQueryResult<ElectronicExamResult[]> {
  return useQuery({
    queryKey: examsKeys.results(),
    queryFn: () => examsService.listResults(),
  });
}

export function useExamAudit(): UseQueryResult<ExamAuditRecord[]> {
  return useQuery({
    queryKey: examsKeys.audit(),
    queryFn: () => examsService.listAudit(),
  });
}

export function useLiveSessions(
  examId: string,
  opts: { enabled?: boolean; refetchInterval?: number } = {},
): UseQueryResult<LiveSessionsResponse> {
  const { enabled = true, refetchInterval = 5000 } = opts;
  return useQuery({
    queryKey: examsKeys.liveSessions(examId),
    queryFn: () => examsService.listLiveSessions(examId),
    enabled: enabled && Boolean(examId),
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useImportQuestionsMutation(): ReturnType<typeof useMutation<BatchCreateResult, Error, QuestionDraft[]>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: QuestionDraft[]) => examsService.createQuestionBatch(rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: examsKeys.questions() });
    },
  });
}
