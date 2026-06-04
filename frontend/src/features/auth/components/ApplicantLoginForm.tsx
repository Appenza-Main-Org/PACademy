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
import { useAuthStore } from '../store/auth.store';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '@/features/applicant-portal/store/applicantPortal.store';
import { applicantPortalService } from '@/features/applicant-portal/api/applicantPortal.service';
import { normalizeApplicantGender } from '@/features/applicant-portal/lib/applicant-gender';
import { ROLE_DEFINITIONS } from '../rbac';
import type { AuthUser } from '../types';
import type { ApplicantDraft } from '@/shared/types/domain';
import { nationalIdErrorMessage } from '@/shared/lib/national-id';

/** Map a saved backend draft to the correct wizard route to resume from. */
function resolveResumeRoute(draft: ApplicantDraft | null): string {
  if (!draft) return ROUTES.applicantStart;
  const stage = draft.furthestStage;
  if (stage >= 9) return ROUTES.applicantFollowUp;
  if (stage >= 8) return ROUTES.applicantPrintCard;
  if (stage >= 7) return ROUTES.applicantExamSchedule;
  if (stage >= 6) return ROUTES.applicantFamily;
  if (stage >= 3) return ROUTES.applicantPayment;
  if (stage >= 1 && draft.categoryKey) return ROUTES.applicantProfile;
  return ROUTES.applicantStart;
}

function buildDemoApplicantUser(nationalId: string, fullName: string): AuthUser {
  const def = ROLE_DEFINITIONS.applicant;
  return {
    id: `demo-applicant-${nationalId}`,
    name: fullName,
    role: 'applicant',
    roleLabel: def.labelAr,
    apps: def.apps,
    permissions: def.permissions,
    token: `demo-${nationalId}`,
    loggedInAt: Date.now(),
  };
}

const schema = z.object({
  nationalId: z.string().superRefine((value, ctx) => {
    const message = nationalIdErrorMessage(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
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
      useAuthStore.getState().clear();
      useApplicantPortalStore.getState().clear();

      const { sessionId } = await applicantPortalService.initiateAuth(values.nationalId, values.mobile);
      const { token, applicantId, profile } = await applicantPortalService.verifyAuth(sessionId, '123456');
      const user = buildDemoApplicantUser(values.nationalId, profile?.fullName ?? 'متقدم');
      const backendUser = { ...user, id: applicantId, token };

      const backendSession = profile ? {
        applicantId: profile.applicantId,
        fullName: profile.fullName,
        nationalId: profile.nationalId,
        dateOfBirth: profile.dateOfBirth,
        dateOfBirthAr: profile.dateOfBirth
          ? new Date(profile.dateOfBirth).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
          : '',
        gender: normalizeApplicantGender(profile.gender, profile.nationalId),
        mobile: profile.mobile,
        email: profile.email,
        birthGovernorate: profile.birthGovernorate,
        birthDistrict: profile.birthDistrict,
        religion: (profile.religion as 'مسلم' | 'مسيحي') ?? 'مسلم',
      } : null;

      useAuthStore.getState().setUser(backendUser);

      let savedDraft: ApplicantDraft | null = null;
      try {
        const fetched = await applicantPortalService.getDraft(applicantId);
        savedDraft = (fetched.furthestStage > 0 || fetched.categoryKey) ? fetched : null;
      } catch {
        /* Network error — proceed to start, user can re-select category. */
      }

      const portal = useApplicantPortalStore.getState();
      portal.setNationalId(values.nationalId);
      if (backendSession) portal.setMoiSession(backendSession);
      if (savedDraft) {
        if (savedDraft.categoryKey) portal.setSelectedCategoryKey(savedDraft.categoryKey);
        if (savedDraft.cycleId) portal.setSelectedCycleId(savedDraft.cycleId);
        if (savedDraft.payment?.paidAt) {
          portal.setPayment({
            paid: true,
            paymentMethod: 'fawry-code',
            paymentReference: savedDraft.payment.refNumber ?? null,
            fawryCode: savedDraft.payment.fawryCode ?? null,
          });
        }
        if (savedDraft.parentsApproved || (savedDraft.furthestStage ?? 0) >= 8) {
          portal.setParentsApproved(true);
        }
        if (savedDraft.examSlot?.date) portal.setFirstExamDate(savedDraft.examSlot.date);
        if ((savedDraft.furthestStage ?? 0) >= 8) {
          portal.setSubmittedDemo(true);
        }
      }

      navigate(resolveResumeRoute(savedDraft), { replace: true });
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
        dir="rtl"
        placeholder="14 رقماً"
        maxLength={14}
        {...register('nationalId')}
        error={errors.nationalId?.message}
      />

      <Input
        label="رقم المحمول"
        type="tel"
        required
        dir="rtl"
        placeholder="01XXXXXXXXX"
        maxLength={11}
        {...register('mobile')}
        error={errors.mobile?.message}
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
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
