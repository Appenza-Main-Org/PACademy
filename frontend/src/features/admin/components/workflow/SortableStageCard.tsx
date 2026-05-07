/**
 * SortableStageCard — single stage editor card with @dnd-kit sortable
 * integration. Drag handle on the start edge; numeric order input as the
 * keyboard fallback. Tests subsection collapsible.
 */

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  ListOrdered,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Input, Select } from '@/shared/components';
import {
  TEST_KIND_LABELS,
  type ApplicantStatus,
  type PassCriterion,
  type TestKind,
  type WorkflowStage,
  type WorkflowTest,
} from '@/shared/types/domain';
import type { AppKey } from '@/shared/lib/constants';
import { APP_KEYS } from '@/shared/lib/constants';
import type { ValidationFinding } from '../../lib/workflow-validation';

interface Props {
  stage: WorkflowStage;
  index: number;
  totalStages: number;
  findings: ValidationFinding[];
  onChange: (next: WorkflowStage) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveTo: (id: string, newIndex: number) => void;
}

const STATUS_OPTIONS: ApplicantStatus[] = [
  'pending',
  'under-review',
  'under_medical_review',
  'passed_physical',
  'failed_interview',
  'awaiting_board_decision',
  'on-hold',
  'documents-required',
  'approved',
  'rejected',
];

const STATUS_LABEL_AR: Record<ApplicantStatus, string> = {
  pending: 'في الانتظار',
  'under-review': 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  'on-hold': 'موقوف',
  'documents-required': 'مستندات ناقصة',
  under_medical_review: 'قيد الكشف الطبي',
  passed_physical: 'اجتاز اللياقة',
  failed_interview: 'لم يجتز المقابلة',
  awaiting_board_decision: 'بانتظار قرار الهيئة',
};

const TEST_KINDS: TestKind[] = ['medical', 'physical', 'written', 'interview', 'biometric', 'investigation'];

const TONE_BY_KIND: Record<TestKind, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  medical: 'info',
  physical: 'success',
  written: 'warning',
  interview: 'neutral',
  biometric: 'info',
  investigation: 'danger',
};

export function SortableStageCard({
  stage,
  index: _index,
  totalStages,
  findings,
  onChange,
  onDuplicate,
  onDelete,
  onMoveTo,
}: Props): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const [testsOpen, setTestsOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  const errors = findings.filter((f) => f.stageId === stage.id && f.kind === 'error');
  const warnings = findings.filter((f) => f.stageId === stage.id && f.kind === 'warning');
  const borderClass = errors.length > 0
    ? 'border-terra-500'
    : warnings.length > 0
      ? 'border-gold-300'
      : 'border-border-subtle';

  const updateTest = (testId: string, patch: Partial<WorkflowTest>): void => {
    onChange({
      ...stage,
      tests: stage.tests.map((t) => (t.id === testId ? { ...t, ...patch } : t)),
    });
  };

  const removeTest = (testId: string): void => {
    onChange({ ...stage, tests: stage.tests.filter((t) => t.id !== testId) });
  };

  const addTest = (): void => {
    const newId = `WTST-NEW-${Date.now()}`;
    onChange({
      ...stage,
      tests: [
        ...stage.tests,
        {
          id: newId,
          name: 'اختبار جديد',
          kind: 'written',
          required: true,
          passCriterion: { type: 'boolean', mustBe: 'pass' },
          ownerApp: 'committee',
        },
      ],
    });
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col gap-4 rounded-lg border bg-surface-card p-4 shadow-xs ${borderClass}`}
      aria-label={`المرحلة ${stage.order}: ${stage.name}`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`اسحب لإعادة ترتيب المرحلة ${stage.name}`}
            className="flex h-9 w-9 flex-shrink-0 cursor-grab items-center justify-center rounded-md text-ink-400 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none active:cursor-grabbing"
          >
            <GripVertical size={18} strokeWidth={1.75} />
          </button>
          <span
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-teal-50 px-2 text-sm font-bold text-teal-700 font-numeric tnum"
            dir="ltr"
            aria-hidden
          >
            {stage.order}
          </span>
          {editingName ? (
            <input
              autoFocus
              value={stage.name}
              onChange={(e) => onChange({ ...stage, name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
              }}
              className="min-w-0 flex-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-md font-bold text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-start text-md font-bold text-ink-900 hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            >
              {stage.name}
            </button>
          )}

          <div className="flex flex-shrink-0 items-center gap-1">
            <div className="flex h-9 items-center gap-1.5 rounded-md border border-border-default bg-surface-card pe-1 ps-2 text-2xs text-ink-500">
              <ListOrdered size={12} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">ترتيب</span>
              <Input
                label={undefined}
                type="number"
                min={1}
                max={totalStages}
                value={stage.order}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(totalStages, Number(e.target.value)));
                  if (Number.isNaN(n)) return;
                  onMoveTo(stage.id, n - 1);
                }}
                containerClassName="!mb-0 w-12"
                className="!h-7 border-0 bg-transparent !p-0 text-center text-sm font-bold text-ink-900 focus-visible:!shadow-none"
                aria-label={`ترتيب المرحلة ${stage.name}`}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Copy size={12} strokeWidth={1.75} />}
              onClick={() => onDuplicate(stage.id)}
            >
              نسخ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
              onClick={() => onDelete(stage.id)}
              aria-label={`حذف المرحلة ${stage.name}`}
            >
              حذف
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 ps-12 text-2xs text-ink-500">
          <span>
            اختبارات: <span className="font-numeric tnum text-ink-700" dir="ltr">{stage.tests.length}</span>
          </span>
          <span aria-hidden className="text-ink-300">·</span>
          <span>
            إلزامي: <span className="font-numeric tnum text-ink-700" dir="ltr">{stage.tests.filter((t) => t.required).length}</span>
          </span>
          {errors.length > 0 && (
            <>
              <span aria-hidden className="text-ink-300">·</span>
              <Badge tone="danger">{errors.length} خطأ</Badge>
            </>
          )}
          {warnings.length > 0 && (
            <>
              <span aria-hidden className="text-ink-300">·</span>
              <Badge tone="warning">{warnings.length} تنبيه</Badge>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="الحالة عند الدخول"
          value={stage.statusOnEnter}
          onChange={(e) =>
            onChange({ ...stage, statusOnEnter: e.target.value as ApplicantStatus })
          }
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] }))}
        />
        <AllowedNextEditor
          value={stage.allowedNextStatuses}
          onChange={(next) => onChange({ ...stage, allowedNextStatuses: next })}
        />
      </div>

      <section className="rounded-md border border-border-subtle bg-ink-50/40 p-3">
        <button
          type="button"
          onClick={() => setTestsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-2xs font-medium uppercase tracking-wide text-ink-500 hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <span>الاختبارات ({stage.tests.length})</span>
          {testsOpen ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
        </button>

        {testsOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {stage.tests.length === 0 && (
              <p className="rounded-md border border-dashed border-border-subtle bg-surface-card p-4 text-center text-2xs text-ink-500">
                لا توجد اختبارات. أضف اختباراً واحداً على الأقل لكي يتمكن الموظفون من إكمال هذه المرحلة.
              </p>
            )}
            {stage.tests.map((t) => (
              <TestRow
                key={t.id}
                test={t}
                onChange={(patch) => updateTest(t.id, patch)}
                onRemove={() => removeTest(t.id)}
              />
            ))}
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus size={12} strokeWidth={1.75} />}
              onClick={addTest}
            >
              إضافة اختبار
            </Button>
          </div>
        )}
      </section>
    </article>
  );
}

function TestRow({
  test,
  onChange,
  onRemove,
}: {
  test: WorkflowTest;
  onChange: (patch: Partial<WorkflowTest>) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border-subtle bg-surface-card p-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
      <Input
        label="اسم الاختبار"
        value={test.name}
        onChange={(e) => onChange({ name: e.target.value })}
        containerClassName="!mb-0"
      />
      <Select
        label="النوع"
        value={test.kind}
        onChange={(e) => onChange({ kind: e.target.value as TestKind })}
        options={TEST_KINDS.map((k) => ({ value: k, label: TEST_KIND_LABELS[k] }))}
        containerClassName="!mb-0"
      />
      <PassCriterionEditor
        value={test.passCriterion}
        onChange={(next) => onChange({ passCriterion: next })}
      />
      <Select
        label="جهة التسجيل"
        value={test.ownerApp}
        onChange={(e) => onChange({ ownerApp: e.target.value as AppKey })}
        options={APP_KEYS.filter((k) => k !== 'architecture').map((k) => ({ value: k, label: k }))}
        containerClassName="!mb-0"
      />
      <div className="flex items-center justify-end gap-1.5">
        <label className="flex select-none items-center gap-1.5 text-2xs text-ink-700">
          <input
            type="checkbox"
            checked={test.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          إلزامي
        </label>
        <Badge tone={TONE_BY_KIND[test.kind]}>{TEST_KIND_LABELS[test.kind]}</Badge>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
          onClick={onRemove}
          aria-label={`حذف اختبار ${test.name}`}
        >
          حذف
        </Button>
      </div>
    </div>
  );
}

const CRITERION_TYPE_LABEL: Record<PassCriterion['type'], string> = {
  minScore: 'حد أدنى',
  boolean: 'نجاح/رسوب',
  composite: 'مركّب',
};

function PassCriterionEditor({
  value,
  onChange,
}: {
  value: PassCriterion;
  onChange: (next: PassCriterion) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-ink-700">شرط النجاح</label>
      <div className="flex items-center gap-1">
        <select
          value={value.type}
          onChange={(e) => {
            const t = e.target.value as PassCriterion['type'];
            if (t === 'minScore') onChange({ type: 'minScore', min: 60, max: 100 });
            else if (t === 'boolean') onChange({ type: 'boolean', mustBe: 'pass' });
            else onChange({ type: 'composite', rule: 'all' });
          }}
          className="h-9 rounded-md border border-border-default bg-surface-card px-2 text-2xs text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          {(Object.keys(CRITERION_TYPE_LABEL) as Array<PassCriterion['type']>).map((t) => (
            <option key={t} value={t}>
              {CRITERION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {value.type === 'minScore' && (
          <>
            <input
              aria-label="الحد الأدنى"
              type="number"
              value={value.min}
              onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
              className="h-9 w-14 rounded-md border border-border-default bg-surface-card px-2 text-center text-2xs"
            />
            <span className="text-2xs text-ink-500">/</span>
            <input
              aria-label="الحد الأقصى"
              type="number"
              value={value.max}
              onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
              className="h-9 w-14 rounded-md border border-border-default bg-surface-card px-2 text-center text-2xs"
            />
          </>
        )}
        {value.type === 'boolean' && (
          <select
            aria-label="القيمة المطلوبة"
            value={value.mustBe}
            onChange={(e) => onChange({ ...value, mustBe: e.target.value as 'pass' | 'fail' })}
            className="h-9 rounded-md border border-border-default bg-surface-card px-2 text-2xs"
          >
            <option value="pass">يجب أن ينجح</option>
            <option value="fail">يجب أن يفشل</option>
          </select>
        )}
        {value.type === 'composite' && (
          <select
            aria-label="قاعدة التركيب"
            value={value.rule}
            onChange={(e) => onChange({ ...value, rule: e.target.value as 'all' | 'any' })}
            className="h-9 rounded-md border border-border-default bg-surface-card px-2 text-2xs"
          >
            <option value="all">كل الاختبارات</option>
            <option value="any">أي اختبار</option>
          </select>
        )}
      </div>
    </div>
  );
}

function AllowedNextEditor({
  value,
  onChange,
}: {
  value: ApplicantStatus[];
  onChange: (next: ApplicantStatus[]) => void;
}): JSX.Element {
  const toggle = (s: ApplicantStatus): void => {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  };
  const selectedCount = value.length;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-ink-700">الانتقالات المسموح بها</label>
        <span className="text-2xs text-ink-500">
          <span className="font-numeric tnum text-ink-700" dir="ltr">{selectedCount}</span>
          {' / '}
          <span className="font-numeric tnum" dir="ltr">{STATUS_OPTIONS.length}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-border-default bg-ink-50/40 p-2 min-h-12">
        {STATUS_OPTIONS.map((s) => {
          const active = value.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={
                'rounded-pill border px-3 py-1 text-2xs leading-none transition-colors duration-fast ease-standard ' +
                (active
                  ? 'shadow-xs'
                  : 'border-border-default bg-surface-card text-ink-700 hover:bg-ink-50 hover:text-ink-900')
              }
              style={
                active
                  ? {
                      borderColor: 'var(--accent-500)',
                      background: 'var(--accent-50)',
                      color: 'var(--accent-700)',
                    }
                  : undefined
              }
              aria-pressed={active}
            >
              {STATUS_LABEL_AR[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
