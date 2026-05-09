import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersService } from './users.service';
import type {
  CreateSystemUserRequest,
  SystemUserDetailDto,
  SystemUserListFilters,
  UpdateSystemUserRequest,
} from '@/shared/types/domain';

export const usersKeys = {
  all: ['users'] as const,
  list: (filters?: SystemUserListFilters) => [...usersKeys.all, 'list', filters] as const,
  detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
};

export function useUsers(filters?: SystemUserListFilters) {
  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: () => usersService.list(filters),
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
    mutationFn: (request: CreateSystemUserRequest) => usersService.create(request),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useUserUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateSystemUserRequest }) =>
      usersService.update(id, request),
    onSuccess: (_data: SystemUserDetailDto, { id }) => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
      qc.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}

export function useUserDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}
