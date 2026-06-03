/**
 * Step 3 — ربط الأعمدة.
 *
 * Two-column layout:
 *   Left  — every TargetField (label + required/optional pill + Combobox
 *           of detected source columns).
 *   Right — preview of the first 20 rows from the selected table, with
 *           the columns that are currently mapped highlighted.
 *
 * The selected table may arrive with an auto-generated initial mapping
 * from Step 2. "متابعة" is gated by every required field having a
 * source column.
 */

import { useMemo } from 'react';
import { Badge, Combobox, Field } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import {
  TARGET_FIELDS,
  type TargetField,
} from '../../../lib/targetFields';

const IMPORT_DROPDOWN_TRIGGER_CLASS =
  '!h-11 !border-border-default !ps-3.5 !pe-3.5 text-sm font-medium shadow-sm hover:!border-border-strong focus-visible:!border-teal-500 data-[state=open]:!border-teal-500 data-[state=open]:shadow-focus-teal';
const ORDERED_TARGET_FIELDS = TARGET_FIELDS.map((field, index) => ({
  field,
  index,
}))
  .sort((a, b) => {
    if (a.field.required !== b.field.required) return a.field.required ? -1 : 1;
    return a.index - b.index;
  })
  .map(({ field }) => field);

export function Step3ColumnMapping(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const setMappingField = useImportWizardStore((s) => s.setMappingField);

  const table = useMemo(
    () => parsed?.tables.find((t) => t.name === selectedTableName) ?? null,
    [parsed, selectedTableName],
  );
  const previewRows = useMemo(() => (table ? table.rows.slice(0, 20) : []), [table]);

  if (!table) {
    return (
      <div className="rounded-md border border-border-subtle bg-white p-6 text-sm text-ink-500">
        اختر الجدول/الورقة في الخطوة السابقة أولاً.
      </div>
    );
  }

  const sourceOptions = table.columns.map((c) => ({ value: c, label: c }));
  const mappedColumns = new Set(Object.values(mapping).filter((c): c is string => c !== null));
  const requiredCount = ORDERED_TARGET_FIELDS.filter((field) => field.required).length;
  const mappedRequiredCount = ORDERED_TARGET_FIELDS.filter(
    (field) => field.required && mapping[field.key] != null,
  ).length;
  const mappedCount = mappedColumns.size;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-ink-50/50 px-3.5 py-2.5">
          <div className="min-w-0">
            <h3 className="m-0 text-xs font-semibold uppercase text-ink-700">ربط الأعمدة</h3>
            <p className="m-0 mt-1 text-2xs text-ink-500">
              يمكن مسح أي اختيار من علامة الإزالة داخل الحقل، ثم اختيار عمود آخر.
            </p>
          </div>
          <div className="flex items-center gap-2 text-2xs text-ink-500">
            <Badge tone={mappedRequiredCount === requiredCount ? 'success' : 'warning'}>
              <span className="font-en">{mappedRequiredCount}</span> /{' '}
              <span className="font-en">{requiredCount}</span> مطلوب
            </Badge>
            <Badge tone="neutral">
              <span className="font-en">{mappedCount}</span> عمود مربوط
            </Badge>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ORDERED_TARGET_FIELDS.map((d) => {
            const value = mapping[d.key];
            return (
              <li
                key={d.key}
                className="rounded-md border border-border-subtle bg-white px-3 py-2.5 shadow-xs"
              >
                <Field
                  label={
                    <span className="flex items-center gap-2 text-sm">
                      <span>{d.labelAr}</span>
                      <Badge tone={d.required ? 'danger' : 'neutral'}>
                        {d.required ? 'مطلوب' : 'اختياري'}
                      </Badge>
                    </span>
                  }
                >
                  <Combobox
                    value={value}
                    onChange={(next) => setMappingField(d.key, next)}
                    options={sourceOptions}
                    placeholder="اختر العمود في الملف"
                    ariaLabel={`ربط ${d.labelAr}`}
                    clearable
                    triggerClassName={IMPORT_DROPDOWN_TRIGGER_CLASS}
                  />
                </Field>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="m-0 text-xs font-semibold uppercase text-ink-700">معاينة أول 20 صف</h3>
          <span className="text-2xs text-ink-500">
            الأعمدة المربوطة تظهر بخلفية ذهبية خفيفة
          </span>
        </div>
        <div className="overflow-auto rounded-md border border-border-subtle bg-white">
          <table className="w-full border-collapse text-2xs">
            <thead className="bg-ink-50">
              <tr>
                {table.columns.map((c) => {
                  const isMapped = mappedColumns.has(c);
                  return (
                    <th
                      key={c}
                      scope="col"
                      className="whitespace-nowrap border-b border-border-subtle px-2 py-1.5 text-start font-mono text-2xs"
                      style={{
                        background: isMapped ? 'var(--gold-50)' : undefined,
                        color: isMapped ? 'var(--gold-700)' : 'var(--ink-700)',
                      }}
                    >
                      {c}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-b-0">
                  {table.columns.map((c) => (
                    <td
                      key={c}
                      className="whitespace-nowrap px-2 py-1.5 text-2xs text-ink-700"
                    >
                      {row[c] == null ? <span className="text-ink-300">—</span> : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function isMappingComplete(mapping: Record<TargetField, string | null>): boolean {
  return TARGET_FIELDS.every((d) => !d.required || mapping[d.key] != null);
}
