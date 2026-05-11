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
          <nav className="lg:sticky lg:top-4 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-3">
            {LOOKUP_SECTIONS.map((section) => (
              <div key={section.key}>
                <div className="mb-1 px-1.5 text-2xs font-medium uppercase tracking-wide text-ink-500">
                  {section.label}
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
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-sm',
                            'transition-colors duration-fast ease-standard',
                            isActive
                              ? 'bg-accent-50 text-accent-700 font-medium'
                              : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate font-ar">{meta.label}</span>
                          <ChevronLeft
                            size={14}
                            className={cn(
                              'shrink-0 rtl:-scale-x-100',
                              isActive ? 'text-accent-600' : 'text-ink-300',
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
          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <header className="flex items-baseline justify-between">
              <div>
                <h2 className="font-ar-display text-lg font-bold text-ink-900">
                  {LOOKUP_META[active].label}
                </h2>
                <p className="font-mono text-2xs text-ink-500">
                  {LOOKUP_META[active].codePrefix} · {active}
                </p>
              </div>
            </header>
            <LookupTabPanel key={active} lookupKey={active} />
          </div>
        </section>
      </div>
    </div>
  );
}
