import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSettingsService, type AdminSettings } from './settings.service';

export const adminSettingsKeys = {
  all: ['admin', 'settings'] as const,
};

export function useAdminSettings() {
  return useQuery({
    queryKey: adminSettingsKeys.all,
    queryFn: () => adminSettingsService.get(),
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AdminSettings>) =>
      adminSettingsService.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSettingsKeys.all }),
  });
}
