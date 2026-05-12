/**
 * LookupsReviewPage — DEV-only review surface.
 *
 * Placeholder while the tab-rail UX is rebuilt. Real content arrives
 * with Commit D.
 */

import { LOOKUP_KEYS, LOOKUP_META, useLookup } from '@/features/lookups';
import { Card } from '@/shared/components';

export function LookupsReviewPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <h1 className="font-ar-display text-2xl font-bold text-ink-900">Lookup Management — DEV review</h1>
      <p className="text-sm text-ink-600">
        تعرض جدول مختصر لكل واحد من الـ18 جدول مرجعي. التصميم الكامل بصفحة /admin/lookups.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LOOKUP_KEYS.map((key) => (
          <ReviewCard key={key} k={key} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ k }: { k: (typeof LOOKUP_KEYS)[number] }): JSX.Element {
  const meta = LOOKUP_META[k];
  const q = useLookup(k);
  const rows = q.data ?? [];
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-medium text-ink-900">{meta.label}</span>
        <span className="font-mono text-2xs text-ink-500">{rows.length}</span>
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-ink-700">
        {rows.slice(0, 5).map((row) => (
          <li key={row.code} className="flex items-center justify-between gap-2 truncate">
            <span className="truncate">{row.name}</span>
          </li>
        ))}
        {rows.length > 5 && (
          <li className="text-2xs text-ink-400">… و{rows.length - 5} سجل آخر</li>
        )}
      </ul>
    </Card>
  );
}
