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

import { useEffect, useState } from 'react';
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
import { Button, Card, Select, toast } from '@/shared/components';
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

  /* Mouse and keyboard sensors. PointerSensor distance=4 prevents a stray
   * click on a row body from initiating a drag; KeyboardSensor with the
   * sortable coordinate-getter delivers the WAI-ARIA reorder pattern
   * (Space to grab, arrows to move, Space to drop, Esc to cancel). */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
                    <td colSpan={5} className="py-6 text-center text-2xs text-ink-500">
                      لا توجد اختبارات في هذه الخطة. أضِف اختباراً من القائمة أعلاه.
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
                    onMoveUp={() => move(i, -1)}
                    onMoveDown={() => move(i, 1)}
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

interface SortableExamRowProps {
  entry: CycleCategoryExamPlanEntry;
  index: number;
  total: number;
  label: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleRequired: (checked: boolean) => void;
  onRemove: () => void;
}

function SortableExamRow({
  entry,
  index,
  total,
  label,
  onMoveUp,
  onMoveDown,
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
      <td className="py-2.5">
        <span className="font-numeric tnum text-2xs text-ink-700" dir="ltr">
          {entry.order}
        </span>
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
