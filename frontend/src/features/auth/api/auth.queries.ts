import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type LockPolicy, type OfficerLookupResult } from './auth.service';
import { useAuthStore } from '../store/auth.store';
import type { LoginCredentials } from '../types';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  lockPolicy: () => [...authKeys.all, 'lock-policy'] as const,
  lockedUsers: () => [...authKeys.all, 'locked-users'] as const,
};

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const prev = useAuthStore.getState().user;
      const user = await authService.me(prev);
      if (user) setUser(user);
      else clear();
      return user;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogoutMutation() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      clear();
      void qc.removeQueries({ queryKey: authKeys.all });
    },
  });
}

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (creds: LoginCredentials) => authService.requestOtp(creds),
  });
}

export function useVerifyOtpMutation() {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingId, code }: { pendingId: string; code: string }) =>
      authService.verifyOtp({ pendingId, code }),
    onSuccess: (user) => {
      setUser(user);
      // Invalidate /auth/me so any AuthGuard-pending query revalidates
      // against the freshly-issued cookie.
      void qc.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useLockPolicy() {
  return useQuery({ queryKey: authKeys.lockPolicy(), queryFn: () => authService.getLockPolicy() });
}

export function useUpdateLockPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LockPolicy>) => authService.updateLockPolicy(patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.lockPolicy() }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.lockedUsers() }),
  });
}

export function useOfficerLookup(): ReturnType<
  typeof useMutation<OfficerLookupResult, Error, { nationalId: string; officerCode: string }>
> {
  return useMutation({
    mutationFn: (input: { nationalId: string; officerCode: string }) =>
      authService.lookupOfficer(input),
  });
}
