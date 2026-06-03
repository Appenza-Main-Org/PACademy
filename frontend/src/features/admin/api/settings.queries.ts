import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSettingsService, type AdminSettings } from './settings.service';

export const adminSettingsKeys = {
  all: ['admin', 'settings'] as const,
};

export function useAdminSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: adminSettingsKeys.all,
    queryFn: () => adminSettingsService.get(),
    enabled: options.enabled,
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
