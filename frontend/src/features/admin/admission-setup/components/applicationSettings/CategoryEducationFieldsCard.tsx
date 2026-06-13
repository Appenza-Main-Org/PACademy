/**
 * CategoryEducationFieldsCard — «حقول الدرجات التعليمية» editor.
 *
 * Admin surface for the per-category education-field config that drives
 * the applicant profile page's score fields. Self-contained card (own
 * category picker + own save) mounted on the application_settings step —
 * deliberately outside the wizard draft lifecycle, like the cycle-export
 * card. Saving replaces the category's full row set via the
 * categoryEducationFieldsService INTEGRATION CONTRACT.
 *
 * Usage: <CategoryEducationFieldsCard />
 */

import { useMemo, useState } from 'react';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { Button, Card, ErrorState, Input, LoadingState, Select, Switch, toast } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import type { ApplicantCategoryRow } from '@/features/lookups';
import { APPLICANT_CATEGORY_KEYS, type CategoryEducationField } from '@/shared/types/domain';
import {
  useAdminCategoryEducationFields,
  useSaveCategoryEducationFields,
} from '../../api/educationFields.queries';

const SECTION_OPTIONS = [
  { value: 'secondary', label: 'الثانوية' },
  { value: 'university', label: 'المؤهل الجامعي' },
  { value: 'postgraduate', label: 'الماجستير' },
  { value: 'doctorate', label: 'الدكتوراه' },
] as const;

const INPUT_KIND_OPTIONS = [
  { value: 'number', label: 'رقم' },
  { value: 'percentage', label: 'نسبة مئوية' },
  { value: 'academic-grade', label: 'تقدير' },
  { value: 'text', label: 'نص' },
] as const;

export function CategoryEducationFieldsCard(): JSX.Element {
  const categoriesQuery = useLookup('applicant-categories');
  const categories = useMemo(
    () => (categoriesQuery.data ?? []) as readonly ApplicantCategoryRow[],
    [categoriesQuery.data],
  );
  const [categoryKey, setCategoryKey] = useState('');
  const defaultCategoryKey =
    categories.find((row) => (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(row.code))?.code
    ?? categories[0]?.code
    ?? '';
  const effectiveCategoryKey = categoryKey || defaultCategoryKey;

  const fieldsQuery = useAdminCategoryEducationFields(effectiveCategoryKey || null);

  return (
    <Card>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <GraduationCap size={14} strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="font-ar-display text-md font-bold text-ink-900">حقول الدرجات التعليمية</h3>
            <p className="text-2xs text-ink-500">
              الحقول التي تظهر للمتقدم في قسم البيانات الدراسية لكل فئة — تعديلها لا يتطلب أي تغيير برمجي.
            </p>
          </div>
        </div>
        <div className="w-56">
          <Select
            aria-label="فئة التقدم"
            value={effectiveCategoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            options={categories.map((row) => ({ value: row.code, label: row.name }))}
          />
        </div>
      </header>

      {fieldsQuery.isLoading && <LoadingState variant="list" rows={3} />}
      {fieldsQuery.isError && (
        <ErrorState error={fieldsQuery.error as Error} onRetry={() => fieldsQuery.refetch()} />
      )}
      {fieldsQuery.data && effectiveCategoryKey && (
        <EducationFieldsEditor
          key={`${effectiveCategoryKey}:${fieldsQuery.dataUpdatedAt}`}
          categoryKey={effectiveCategoryKey}
          initialRows={fieldsQuery.data}
        />
      )}
    </Card>
  );
}

function EducationFieldsEditor({
  categoryKey,
  initialRows,
}: {
  categoryKey: string;
  initialRows: readonly CategoryEducationField[];
}): JSX.Element {
  const [rows, setRows] = useState<CategoryEducationField[]>(() => [...initialRows]);
  const saveMutation = useSaveCategoryEducationFields();

  const patchRow = (index: number, patch: Partial<CategoryEducationField>): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = (): void => {
    setRows((prev) => [
      ...prev,
      {
        id: '',
        categoryKey,
        fieldKey: '',
        labelAr: '',
        inputKind: 'number',
        sectionKey: 'secondary',
        isRequired: false,
        minValue: null,
        maxValue: null,
        sortOrder: (prev[prev.length - 1]?.sortOrder ?? 0) + 10,
        isActive: true,
      },
    ]);
  };

  const handleSave = async (): Promise<void> => {
    try {
      await saveMutation.mutateAsync({
        categoryKey,
        // Default-sourced ids (default:<cat>:<key>) are placeholders — the
        // backend materializes real rows on first save.
        rows: rows.map((row) => ({ ...row, id: row.id.startsWith('default:') ? '' : row.id })),
      });
      toast('تم حفظ حقول الدرجات للفئة', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حفظ حقول الدرجات', 'danger');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <table className="w-full min-w-[920px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-page">
              {['مفتاح الحقل', 'التسمية', 'القسم', 'نوع الإدخال', 'إجباري', 'الحد الأدنى', 'الحد الأقصى', 'الترتيب', 'مفعل', ''].map((header) => (
                <th
                  key={header || 'actions'}
                  className="whitespace-nowrap border-b border-border-subtle px-2 py-2 text-start text-2xs font-bold uppercase tracking-wide text-ink-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `new-${index}`} className="border-b border-border-subtle align-middle last:border-b-0">
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="مفتاح الحقل"
                    dir="ltr"
                    value={row.fieldKey}
                    onChange={(e) => patchRow(index, { fieldKey: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="التسمية"
                    value={row.labelAr}
                    onChange={(e) => patchRow(index, { labelAr: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    aria-label="القسم"
                    value={row.sectionKey}
                    onChange={(e) => patchRow(index, { sectionKey: e.target.value })}
                    options={[...SECTION_OPTIONS]}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    aria-label="نوع الإدخال"
                    value={row.inputKind}
                    onChange={(e) => patchRow(index, { inputKind: e.target.value })}
                    options={[...INPUT_KIND_OPTIONS]}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <Switch
                    aria-label="إجباري"
                    checked={row.isRequired}
                    onCheckedChange={(checked) => patchRow(index, { isRequired: checked })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="الحد الأدنى"
                    type="number"
                    dir="ltr"
                    value={row.minValue ?? ''}
                    onChange={(e) =>
                      patchRow(index, { minValue: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="الحد الأقصى"
                    type="number"
                    dir="ltr"
                    value={row.maxValue ?? ''}
                    onChange={(e) =>
                      patchRow(index, { maxValue: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="الترتيب"
                    type="number"
                    dir="ltr"
                    value={row.sortOrder}
                    onChange={(e) => patchRow(index, { sortOrder: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <Switch
                    aria-label="مفعل"
                    checked={row.isActive}
                    onCheckedChange={(checked) => patchRow(index, { isActive: checked })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="حذف الحقل"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" leadingIcon={<Plus size={14} />} onClick={addRow}>
          إضافة حقل
        </Button>
        <Button
          variant="primary"
          size="sm"
          isLoading={saveMutation.isPending}
          onClick={() => void handleSave()}
        >
          حفظ حقول الفئة
        </Button>
      </div>
    </div>
  );
}
