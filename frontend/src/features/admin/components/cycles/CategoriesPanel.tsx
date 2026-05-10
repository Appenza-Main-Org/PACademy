/**
 * CategoriesPanel — per-cycle per-category open/close + capacity table.
 *
 * Extracted from `CycleDetailPage` so the Admission Setup section's
 * "إعدادات التقديم" step composes the same surface without forking
 * the toggle mutation.
 */

import { useState } from 'react';
import { Badge, Button, Card, Input, Textarea } from '@/shared/components';
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategory,
} from '@/shared/types/domain';

interface CategoriesPanelProps {
  cycle: AdmissionCycle;
  categories: ApplicantCategory[];
  readOnly: boolean;
  onToggle: (
    categoryKey: ApplicantCategory['key'],
    config: AdmissionCycleCategoryConfig,
  ) => void;
}

export function CategoriesPanel({
  cycle,
  categories,
  readOnly,
  onToggle,
}: CategoriesPanelProps): JSX.Element {
  return (
    <section>
      <h2 className="mb-3 font-ar-display text-xl font-bold text-ink-900">
        حالة الفئات في هذه الدورة
      </h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 text-start">الفئة</th>
                <th className="py-2 text-start">النوع</th>
                <th className="py-2 text-start">الحالة</th>
                <th className="py-2 text-start">السعة</th>
                <th className="py-2 text-start">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const cfg = cycle.openCategories?.[cat.key] ?? {
                  isOpen: false,
                  capacity: null,
                  notes: '',
                };
                return (
                  <CategoryRow
                    key={cat.key}
                    category={cat}
                    config={cfg}
                    readOnly={readOnly}
                    onToggle={(c) => onToggle(cat.key, c)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function CategoryRow({
  category,
  config,
  readOnly,
  onToggle,
}: {
  category: ApplicantCategory;
  config: AdmissionCycleCategoryConfig;
  readOnly: boolean;
  onToggle: (config: AdmissionCycleCategoryConfig) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(config);
  const dirty =
    draft.isOpen !== config.isOpen ||
    draft.capacity !== config.capacity ||
    draft.notes !== config.notes;

  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="py-3 font-medium text-ink-900">{category.labelAr}</td>
      <td className="py-3">
        {category.conditions.nominationOnly ? (
          <Badge tone="warning">بالترشيح</Badge>
        ) : (
          <Badge tone="neutral">تقديم عام</Badge>
        )}
      </td>
      <td className="py-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={draft.isOpen}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, isOpen: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          {draft.isOpen ? 'مفتوح' : 'مغلق'}
        </label>
      </td>
      <td className="py-3">
        <Input
          type="number"
          value={draft.capacity ?? ''}
          disabled={readOnly}
          onChange={(e) =>
            setDraft({ ...draft, capacity: e.target.value ? Number(e.target.value) : null })
          }
          containerClassName="!mb-0"
          className="w-24"
        />
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <Textarea
            value={draft.notes}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            containerClassName="!mb-0 flex-1"
            rows={1}
          />
          {dirty && !readOnly && (
            <Button variant="primary" size="sm" onClick={() => onToggle(draft)}>
              حفظ
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
