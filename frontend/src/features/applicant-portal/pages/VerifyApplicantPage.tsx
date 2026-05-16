/**
 * VerifyApplicantPage — التحقق من المستخدم (PDF p.5 lower).
 *
 * Sits between profile (`/applicant/profile`) and the summary
 * (`/applicant`). The applicant re-enters their NID + mobile to confirm
 * their identity matches the values they registered with on the MOI
 * portal. On match → navigate to `/applicant`. On mismatch → inline
 * ErrorState, no navigation.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Check, ShieldCheck } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { Button, Card, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { verifyApplicantSchema, type VerifyApplicantValues } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { useApplicantPortalStore } from '../store/applicantPortal.store';

const MISMATCH_MESSAGE = 'البيانات غير مطابقة. برجاء التحقق منها وإعادة المحاولة.';

export function VerifyApplicantPage(): JSX.Element {
  const navigate = useNavigate();
  const setVerifiedAt = useApplicantPortalStore((s) => s.setVerifiedAt);
  const [mismatch, setMismatch] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyApplicantValues>({
    resolver: zodResolver(verifyApplicantSchema),
    defaultValues: { nationalId: '', mobile: '' },
  });

  const onSubmit = async (values: VerifyApplicantValues): Promise<void> => {
    setMismatch(false);
    const result = await applicantPortalService.verifyApplicant(values);
    if (!result.confirmed) {
      setMismatch(true);
      return;
    }
    setVerifiedAt(Date.now());
    toast('تم التحقق من البيانات', 'success');
    navigate(ROUTES.applicant);
  };

  return (
    <Card className="mx-auto max-w-xl">
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700"
        >
          <ShieldCheck size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">التحقق من المستخدم</h2>
          <p className="mt-1 text-sm text-ink-500 leading-normal">
            برجاء ملء البيانات التالية وفقاً للبيانات السابق إدراجها أثناء التسجيل على بوابة
            وزارة الداخلية.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Input
          label="الرقم القومي"
          required
          placeholder="14 رقماً"
          dir="ltr"
          {...register('nationalId')}
          error={errors.nationalId?.message}
        />
        <Input
          label="رقم المحمول"
          required
          placeholder="01XXXXXXXXX"
          dir="ltr"
          {...register('mobile')}
          error={errors.mobile?.message}
        />

        {mismatch && (
          <div
            role="alert"
            className="mt-1 flex items-start gap-2 rounded-md border border-terra-500 bg-terra-50 px-3 py-2 text-sm text-terra-800"
          >
            <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden />
            <span className="leading-normal">{MISMATCH_MESSAGE}</span>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            leadingIcon={<Check size={14} strokeWidth={1.75} />}
          >
            تحقق
          </Button>
        </div>
      </form>
    </Card>
  );
}
