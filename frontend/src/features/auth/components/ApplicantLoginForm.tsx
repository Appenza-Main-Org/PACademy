/**
 * ApplicantLoginForm — applicant-only login at /applicant-login.
 *
 * Applicants log in with **national ID + mobile number** (not a password)
 * per client direction (2026-05-18). The staff login at /staff-login is
 * unchanged. Differences from the officer LoginForm:
 *  - No role picker (role is hardcoded to 'applicant').
 *  - No OTP step.
 *  - Mobile number replaces the password field.
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
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { authService } from '../api/auth.service';
import { useAuthStore } from '../store/auth.store';
import { ROUTES } from '@/config/routes';
import {
  SUBMITTED_APPLICANT_NID,
  lookupMoiSession,
} from '@/features/applicant-portal/lib/moi-session.mock';
import { useApplicantPortalStore } from '@/features/applicant-portal/store/applicantPortal.store';

const schema = z.object({
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
});
type FormValues = z.infer<typeof schema>;

export function ApplicantLoginForm(): JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- zodResolver bridges zod's variance-strict generic
    resolver: zodResolver(schema),
    defaultValues: { nationalId: '', mobile: '' },
  });

  const performLogin = async (values: FormValues): Promise<void> => {
    setSubmitting(true);
    try {
      /* Reset both stores so a previous scenario can't leak state into
       * this login (the most common demo bug — Ahmed's category lingered
       * after switching to Khaled). */
      useAuthStore.getState().clear();
      useApplicantPortalStore.getState().clear();

      /* The mock authService.login expects a `password` arg — the
       * applicant flow uses the mobile as the second credential
       * (mock auth doesn't actually validate it, it just needs to be
       * non-empty). */
      const user = await authService.login({
        username: values.nationalId,
        password: values.mobile,
        role: 'applicant',
      });

      const result = await lookupMoiSession(values.nationalId);
      const portal = useApplicantPortalStore.getState();
      portal.setNationalId(values.nationalId);

      let dest: string = ROUTES.applicantStart;
      switch (result.kind) {
        case 'eligible':
          portal.setMoiSession(result.session);
          portal.setSelectedCategoryKey(result.categoryKey);
          /* Submitted-state demo user (user #4): pre-populate the wizard
           * progress (paid + parents approved + exam date picked) so the
           * post-exam 4-tab view renders instead of the wizard. */
          if (values.nationalId === SUBMITTED_APPLICANT_NID) {
            const firstExam = new Date();
            firstExam.setDate(firstExam.getDate() + 3);
            firstExam.setHours(8, 0, 0, 0);
            portal.setPayment({
              paid: true,
              paymentMethod: 'fawry-code',
              paymentReference: '1234567890',
              fawryCode: '87654321',
            });
            portal.setParentsApproved(true);
            portal.setFirstExamDate(firstExam.toISOString());
            /* Flip the demo-only flag so ApplicantPortalLayout swaps the
             * wizard for the 4-tab post-submission view. */
            portal.setSubmittedDemo(true);
            dest = ROUTES.applicant;
            break;
          }
          /* Client direction 2026-05-19: every applicant lands on
           * /applicant/start so they see the full category list with
           * eligibility cues — even when only one category qualifies. */
          dest = ROUTES.applicantStart;
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
          أدخل الرقم القومي ورقم المحمول للوصول إلى ملف التقديم الخاص بك.
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
        {...register('mobile')}
        error={errors.mobile?.message}
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
        <ShieldCheck size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">دخول آمن</p>
          <p className="mt-0.5 text-xs text-teal-700/80 leading-normal">
            بياناتك مُشفّرة. عند الحاجة لتحديث رقم المحمول تواصَل مع الدعم الفنّي
            للأكاديمية.
          </p>
        </div>
      </aside>
    </form>
  );
}
