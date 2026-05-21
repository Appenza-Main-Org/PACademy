/**
 * PageHeader — title + breadcrumbs + actions.
 * Source: Tasks/DESIGN_SYSTEM.md §4.14 (header) + §6.1 (template).
 *
 * Sits above the main content area inside <AppShell />. Breadcrumbs render
 * in 11px tracking-wide ink-500; title in 24px display weight; subtitle in
 * 13px ink-500. Actions slot is end-aligned and wraps on small viewports.
 */

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <header className={cn('mb-6 border-b border-border-subtle pb-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="مسار التنقل" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-2xs uppercase tracking-wide text-ink-500">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="rounded-sm px-1 py-0.5 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-900 focus-visible:shadow-focus-teal focus-visible:outline-none"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="px-1 py-0.5 text-ink-700">{crumb.label}</span>
                )}
                {i < breadcrumbs.length - 1 && (
                  <ChevronLeft size={12} strokeWidth={1.75} aria-hidden className="opacity-60" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-ar-display text-2xl font-bold leading-snug text-ink-900">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {actions && (
          <div
            role="toolbar"
            aria-label="إجراءات الصفحة"
            className={cn(
              'flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end',
              '[&_.btn]:h-9 [&_.btn]:px-4 [&_.btn]:text-sm [&_.btn]:font-medium',
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
