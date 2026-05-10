/**
 * Step 8 — إدارة اللجان.
 * Lists committees scoped to the picked cycle (any with no linkedCycleId
 * are treated as cross-cycle for the demo). Click-through to the existing
 * `/committee/:id` detail page for full management; click "إضافة لجنة"
 * to land on the canonical create form.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import { num } from '@/shared/lib/format';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

export function CommitteesManagementPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle }: { cycle: AdmissionCycle }): JSX.Element {
  const { data: committees = [], isLoading } = useCommittees();
  const cycleCommittees = committees.filter(
    (c) => !c.linkedCycleId || c.linkedCycleId === cycle.id,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إدارة اللجان"
        subtitle={`${cycleCommittees.length} لجنة مرتبطة بدورة "${cycle.nameAr}"`}
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.committee.list} className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
              >
                إدارة اللجان الكاملة
              </Button>
            </Link>
            <Link to={ROUTES.committee.create} className="inline-flex">
              <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                إضافة لجنة
              </Button>
            </Link>
          </div>
        }
      />
      {isLoading && <Card><p className="text-2xs text-ink-500">جارٍ التحميل…</p></Card>}
      {!isLoading && cycleCommittees.length === 0 && (
        <EmptyState
          variant="generic"
          title="لا توجد لجان مرتبطة بهذه الدورة"
          description="أنشئ لجنة جديدة أو اربط اللجان الموجودة من إدارة اللجان."
        />
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cycleCommittees.map((c) => (
          <Link
            key={c.id}
            to={ROUTES.committee.detail(c.id)}
            className="block rounded-md focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <Card variant="elevated" className="h-full transition-shadow duration-fast ease-standard hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-ar-display text-md font-bold text-ink-900">{c.name}</h3>
                <Badge tone="neutral">{num(c.members)} عضو</Badge>
              </div>
              <p className="mt-2 text-2xs text-ink-500">رئيس اللجنة: {c.head}</p>
              <p className="mt-1 text-2xs text-ink-500">
                {num(c.applicants)} متقدم · {num(c.completed)} مكتمل
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
