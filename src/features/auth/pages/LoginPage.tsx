/**
 * LoginPage — splash + form composition.
 * Source: Tasks/DESIGN_SYSTEM.md §1 + §2.2 + Sprint 0 Part C.
 */

import { Navigate } from 'react-router-dom';
import { Pattern } from '@/shared/components';
import { useAuthStore } from '../store/auth.store';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { LoginForm } from '../components/LoginForm';

export function LoginPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to={user.role === 'applicant' ? '/applicant' : '/'} replace />;

  return (
    <div className="page-enter relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LoginArtPanel />
      <section className="relative flex items-center justify-center overflow-hidden bg-surface-page p-6">
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
