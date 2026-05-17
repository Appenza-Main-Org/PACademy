/**
 * OtpStep — second stage of the staff login flow (spec 007 US1).
 *
 * Wired to POST /auth/login/verify-otp. The backend hashes the code
 * (PBKDF2) and never echoes it back; in development the
 * InMemoryOtpTransport logs the generated code to the API console at
 * Information level, and the dev-only endpoint
 * `GET /auth/dev/otp-peek?phoneTail=...` surfaces it to the UI so demo
 * walkthroughs don't need to scrape the server log. The peek endpoint
 * 404s in non-Development environments, so production never exposes it.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { apiClient } from '@/shared/api';
import { useRequestOtpMutation, useVerifyOtpMutation } from '../api/auth.queries';
import type { AuthUser, LoginCredentials } from '../types';

export interface OtpStepProps {
  pendingId: string;
  otpDevice: string;
  credentials: LoginCredentials;
  /** Fires once the verify mutation succeeds; the verified AuthUser is in the store. */
  onSuccess: (user: AuthUser) => void;
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
  const [peekedCode, setPeekedCode] = useState<string | null>(null);
  const verifyMut = useVerifyOtpMutation();
  const requestMut = useRequestOtpMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Dev-only peek — surface the dispatched OTP for demo walkthroughs.
   * Endpoint 404s in non-Development environments, so this is a no-op
   * in production. Re-fires on resend so the displayed code stays in
   * sync with the latest InMemoryOtpTransport dispatch (pendingId
   * rotates per request-otp; otpDevice stays the same for the user). */
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ code: string }>('/auth/dev/otp-peek', { params: { phoneTail: otpDevice } })
      .then((r) => { if (!cancelled) setPeekedCode(r.data.code); })
      .catch(() => { if (!cancelled) setPeekedCode(null); });
    return () => { cancelled = true; };
  }, [otpDevice, pendingId]);

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
        onSuccess: (user) => {
          toast('تم التحقق بنجاح', 'success');
          onSuccess(user);
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
          peekedCode
            ? `العرض التجريبي · الرمز: ${peekedCode}`
            : 'بيئة التطوير · افحص سجل الخادم لمشاهدة رمز التحقق'
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
