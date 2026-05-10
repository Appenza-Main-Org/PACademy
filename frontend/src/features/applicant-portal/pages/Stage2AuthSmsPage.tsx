/**
 * Stage 2 — SMS verification (RFP Scope Document §2.2 stage 2).
 * 6-digit OTP, 5-min countdown, resend rate-limited; demo accepts any
 * 6-digit code except 000000.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShieldCheck, Timer } from 'lucide-react';
import { Button, Card, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage2Schema, type Stage2Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';

const COUNTDOWN_SECONDS = 5 * 60;

export function Stage2AuthSmsPage(): JSX.Element {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [resendCount, setResendCount] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Stage2Values>({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- zodResolver returns any; see src/shared/lib/zod-resolver.ts header.
    resolver: zodResolver(stage2Schema),
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  const onSubmit = async (values: Stage2Values): Promise<void> => {
    try {
      await applicantPortalService.verifyAuth('SESS-DEMO', values.smsCode);
      toast('تم التحقق بنجاح', 'success');
      navigate('/applicant/profile/personal');
    } catch (err) {
      toast((err as Error).message ?? 'تعذر التحقق', 'danger');
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <ShieldCheck size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">إدخال رمز التحقق</h2>
          <p className="mt-1 text-sm text-ink-500">
            أدخل الرمز المكون من 6 أرقام الذي تم إرساله إلى هاتفك المحمول.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="رمز التحقق"
          required
          placeholder="000000"
          dir="ltr"
          maxLength={6}
          {...register('smsCode')}
          error={errors.smsCode?.message}
        />
        <p className="inline-flex items-center gap-2 text-xs text-ink-500">
          <Timer size={14} strokeWidth={1.75} />
          <span dir="ltr" className="font-numeric tnum">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          متبقّية لانتهاء صلاحية الرمز
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={resendCount >= 3}
            onClick={() => {
              setResendCount((c) => c + 1);
              setSecondsLeft(COUNTDOWN_SECONDS);
              toast('تم إعادة إرسال الرمز', 'info');
            }}
          >
            إعادة إرسال الرمز ({3 - resendCount} متبقية)
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            تحقق
          </Button>
        </div>
      </form>
    </Card>
  );
}
