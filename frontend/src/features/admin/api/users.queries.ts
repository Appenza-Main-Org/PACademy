import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usersService,
  type CreateUserPayload,
  type SetAccountStatusInput,
  type UpdateUserPayload,
} from './users.service';

export const usersKeys = {
  all: ['users'] as const,
  list: () => [...usersKeys.all, 'list'] as const,
  detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
  activity: (id: string) => [...usersKeys.all, 'activity', id] as const,
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
    queryFn: () => usersService.getById(id!),
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
    mutationFn: ({ id, patch }: { id: string; patch: UpdateUserPayload }) =>
      usersService.update(id, patch),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      void qc.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}

/** Active / Inactive toggle (admin-create NID flow). */
export function useSetUserAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetAccountStatusInput) => usersService.setAccountStatus(input),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      void qc.invalidateQueries({ queryKey: usersKeys.detail(input.id) });
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

export function useUserActivity(id: string | null) {
  return useQuery({
    queryKey: usersKeys.activity(id ?? ''),
    queryFn: () => usersService.getActivity(id!),
    enabled: Boolean(id),
  });
}
