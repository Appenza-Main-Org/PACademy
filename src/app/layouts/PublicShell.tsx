/**
 * PublicShell — full-bleed canvas for unauthenticated routes (login).
 * Source: Tasks/DESIGN_SYSTEM.md Sprint 0 Part C.
 *
 * Full-bleed Pattern background at 4% opacity provides the heritage watermark
 * mood for the login splash.
 */

import type { ReactNode } from 'react';
import { Pattern } from '@/shared/components';

export function PublicShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="page-enter relative min-h-screen bg-surface-page">
      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />
      <div className="relative">{children}</div>
    </div>
  );
}
