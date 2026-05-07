import { useQuery } from '@tanstack/react-query';
import { testScheduleService } from './test-schedule.service';

export const testScheduleKeys = {
  all: ['test-schedule'] as const,
  list: (applicantId: string) => [...testScheduleKeys.all, 'list', applicantId] as const,
  current: (applicantId: string) => [...testScheduleKeys.all, 'current', applicantId] as const,
};

export function useApplicantTests(applicantId: string) {
  return useQuery({
    queryKey: testScheduleKeys.list(applicantId),
    queryFn: () => testScheduleService.list(applicantId),
  });
}

export function useCurrentTest(applicantId: string) {
  return useQuery({
    queryKey: testScheduleKeys.current(applicantId),
    queryFn: () => testScheduleService.current(applicantId),
  });
}
