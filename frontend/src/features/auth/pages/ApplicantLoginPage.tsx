/**
 * ApplicantLoginPage — public login at /applicant-login, applicant-only.
 *
 * Already-authenticated staff are bounced to their landing (so an
 * officer who pasted the wrong link isn't stranded). Already-
 * authenticated applicants are NOT auto-redirected — they can pick a
 * different demo scenario by submitting the form again. The form's
 * imperative submit handler clears state before logging in.
 */

import { Navigate } from 'react-router-dom';
import { Pattern } from '@/shared/components';
import { useAuthStore } from '../store/auth.store';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { ApplicantLoginForm } from '../components/ApplicantLoginForm';
import { getDefaultRouteForUser } from '../lib/default-route';

export function ApplicantLoginPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (user && user.role !== 'applicant') {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return (
    <div className="page-enter relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LoginArtPanel />
      <section className="relative flex items-center justify-center overflow-hidden bg-surface-page px-6 py-10 lg:p-6">
        <Pattern variant="tessellation-8" tile={96} opacity={0.04} />
        <div className="relative w-full">
          <div className="mx-auto flex w-full items-center justify-center">
            <ApplicantLoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
