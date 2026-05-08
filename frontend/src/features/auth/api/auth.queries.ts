import { useMutation, useQuery } from '@tanstack/react-query';
import { authService } from './auth.service';
import { useAuthStore } from '../store/auth.store';
import type { LoginCredentials } from '../types';

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

/** Validates the session server-side and syncs the Zustand store. */
export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authService.me();
      if (user) {
        setUser(user);
      } else {
        clear();
      }
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
