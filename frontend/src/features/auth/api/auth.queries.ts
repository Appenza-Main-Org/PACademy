import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type LockPolicy } from './auth.service';
import { useAuthStore } from '../store/auth.store';
import type { LoginCredentials } from '../types';

export const authKeys = {
  all: ['auth'] as const,
  lockPolicy: () => [...authKeys.all, 'lock-policy'] as const,
  lockedUsers: () => [...authKeys.all, 'locked-users'] as const,
};

export function useLoginMutation(): ReturnType<typeof useMutation<Awaited<ReturnType<typeof authService.login>>, Error, LoginCredentials>> {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.login(creds),
    onSuccess: (user) => setUser(user),
  });
}

export function useLogoutMutation(): ReturnType<typeof useMutation<Awaited<ReturnType<typeof authService.logout>>, Error, void>> {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => clear(),
  });
}

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.requestOtp(creds),
  });
}

export function useVerifyOtpMutation() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: ({ pendingId, code }: { pendingId: string; code: string }) =>
      authService.verifyOtp({ pendingId, code }),
    onSuccess: (user) => setUser(user),
  });
}

export function useLockPolicy() {
  return useQuery({ queryKey: authKeys.lockPolicy(), queryFn: () => authService.getLockPolicy() });
}

export function useUpdateLockPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LockPolicy>) => authService.updateLockPolicy(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.lockPolicy() }),
  });
}

export function useLockedUsers() {
  return useQuery({ queryKey: authKeys.lockedUsers(), queryFn: () => authService.getLockedUsers() });
}

export function useUnlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      authService.unlockUser(userId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.lockedUsers() }),
  });
}
