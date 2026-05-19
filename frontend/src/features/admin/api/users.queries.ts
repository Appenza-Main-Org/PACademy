import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usersService,
  type CreateUserPayload,
  type SetAccountStatusInput,
  type UpdateUserPayload,
} from './users.service';
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

export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: () => usersService.getById(id!),
    enabled: Boolean(id),
  });
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
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: usersKeys.list() });
      qc.setQueryData(usersKeys.detail(user.id), user);
    },
  });
}

export function useUserUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateUserPayload }) =>
      usersService.update(id, patch),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: usersKeys.list() });
      qc.setQueryData(usersKeys.detail(user.id), user);
    },
  });
}

export function useSetUserAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetAccountStatusInput) => usersService.setAccountStatus(input),
    /* Optimistic: flip the cached `accountStatus` immediately so the
     * detail page reflects the new state without a network round trip.
     * On error, `onError` restores the previous value via the
     * snapshotted context — typical TanStack-Query rollback pattern. */
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: usersKeys.detail(input.id) });
      await qc.cancelQueries({ queryKey: usersKeys.list() });
      const prevDetail = qc.getQueryData<SystemUser | null>(usersKeys.detail(input.id));
      const prevList = qc.getQueryData<SystemUser[]>(usersKeys.list());
      if (prevDetail) {
        qc.setQueryData<SystemUser>(usersKeys.detail(input.id), {
          ...prevDetail,
          accountStatus: input.next,
          active: input.next === 'active',
          status: input.next === 'active' ? 'active' : 'suspended',
        });
      }
      if (prevList) {
        qc.setQueryData<SystemUser[]>(
          usersKeys.list(),
          prevList.map((u) =>
            u.id === input.id
              ? {
                  ...u,
                  accountStatus: input.next,
                  active: input.next === 'active',
                  status: input.next === 'active' ? 'active' : 'suspended',
                }
              : u,
          ),
        );
      }
      return { prevDetail, prevList };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prevDetail !== undefined) {
        qc.setQueryData(usersKeys.detail(input.id), ctx.prevDetail);
      }
      if (ctx?.prevList !== undefined) {
        qc.setQueryData(usersKeys.list(), ctx.prevList);
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: usersKeys.list() });
      qc.invalidateQueries({ queryKey: usersKeys.detail(input.id) });
    },
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
