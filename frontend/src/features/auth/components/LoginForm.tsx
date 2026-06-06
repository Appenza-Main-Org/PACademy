/**
 * LoginForm — staff login via the MOI SSO flow.
 *
 * Staff sign in with the MOI-issued username + password. The two-step ministry
 * protocol (token exchange → validate-login) is orchestrated by the admin
 * backend (`/api/auth/moi/login`); this form only collects the credentials.
 * Until the ministry API is live the backend runs a simulated MOI gateway.
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { useLoginMutation } from '../api/auth.queries';
import { ROLE_TILES, RoleSelector } from './RoleSelector';
import type { RoleTile, RoleTileLanding } from './RoleSelector';
import { getDefaultRouteForUser } from '../lib/default-route';
import type { Role } from '../rbac';
import type { AuthUser } from '../types';
import { ROUTES } from '@/config/routes';

const STAFF_LOGIN_ROLES = [
  'super_admin',
  'exams_admin',
  'admissions_system_admin',
] as const;

/** Resolve a tile's post-login landing route. `auto` defers to the user's
 *  default route; the app-specific landings mirror how Question Bank +
 *  Biometric already redirect from their tiles. */
function landingRoute(landing: RoleTileLanding, user: AuthUser): string {
  switch (landing) {
    case 'barcode':
      return ROUTES.barcode.overview;
    case 'biometric':
      return ROUTES.biometric.overview;
    case 'exams':
      return ROUTES.questionBank.overview;
    case 'auto':
    default:
      return getDefaultRouteForUser(user);
  }
}

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'اسم المستخدم مطلوب'),
  password: z
    .string()
    .min(1, 'كلمة المرور مطلوبة'),
  role: z.enum(STAFF_LOGIN_ROLES),
});
type LoginValues = Omit<z.infer<typeof loginSchema>, 'role'> & { role: Role };

/* Accept only internal, single-leading-slash paths. Rejects absolute URLs
 * (`//evil.com`, `https://…`) so a crafted `state.from` cannot redirect off-site
 * after login, and skips bouncing back to the login routes themselves. */
function pickRedirectTarget(from: unknown): string | null {
  if (typeof from !== 'string' || from.length === 0) return null;
  if (!from.startsWith('/') || from.startsWith('//')) return null;
  if (from === ROUTES.staffLogin || from === ROUTES.applicantLogin || from === ROUTES.login) {
    return null;
  }
  return from;
}

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMut = useLoginMutation();

  const redirectTo = pickRedirectTarget(
    (location.state as { from?: unknown } | null)?.from,
  );

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: 'superadmin',
      password: 'Admin@12345',
      role: 'super_admin',
    },
  });

  /* The selected *tile* (not just its role) drives the post-login landing,
   * so the barcode + biometric tiles can share the admissions_system_admin
   * role yet route to different apps. */
  const [selectedTile, setSelectedTile] = useState<RoleTile>(ROLE_TILES[0]!);

  const onSubmit = async (values: LoginValues): Promise<void> => {
    loginMut.mutate({
      username: values.username,
      password: values.password,
      role: values.role,
    }, {
      onSuccess: (user) => {
        toast('تم تسجيل الدخول بنجاح', 'success');
        /* If the user was bounced here from a protected URL, send them back.
         * AuthGuard will re-deny if their role lacks access and route them
         * to their default landing — so we don't need to pre-check here. */
        if (redirectTo) {
          navigate(redirectTo, { replace: true });
          return;
        }
        navigate(landingRoute(selectedTile.landing, user), { replace: true });
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
          يتم التحقق من هوية الضباط والموظفين عبر وزارة الداخلية باسم المستخدم وكلمة المرور.
          المتقدّمون للالتحاق يستخدمون
          <a href={ROUTES.applicantLogin} className="mx-1 font-medium text-teal-700 hover:underline">صفحة التقديم</a>
          مباشرةً.
        </p>
      </header>

      <Input
        label="اسم المستخدم"
        required
        dir="ltr"
        autoComplete="username"
        placeholder="اسم المستخدم"
        {...register('username')}
        error={errors.username?.message}
      />

      <Input
        label="كلمة المرور"
        type="password"
        required
        dir="ltr"
        autoComplete="current-password"
        placeholder="••••••••"
        helper="كلمة المرور صادرة من إدارة المنظومة. يمكنك تغييرها بعد الدخول."
        {...register('password')}
        error={errors.password?.message}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-700">
          اختر التطبيق المطلوب
        </span>
        <RoleSelector
          value={selectedTile.id}
          onChange={(tile: RoleTile) => {
            if ((STAFF_LOGIN_ROLES as readonly Role[]).includes(tile.role)) {
              setSelectedTile(tile);
              setValue('role', tile.role, { shouldValidate: true });
            }
          }}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
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
            لإعادة تعيين كلمة المرور تواصَل مع مدير النظام.
          </p>
        </div>
      </aside>
    </form>
  );
}
