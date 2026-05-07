/**
 * Auth store — Zustand with sessionStorage persistence.
 * Mirrors the legacy Store auth behavior; keeps user across page refresh.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'pa-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function getCurrentUser(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().user !== null;
}
