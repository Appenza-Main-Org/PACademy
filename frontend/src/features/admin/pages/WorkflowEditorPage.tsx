/**
 * WorkflowEditorPage — main configurator for a single department workflow.
 * Source: RFP §3 / §6 (per-department test pipelines).
 *
 * Layout (RTL):
 *   - Sticky top bar: name + department + cycle + version chip + save/publish.
 *   - Center: ordered stage list (drag-drop via @dnd-kit + numeric input).
 *   - Side: live <StageStepper> preview + validation panel.
 *
 * Two-phase publish (PRODUCT.md §4): preliminary "scope choice" notice → final.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconStamp,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StageStepper,
  toast,
  type StageDescriptor,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import {
  DEPARTMENT_LABELS,
  type DepartmentKey,
  type DepartmentWorkflow,
  type WorkflowStage,
  type WorkflowTest,
} from '@/shared/types/domain';
import {
  useApplyToScope,
  useDeleteWorkflow,
  useReorderStages,
  useSaveWorkflow,
  useWorkflow,
} from '../api/workflows.queries';
import { useCycles } from '../api/cycles.queries';
import {
  hasErrors,
  validateStages,
  type ValidationFinding,
} from '../lib/workflow-validation';
import { SortableStageCard } from '../components/workflow/SortableStageCard';

const DEPARTMENT_KEYS: DepartmentKey[] = [
  'general_first',
  'general_second',
  'special',
  'lawyers',
  'masters',
  'doctorate',
];

function emptyStage(order: number): WorkflowStage {
  const id = `WSTG-NEW-${order}-${Date.now()}`;
  return {
    id,
    order,
    name: `مرحلة جديدة ${order}`,
    statusOnEnter: 'under-review',
    allowedNextStatuses: ['approved', 'rejected'],
    tests: [],
  };
}

function emptyDraft(department: DepartmentKey, cycleId: string): DepartmentWorkflow {
  const now = new Date().toISOString();
  return {
    id: 'new',
    department,
    name: `سير عمل ${DEPARTMENT_LABELS[department]} · جديد`,
    cycleId,
    stages: [emptyStage(1)],
    isActive: false,
    version: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: '',
  };
}

export function WorkflowEditorPage(): JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialDept = (searchParams.get('department') as DepartmentKey | null) ?? 'general_first';
  const navigate = useNavigate();

  const isNew = id === 'new';
  const { data: cycles = [] } = useCycles();
  const { data: existing, isLoading, error, refetch } = useWorkflow(isNew ? null : id);

  const saveMut = useSaveWorkflow();
  const reorderMut = useReorderStages();
  const applyMut = useApplyToScope();
  const deleteMut = useDeleteWorkflow();

  const [draft, setDraft] = useState<DepartmentWorkflow | null>(null);
  const [publishStep, setPublishStep] = useState<'idle' | 'choose-scope' | 'confirm'>('idle');
  const [publishScope, setPublishScope] = useState<'new' | 'all'>('new');
  const [pendingDeleteStageId, setPendingDeleteStageId] = useState<string | null>(null);
  const [pendingDeleteWorkflow, setPendingDeleteWorkflow] = useState(false);

  /* Hydrate the draft once data lands. */
  useEffect(() => {
    if (isNew) {
      const cycleId = cycles[0]?.id ?? 'CYC-2026-M-1';
      setDraft(emptyDraft(initialDept, cycleId));
      return;
    }
    if (existing) setDraft(existing);
  }, [isNew, existing, cycles, initialDept]);

  const findings: ValidationFinding[] = useMemo(
    () => (draft ? validateStages(draft.stages) : []),
    [draft],
  );

  const blocked = hasErrors(findings);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!isNew && isLoading) {
    return <LoadingState variant="page" />;
  }
  if (!isNew && error) {
    return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  }
  if (!draft) {
    return (
      <EmptyState variant="generic" title="لم يتم تحميل سير العمل" />
    );
  }

  const totalStages = draft.stages.length;

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = draft.stages.findIndex((s) => s.id === active.id);
    const newIdx = draft.stages.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(draft.stages, oldIdx, newIdx).map((s, i) => ({ ...s, order: i + 1 }));
    setDraft({ ...draft, stages: reordered });
    /* Persist reorder right away when working on a saved workflow. */
    if (!isNew) {
      reorderMut.mutate(
        { id: draft.id, stageIds: reordered.map((s) => s.id) },
        {
          onError: (err) => toast((err as Error).message ?? 'تعذر إعادة الترتيب', 'danger'),
        },
      );
    }
  };

  const moveStageTo = (stageId: string, newIndex: number): void => {
    const oldIdx = draft.stages.findIndex((s) => s.id === stageId);
    if (oldIdx === -1) return;
    const clamped = Math.max(0, Math.min(draft.stages.length - 1, newIndex));
    const reordered = arrayMove(draft.stages, oldIdx, clamped).map((s, i) => ({ ...s, order: i + 1 }));
    setDraft({ ...draft, stages: reordered });
  };

  const updateStage = (next: WorkflowStage): void => {
    setDraft({
      ...draft,
      stages: draft.stages.map((s) => (s.id === next.id ? next : s)),
    });
  };

  const duplicateStage = (stageId: string): void => {
    const target = draft.stages.find((s) => s.id === stageId);
    if (!target) return;
    const clone: WorkflowStage = {
      ...target,
      id: `WSTG-NEW-${Date.now()}`,
      name: `${target.name} (نسخة)`,
      tests: target.tests.map<WorkflowTest>((t) => ({ ...t, id: `WTST-NEW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    };
    const idx = draft.stages.findIndex((s) => s.id === stageId);
    const next = [...draft.stages.slice(0, idx + 1), clone, ...draft.stages.slice(idx + 1)].map(
      (s, i) => ({ ...s, order: i + 1 }),
    );
    setDraft({ ...draft, stages: next });
  };

  const requestDeleteStage = (stageId: string): void => {
    setPendingDeleteStageId(stageId);
  };

  const confirmDeleteStage = (): void => {
    if (!pendingDeleteStageId) return;
    const next = draft.stages
      .filter((s) => s.id !== pendingDeleteStageId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setDraft({ ...draft, stages: next });
    setPendingDeleteStageId(null);
  };

  const addStage = (): void => {
    const next = [...draft.stages, emptyStage(draft.stages.length + 1)];
    setDraft({ ...draft, stages: next });
  };

  const handleSave = (): void => {
    if (blocked) {
      toast('لا يمكن الحفظ — يوجد أخطاء يجب معالجتها أولاً', 'danger');
      return;
    }
    const { id: _id, version: _v, createdAt: _c, updatedAt: _u, updatedBy: _b, ...payload } = draft;
    saveMut.mutate(
      { id: isNew ? null : draft.id, payload: { ...payload, stages: draft.stages } },
      {
        onSuccess: (wf) => {
          toast(`تم حفظ "${wf.name}" — الإصدار v${wf.version}`, 'success');
          if (isNew) navigate(ROUTES.admin.workflowEdit(wf.id));
        },
        onError: (err) => toast((err as Error).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  const handlePublishOpen = (): void => {
    if (blocked) {
      toast('لا يمكن النشر — يوجد أخطاء يجب معالجتها أولاً', 'danger');
      return;
    }
    setPublishScope('new');
    setPublishStep('choose-scope');
  };

  const handlePublishConfirm = (): void => {
    if (isNew) {
      const { id: _id, version: _v, createdAt: _c, updatedAt: _u, updatedBy: _b, ...payload } = draft;
      saveMut.mutate(
        { id: null, payload: { ...payload, isActive: true } },
        {
          onSuccess: (wf) => {
            applyMut.mutate(
              { id: wf.id, scope: publishScope },
              {
                onSuccess: (res) => {
                  toast(
                    publishScope === 'all'
                      ? `تم النشر · تطبيق على ${res.affected} متقدم حالي`
                      : 'تم النشر للمتقدمين الجدد فقط',
                    'success',
                  );
                  setPublishStep('idle');
                  navigate(ROUTES.admin.workflowEdit(wf.id));
                },
              },
            );
          },
          onError: (err) => toast((err as Error).message ?? 'تعذر النشر', 'danger'),
        },
      );
      return;
    }
    saveMut.mutate(
      {
        id: draft.id,
        payload: { ...draft, isActive: true, stages: draft.stages },
      },
      {
        onSuccess: () => {
          applyMut.mutate(
            { id: draft.id, scope: publishScope },
            {
              onSuccess: (res) => {
                toast(
                  publishScope === 'all'
                    ? `تم النشر · تطبيق على ${res.affected} متقدم حالي`
                    : 'تم النشر للمتقدمين الجدد فقط',
                  'success',
                );
                setPublishStep('idle');
              },
            },
          );
        },
        onError: (err) => toast((err as Error).message ?? 'تعذر النشر', 'danger'),
      },
    );
  };

  const handleDelete = (): void => {
    if (!draft.id || isNew) {
      navigate(ROUTES.admin.workflows);
      return;
    }
    deleteMut.mutate(draft.id, {
      onSuccess: () => {
        toast(`تم حذف "${draft.name}"`, 'success');
        navigate(ROUTES.admin.workflows);
      },
      onError: (err) => toast((err as Error).message ?? 'تعذر الحذف', 'danger'),
      onSettled: () => setPendingDeleteWorkflow(false),
    });
  };

  const previewStages: StageDescriptor[] = draft.stages.map((s, i) => ({
    label: s.name,
    state: i === 0 ? 'current' : 'upcoming',
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {isNew ? 'سير عمل جديد' : draft.name}
            {!isNew && (
              <Badge tone={draft.isActive ? 'success' : 'warning'}>
                {draft.isActive && (
                  <IconStamp width={12} height={12} className="me-1 inline-block" />
                )}
                {draft.isActive ? 'نشط' : 'مسوّدة'}
              </Badge>
            )}
          </span>
        }
        subtitle={isNew ? 'تعريف مراحل القبول لأحد الأقسام' : `الإصدار v${draft.version} · آخر تحديث ${fmtDate(draft.updatedAt, 'rel')}`}
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'سير العمل', href: ROUTES.admin.workflows },
          { label: isNew ? 'جديد' : draft.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
                onClick={() => setPendingDeleteWorkflow(true)}
              >
                حذف سير العمل
              </Button>
            )}
            <Button
              variant="secondary"
              isLoading={saveMut.isPending && publishStep === 'idle'}
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={handleSave}
              disabled={blocked}
            >
              حفظ كمسودة
            </Button>
            <Button
              variant="primary"
              isLoading={applyMut.isPending}
              leadingIcon={<Send size={14} strokeWidth={1.75} />}
              onClick={handlePublishOpen}
              disabled={blocked}
            >
              نشر التغييرات
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="wf-name" className="text-sm font-medium text-ink-700">
              اسم سير العمل
            </label>
            <input
              id="wf-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            />
          </div>
          <Select
            label="القسم"
            value={draft.department}
            onChange={(e) =>
              setDraft({ ...draft, department: e.target.value as DepartmentKey })
            }
            options={DEPARTMENT_KEYS.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }))}
          />
          <Select
            label="الدورة"
            value={draft.cycleId}
            onChange={(e) => setDraft({ ...draft, cycleId: e.target.value })}
            options={
              cycles.length > 0
                ? cycles.map((c) => ({ value: c.id, label: c.nameAr }))
                : [{ value: draft.cycleId, label: draft.cycleId }]
            }
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="font-ar-display text-md font-bold text-ink-900">
              مراحل سير العمل
            </h2>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={addStage}
            >
              إضافة مرحلة
            </Button>
          </header>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {draft.stages.length === 0 && (
                  <EmptyState
                    variant="generic"
                    title="لا توجد مراحل"
                    description="أضف أول مرحلة لتبدأ تكوين سير العمل."
                  />
                )}
                {draft.stages.map((s, i) => (
                  <SortableStageCard
                    key={s.id}
                    stage={s}
                    index={i}
                    totalStages={totalStages}
                    findings={findings}
                    onChange={updateStage}
                    onDuplicate={duplicateStage}
                    onDelete={requestDeleteStage}
                    onMoveTo={moveStageTo}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader title="معاينة المتقدم" subtitle="ما يراه المتقدم على بوابته" />
            {draft.stages.length === 0 ? (
              <p className="rounded-md bg-ink-50/60 p-4 text-center text-2xs text-ink-500">
                لا توجد مراحل لعرضها بعد.
              </p>
            ) : (
              <StageStepper
                stages={previewStages}
                currentIndex={0}
                orientation="vertical"
                ariaLabel="معاينة مراحل سير العمل"
              />
            )}
          </Card>

          <ValidationPanel findings={findings} />
        </aside>
      </div>

      <Modal
        open={pendingDeleteStageId !== null}
        onClose={() => setPendingDeleteStageId(null)}
        title="تأكيد حذف المرحلة"
        size="sm"
        transparentBackdrop={false}
      >
        <Modal.Body>
          <p className="text-sm text-ink-700">
            سيتم حذف هذه المرحلة وجميع اختباراتها. لا يمكن التراجع بعد الحفظ.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPendingDeleteStageId(null)}>
            إلغاء
          </Button>
          <Button variant="danger" onClick={confirmDeleteStage}>
            حذف
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={pendingDeleteWorkflow}
        onClose={() => setPendingDeleteWorkflow(false)}
        title={`تأكيد حذف "${draft.name}"`}
        size="sm"
        transparentBackdrop={false}
      >
        <Modal.Body>
          <p className="text-sm text-ink-700">
            سيتم حذف سير العمل بالكامل. تأكد من عدم وجود متقدمين نشطين على هذا
            الإصدار.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPendingDeleteWorkflow(false)}>
            إلغاء
          </Button>
          <Button variant="danger" isLoading={deleteMut.isPending} onClick={handleDelete}>
            حذف
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={publishStep === 'choose-scope'}
        onClose={() => setPublishStep('idle')}
        title="نطاق التطبيق"
        size="md"
        transparentBackdrop={false}
      >
        <Modal.Body>
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
              سيتم تطبيق هذا التعديل على المتقدمين الجدد فقط بشكل افتراضي. هل
              تريد تطبيقه على المتقدمين الحاليين أيضاً؟ هذا الإجراء يُعيد ترسيخ
              مراحلهم الحالية على الإصدار الجديد.
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">نطاق التطبيق</legend>
              <ScopeRadio
                checked={publishScope === 'new'}
                onChange={() => setPublishScope('new')}
                label="جدد فقط"
                description="المتقدمون الذين سيُسجّلون بعد النشر فقط."
              />
              <ScopeRadio
                checked={publishScope === 'all'}
                onChange={() => setPublishScope('all')}
                label="جدد + حاليين"
                description="إعادة ترسيخ كل المتقدمين النشطين على الإصدار الجديد."
              />
            </fieldset>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPublishStep('idle')}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            leadingIcon={<IconStamp width={12} height={12} />}
            isLoading={saveMut.isPending || applyMut.isPending}
            onClick={handlePublishConfirm}
          >
            تأكيد النشر
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function ScopeRadio({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}): JSX.Element {
  return (
    <label
      className={
        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-fast ease-standard ' +
        (checked
          ? ''
          : 'border-border-default bg-surface-card hover:bg-ink-50')
      }
      style={
        checked
          ? {
              borderColor: 'var(--accent-500)',
              background: 'var(--accent-50)',
            }
          : undefined
      }
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-teal-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="text-2xs text-ink-500">{description}</span>
      </span>
    </label>
  );
}

function ValidationPanel({ findings }: { findings: ValidationFinding[] }): JSX.Element {
  const errors = findings.filter((f) => f.kind === 'error');
  const warnings = findings.filter((f) => f.kind === 'warning');
  const ok = errors.length === 0 && warnings.length === 0;

  return (
    <Card>
      <CardHeader title="تحقق من الصحة" subtitle="قواعد التكوين الإلزامية" />
      {ok && (
        <div className="flex items-center gap-2 rounded-md bg-success-bg p-3 text-2xs text-success">
          <CheckCircle2 size={14} strokeWidth={2} />
          سير العمل صالح للحفظ والنشر.
        </div>
      )}
      {errors.length > 0 && (
        <section className="mt-3 flex flex-col gap-2">
          <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-terra-700">
            <ShieldAlert size={12} strokeWidth={2} /> أخطاء ({errors.length})
          </h4>
          <ul className="flex flex-col gap-1.5">
            {errors.map((f, i) => (
              <li
                key={`err-${i}`}
                className="rounded-md border border-terra-300 bg-terra-50 p-2 text-2xs text-terra-700"
              >
                {f.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="mt-3 flex flex-col gap-2">
          <h4 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-gold-700">
            <AlertTriangle size={12} strokeWidth={2} /> تنبيهات ({warnings.length})
          </h4>
          <ul className="flex flex-col gap-1.5">
            {warnings.map((f, i) => (
              <li
                key={`warn-${i}`}
                className="rounded-md border border-gold-300 bg-gold-50 p-2 text-2xs text-gold-700"
              >
                {f.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

/* Tree-shake guards for symbols imported but only conditionally referenced. */
void Loader2;
void ArrowRight;
