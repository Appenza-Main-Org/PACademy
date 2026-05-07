import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersService, type CreateUserPayload } from './users.service';
import type { SystemUser } from '@/shared/types/domain';

export const usersKeys = {
  all: ['users'] as const,
  list: () => [...usersKeys.all, 'list'] as const,
  detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
  activity: (id: string) => [...usersKeys.all, 'activity', id] as const,
};

export function useUsers() {
  return useQuery({ queryKey: usersKeys.list(), queryFn: () => usersService.list() });
}

export function useUserActivity(id: string | null) {
  return useQuery({
    queryKey: usersKeys.activity(id ?? ''),
    queryFn: () => usersService.getActivity(id!),
    enabled: Boolean(id),
  });
}

export function useUserCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.list() }),
  });
}

export function useUserUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SystemUser> }) =>
      usersService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.list() }),
  });
}

export function useUserDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.list() }),
  });
}

export function useUserReset2fa() {
  return useMutation({ mutationFn: (id: string) => usersService.reset2fa(id) });
}

export function useUserBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, role }: { ids: string[]; role: string }) => usersService.bulkAssign(ids, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.list() }),
  });
}
