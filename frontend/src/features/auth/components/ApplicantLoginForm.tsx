/**
 * ApplicantLoginForm — applicant-only login at /applicant-login.
 *
 * Differences from the officer LoginForm:
 *  - No role picker (role is hardcoded to 'applicant').
 *  - No OTP step.
 *  - Routes the applicant by the (mocked) MOI lookup verdict:
 *      eligible    → /applicant/profile (category pre-selected)
 *      not_found   → /applicant/start   (category selection)
 *      ineligible  → /applicant/ineligible
 *
 * The submit handler is imperative (not via useLoginMutation) so the
 * setUser + setNationalId + setMoiSession + navigate updates all land in
 * the same React batch. This prevents the page-level redirect (which
 * fires when `user` becomes truthy) from racing the routing decision.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { authService } from '../api/auth.service';
import { useAuthStore } from '../store/auth.store';
import { ROUTES } from '@/config/routes';
import {
  DEMO_TEST_USERS,
  mockMoiLookup,
} from '@/features/applicant-portal/lib/moi-session.mock';
import { useApplicantPortalStore } from '@/features/applicant-portal/store/applicantPortal.store';

const schema = z.object({
  nationalId: z
    .string()
    .min(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .max(14, 'الرقم القومي يجب أن يكون 14 رقماً')
    .regex(/^[0-9]{14}$/, 'الرقم القومي يجب أن يحتوي على أرقام فقط'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});
type FormValues = z.infer<typeof schema>;

export function ApplicantLoginForm(): JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- zodResolver bridges zod's variance-strict generic
    resolver: zodResolver(schema),
    defaultValues: { nationalId: '', password: '' },
  });

  /**
   * Imperative login. Returns the destination URL based on MOI verdict.
   * Caller is responsible for navigating; we keep navigation OUT of this
   * function so the dest is observable in tests/debug.
   */
  const performLogin = async (values: FormValues): Promise<void> => {
    setSubmitting(true);
    try {
      /* Reset both stores so a previous scenario can't leak state into
       * this login (the most common demo bug — Ahmed's category lingered
       * after switching to Khaled). */
      useAuthStore.getState().clear();
      useApplicantPortalStore.getState().clear();

      const user = await authService.login({
        username: values.nationalId,
        password: values.password,
        role: 'applicant',
      });

      const result = mockMoiLookup(values.nationalId);
      const portal = useApplicantPortalStore.getState();
      portal.setNationalId(values.nationalId);

      let dest: string = ROUTES.applicantStart;
      switch (result.kind) {
        case 'eligible':
          portal.setMoiSession(result.session);
          portal.setSelectedCategoryKey(result.categoryKey);
          dest = ROUTES.applicantProfile;
          break;
        case 'ineligible':
          portal.setMoiSession(result.session);
          portal.setSelectedCategoryKey(null);
          dest = ROUTES.applicantIneligible;
          break;
        case 'not_found':
        default:
          portal.setMoiSession(null);
          portal.setSelectedCategoryKey(null);
          dest = ROUTES.applicantStart;
          break;
      }

      /* setUser and navigate in the same batch — page-level redirect on
       * /applicant-login can't race us because the URL is updated in the
       * same tick the user becomes truthy. */
      useAuthStore.getState().setUser(user);
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذّر تسجيل الدخول';
      toast(message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (values: FormValues): void => {
    void performLogin(values);
  };

  /** Fill the form with a demo user AND auto-submit so a single click
   *  drives the whole scenario. */
  const tryDemoUser = (nid: string): void => {
    setValue('nationalId', nid, { shouldValidate: true });
    setValue('password', 'demo-password', { shouldValidate: true });
    void performLogin(getValues());
  };

  return (
    <form
      onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
      className="flex w-full max-w-md flex-col gap-4 lg:gap-5"
    >
      <header>
        <h2 className="font-ar-display text-xl font-bold text-ink-900 lg:text-2xl">
          دخول المتقدمين
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          أدخل الرقم القومي وكلمة المرور للوصول إلى ملف التقديم الخاص بك.
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
        {...register('password')}
        error={errors.password?.message}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={submitting}
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
            بياناتك مُشفّرة. لاسترجاع كلمة المرور تواصَل مع الدعم الفنّي للأكاديمية.
          </p>
        </div>
      </aside>

      <section
        aria-label="مستخدمون تجريبيون"
        className="rounded-md border border-dashed border-ink-200 bg-ink-50/40 px-4 py-3"
      >
        <header className="mb-2 flex items-center justify-between gap-2">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-600">
            للعرض التجريبي
          </span>
          <span className="text-2xs text-ink-500">انقر على المستخدم لتسجيل الدخول مباشرةً</span>
        </header>
        <ul className="flex flex-col gap-2 text-2xs">
          {DEMO_TEST_USERS.map((u) => (
            <li key={u.nationalId} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => tryDemoUser(u.nationalId)}
                disabled={submitting}
                className="flex items-center justify-between gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-start text-ink-800 transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-ink-900">{u.label}</span>
                  <span className="text-ink-500" dir="ltr">{u.nationalId}</span>
                </span>
                <span className="shrink-0 text-2xs text-teal-700">{u.fullName}</span>
              </button>
              <p className="text-ink-500 leading-normal">{u.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </form>
  );
}
