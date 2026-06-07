/**
 * LoginPage — staff (officers) login at /staff-login.
 * Source: ARCH-03 (MOIPASS framing for officers, public/private split).
 *
 * Applicants don't reach this page — they use /apply instead.
 * After successful auth: redirect to the user's default allowed page.
 */

import { Pattern } from '@/shared/components';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { LoginForm } from '../components/LoginForm';

export function LoginPage(): JSX.Element {
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
