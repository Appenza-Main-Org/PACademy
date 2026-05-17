/**
 * LoginForm — staff login via MOIPASS-styled flow.
 * Source: ARCH-03 (MOIPASS framing) + AUD-004 (RHF retrofit).
 *
 * Demo: still uses the role picker so evaluators can simulate any role,
 * but the framing is "MOIPASS authenticated officer" rather than a generic
 * username/password. A 1.5s simulated MOIPASS verification step runs on submit.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { useRequestOtpMutation } from '../api/auth.queries';
import { OtpStep } from './OtpStep';
import { RoleSelector } from './RoleSelector';
import { ROLES, type Role } from '../rbac';
import type { LoginCredentials } from '../types';
import { ROUTES } from '@/config/routes';

const loginSchema = z.object({
  nationalId: z
    .string()
    .min(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .max(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .regex(/^[0-9]{14}$/, 'الرقم القومي يجب أن يحتوي على أرقام فقط'),
  passcode: z
    .string()
    .min(1, 'كلمة المرور مطلوبة'),
  role: z.enum(ROLES),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const requestOtpMut = useRequestOtpMutation();
  const [verifying, setVerifying] = useState(false);
  const [otpState, setOtpState] = useState<{
    pendingId: string;
    otpDevice: string;
    credentials: LoginCredentials;
  } | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      nationalId: '29512011500011',
      passcode: 'demo-password',
      role: 'super_admin',
    },
  });

  const role = watch('role');

  const goToLanding = (chosenRole: Role): void => {
    const landing =
      chosenRole === 'applicant'
        ? ROUTES.applicant
        : chosenRole === 'super_admin'
          ? ROUTES.admin.reports
          : ROUTES.hub;
    navigate(landing, { replace: true });
  };

  const onSubmit = async (values: LoginValues): Promise<void> => {
    /* Simulated MOIPASS verification delay (per ARCH-03 — 1.5s). */
    setVerifying(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setVerifying(false);

    const credentials: LoginCredentials = {
      username: values.nationalId,
      password: values.passcode,
      role: values.role,
    };

    requestOtpMut.mutate(credentials, {
      onSuccess: ({ pendingId, otpDevice }) => {
        toast('تم إرسال رمز التحقق', 'info');
        setOtpState({ pendingId, otpDevice, credentials });
      },
      onError: (err) => toast(err.message || 'تعذّر بدء الدخول', 'danger'),
    });
  };

  const isPending = requestOtpMut.isPending || verifying;

  if (otpState) {
    return (
      <OtpStep
        pendingId={otpState.pendingId}
        otpDevice={otpState.otpDevice}
        credentials={otpState.credentials}
        onSuccess={(chosenRole) => {
          setOtpState(null);
          goToLanding(chosenRole);
        }}
        onBack={() => setOtpState(null)}
        onResent={(next) =>
          setOtpState((prev) =>
            prev ? { ...prev, pendingId: next.pendingId, otpDevice: next.otpDevice } : prev,
          )
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-md flex-col gap-4 lg:gap-5">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
          <ShieldCheck size={12} strokeWidth={1.75} />
          منصّة التحقق الرقمي · MOIPASS
        </div>
        <h2 className="font-ar-display text-xl font-bold text-ink-900 lg:text-2xl">دخول الموظفين</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          يتم التحقق من هوية الضباط والموظفين عبر منصّة التحقق الرقمي للحكومة المصرية.
          المتقدّمون للالتحاق يستخدمون
          <a href={ROUTES.applicantLogin} className="mx-1 font-medium text-teal-700 hover:underline">صفحة التقديم</a>
          مباشرةً.
        </p>
      </header>

      <Input
        label="الرقم القومي"
        required
        dir="ltr"
        placeholder="14 رقماً"
        maxLength={14}
        {...register('nationalId')}
        error={errors.nationalId?.message}
      />

      <Input
        label="كلمة المرور"
        type="password"
        required
        placeholder="••••••••"
        helper="بيانات تجريبية مدخلة مسبقاً للعرض"
        {...register('passcode')}
        error={errors.passcode?.message}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-700">
          العرض التجريبي · اختر دور الموظف لمحاكاة الدخول
        </span>
        <RoleSelector value={role} onChange={(r: Role) => setValue('role', r, { shouldValidate: true })} />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isPending}
        loadingLabel={verifying ? 'جارٍ التحقق عبر MOIPASS…' : 'جارٍ الدخول…'}
        trailingIcon={<ArrowLeft size={18} strokeWidth={1.75} />}
      >
        تسجيل الدخول
      </Button>

      <aside
        role="note"
        className="flex items-start gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700"
      >
        <Lock size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">دخول آمن</p>
          <p className="mt-0.5 text-xs text-teal-700/80 leading-normal">
            بياناتك مُشفّرة وكل عمليات الدخول تُسجَّل في سجل العمليات (Audit Trail).
            لإعادة ضبط كلمة المرور تواصَل مع إدارة المنظومة.
          </p>
        </div>
      </aside>
    </form>
  );
}
