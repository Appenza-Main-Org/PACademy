/**
 * LoginPage — staff (officers) login at /staff-login.
 * Source: ARCH-03 (MOIPASS framing for officers, public/private split).
 *
 * Applicants don't reach this page — they use /apply instead.
 * After successful auth: redirect to the user's default allowed page.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pattern } from '@/shared/components';
import { useAuthStore } from '../store/auth.store';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { LoginForm } from '../components/LoginForm';
import { getDefaultRouteForUser } from '../lib/default-route';

export function LoginPage(): JSX.Element | null {
  /* Snapshot the auth state on mount. This is the user who was *already*
   * authenticated when they hit /staff-login (e.g. via bookmark) — bounce
   * them to their default landing. We deliberately do NOT subscribe to
   * later updates: when LoginForm successfully submits, it calls navigate()
   * directly, and we don't want a re-render here to race it with a generic
   * <Navigate> to the admin landing. */
  const initialUser = useState(() => {
    const user = useAuthStore.getState().user;
    return user?.role === 'applicant' ? null : user;
  })[0];
  const navigate = useNavigate();

  useEffect(() => {
    if (initialUser) {
      navigate(getDefaultRouteForUser(initialUser), { replace: true });
    }
  }, [initialUser, navigate]);

  if (initialUser) return null;

  return (
    <div className="page-enter relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LoginArtPanel />
      <section className="relative flex items-center justify-center overflow-hidden bg-surface-page px-6 py-10 lg:p-6">
        <Pattern variant="tessellation-8" tile={96} opacity={0.04} />
        <div className="relative w-full">
          <div className="mx-auto flex w-full items-center justify-center">
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
