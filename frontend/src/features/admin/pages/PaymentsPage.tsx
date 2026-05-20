/**
 * PaymentsPage — Gap K (admin-gaps).
 *
 * Fawry-only payment ledger gated by `payments:review` permission
 * (super_admin + finance_review roles). Two views:
 *   - Active ledger: applicant / fawry ref / amount / status / lastSync
 *   - Refund-eligibility: read-only filtered list per RFP §p.42
 */

import { useMemo, useState } from 'react';
import { Banknote, ClipboardCheck, RefreshCw, RotateCcw, Search } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useAuthStore } from '@/features/auth';
import { hasPermission } from '@/features/auth';
import { date as fmtDate, num } from '@/shared/lib/format';
import {
  useAdminPayments,
  useRefundEligiblePayments,
  useSyncFawryStatus,
} from '../api/payments.queries';
import type { AdminPaymentRow, FawryPaymentStatus } from '@/shared/types/domain';

const STATUS_LABEL: Record<FawryPaymentStatus, string> = {
  pending: 'قيد الدفع',
  paid: 'مدفوع',
  failed: 'فشل',
  expired: 'منتهي',
  refunded: 'تم الاسترداد',
};

const STATUS_TONE: Record<FawryPaymentStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pending: 'info',
  paid: 'success',
  failed: 'danger',
  expired: 'warning',
  refunded: 'neutral',
};

export function PaymentsPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  /* Permission gate — `payments:review` is held by super_admin and
   * finance_review per Gap C seed. Demo super_admin already has '*'. */
  const allowed = user
    ? hasPermission(user.permissions, 'payments:review') || user.role === 'super_admin'
    : false;

  const [statusFilter, setStatusFilter] = useState<FawryPaymentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ledger' | 'refund-eligible'>('ledger');
  const ledgerQuery = useAdminPayments({ status: statusFilter, search });
  const refundQuery = useRefundEligiblePayments();
  const syncMut = useSyncFawryStatus();
  /* Demo-only client state: which payment refs have been marked as
   * reviewed by the finance team, and which have a refund request
   * filed. Production wires these to real audit-emitting service
   * methods (markReviewed / requestRefund). */
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [refundRequested, setRefundRequested] = useState<Set<string>>(new Set());
  const [refundTarget, setRefundTarget] = useState<AdminPaymentRow | null>(null);
  const reviewedSet = useMemo(() => reviewed, [reviewed]);

  const rows = (tab === 'ledger' ? ledgerQuery.data : refundQuery.data) ?? [];
  const isLoading = tab === 'ledger' ? ledgerQuery.isLoading : refundQuery.isLoading;

  const listActions: ListActionsConfig<AdminPaymentRow> = useMemo(
    () => ({
      entityKey: 'admin.payments',
      entityLabelAr: 'دفعات الفوري',
      auditModule: 'payments',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'دفعات-',
        columns: [
          { key: 'id', labelAr: 'المعرف' },
          { key: 'applicantId', labelAr: 'كود المتقدم' },
          { key: 'applicantName', labelAr: 'اسم المتقدم' },
          { key: 'nationalId', labelAr: 'الرقم القومي' },
          { key: 'cycleId', labelAr: 'الدورة' },
          { key: 'fawryReference', labelAr: 'مرجع فوري' },
          { key: 'amount', labelAr: 'المبلغ' },
          {
            key: 'status',
            labelAr: 'الحالة',
            format: (v) => STATUS_LABEL[v as FawryPaymentStatus] ?? String(v ?? ''),
          },
          { key: 'lastSyncAt', labelAr: 'آخر مزامنة', format: (v) => fmtDate(String(v), 'short') },
          { key: 'paidAt', labelAr: 'تاريخ السداد', format: (v) => (v ? fmtDate(String(v), 'short') : '—') },
        ],
      },
    }),
    [],
  );

  if (!allowed) {
    return (
      <CenteredShell>
        <EmptyState
          variant="generic"
          title="لا تملك صلاحية مراجعة المدفوعات"
          description="هذه الشاشة مخصصة لدور المراجع المالي ومدير المنظومة الرئيسي."
        />
      </CenteredShell>
    );
  }

  const columns: DataTableColumn<AdminPaymentRow>[] = [
    {
      key: 'applicantName',
      label: 'المتقدم',
      sortable: true,
      getSortValue: (r) => r.applicantName,
      filter: { kind: 'text', getValue: (r) => r.applicantName },
      render: (r) => <span className="font-medium text-ink-900">{r.applicantName}</span>,
    },
    {
      key: 'nationalId',
      label: 'الرقم القومي',
      sortable: true,
      getSortValue: (r) => r.nationalId,
      filter: { kind: 'text', getValue: (r) => r.nationalId },
      render: (r) => (
        <span dir="ltr" className="font-mono text-2xs text-ink-500">
          {r.nationalId}
        </span>
      ),
    },
    {
      key: 'fawryReference',
      label: 'مرجع فوري',
      sortable: true,
      getSortValue: (r) => r.fawryReference,
      filter: { kind: 'text', getValue: (r) => r.fawryReference },
      render: (r) => (
        <span dir="ltr" className="font-mono text-2xs text-ink-700">
          {r.fawryReference}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'المبلغ',
      numeric: true,
      sortable: true,
      getSortValue: (r) => r.amount,
      filter: { kind: 'number', getValue: (r) => r.amount },
      render: (r) => <span className="font-numeric tnum">{num(r.amount)} ج.م</span>,
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      getSortValue: (r) => r.status,
      filter: {
        kind: 'enum',
        getValue: (r) => r.status,
        options: (Object.entries(STATUS_LABEL) as [FawryPaymentStatus, string][]).map(([v, l]) => ({
          value: v,
          label: l,
        })),
      },
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: 'lastSyncAt',
      label: 'آخر مزامنة',
      sortable: true,
      getSortValue: (r) => new Date(r.lastSyncAt).getTime(),
      filter: { kind: 'date', getValue: (r) => r.lastSyncAt },
      render: (r) => (
        <span className="text-2xs text-ink-500">
          {fmtDate(new Date(r.lastSyncAt).getTime(), 'rel')}
        </span>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (r) => {
        if (tab !== 'ledger') return null;
        const isReviewed = reviewedSet.has(r.fawryReference);
        const isRefundFiled = refundRequested.has(r.fawryReference);
        const canRequestRefund = r.status === 'paid' && !isRefundFiled;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<RefreshCw size={12} strokeWidth={1.75} />}
              onClick={() =>
                syncMut.mutate(r.fawryReference, {
                  onSuccess: () => toast('تم المزامنة', 'success'),
                  onError: (err) => toast((err as Error).message, 'danger'),
                })
              }
              isLoading={syncMut.isPending}
            >
              مزامنة
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ClipboardCheck size={12} strokeWidth={1.75} />}
              onClick={() => {
                setReviewed((prev) => {
                  const next = new Set(prev);
                  if (next.has(r.fawryReference)) next.delete(r.fawryReference);
                  else next.add(r.fawryReference);
                  return next;
                });
                toast(
                  isReviewed ? 'تم إلغاء وسم الدفعة' : 'تم وسم الدفعة كمُراجَعة',
                  'success',
                );
              }}
              title={isReviewed ? 'تراجع عن وسم المراجعة' : 'وسم كمُراجَعة'}
            >
              {isReviewed ? 'مُراجَعة ✓' : 'مراجعة'}
            </Button>
            {canRequestRefund && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
                onClick={() => setRefundTarget(r)}
                title="طلب استرداد المبلغ"
              >
                استرداد
              </Button>
            )}
            {isRefundFiled && (
              <Badge tone="warning">طلب استرداد قيد المراجعة</Badge>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="المدفوعات"
        subtitle="مراجعة دفعات المتقدمين عبر فوري — دور المراجع المالي ومدير المنظومة"
      />

      <nav className="mb-5 flex gap-1 border-b border-border-subtle">
        <TabLink active={tab === 'ledger'} onClick={() => setTab('ledger')}>
          سجل المدفوعات
        </TabLink>
        <TabLink active={tab === 'refund-eligible'} onClick={() => setTab('refund-eligible')}>
          دفعات قابلة للاسترداد
        </TabLink>
      </nav>

      {tab === 'ledger' ? (
        <Card>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <Input
              label="بحث"
              placeholder="ابحث بالاسم أو الرقم القومي أو مرجع فوري…"
              leadingIcon={<Search size={14} strokeWidth={1.75} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label="الحالة"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FawryPaymentStatus | 'all')}
              options={[
                { value: 'all', label: 'الكل' },
                ...(Object.entries(STATUS_LABEL) as [FawryPaymentStatus, string][]).map(([v, l]) => ({
                  value: v,
                  label: l,
                })),
              ]}
            />
          </div>
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            loading={isLoading}
            empty={<EmptyState variant="generic" title="لا توجد دفعات" icon={<Banknote size={32} />} />}
            zebraStripes
            stickyHeader
            density="compact"
            listActions={listActions}
          />
        </Card>
      ) : (
        <Card>
          <div className="mb-3 rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
            دفعات مدفوعة على دورات مؤرشفة — صالحة لإعادة المقابل المالي وفقاً لـ
            §p.42 من كراسة الشروط.
          </div>
          <DataTable
            data={rows}
            columns={columns.filter((c) => c.key !== '_actions')}
            rowKey={(r) => r.id}
            loading={isLoading}
            empty={<EmptyState variant="generic" title="لا توجد دفعات قابلة للاسترداد" />}
            zebraStripes
            stickyHeader
            density="compact"
          />
        </Card>
      )}

      <AlertDialog
        open={refundTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
        title="تسجيل طلب استرداد"
        description={
          refundTarget
            ? `سيتم تسجيل طلب استرداد للدفعة ${refundTarget.fawryReference} ومراجعته قبل التنفيذ.`
            : undefined
        }
        actionLabel="تسجيل الطلب"
        cancelLabel="إلغاء"
        onAction={() => {
          if (!refundTarget) return;
          setRefundRequested((prev) => {
            const next = new Set(prev);
            next.add(refundTarget.fawryReference);
            return next;
          });
          setRefundTarget(null);
          toast('تم تسجيل طلب الاسترداد، في انتظار الموافقة', 'info');
        }}
        tone="danger"
      />
    </CenteredShell>
  );
}

function TabLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-fast ease-standard rounded-t-md ' +
        (active
          ? 'border-accent-500 text-accent-600 font-medium'
          : 'border-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900')
      }
    >
      {children}
    </button>
  );
}
