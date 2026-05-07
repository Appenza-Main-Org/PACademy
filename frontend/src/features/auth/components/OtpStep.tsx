/**
 * OtpStep — Gap A (admin-gaps).
 *
 * Stage-2 of the staff login flow. Renders a 6-digit code input plus a
 * "send again" affordance. Demo-only: the dev-bypass code `000000` always
 * passes; the actual generated code is surfaced as a secondary helper line
 * so evaluators can sail through the OTP step without fishing for SMS.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { authService } from '../api/auth.service';
import { useRequestOtpMutation, useVerifyOtpMutation } from '../api/auth.queries';
import type { LoginCredentials } from '../types';

export interface OtpStepProps {
  pendingId: string;
  otpDevice: string;
  credentials: LoginCredentials;
  onSuccess: (role: LoginCredentials['role']) => void;
  onBack: () => void;
  /** Update parent's pendingId after a resend. */
  onResent: (next: { pendingId: string; otpDevice: string }) => void;
}

const CODE_LENGTH = 6;

export function OtpStep({
  pendingId,
  otpDevice,
  credentials,
  onSuccess,
  onBack,
  onResent,
}: OtpStepProps): JSX.Element {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verifyMut = useVerifyOtpMutation();
  const requestMut = useRequestOtpMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  /* The first OTP-step render auto-focuses the input. */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError('رمز التحقق يجب أن يتكوّن من 6 أرقام');
      return;
    }
    setError(null);
    verifyMut.mutate(
      { pendingId, code },
      {
        onSuccess: () => {
          toast('تم التحقق بنجاح', 'success');
          onSuccess(credentials.role);
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  };

  const onResend = (): void => {
    requestMut.mutate(credentials, {
      onSuccess: (next) => {
        onResent(next);
        toast('تم إرسال رمز جديد', 'info');
      },
      onError: (err) => toast(err.message, 'danger'),
    });
  };

  /* Demo-only hint: surface the generated code as a quiet helper line so
   * evaluators can complete the flow without a real SMS. The real
   * integration removes this. */
  const hintCode = authService.peekOtpCode(pendingId);

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4 lg:gap-5">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
          <ShieldCheck size={12} strokeWidth={1.75} />
          المرحلة الثانية · رمز التحقق
        </div>
        <h2 className="font-ar-display text-xl font-bold text-ink-900 lg:text-2xl">أدخل رمز التحقق</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          أُرسل رمز مكوّن من 6 أرقام إلى الرقم{' '}
          <span dir="ltr" className="font-mono">{otpDevice}</span>. أدخله للمتابعة.
        </p>
      </header>

      <Input
        label="رمز التحقق"
        dir="ltr"
        ref={inputRef}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        error={error ?? undefined}
        helper={
          hintCode
            ? `العرض التجريبي · الرمز: ${hintCode} (أو 000000 للتجاوز)`
            : 'تجاوز سريع للعرض: 000000'
        }
        required
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
          onClick={onBack}
        >
          رجوع
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw size={14} strokeWidth={1.75} />}
          onClick={onResend}
          isLoading={requestMut.isPending}
        >
          إرسال رمز جديد
        </Button>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={verifyMut.isPending}
        loadingLabel="جارٍ التحقق…"
        trailingIcon={<ArrowLeft size={18} strokeWidth={1.75} />}
      >
        تأكيد ودخول
      </Button>
    </form>
  );
}
