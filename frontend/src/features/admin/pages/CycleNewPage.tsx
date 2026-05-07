/**
 * CycleNewPage — Bucket E3.
 * Minimal "create cycle" form. Created cycles always start in `draft` —
 * department-level open/closed flags are configured on CycleDetailPage.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCycleCreate } from '../api/cycles.queries';
import type { AdmissionCycle } from '@/shared/types/domain';

export function CycleNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCycleCreate();
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [cohort, setCohort] = useState<'male' | 'female'>('male');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [expectedCapacity, setExpectedCapacity] = useState(1500);

  const onSubmit = (): void => {
    if (!labelAr.trim()) return toast('الاسم بالعربية مطلوب', 'warning');
    if (!openDate || !closeDate) return toast('تاريخا الفتح والإغلاق مطلوبان', 'warning');
    if (new Date(closeDate).getTime() <= new Date(openDate).getTime()) {
      return toast('تاريخ الإغلاق يجب أن يكون بعد تاريخ الفتح', 'danger');
    }
    const payload: Omit<AdmissionCycle, 'id' | 'applicantCount'> = {
      nameAr: labelAr,
      labelEn: labelEn || undefined,
      cohort,
      year,
      openDate: new Date(openDate).toISOString(),
      closeDate: new Date(closeDate).toISOString(),
      expectedCapacity,
      status: 'draft',
      openCategories: {},
      conditionOverrides: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createMut.mutate(payload, {
      onSuccess: (cycle) => {
        toast(`تم إنشاء "${cycle.nameAr}" كمسودة`, 'success');
        navigate(ROUTES.admin.cycleDetail(cycle.id));
      },
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  return (
    <div>
      <PageHeader
        title="إنشاء دورة قبول جديدة"
        subtitle="أنشئ دورة كمسودة، ثم اضبط الفئات المفتوحة وشروطها من صفحة الدورة"
        breadcrumbs={[
          { label: 'إدارة الدورات', href: ROUTES.admin.cycles },
          { label: 'دورة جديدة' },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={onSubmit}
            isLoading={createMut.isPending}
          >
            حفظ كمسودة
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="اسم الدورة بالعربية"
            required
            placeholder="مثال: دورة 2027 - الذكور"
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
          />
          <Input
            label="Label (English)"
            dir="ltr"
            placeholder="e.g. Cycle 2027 (Male)"
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
          />
          <Input
            label="السنة"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <Select
            label="الفئة"
            value={cohort}
            onChange={(e) => setCohort(e.target.value as 'male' | 'female')}
            options={[
              { value: 'male', label: 'ذكور' },
              { value: 'female', label: 'إناث' },
            ]}
          />
          <Input
            label="تاريخ الفتح"
            type="date"
            required
            value={openDate}
            onChange={(e) => setOpenDate(e.target.value)}
          />
          <Input
            label="تاريخ الإغلاق"
            type="date"
            required
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
          />
          <Input
            label="السعة المتوقعة"
            type="number"
            value={expectedCapacity}
            onChange={(e) => setExpectedCapacity(Number(e.target.value))}
            containerClassName="md:col-span-2"
          />
        </div>
      </Card>
    </div>
  );
}
