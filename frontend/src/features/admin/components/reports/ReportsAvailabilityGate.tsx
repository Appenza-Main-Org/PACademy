import { AlertTriangle, Database, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Drawer, EmptyState, ErrorState } from '@/shared/components';
import { NotFoundError } from '@/shared/lib/errors';
import { useDataAvailabilityProbeQuery } from '../../api/reports.queries';
import { useReportsFiltersStore } from '../../reports/store';
import type { ReportsFilters } from '../../reports/types';
import { useState } from 'react';

interface ReportsAvailabilityGateProps {
  filters: ReportsFilters;
  children: ReactNode;
}

export function ReportsAvailabilityGate({ filters, children }: ReportsAvailabilityGateProps): JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reset = useReportsFiltersStore((state) => state.reset);
  const probe = useDataAvailabilityProbeQuery(filters);

  if (!filters.cycleId) {
    return (
      <EmptyState
        title="اختر دورة قبول أولاً"
        description="تحتاج التقارير إلى دورة محددة حتى يتم حساب الأرقام من قاعدة البيانات."
        icon={<Database className="text-ink-400" size={42} />}
      />
    );
  }

  if (probe.isError) {
    if (probe.error instanceof NotFoundError) {
      return (
        <ErrorState
          title="الدورة المحددة غير موجودة بقاعدة البيانات."
          description="قد تكون الدورة حُذفت أو تغيّر رابطها."
          extraActions={<Link to="/admin/cycles"><Button variant="secondary">اختيار دورة أخرى</Button></Link>}
        />
      );
    }
    return (
      <ErrorState
        title="تعذر الاتصال بقاعدة البيانات. يُرجى المحاولة لاحقاً."
        description={probe.error.message}
        onRetry={() => void probe.refetch()}
        extraActions={<RotateCcw size={16} className="text-ink-400" />}
      />
    );
  }

  if (probe.isLoading || !probe.data) {
    return <Card><p className="text-sm text-ink-500">جاري فحص جاهزية البيانات…</p></Card>;
  }

  if (!probe.data.cycleExists) {
    return (
      <EmptyState
        title="الدورة المحددة غير متاحة للتقارير."
        description="اختر دورة أخرى من الفلاتر أو راجع حالة الدورة في شاشة دورات القبول."
        icon={<Database className="text-ink-400" size={42} />}
        action={<Link to="/admin/cycles"><Button>مراجعة الدورات</Button></Link>}
      />
    );
  }

  if (probe.data.totals.applicantsInCycle === 0) {
    return (
      <EmptyState
        variant="no-applicants-yet"
        title="لم يتم تسجيل أي متقدمين بهذه الدورة بعد."
        description={`آخر فحص: ${new Date(probe.data.generatedAt).toLocaleString('ar-EG')}`}
      />
    );
  }

  if (probe.data.appliedFiltersMatchCount === 0) {
    return (
      <EmptyState
        variant="no-results-search"
        title="لا توجد بيانات تطابق الفلاتر المحددة."
        description="خفّف الفلاتر أو عد إلى نطاق الدورة بالكامل."
        action={<Button variant="secondary" onClick={reset}>إعادة ضبط الفلاتر</Button>}
      />
    );
  }

  const warning = probe.data.missingReferences.length > 0;
  return (
    <>
      {warning && (
        <Card className="mb-4 border-gold-400 bg-gold-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-gold-700">
              <AlertTriangle size={18} />
              تنبيه: {probe.data.missingReferences.length} مرجع غير موجود — قد تظهر بعض الصفوف بدون تسمية كاملة.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
              عرض التفاصيل
            </Button>
          </div>
        </Card>
      )}
      {children}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="المراجع غير الموجودة"
        subtitle="هذه القيم موجودة في بيانات المتقدمين أو الفلاتر لكنها غير موجودة في جداول المرجع."
      >
        <div className="space-y-2">
          {probe.data.missingReferences.map((item) => (
            <Card key={`${item.kind}-${item.id}-${item.requestedFrom}`} variant="compact">
              <p className="text-sm font-medium text-ink-900">{item.kind}</p>
              <p className="mt-1 font-mono text-xs text-ink-500" dir="ltr">{item.id}</p>
              <p className="mt-1 text-xs text-ink-500">
                المصدر: {item.requestedFrom === 'filter' ? 'فلتر الاستعلام' : 'بيانات المتقدمين'}
              </p>
            </Card>
          ))}
        </div>
      </Drawer>
    </>
  );
}
