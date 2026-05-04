/**
 * Stage 1 — phone verification (RFP Scope Document §2.2 stage 1).
 * Captures national ID + Egyptian mobile, requests SMS via service.
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Phone } from 'lucide-react';
import { Button, Card, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage1Schema, type Stage1Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { useApplicantPortalStore } from '../store/applicantPortal.store';

export function Stage1AuthPhonePage(): JSX.Element {
  const navigate = useNavigate();
  const setNationalId = useApplicantPortalStore((s) => s.setNationalId);
  const storedNid = useApplicantPortalStore((s) => s.nationalId);
  const carriedFromEligibility = Boolean(storedNid);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Stage1Values>({
    resolver: zodResolver(stage1Schema),
    defaultValues: { nationalId: storedNid ?? '', phoneNumber: '' },
  });

  const onSubmit = async (values: Stage1Values): Promise<void> => {
    try {
      await applicantPortalService.initiateAuth(values.nationalId, values.phoneNumber);
      setNationalId(values.nationalId);
      const masked = `${values.phoneNumber.slice(0, 3)}-XXX-XX${values.phoneNumber.slice(-4)}`;
      toast(`تم إرسال كلمة المرور إلى الرقم ${masked}`, 'success');
      navigate('/applicant/auth/step-2');
    } catch (err) {
      toast((err as Error).message ?? 'تعذر الإرسال', 'danger');
    }
  };

  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Phone size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">التحقق من الهوية</h2>
          <p className="mt-1 text-sm text-ink-500">
            أدخل رقمك القومي ورقم هاتفك المحمول لإرسال رمز التحقق عبر رسالة SMS.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
        <Input
          label="الرقم القومي"
          required
          placeholder="14 رقماً"
          dir="ltr"
          readOnly={carriedFromEligibility}
          helper={
            carriedFromEligibility
              ? 'تم نقله تلقائياً من خطوة التحقق من الأهلية'
              : undefined
          }
          leadingIcon={
            carriedFromEligibility ? <CheckCircle2 size={14} strokeWidth={1.75} className="text-success" /> : undefined
          }
          {...register('nationalId')}
          error={errors.nationalId?.message}
        />
        <Input
          label="رقم الهاتف المحمول"
          required
          placeholder="01XXXXXXXXX"
          dir="ltr"
          {...register('phoneNumber')}
          error={errors.phoneNumber?.message}
        />
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            إرسال رمز التحقق
          </Button>
        </div>
      </form>
    </Card>
  );
}
