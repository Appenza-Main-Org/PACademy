/**
 * CommitteeCreatePage — wizard-style form to create a new committee.
 * Source: RFP Scope Document §3.2.A.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button, Card, Input, PageHeader, Select, toast } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useCreateCommittee } from '../api/committee.queries';
import { ROUTES } from '@/config/routes';
import type { CommitteeType } from '@/shared/types/domain';

export function CommitteeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<CommitteeType>('capacities');
  const [head, setHead] = useState('');
  const [members, setMembers] = useState(5);
  const [capacity, setCapacity] = useState(50);
  const [cycleId, setCycleId] = useState('CYC-2026-M');
  const createMut = useCreateCommittee();

  return (
    <CenteredShell>
      <PageHeader
        title="إنشاء لجنة جديدة"
        subtitle="حدّد نوع اللجنة، رئيسها، عدد الأعضاء، والسعة اليومية."
        breadcrumbs={[
          { label: 'لجان القبول', href: ROUTES.committee.list },
          { label: 'إنشاء لجنة' },
        ]}
      />

      <Card>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate(
              { name, head, type, members, capacityPerSession: capacity, cycleId },
              {
                onSuccess: (committee) => {
                  toast(`تم إنشاء لجنة ${committee.name}`, 'success');
                  navigate(ROUTES.committee.list);
                },
              },
            );
          }}
        >
          <Input label="اسم اللجنة" required value={name} onChange={(e) => setName(e.target.value)} containerClassName="md:col-span-2" />
          <Select
            label="نوع اللجنة"
            value={type}
            onChange={(e) => setType(e.target.value as CommitteeType)}
            options={[
              { value: 'capacities', label: 'القدرات' },
              { value: 'traits', label: 'السمات' },
              { value: 'sports', label: 'اللياقة البدنية' },
              { value: 'interview', label: 'مقابلة شخصية' },
            ]}
          />
          <Input label="رئيس اللجنة" required value={head} onChange={(e) => setHead(e.target.value)} />
          <Input label="عدد الأعضاء" type="number" min={3} value={members} onChange={(e) => setMembers(Number(e.target.value))} />
          <Input label="السعة لكل جلسة" type="number" min={10} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          <Select
            label="الدورة"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            options={[
              { value: 'CYC-2026-M', label: 'دورة التقديم 2026' },
              { value: 'CYC-2025-M', label: 'دورة 2025 - الذكور' },
              { value: 'CYC-2025-F', label: 'دورة 2025 - الإناث' },
            ]}
            containerClassName="md:col-span-2"
          />

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.committee.list)}>إلغاء</Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={createMut.isPending}
              leadingIcon={<ClipboardList size={14} strokeWidth={1.75} />}
              trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
            >
              إنشاء اللجنة
            </Button>
          </div>
        </form>
      </Card>
    </CenteredShell>
  );
}
