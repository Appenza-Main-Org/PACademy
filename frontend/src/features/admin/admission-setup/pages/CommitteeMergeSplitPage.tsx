/**
 * Step 9 — دمج وفصل اللجان (NEW).
 * Net-new feature: admins can merge several committees into one or split
 * one committee into several. Existing rules for the cycle list below
 * the form with soft-delete (per Gap D pattern).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Split, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import { MarkStepCompleteButton } from '../components/MarkStepCompleteButton';
import { MergeSplitApplyDrawer } from '../components/MergeSplitApplyDrawer';
import { Play } from 'lucide-react';
import { date as fmtDate } from '@/shared/lib/format';
import type { AdmissionCycle, Committee } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useAdmissionMergeSplitRules,
  useCreateMergeSplitRule,
  useDeleteMergeSplitRule,
} from '../api/admission-setup.queries';
import type { CommitteeMergeSplitRule } from '../types';

export function CommitteeMergeSplitPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: committees = [] } = useCommittees({ cycleId: cycle.id });
  const cycleCommittees = committees;
  const { data: rules = [] } = useAdmissionMergeSplitRules(cycle.id);
  const createMut = useCreateMergeSplitRule();
  const deleteMut = useDeleteMergeSplitRule(cycle.id);

  /* Apply-drawer state — a single rule at a time. Cleared on drawer close. */
  const [applyTarget, setApplyTarget] = useState<CommitteeMergeSplitRule | null>(null);
  const committeeNames: Record<string, string> = Object.fromEntries(
    cycleCommittees.map((c) => [c.id, c.name]),
  );

  const [type, setType] = useState<'merge' | 'split'>('merge');
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [effectiveAt, setEffectiveAt] = useState<Date | null>(new Date());

  const reset = (): void => {
    setSourceIds([]);
    setTargetIds([]);
    setReason('');
  };

  const submit = (): void => {
    if (!canWrite || !effectiveAt) return;
    createMut.mutate(
      {
        cycleId: cycle.id,
        type,
        sourceCommitteeIds: sourceIds,
        targetCommitteeIds: targetIds,
        reason: reason.trim() || undefined,
        effectiveAt: effectiveAt.toISOString(),
      },
      {
        onSuccess: () => {
          toast(type === 'merge' ? 'تم تسجيل قاعدة الدمج' : 'تم تسجيل قاعدة الفصل', 'success');
          reset();
        },
        onError: (err) => toast((err).message, 'danger'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="دمج وفصل اللجان"
        subtitle="قواعد دمج عدة لجان في لجنة واحدة، أو فصل لجنة إلى عدة لجان."
        actions={
          <MarkStepCompleteButton
            cycleId={cycle.id}
            stepKey="committee_merge_split"
            canWrite={canWrite}
          />
        }
      />
      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">قاعدة جديدة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="النوع"
            value={type}
            onChange={(e) => {
              const next = e.target.value as 'merge' | 'split';
              setType(next);
              reset();
            }}
            options={[
              { value: 'merge', label: 'دمج عدة لجان في لجنة واحدة' },
              { value: 'split', label: 'فصل لجنة إلى عدة لجان' },
            ]}
            disabled={!canWrite}
          />
          <DatePicker
            label="تاريخ السريان"
            value={effectiveAt}
            onChange={setEffectiveAt}
            disabled={!canWrite}
          />
          <CommitteePicker
            label={type === 'merge' ? 'اللجان المصدر (لجنتان أو أكثر)' : 'اللجنة المصدر (واحدة)'}
            committees={cycleCommittees}
            value={sourceIds}
            onChange={setSourceIds}
            disabled={!canWrite}
            single={type === 'split'}
          />
          <CommitteePicker
            label={type === 'merge' ? 'اللجنة الهدف (واحدة)' : 'اللجان الهدف (لجنتان أو أكثر)'}
            committees={cycleCommittees}
            value={targetIds}
            onChange={setTargetIds}
            disabled={!canWrite}
            single={type === 'merge'}
          />
        </div>
        <Textarea
          label="السبب (اختياري)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          disabled={!canWrite}
          containerClassName="mt-3"
        />
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={submit}
            disabled={!canWrite || sourceIds.length === 0 || targetIds.length === 0 || !effectiveAt}
            isLoading={createMut.isPending}
          >
            تسجيل القاعدة
          </Button>
        </div>
      </Card>

      <section>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">القواعد المسجلة</h3>
        {rules.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-500 text-center py-6">لا توجد قواعد مسجلة لهذه الدورة بعد.</p>
          </Card>
        ) : (
          rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              committees={cycleCommittees}
              canWrite={canWrite}
              onApply={() => setApplyTarget(rule)}
              onDelete={(reasonText) =>
                deleteMut.mutate(
                  { ruleId: rule.id, reason: reasonText },
                  { onSuccess: () => toast('تم حذف القاعدة', 'success') },
                )
              }
            />
          ))
        )}
      </section>

      <MergeSplitApplyDrawer
        open={applyTarget !== null}
        onClose={() => setApplyTarget(null)}
        rule={applyTarget}
        cycleId={cycle.id}
        committeeNames={committeeNames}
      />
    </div>
  );
}

function CommitteePicker({
  label,
  committees,
  value,
  onChange,
  disabled,
  single,
}: {
  label: string;
  committees: Committee[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  single: boolean;
}): JSX.Element {
  const toggle = (id: string): void => {
    if (single) {
      onChange([id]);
      return;
    }
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div>
      <p className="mb-1 text-2xs font-medium text-ink-700">{label}</p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border-default p-2">
        {committees.length === 0 && <p className="text-2xs text-ink-500">لا توجد لجان متاحة.</p>}
        {committees.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-ink-700 hover:bg-ink-50">
            <input
              type={single ? 'radio' : 'checkbox'}
              checked={value.includes(c.id)}
              onChange={() => toggle(c.id)}
              disabled={disabled}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
            {c.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  committees,
  canWrite,
  onApply,
  onDelete,
}: {
  rule: CommitteeMergeSplitRule;
  committees: Committee[];
  canWrite: boolean;
  onApply: () => void;
  onDelete: (reason: string) => void;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const nameOf = (id: string): string => committees.find((c) => c.id === id)?.name ?? id;
  const isPlanned = rule.status === 'planned' && !rule.deletedAt;
  const isApplied = rule.status === 'applied';

  return (
    <Card className="mb-3">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Split size={16} strokeWidth={1.75} className="text-teal-600" />
          <Badge tone={rule.type === 'merge' ? 'info' : 'warning'}>
            {rule.type === 'merge' ? 'دمج' : 'فصل'}
          </Badge>
          {isApplied && (
            <Badge tone="success" className="text-2xs">مُطبَّقة</Badge>
          )}
          {rule.status === 'cancelled' && (
            <Badge tone="neutral" className="text-2xs">ملغاة</Badge>
          )}
          <span className="text-2xs text-ink-500">سريان: {fmtDate(rule.effectiveAt, 'short')}</span>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && isPlanned && !confirming && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Play size={12} strokeWidth={1.75} />}
              onClick={onApply}
            >
              تطبيق
            </Button>
          )}
          {canWrite && !rule.deletedAt && !isApplied && !confirming && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
              onClick={() => setConfirming(true)}
            >
              حذف
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <p className="text-2xs font-medium text-ink-500">المصدر</p>
          <p className="text-ink-700">{rule.sourceCommitteeIds.map(nameOf).join('، ')}</p>
        </div>
        <div>
          <p className="text-2xs font-medium text-ink-500">الهدف</p>
          <p className="text-ink-700">{rule.targetCommitteeIds.map(nameOf).join('، ')}</p>
        </div>
      </div>
      {rule.reason && <p className="mt-2 text-2xs text-ink-500">السبب: {rule.reason}</p>}
      {rule.deletedAt && <p className="mt-2 text-2xs text-terra-700">محذوف</p>}

      {confirming && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
          <Input
            label="سبب الحذف"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: إعادة هيكلة"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>إلغاء</Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!reason.trim()}
              onClick={() => {
                onDelete(reason.trim());
                setConfirming(false);
                setReason('');
              }}
            >
              تأكيد الحذف
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
