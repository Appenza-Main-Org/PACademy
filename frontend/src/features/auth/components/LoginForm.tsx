/**
 * LoginForm — staff login via MOIPASS-styled flow.
 * Source: ARCH-03 (MOIPASS framing) + AUD-004 (RHF retrofit).
 *
 * Staff users log in through the admin backend using national ID + mobile
 * number. No OTP step is required for this sprint.
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { useLoginMutation } from '../api/auth.queries';
import { RoleSelector } from './RoleSelector';
import type { Role } from '../rbac';
import { ROUTES } from '@/config/routes';

const loginSchema = z.object({
  nationalId: z
    .string()
    .min(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .max(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .regex(/^[0-9]{14}$/, 'الرقم القومي يجب أن يحتوي على أرقام فقط'),
  mobile: z
    .string()
    .regex(
      /^01[0125][0-9]{8}$/,
      'رقم المحمول يجب أن يكون 11 رقماً ويبدأ بـ 010 / 011 / 012 / 015',
    ),
  role: z.enum(['super_admin', 'exams_admin']),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const loginMut = useLoginMutation();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      nationalId: '28705260103619',
      mobile: '01119441198',
      role: 'super_admin',
    },
  });

  const role = watch('role');

  const goToLanding = (chosenRole: Role): void => {
    const landing =
      chosenRole === 'exams_admin'
        ? ROUTES.questionBank.overview
        : ROUTES.admin.reports;
    navigate(landing, { replace: true });
  };

  const onSubmit = async (values: LoginValues): Promise<void> => {
    loginMut.mutate({
      username: values.nationalId,
      password: values.mobile,
      role: values.role,
    }, {
      onSuccess: (user) => {
        toast('تم تسجيل الدخول بنجاح', 'success');
        goToLanding(user.role);
      },
      onError: (err) => toast(err.message || 'تعذّر بدء الدخول', 'danger'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-md flex-col gap-4 lg:gap-5">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
          <ShieldCheck size={12} strokeWidth={1.75} />
          منصّة التحقق الرقمي · MOIPASS
        </div>
        <h2 className="font-ar-display text-xl font-bold text-ink-900 lg:text-2xl">دخول الموظفين</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          يتم التحقق من هوية الضباط والموظفين بالرقم القومي ورقم المحمول المسجل.
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
        label="رقم المحمول"
        type="tel"
        required
        dir="ltr"
        placeholder="01XXXXXXXXX"
        maxLength={11}
        helper="يجب أن يطابق الرقم المسجل على حساب الموظف"
        {...register('mobile')}
        error={errors.mobile?.message}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-700">
          اختر التطبيق المطلوب
        </span>
        <RoleSelector
          value={role}
          onChange={(r: Role) => {
            if (r === 'super_admin' || r === 'exams_admin') {
              setValue('role', r, { shouldValidate: true });
            }
          }}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={loginMut.isPending}
        loadingLabel="جارٍ تسجيل الدخول…"
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
            لتحديث رقم المحمول المسجل تواصَل مع إدارة المنظومة.
          </p>
        </div>
      </aside>
    </form>
  );
}
