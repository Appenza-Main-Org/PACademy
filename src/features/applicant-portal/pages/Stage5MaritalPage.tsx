/**
 * Stage 5 — marital status (KARASA §2.2 stage 5).
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Heart } from 'lucide-react';
import { Button, Card, Input, Select, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage5Schema, type Stage5Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';

const APPLICANT_ID = 'APP-2026000';

const STATUS_OPTIONS = [
  { value: 'أعزب', label: 'أعزب' },
  { value: 'متزوج', label: 'متزوج' },
  { value: 'مطلق', label: 'مطلق' },
  { value: 'أرمل', label: 'أرمل' },
];

export function Stage5MaritalPage(): JSX.Element {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Stage5Values>({
    resolver: zodResolver(stage5Schema),
    defaultValues: { maritalStatus: 'أعزب' },
  });

  const status = watch('maritalStatus');

  const onSubmit = async (values: Stage5Values): Promise<void> => {
    await applicantPortalService.submitStage(APPLICANT_ID, 5, { marital: values });
    toast('تم حفظ الحالة الاجتماعية', 'success');
    navigate('/applicant/payment');
  };

  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Heart size={18} strokeWidth={1.75} />
        </span>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">الحالة الاجتماعية</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <Select
          label="الحالة"
          required
          {...register('maritalStatus')}
          options={STATUS_OPTIONS}
          containerClassName="md:col-span-2"
          error={errors.maritalStatus?.message}
        />

        {status === 'متزوج' && (
          <>
            <Input label="اسم الزوج/الزوجة" required {...register('spouseName')} error={errors.spouseName?.message} />
            <Input
              label="الرقم القومي للزوج/الزوجة"
              required
              dir="ltr"
              {...register('spouseNationalId')}
              error={errors.spouseNationalId?.message}
            />
            <Input
              label="تاريخ الزواج"
              type="date"
              required
              {...register('marriageDate')}
              error={errors.marriageDate?.message}
            />
            <Input label="مهنة الزوج/الزوجة" {...register('spouseOccupation')} />
          </>
        )}

        <div className="md:col-span-2 flex justify-end pt-2">
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            حفظ والمتابعة
          </Button>
        </div>
      </form>
    </Card>
  );
}
