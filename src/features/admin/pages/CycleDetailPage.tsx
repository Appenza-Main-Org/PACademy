/**
 * CycleDetailPage — full configuration of one admission cycle.
 * Source: Tasks/KARASA_GAPS.md §1.2.D.
 */

import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Copy, ListChecks } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import { useCycle, useCycleClone, useCycleTransition } from '../api/cycles.queries';
import { useRulesForCycle } from '../api/admissionRules.queries';
import type { CycleStatus } from '@/shared/types/domain';

const STATUS_OPTIONS: CycleStatus[] = ['draft', 'open', 'active', 'closed', 'processing', 'finalized', 'archived'];

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

export function CycleDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: cycle, isLoading, error, refetch } = useCycle(id);
  const { data: rules } = useRulesForCycle(id);
  const cloneMut = useCycleClone();
  const transitionMut = useCycleTransition();

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!cycle) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="الدورة غير موجودة" />
      </CenteredShell>
    );
  }

  const fillPct = Math.round((cycle.applicantCount / Math.max(1, cycle.expectedCapacity)) * 100);

  return (
    <CenteredShell>
      <PageHeader
        title={cycle.nameAr}
        subtitle={`دورة عام ${cycle.year} · ${cycle.cohort === 'male' ? 'ذكور' : 'إناث'}`}
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'الدورات', href: ROUTES.admin.cycles },
          { label: cycle.nameAr },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Copy size={14} strokeWidth={1.75} />}
              onClick={() => {
                cloneMut.mutate(cycle.id, {
                  onSuccess: (next) => toast(`تم إنشاء نسخة: ${next.nameAr}`, 'success'),
                });
              }}
            >
              نسخ كمسودة
            </Button>
            <Link to={ROUTES.admin.admissionRules} className="inline-flex">
              <Button
                variant="primary"
                leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
                trailingIcon={<ChevronRight size={14} strokeWidth={1.75} />}
              >
                شروط القبول
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-500">السعة المتوقعة</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">
            {num(cycle.expectedCapacity)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">المتقدمون حتى الآن</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">
            {num(cycle.applicantCount)}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, fillPct)}%`, background: 'var(--accent-500)' }} />
          </div>
          <p className="mt-1 text-2xs text-ink-500">{fillPct}% من السعة</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">الفترة</p>
          <p className="mt-1 text-sm text-ink-900">
            {fmtDate(cycle.openDate, 'short')} إلى {fmtDate(cycle.closeDate, 'short')}
          </p>
          <div className="mt-3">
            <Select
              label="الحالة"
              value={cycle.status}
              onChange={(e) => {
                transitionMut.mutate(
                  { id: cycle.id, next: e.target.value as CycleStatus },
                  { onSuccess: () => toast('تم تحديث حالة الدورة', 'success') },
                );
              }}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-ar-display text-xl font-bold text-ink-900">سجل تحديثات شروط القبول</h2>
        <Card>
          <ul className="flex flex-col">
            {(rules ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    النسخة <span className="font-numeric tnum" dir="ltr">{r.version}</span>
                  </p>
                  <p className="text-xs text-ink-500">{r.changedBy.name} · {fmtDate(r.effectiveAt, 'short')}</p>
                </div>
                <Badge tone={r.version === 1 ? 'neutral' : 'info'}>
                  {r.version === 1 ? 'الإصدار الأول' : `تعديل #${r.version - 1}`}
                </Badge>
              </li>
            ))}
            {(rules ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-ink-500">لم يتم حفظ شروط بعد</li>
            )}
          </ul>
        </Card>
      </section>
    </CenteredShell>
  );
}
