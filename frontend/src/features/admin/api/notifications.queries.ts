import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationsService,
  type NotificationFilters,
} from './notifications.service';
import type { AdminNotification } from '@/shared/types/domain';

export const adminNotificationKeys = {
  all: ['admin-notifications'] as const,
  list: (filters: NotificationFilters) => [...adminNotificationKeys.all, 'list', filters] as const,
  detail: (id: string) => [...adminNotificationKeys.all, 'detail', id] as const,
  forApplicant: (id: string) => [...adminNotificationKeys.all, 'for-applicant', id] as const,
};

export function useAdminNotifications(filters: NotificationFilters = {}) {
  return useQuery({
    queryKey: adminNotificationKeys.list(filters),
    queryFn: () => notificationsService.list(filters),
  });
}

export function useAdminNotification(id: string | null) {
  return useQuery({
    queryKey: adminNotificationKeys.detail(id ?? ''),
    queryFn: () => notificationsService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useApplicantNotifications(applicantId: string | null) {
  return useQuery({
    queryKey: adminNotificationKeys.forApplicant(applicantId ?? ''),
    queryFn: () => notificationsService.listForApplicant(applicantId!),
    enabled: Boolean(applicantId),
  });
}

export function useCreateAdminNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<AdminNotification, 'id' | 'status' | 'createdAt'>) =>
      notificationsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}

export function useUpdateAdminNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdminNotification> }) =>
      notificationsService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}

export function usePublishNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}

export function useUnpublishNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.unpublish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}

export function useSoftDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      notificationsService.softDelete(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}

export function useRestoreNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminNotificationKeys.all }),
  });
}
