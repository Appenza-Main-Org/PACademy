import type { ReactNode } from 'react';

export function CenteredShell({ children }: { children: ReactNode }): JSX.Element {
  return <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>;
}
