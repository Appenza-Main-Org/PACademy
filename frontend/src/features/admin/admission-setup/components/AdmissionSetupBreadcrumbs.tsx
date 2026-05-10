/**
 * AdmissionSetupBreadcrumbs — "إدارة المنظومة → التقديم → {step.labelAr}".
 * Pure presentational; the active step is derived from props (resolved
 * once at the shell level via `getStepByPath`).
 */

import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import type { AdmissionSetupStep } from '../config';

interface AdmissionSetupBreadcrumbsProps {
  step: AdmissionSetupStep | null;
}

export function AdmissionSetupBreadcrumbs({ step }: AdmissionSetupBreadcrumbsProps): JSX.Element {
  return (
    <nav aria-label="مسار التنقل" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-2xs uppercase tracking-wide text-ink-500">
        <Crumb label="إدارة المنظومة" href={ROUTES.admin.dashboard} />
        <Sep />
        <Crumb label="التقديم" href={ROUTES.admin.admissionSetup.index} />
        {step && (
          <>
            <Sep />
            <Crumb label={step.labelAr} />
          </>
        )}
      </ol>
    </nav>
  );
}

function Crumb({ label, href }: { label: string; href?: string }): JSX.Element {
  if (href) {
    return (
      <li>
        <Link
          to={href}
          className="rounded-sm px-1 py-0.5 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-900 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          {label}
        </Link>
      </li>
    );
  }
  return <li className="px-1 py-0.5 text-ink-700">{label}</li>;
}

function Sep(): JSX.Element {
  return (
    <li aria-hidden className="opacity-60">
      <ChevronLeft size={12} strokeWidth={1.75} />
    </li>
  );
}
