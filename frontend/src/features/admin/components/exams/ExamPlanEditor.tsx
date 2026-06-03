/**
 * ExamPlanEditor — Gap J (admin-gaps).
 *
 * Per-(cycle, category) reorderable list of academy exams. Each row has:
 *   - drag handle on the start edge (@dnd-kit, with keyboard fallback)
 *   - up/down arrow buttons (redundant click affordance for non-pointer users)
 *   - required toggle
 *
 * Save validates that orders are unique within the plan; the service
 * rejects duplicates with ConflictError('EXAM_ORDER_DUPLICATE').
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Save } from 'lucide-react';
import { Button, Card, Input, Select, toast } from '@/shared/components';
import { isConflictError } from '@/shared/lib/errors';
import type {
  ApplicantCategoryKey,
  CycleCategoryExamPlanEntry,
} from '@/shared/types/domain';
import {
  hasExamPlanOrderErrors,
  type ExamPlanCategoryDraft,
} from '@/features/admin/admission-setup/lib/exam-plan-step';
import {
  useAcademyExams,
  useExamPlan,
  useSaveExamPlan,
} from '../../api/examPlans.queries';

export interface ExamPlanEditorProps {
  cycleId: string;
  categoryId: ApplicantCategoryKey;
  showSaveButton?: boolean;
  onDraftChange?: (draft: ExamPlanCategoryDraft | null) => void;
}

/** Inline validation message surfaced when the order cell is empty,
 *  not a positive integer, or duplicated within the current category. */
const ORDER_ERROR_MESSAGE = 'الترتيب يجب أن يكون رقمًا موجبًا وغير مكرر';

export function ExamPlanEditor({
  cycleId,
  categoryId,
  showSaveButton = true,
  onDraftChange,
}: ExamPlanEditorProps): JSX.Element {
  const examsQuery = useAcademyExams();
  const planQuery = useExamPlan(cycleId, categoryId);
  const saveMut = useSaveExamPlan();

  const [entries, setEntries] = useState<CycleCategoryExamPlanEntry[]>([]);
  const exams = examsQuery.data ?? [];

  useEffect(() => {
    if (planQuery.data) {
      if (!examsQuery.data) {
        setEntries([...planQuery.data.exams].sort((a, b) => a.order - b.order));
        return;
      }

      const knownExamIds = new Set(examsQuery.data.map((exam) => exam.id));
      const validEntries = planQuery.data.exams
        .filter((entry) => knownExamIds.has(entry.examId))
        .sort((a, b) => a.order - b.order);
      const nextEntries =
        planQuery.data.exams.length > 0 && validEntries.length === 0
          ? examsQuery.data
              .filter((exam) => exam.isQualifying)
              .map((exam, index) => ({
                examId: exam.id,
                order: index + 1,
                isRequired: true,
              }))
          : validEntries;
      setEntries(nextEntries);
    }
  }, [examsQuery.data, planQuery.data]);

  const examLabel = (id: string): string => exams.find((e) => e.id === id)?.nameAr ?? id;

  /* Mouse and keyboard sensors. PointerSensor distance=4 prevents a stray
   * click on a row body from initiating a drag; KeyboardSensor with the
   * sortable coordinate-getter delivers the WAI-ARIA reorder pattern
   * (Space to grab, arrows to move, Space to drop, Esc to cancel). */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* Per-row validation map keyed by examId. A row is invalid when its
   * order isn't a positive integer OR collides with another row's
   * order in the same plan. Save is blocked while any row reports an
   * error. No upper bound — admins can use any positive integer
   * (1, 2, 3… or 10, 20, 30…) depending on whether they want compact
   * or sparse numbering. */
  const orderErrors = useMemo<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const entry of entries) {
      if (hasExamPlanOrderErrorsForEntry(entry, entries)) out[entry.examId] = true;
    }
    return out;
  }, [entries]);

  const hasOrderError = hasExamPlanOrderErrors(entries);

  useEffect(() => {
    onDraftChange?.({
      entries,
      hasOrderError,
      isLoading: examsQuery.isLoading || planQuery.isLoading,
    });
  }, [entries, examsQuery.isLoading, hasOrderError, onDraftChange, planQuery.isLoading]);

  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const reorderTo = (next: CycleCategoryExamPlanEntry[]): void => {
    setEntries(next.map((e, i) => ({ ...e, order: i + 1 })));
  };

  const move = (idx: number, delta: -1 | 1): void => {
    const target = idx + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    reorderTo(next);
  };

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = entries.findIndex((e) => e.examId === active.id);
    const newIdx = entries.findIndex((e) => e.examId === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderTo(arrayMove(entries, oldIdx, newIdx));
  };

  const setEntry = (idx: number, patch: Partial<CycleCategoryExamPlanEntry>): void => {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  /* Strip non-digit characters and parse to integer. Empty / 0 keeps
   * the row in an invalid state so the error message + disabled-save
   * guard are obvious to the admin without silently inventing a
   * value. No upper bound — values grow freely as plans expand. */
  const setOrderFromInput = (idx: number, raw: string): void => {
    const digits = raw.replace(/\D/g, '');
    setEntry(idx, { order: digits ? Number(digits) : 0 });
  };

  const addExam = (examId: string): void => {
    if (entries.some((e) => e.examId === examId)) return;
    setEntries([
      ...entries,
      { examId, order: entries.length + 1, isRequired: true },
    ]);
  };

  const removeExam = (idx: number): void => {
    setEntries(entries.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i + 1 })));
  };

  const onSave = (): void => {
    if (hasOrderError) {
      toast(ORDER_ERROR_MESSAGE, 'danger');
      return;
    }
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
            ترتيب الاختبارات للفئة في هذه الدورة — اسحب الصفوف لإعادة الترتيب، أو استخدم الأسهم.
            يأخذ هذا الترتيب الأولوية على الترتيب الافتراضي.
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
          {showSaveButton && (
            <Button
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={onSave}
              isLoading={saveMut.isPending}
              disabled={hasOrderError}
            >
              حفظ
            </Button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="w-8 py-2" aria-label="مقبض السحب" />
              <th className="py-2 text-start">الترتيب</th>
              <th className="py-2 text-start">الاختبار</th>
              <th className="py-2 text-start">إلزامي</th>
              <th />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={entries.map((e) => e.examId)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center">
                      <div className="flex flex-col items-center gap-3 text-2xs text-ink-500">
                        <span>لا توجد امتحانات لهذه الفئة بعد</span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const next = unselectedExams[0];
                            if (next) addExam(next.id);
                          }}
                          disabled={unselectedExams.length === 0}
                        >
                          إضافة امتحان
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {entries.map((entry, i) => (
                  <SortableExamRow
                    key={entry.examId}
                    entry={entry}
                    index={i}
                    total={entries.length}
                    label={examLabel(entry.examId)}
                    hasOrderError={Boolean(orderErrors[entry.examId])}
                    onMoveUp={() => move(i, -1)}
                    onMoveDown={() => move(i, 1)}
                    onOrderInput={(raw) => setOrderFromInput(i, raw)}
                    onToggleRequired={(checked) => setEntry(i, { isRequired: checked })}
                    onRemove={() => removeExam(i)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </Card>
  );
}

function hasExamPlanOrderErrorsForEntry(
  entry: CycleCategoryExamPlanEntry,
  entries: CycleCategoryExamPlanEntry[],
): boolean {
  if (!Number.isInteger(entry.order) || entry.order < 1) return true;
  return entries.filter((candidate) => candidate.order === entry.order).length > 1;
}

interface SortableExamRowProps {
  entry: CycleCategoryExamPlanEntry;
  index: number;
  total: number;
  label: string;
  hasOrderError: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOrderInput: (raw: string) => void;
  onToggleRequired: (checked: boolean) => void;
  onRemove: () => void;
}

function SortableExamRow({
  entry,
  index,
  total,
  label,
  hasOrderError,
  onMoveUp,
  onMoveDown,
  onOrderInput,
  onToggleRequired,
  onRemove,
}: SortableExamRowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.examId,
  });
  /* Lifting the row briefly while it drags reads as a real grab; the
   * opacity dip on the source row avoids a perceived "ghost" duplicate. */
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    background: isDragging ? 'var(--accent-50)' : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border-subtle last:border-b-0"
    >
      <td className="py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`اسحب لإعادة ترتيب ${label}`}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-ink-400 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical size={16} strokeWidth={1.75} />
        </button>
      </td>
      <td className="py-2.5 align-top">
        <Input
          dir="ltr"
          density="compact"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          aria-label={`الترتيب — ${label}`}
          value={entry.order > 0 ? String(entry.order) : ''}
          onChange={(e) => onOrderInput(e.target.value)}
          error={hasOrderError ? ORDER_ERROR_MESSAGE : undefined}
          className="text-center font-numeric tnum"
          style={{ inlineSize: '4rem' }}
        />
      </td>
      <td className="py-2.5 font-medium text-ink-900">{label}</td>
      <td className="py-2.5">
        <label className="flex items-center gap-2 text-2xs text-ink-700">
          <input
            type="checkbox"
            checked={entry.isRequired}
            onChange={(e) => onToggleRequired(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          {entry.isRequired ? 'إلزامي' : 'اختياري'}
        </label>
      </td>
      <td className="py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="رفع"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ArrowUp size={14} strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="إنزال"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDown size={14} strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            حذف
          </Button>
        </div>
      </td>
    </tr>
  );
}
