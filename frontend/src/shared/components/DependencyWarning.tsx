/**
 * DependencyWarning — Gap D (admin-gaps).
 *
 * Block-level warning surfaced inside <SoftDeleteDialog> (and reusable
 * elsewhere) when a delete is rejected because of child rows. Reads the
 * typed DependencyResult and shows a dependency-count list.
 */

import { AlertTriangle } from 'lucide-react';
import type { DependencyResult } from '@/shared/lib/soft-delete';

export interface DependencyWarningProps {
  /** The Arabic noun the parent-side message references ("هذه الفئة"). */
  parentNoun: string;
  /** Counts + blocking flag returned by `service.getDependencies()`. */
  result: DependencyResult;
  /** Map of child relation keys (`applicants`/`committees`) to Arabic labels. */
  labels: Record<string, string>;
}

export function DependencyWarning({ parentNoun, result, labels }: DependencyWarningProps): JSX.Element | null {
  const rows = Object.entries(result.counts).filter(([, c]) => c > 0);
  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-md border border-terra-300 bg-terra-50 p-3 text-sm text-ink-900"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-terra-500" />
        <div className="min-w-0">
          <p className="font-medium leading-normal">
            لا يمكن حذف {parentNoun} لارتباط{rows.length === 1 ? 'ها' : 'ها'} بسجلات تابعة.
          </p>
          <ul className="mt-2 space-y-1 text-2xs text-ink-700">
            {rows.map(([key, count]) => (
              <li key={key} className="flex items-center justify-between gap-2">
                <span>{labels[key] ?? key}</span>
                <span className="rounded-sm bg-surface-card px-2 py-0.5 font-mono text-2xs text-ink-900" dir="ltr">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
