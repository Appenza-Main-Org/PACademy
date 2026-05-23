/**
 * SpecializationList — body of one CategoryAccordion item.
 *
 * The "إضافة تخصص" picker sits at the *top* of the section so it stays
 * in the viewport regardless of how many specializations are already
 * attached; the attached rows scroll below it. Lazy-mounted by the outer
 * accordion so the per-config query fires only on demand.
 */

import { Plus } from 'lucide-react';
import { useSpecializationsForConfig } from '../../api/applicationSettings.queries';
import { AttachSpecializationCombobox } from './AttachSpecializationCombobox';
import { SpecializationRow } from './SpecializationRow';

interface SpecializationListProps {
  configId: string;
}

export function SpecializationList({ configId }: SpecializationListProps): JSX.Element {
  const specsQuery = useSpecializationsForConfig(configId);
  const specs = specsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4 py-3">
      <div
        className="rounded-md border border-border-default bg-surface-card p-3 shadow-sm ring-1 ring-[color:var(--accent-500)]/10"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700">
          <Plus size={14} strokeWidth={2} className="text-[color:var(--accent-600)]" />
          <span>إضافة تخصص جديد</span>
        </div>
        <AttachSpecializationCombobox configId={configId} />
      </div>

      {specsQuery.isLoading ? (
        <p className="font-ar text-sm text-ink-500">جارٍ تحميل التخصصات…</p>
      ) : specs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-4 py-3 text-2xs text-ink-500">
          لا توجد تخصصات مربوطة بهذه الفئة بعد. استخدم القائمة أعلاه لربط أول
          تخصص.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {specs.map((s) => (
            <li key={s.id}>
              <SpecializationRow configId={configId} row={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
