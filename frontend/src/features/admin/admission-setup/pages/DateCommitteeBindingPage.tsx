/**
 * ربط اللجان بالمواعيد — wizard step (spec 009 §10).
 *
 * For each committee in the active cycle, allows an admin to set per-date
 * capacity overrides (CommitteeDateBinding). Each row shows: date picker →
 * capacity input → save / delete. Reloading the page retrieves live server
 * state via useDateBindings.
 */

import { useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  toast,
} from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useCommittees } from '@/features/committees/api/committee.queries';
import {
  useDateBindings,
  useUpsertDateBinding,
  useDeleteDateBinding,
} from '@/features/committees/api/committee.queries';
import type { Committee } from '@/shared/types/domain';

export function DateCommitteeBindingPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycleId={cycle.id} />}
    </AdmissionSetupShell>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="لم يتم اختيار دورة"
      description="اختر دورة من صفحة إعداد القبول للمتابعة."
    />
  );
}

interface BodyProps {
  cycleId: string;
}

function Body({ cycleId }: BodyProps): JSX.Element {
  const committeesQuery = useCommittees({ cycleId });

  if (committeesQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }

  const committees = committeesQuery.data ?? [];

  if (committees.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد لجان"
        description="أنشئ لجاناً في الخطوة السابقة ثم عد لهنا لضبط المواعيد."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ربط اللجان بالمواعيد"
        subtitle="حدد السعة اليومية لكل لجنة بحسب التاريخ. الأيام غير المقيّدة تستخدم السعة الافتراضية للجنة."
      />
      {committees.map((c) => (
        <CommitteeDatePanel key={c.id} committee={c} />
      ))}
    </div>
  );
}

interface CommitteeDatePanelProps {
  committee: Committee;
}

function CommitteeDatePanel({ committee }: CommitteeDatePanelProps): JSX.Element {
  const bindingsQuery = useDateBindings(committee.id);
  const upsert = useUpsertDateBinding();
  const remove = useDeleteDateBinding();

  const [newDate, setNewDate] = useState('');
  const [newCapacity, setNewCapacity] = useState('');

  const handleAdd = async (): Promise<void> => {
    if (!newDate || !newCapacity) {
      toast('أدخل التاريخ والسعة', 'warning');
      return;
    }
    const cap = Number(newCapacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 9999) {
      toast('السعة يجب أن تكون عدداً صحيحاً بين 1 و 9999', 'warning');
      return;
    }
    try {
      await upsert.mutateAsync({ committeeId: committee.id, boundDate: newDate, capacity: cap });
      setNewDate('');
      setNewCapacity('');
      toast('تم حفظ السعة بنجاح', 'success');
    } catch {
      toast('حدث خطأ أثناء الحفظ', 'danger');
    }
  };

  const handleDelete = async (boundDate: string): Promise<void> => {
    try {
      await remove.mutateAsync({ committeeId: committee.id, boundDate });
      toast('تم حذف القيد بنجاح', 'success');
    } catch {
      toast('حدث خطأ أثناء الحذف', 'danger');
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-[var(--accent-600)]" />
        <h3 className="font-medium text-sm">{committee.name}</h3>
        <span className="text-xs text-ink-400">
          (السعة الافتراضية: {committee.capacityPerDay ?? committee.capacity ?? '—'})
        </span>
      </div>

      {bindingsQuery.isLoading && <LoadingState variant="list" />}

      {!bindingsQuery.isLoading && (
        <div className="space-y-2">
          {(bindingsQuery.data ?? []).map((b) => (
            <div
              key={b.boundDate}
              className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-ink-500">{b.boundDate}</span>
              <span className="flex-1 text-ink-800">{b.capacity} متقدم</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="حذف"
                onClick={() => handleDelete(b.boundDate)}
                disabled={remove.isPending}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}

          {(bindingsQuery.data ?? []).length === 0 && (
            <p className="text-xs text-ink-400 py-2">
              لا توجد قيود مواعيد — السعة الافتراضية مطبّقة على جميع الأيام.
            </p>
          )}
        </div>
      )}

      {/* Add new binding */}
      <div className="flex items-center gap-2 border-t border-ink-100 pt-3">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-ink-300 px-2 py-1.5 text-sm focus:border-[var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500)]"
          aria-label="التاريخ"
        />
        <input
          type="number"
          min={1}
          max={9999}
          value={newCapacity}
          onChange={(e) => setNewCapacity(e.target.value)}
          placeholder="السعة"
          className="w-24 rounded-md border border-ink-300 px-2 py-1.5 text-sm focus:border-[var(--accent-500)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500)]"
          aria-label="السعة"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          disabled={upsert.isPending || !newDate || !newCapacity}
          leadingIcon={<Plus size={14} />}
        >
          إضافة
        </Button>
      </div>
    </Card>
  );
}
