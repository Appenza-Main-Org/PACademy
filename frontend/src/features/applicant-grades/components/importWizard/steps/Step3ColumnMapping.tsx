/**
 * Step 3 — ربط الأعمدة.
 *
 * Two-column layout:
 *   Left  — every TargetField (label + required/optional pill + Combobox
 *           of detected source columns).
 *   Right — preview of the first 20 rows from the selected table, with
 *           the columns that are currently mapped highlighted.
 *
 * Auto-mapping runs at mount (and again when the user clicks "تعيين
 * تلقائي") via `autoMapColumns`. "متابعة" is gated by
 * `unmappedRequiredFields(mapping).length === 0`.
 */

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Button, Combobox, Field } from '@/shared/components';
import { useImportWizardStore } from '../../../store/importWizard.store';
import {
  TARGET_FIELDS,
  autoMapColumns,
  type TargetField,
} from '../../../lib/targetFields';

export function Step3ColumnMapping(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const setMapping = useImportWizardStore((s) => s.setMapping);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="m-0 text-xs font-semibold uppercase text-ink-500">ربط الأعمدة</h3>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
            onClick={() => setMapping(autoMapColumns(table.columns))}
          >
            تعيين تلقائي
          </Button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {TARGET_FIELDS.map((d) => {
            const value = mapping[d.key];
            return (
              <li key={d.key}>
                <Field
                  label={
                    <span className="flex items-center gap-2">
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
                  />
                </Field>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase text-ink-500">معاينة أول 20 صف</h3>
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
