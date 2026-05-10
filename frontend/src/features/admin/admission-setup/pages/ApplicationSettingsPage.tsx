/**
 * Step 2 — إعدادات التقديم.
 * Composes the per-cycle per-category open/close + capacity table extracted
 * from CycleDetailPage. Reuses `useToggleCycleCategory` directly.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { CategoriesPanel } from '@/features/admin/components/cycles/CategoriesPanel';
import {
  useToggleCycleCategory,
} from '@/features/admin/api/cycles.queries';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

export function ApplicationSettingsPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: categories = [] } = useCategoriesAdmin();
  const toggleMut = useToggleCycleCategory();
  const readOnly = !canWrite || cycle.status === 'archived' || cycle.status === 'finalized';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إعدادات التقديم"
        subtitle="افتح/أغلق فئات هذه الدورة وحدّد السعة، النوع، وفترة التقديم لكل فئة."
        actions={
          <Link to={ROUTES.admin.categories} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
            >
              تعديل تفاصيل الفئات
            </Button>
          </Link>
        }
      />
      <CategoriesPanel
        cycle={cycle}
        categories={categories}
        readOnly={readOnly}
        onToggle={(categoryKey, config) => {
          toggleMut.mutate(
            { cycleId: cycle.id, categoryKey, config },
            {
              onSuccess: () => toast('تم تحديث حالة الفئة', 'success'),
              onError: (err) => toast((err).message ?? 'تعذر التحديث', 'danger'),
            },
          );
        }}
      />
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      description="إعدادات الفئات مرتبطة بالدورة."
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
