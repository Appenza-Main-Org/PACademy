import type { ReactNode } from 'react';

export function PublicShell({ children }: { children: ReactNode }): JSX.Element {
  return <div className="page-enter">{children}</div>;
}
