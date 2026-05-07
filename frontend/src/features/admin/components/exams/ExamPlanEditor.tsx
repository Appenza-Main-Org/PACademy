/**
 * ExamPlanEditor — Gap J (admin-gaps).
 *
 * Per-(cycle, category) reorderable list of academy exams. Each row has:
 *   - drag-handle order (up/down arrows)
 *   - required toggle
 *   - optional fee input
 *
 * Save validates that orders are unique within the plan; the service
 * rejects duplicates with ConflictError('EXAM_ORDER_DUPLICATE').
 */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import { Button, Card, Input, Select, toast } from '@/shared/components';
import { isConflictError } from '@/shared/lib/errors';
import type {
  ApplicantCategoryKey,
  CycleCategoryExamPlanEntry,
} from '@/shared/types/domain';
import {
  useAcademyExams,
  useExamPlan,
  useSaveExamPlan,
} from '../../api/examPlans.queries';

export interface ExamPlanEditorProps {
  cycleId: string;
  categoryId: ApplicantCategoryKey;
}

export function ExamPlanEditor({ cycleId, categoryId }: ExamPlanEditorProps): JSX.Element {
  const examsQuery = useAcademyExams();
  const planQuery = useExamPlan(cycleId, categoryId);
  const saveMut = useSaveExamPlan();

  const [entries, setEntries] = useState<CycleCategoryExamPlanEntry[]>([]);

  useEffect(() => {
    if (planQuery.data) {
      setEntries([...planQuery.data.exams].sort((a, b) => a.order - b.order));
    }
  }, [planQuery.data]);

  const exams = examsQuery.data ?? [];
  const examLabel = (id: string): string => exams.find((e) => e.id === id)?.nameAr ?? id;

  const move = (idx: number, delta: -1 | 1): void => {
    const next = [...entries];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setEntries(next.map((e, i) => ({ ...e, order: (i + 1) * 10 })));
  };

  const setEntry = (idx: number, patch: Partial<CycleCategoryExamPlanEntry>): void => {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const addExam = (examId: string): void => {
    if (entries.some((e) => e.examId === examId)) return;
    setEntries([
      ...entries,
      { examId, order: (entries.length + 1) * 10, isRequired: true },
    ]);
  };

  const removeExam = (idx: number): void => {
    setEntries(entries.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: (i + 1) * 10 })));
  };

  const onSave = (): void => {
    saveMut.mutate(
      { cycleId, categoryId, entries },
      {
        onSuccess: () => toast('تم حفظ خطة الاختبارات', 'success'),
        onError: (err) => {
          if (isConflictError(err) && err.conflictCode === 'EXAM_ORDER_DUPLICATE') {
            toast(err.message, 'danger');
          } else {
            toast((err as Error).message, 'danger');
          }
        },
      },
    );
  };

  const unselectedExams = exams.filter((e) => !entries.some((p) => p.examId === e.id));

  return (
    <Card>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">خطة الاختبارات</h3>
          <p className="text-2xs text-ink-500">
            ترتيب الاختبارات للفئة في هذه الدورة — تأخذ الأولوية على الترتيب الافتراضي.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) addExam(e.target.value);
            }}
            options={[
              { value: '', label: '+ إضافة اختبار…' },
              ...unselectedExams.map((ex) => ({ value: ex.id, label: ex.nameAr })),
            ]}
            disabled={unselectedExams.length === 0}
          />
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={onSave}
            isLoading={saveMut.isPending}
          >
            حفظ
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="py-2 text-start">الترتيب</th>
              <th className="py-2 text-start">الاختبار</th>
              <th className="py-2 text-start">إلزامي</th>
              <th className="py-2 text-start">الرسم</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-2xs text-ink-500">
                  لا توجد اختبارات في هذه الخطة. أضِف اختباراً من القائمة أعلاه.
                </td>
              </tr>
            )}
            {entries.map((entry, i) => (
              <tr key={entry.examId} className="border-b border-border-subtle last:border-b-0">
                <td className="py-2.5">
                  <span className="font-numeric tnum text-2xs text-ink-700" dir="ltr">
                    {entry.order}
                  </span>
                </td>
                <td className="py-2.5 font-medium text-ink-900">{examLabel(entry.examId)}</td>
                <td className="py-2.5">
                  <label className="flex items-center gap-2 text-2xs text-ink-700">
                    <input
                      type="checkbox"
                      checked={entry.isRequired}
                      onChange={(e) => setEntry(i, { isRequired: e.target.checked })}
                      className="h-4 w-4 cursor-pointer accent-teal-500"
                    />
                    {entry.isRequired ? 'إلزامي' : 'اختياري'}
                  </label>
                </td>
                <td className="py-2.5">
                  <Input
                    type="number"
                    placeholder="—"
                    value={entry.fee ?? ''}
                    onChange={(e) => setEntry(i, { fee: e.target.value ? Number(e.target.value) : undefined })}
                    containerClassName="!mb-0 max-w-[110px]"
                  />
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="رفع"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp size={14} strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="إنزال"
                      onClick={() => move(i, 1)}
                      disabled={i === entries.length - 1}
                    >
                      <ArrowDown size={14} strokeWidth={1.75} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeExam(i)}>
                      حذف
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
