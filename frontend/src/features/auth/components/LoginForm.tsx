/**
 * LoginForm — staff login wired to the real backend (spec 007).
 *
 * Flow: NID + password → POST /auth/login/request-otp → OtpStep →
 * POST /auth/login/verify-otp → session cookie + AuthUser in store.
 *
 * Role is determined by the user record on the server, not picked in the
 * form. The post-login destination is derived from the verified user.
 *
 * Demo skin: a role-picker grid pre-fills NID + password with the
 * `DemoDataSeeder`'s known credentials for that role. Submitting still
 * goes through the real OTP backend — the role grid only changes which
 * seeded demo user is being authenticated.
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
import type { Role } from '../rbac';
import type { AuthUser, LoginCredentials } from '../types';
import { ROUTES } from '@/config/routes';

const loginSchema = z.object({
  nationalId: z
    .string()
    .min(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .max(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .regex(/^[0-9]{14}$/, 'الرقم القومي يجب أن يحتوي على أرقام فقط'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});
type LoginValues = z.infer<typeof loginSchema>;

/* Mirrors `DemoDataSeeder.GenerateSystemUserNationalId(i)` for the
 * RoleUsers array (super_admin = index 0) and `appsettings.Development.json`'s
 * `DemoPasswords` section. Picking a role from the grid pre-fills the form
 * with that seeded user's credentials. Roles intentionally absent from the
 * grid (committee_user / medical_doctor / records_clerk) reuse their parent
 * role's demo credentials.
 */
const DEMO_CREDENTIALS: Partial<Record<Role, { nationalId: string; password: string }>> = {
  super_admin:     { nationalId: '27001010150010', password: 'SuperAdmin123!' },
  committee_admin: { nationalId: '27102020251310', password: 'CommitteeAdmin123!' },
  medical_admin:   { nationalId: '27304041253910', password: 'MedicalAdmin123!' },
  investigator:    { nationalId: '27506060156510', password: 'Investigator123!' },
  board_admin:     { nationalId: '27607070257810', password: 'BoardAdmin123!' },
  exams_admin:     { nationalId: '27708082159110', password: 'ExamsAdmin123!' },
  biometric_user:  { nationalId: '27809091260410', password: 'BiometricUser123!' },
  applicant:       { nationalId: '28011110163010', password: 'Applicant123!' },
};

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const requestOtpMut = useRequestOtpMutation();
  const [otpState, setOtpState] = useState<{
    pendingId: string;
    otpDevice: string;
    credentials: LoginCredentials;
  } | null>(null);
  const [role, setRole] = useState<Role>('super_admin');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginValues>({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- zodResolver bridges zod's variance-strict generic; project-wide pattern.
    resolver: zodResolver(loginSchema),
    defaultValues: DEMO_CREDENTIALS.super_admin,
  });

  const onRoleChange = (next: Role): void => {
    setRole(next);
    const creds = DEMO_CREDENTIALS[next];
    if (creds) {
      setValue('nationalId', creds.nationalId, { shouldValidate: true });
      setValue('password', creds.password, { shouldValidate: true });
    }
  };

  const goToLanding = (user: AuthUser): void => {
    const landing =
      user.role === 'applicant'
        ? ROUTES.applicant
        : user.role === 'super_admin'
          ? ROUTES.admin.reports
          : ROUTES.hub;
    navigate(landing, { replace: true });
  };

  const onSubmit = (values: LoginValues): void => {
    const credentials: LoginCredentials = {
      nationalId: values.nationalId,
      password: values.password,
    };

    requestOtpMut.mutate(credentials, {
      onSuccess: ({ pendingId, otpDevice }) => {
        toast('تم إرسال رمز التحقق', 'info');
        setOtpState({ pendingId, otpDevice, credentials });
      },
      onError: (err) => toast(err.message || 'تعذّر بدء الدخول', 'danger'),
    });
  };

  if (otpState) {
    return (
      <OtpStep
        pendingId={otpState.pendingId}
        otpDevice={otpState.otpDevice}
        credentials={otpState.credentials}
        onSuccess={(user) => {
          setOtpState(null);
          goToLanding(user);
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
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="flex w-full max-w-md flex-col gap-4 lg:gap-5">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
          <ShieldCheck size={12} strokeWidth={1.75} />
          منصّة التحقق الرقمي · MOIPASS
        </div>
        <h2 className="font-ar-display text-xl font-bold text-ink-900 lg:text-2xl">دخول الموظفين</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          يتم التحقق من هوية الضباط والموظفين عبر منصّة التحقق الرقمي للحكومة المصرية.
          المتقدّمون للالتحاق يستخدمون
          <a href={ROUTES.apply} className="mx-1 font-medium text-teal-700 hover:underline">صفحة التقديم</a>
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
        {...register('password')}
        error={errors.password?.message}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-700">
          العرض التجريبي · اختر دور الموظف لمحاكاة الدخول
        </span>
        <RoleSelector value={role} onChange={onRoleChange} />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={requestOtpMut.isPending}
        loadingLabel="جارٍ بدء الدخول…"
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
