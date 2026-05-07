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
  LiveSessionsResponse,
  QuestionDraft,
} from '@/shared/types/domain';

export const examsKeys = {
  all: ['exams'] as const,
  questions: () => [...examsKeys.all, 'questions'] as const,
  liveSessions: (examId: string) =>
    [...examsKeys.all, 'sessions', 'live', examId] as const,
};

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
