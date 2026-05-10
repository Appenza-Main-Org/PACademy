import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersService, type CreateUserPayload } from './users.service';
import type { SystemUser } from '@/shared/types/domain';

export const usersKeys = {
  all: ['users'] as const,
  list: () => [...usersKeys.all, 'list'] as const,
  detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: usersKeys.list(),
    queryFn: () => usersService.list(),
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: () => usersService.list().then((rows) => rows.find((r) => r.id === id) ?? null),
    enabled: Boolean(id),
  });
}

export function useUserCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useUserUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SystemUser> }) =>
      usersService.update(id, patch),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      void qc.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}

export function useUserDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.deactivate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}
