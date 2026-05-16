/**
 * LookupsHubPage — `/admin/lookups[/:tab]`.
 *
 * 18 lookups grouped into 3 sections in a left-rail tab list. URL persists
 * the active tab. Default → `relationships`.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { ROUTES } from '@/config/routes';
import { LookupTabPanel } from '../components/LookupTabPanel';
import {
  LOOKUP_META,
  LOOKUP_SECTIONS,
  isLookupKey,
  type LookupKey,
} from '../types';

const DEFAULT_TAB: LookupKey = 'relationships';

export function LookupsHubPage(): JSX.Element {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const active: LookupKey = isLookupKey(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    if (tab && !isLookupKey(tab)) {
      // Unknown slug — bounce to default without leaking a 404.
      navigate(ROUTES.admin.adminLookupsType(DEFAULT_TAB), { replace: true });
    }
  }, [tab, navigate]);

  const activeMeta = LOOKUP_META[active];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الأكواد المرجعية"
        subtitle="إدارة الأكواد المرجعية للمنظومة — صلات القرابة، الاختبارات، اللجان، الجغرافيا، التنبيهات."
        breadcrumbs={[
          { label: 'الإدارة', href: ROUTES.admin.dashboard },
          { label: 'الأكواد المرجعية' },
        ]}
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Tab rail */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-3">
          <nav
            aria-label="أقسام الأكواد المرجعية"
            className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-3 shadow-xs lg:sticky lg:top-20 lg:h-[calc(100dvh_-_6rem)] lg:overflow-y-auto"
          >
            {LOOKUP_SECTIONS.map((section, idx) => (
              <div key={section.key} className={cn(idx > 0 && 'border-t border-border-subtle pt-4')}>
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <span aria-hidden className="h-3 w-0.5 shrink-0 rounded-full bg-accent-500" />
                  <span className="font-ar-display text-2xs font-bold uppercase tracking-wider text-accent-700">
                    {section.label}
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {section.keys.map((key) => {
                    const isActive = key === active;
                    const meta = LOOKUP_META[key];
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => navigate(ROUTES.admin.adminLookupsType(key))}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm font-ar font-medium',
                            'transition-colors duration-fast ease-standard',
                            'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
                            isActive
                              ? 'border border-accent-200 bg-accent-50 text-accent-700'
                              : 'border border-transparent text-ink-800 hover:bg-ink-50 hover:text-ink-900',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                          <ChevronLeft
                            size={14}
                            strokeWidth={2}
                            aria-hidden
                            className={cn(
                              'shrink-0 transition-transform duration-fast ease-standard',
                              isActive ? 'text-accent-600' : 'text-ink-400',
                            )}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Active panel */}
        <section className="col-span-12 lg:col-span-9 xl:col-span-9">
          <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-5 shadow-xs">
            <header className="flex items-start justify-between gap-3 border-b border-border-subtle pb-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="font-ar-display text-lg font-bold text-ink-900">
                  {activeMeta.label}
                </h2>
              </div>
            </header>
            <LookupTabPanel key={active} lookupKey={active} />
          </div>
        </section>
      </div>
    </div>
  );
}
