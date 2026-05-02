/**
 * InvestigationCreatePage — open a new investigation case.
 * Source: KARASA §5.2.A.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mailbox } from 'lucide-react';
import { Button, Card, Input, PageHeader, Select, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { investigationsService } from '../api/investigations.service';
import type { CasePriority } from '@/shared/types/domain';

export function InvestigationCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [applicantId, setApplicantId] = useState('APP-2026000005');
  const [applicantName, setApplicantName] = useState('محمد علي محمد');
  const [caseType, setCaseType] = useState<'committee-A' | 'committee-C' | 'data-review'>('committee-A');
  const [assignedTo, setAssignedTo] = useState('U-004');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));

  return (
    <>
      <PageHeader
        title="فتح قضية تحريات جديدة"
        subtitle="إسناد القضية إلى محقّق وتحديد الأولوية وتاريخ الاستحقاق."
        breadcrumbs={[
          { label: 'إدارة التحريات', href: ROUTES.investigations.overview },
          { label: 'قضية جديدة' },
        ]}
      />

      <Card>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const next = await investigationsService.create({
              applicantId,
              applicantName,
              caseType,
              assignedTo,
              priority,
              dueDate: new Date(dueDate).toISOString(),
            });
            toast(`تم فتح القضية ${next.id}`, 'success');
            navigate(ROUTES.investigations.overview);
          }}
        >
          <Input label="الرقم التعريفي للمتقدم" required dir="ltr" value={applicantId} onChange={(e) => setApplicantId(e.target.value)} />
          <Input label="اسم المتقدم" required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
          <Select
            label="نوع القضية"
            value={caseType}
            onChange={(e) => setCaseType(e.target.value as typeof caseType)}
            options={[
              { value: 'committee-A', label: 'لجنة (أ)' },
              { value: 'committee-C', label: 'لجنة (ج)' },
              { value: 'data-review', label: 'مراجعة بيانات' },
            ]}
          />
          <Select
            label="المحقّق المسؤول"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            options={[
              { value: 'U-004', label: 'النقيب يوسف أحمد المصري' },
              { value: 'U-009', label: 'النقيب كريم زياد فاروق' },
            ]}
          />
          <Select
            label="الأولوية"
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority)}
            options={[
              { value: 'low', label: 'منخفضة' },
              { value: 'medium', label: 'متوسطة' },
              { value: 'high', label: 'مرتفعة' },
              { value: 'critical', label: 'حرجة' },
            ]}
          />
          <Input label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.investigations.overview)}>إلغاء</Button>
            <Button type="submit" variant="primary" leadingIcon={<Mailbox size={14} strokeWidth={1.75} />}>
              فتح القضية
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
