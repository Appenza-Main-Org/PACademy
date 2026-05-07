/**
 * Stage 4 — education (RFP Scope Document §2.2 stage 4).
 * Certificate fields + التربية والتعليم verification with override flow.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, Field, Input, SearchSelect, Select, Textarea, toast } from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage4Schema, type Stage4Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { REF_GOVERNORATES } from '@/shared/mock-data/referenceData';

const APPLICANT_ID = 'APP-2026000';

const CERT_TYPES: readonly SearchSelectOption[] = [
  { value: 'ثانوية عامة', label: 'ثانوية عامة' },
  { value: 'ثانوية أزهرية', label: 'ثانوية أزهرية' },
];

const GOV_SEARCH_OPTIONS: readonly SearchSelectOption[] = REF_GOVERNORATES.map((g) => ({
  value: g.nameAr,
  label: g.nameAr,
  keywords: g.nameEn,
}));

export function Stage4EducationPage(): JSX.Element {
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'pending' | 'verified' | 'mismatch'>('idle');
  const [overrideReason, setOverrideReason] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues, watch, control } = useForm<Stage4Values>({
    resolver: zodResolver(stage4Schema),
    defaultValues: { certificateYear: new Date().getFullYear() - 1 },
  });

  const certType = watch('certificateType');

  const verify = async (): Promise<void> => {
    setVerificationStatus('pending');
    const v = getValues();
    const result = await applicantPortalService.verifyCertificate(APPLICANT_ID, {
      certificateType: v.certificateType,
      seatNumber: v.seatNumber,
    });
    if (result.match) {
      setVerificationStatus('verified');
      toast('تم التحقق من البيانات مع وزارة التربية والتعليم', 'success');
    } else {
      setVerificationStatus('mismatch');
      toast('عدم تطابق في البيانات — يلزم سبب للتجاوز', 'warning');
    }
  };

  const onSubmit = async (values: Stage4Values): Promise<void> => {
    if (verificationStatus === 'mismatch' && !overrideReason.trim()) {
      toast('يرجى توضيح سبب التجاوز', 'danger');
      return;
    }
    await applicantPortalService.submitStage(APPLICANT_ID, 4, {
      education: { ...values, verificationStatus, verificationOverrideReason: overrideReason || undefined },
    });
    toast('تم حفظ البيانات التعليمية', 'success');
    navigate('/applicant/profile/marital');
  };

  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <GraduationCap size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">البيانات التعليمية</h2>
            <p className="mt-1 text-sm text-ink-500">
              يتم التحقق من البيانات تلقائياً مع وزارة التربية والتعليم / الأزهر.
            </p>
          </div>
        </div>
        {verificationStatus === 'verified' && <Badge tone="success">تم التحقق</Badge>}
        {verificationStatus === 'mismatch' && <Badge tone="danger">عدم تطابق</Badge>}
        {verificationStatus === 'pending' && <Badge tone="warning" dot>جارٍ التحقق…</Badge>}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <Field label="نوع الشهادة" required error={errors.certificateType?.message}>
          <Controller
            control={control}
            name="certificateType"
            render={({ field }) => (
              <SearchSelect
                value={field.value ? field.value : null}
                onChange={(next) => field.onChange(next ?? '')}
                options={CERT_TYPES}
                ariaLabel="نوع الشهادة"
                placeholder="اختر نوع الشهادة"
              />
            )}
          />
        </Field>
        <Input
          label="سنة الحصول"
          type="number"
          required
          {...register('certificateYear')}
          error={errors.certificateYear?.message}
        />
        <Input
          label="رقم الجلوس"
          dir="ltr"
          {...register('seatNumber')}
          error={errors.seatNumber?.message}
          helper="مطلوب للثانوية العامة"
        />
        <Input
          label="إجمالي الدرجات"
          type="number"
          required
          {...register('totalScore')}
          error={errors.totalScore?.message}
        />
        <Input
          label="النسبة المئوية"
          type="number"
          step="0.01"
          required
          {...register('percentage')}
          error={errors.percentage?.message}
        />
        <Input
          label="اسم المدرسة / المعهد"
          required
          {...register('schoolName')}
          error={errors.schoolName?.message}
        />
        <Field label="محافظة المدرسة" required error={errors.schoolGovernorate?.message}>
          <Controller
            control={control}
            name="schoolGovernorate"
            render={({ field }) => (
              <SearchSelect
                value={field.value ? field.value : null}
                onChange={(next) => field.onChange(next ?? '')}
                options={GOV_SEARCH_OPTIONS}
                ariaLabel="محافظة المدرسة"
                placeholder="اختر المحافظة"
              />
            )}
          />
        </Field>
        {certType === 'ثانوية أزهرية' && (
          <Select
            label="القسم"
            {...register('azharBranch')}
            options={[
              { value: 'علمي', label: 'علمي' },
              { value: 'أدبي', label: 'أدبي' },
            ]}
          />
        )}

        {verificationStatus === 'mismatch' && (
          <div className="md:col-span-2">
            <Textarea
              label="سبب التجاوز"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              helper="سيتم تسجيل السبب في سجل العمليات (audit)."
            />
          </div>
        )}

        <div className="md:col-span-2 flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<ShieldCheck size={14} strokeWidth={1.75} />}
            onClick={verify}
            isLoading={verificationStatus === 'pending'}
          >
            التحقق من الوزارة
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            حفظ والمتابعة
          </Button>
        </div>
      </form>
    </Card>
  );
}

