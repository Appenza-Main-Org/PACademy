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
  DEMO_TEST_USERS,
  SUBMITTED_APPLICANT_NID,
  VOTHIQA_EXPIRED_NID,
  VOTHIQA_FILLABLE_NID,
  VOTHIQA_LAW_BACHELOR_NID,
  VOTHIQA_SPECIALIZED_OFFICERS_NID,
  mockMoiLookup,
} from '@/features/applicant-portal/lib/moi-session.mock';
import { useApplicantPortalStore } from '@/features/applicant-portal/store/applicantPortal.store';
import { saveVothiqaTaarufSnapshot } from '@/features/applicant-portal/lib/vothiqaTaaruf.snapshot';
import { EXPIRED_DEMO_DOCUMENT } from '@/features/applicant-portal/lib/vothiqaTaaruf.expiredDemo';
import { emptyDocument } from '@/features/applicant-portal/lib/vothiqaTaaruf.types';
import { ROLE_DEFINITIONS } from '../rbac';
import type { AuthUser } from '../types';

/* Set of NIDs that should land directly on /applicant/acquaintance-doc
 * after login (وثيقة تعارف demo users). All three (fillable قسم عام
 * + the two married professional users) share the same pre-fill: paid
 * + parents approved + exam date so the post-submission view shows
 * the وثيقة تعارف tab and skips the wizard. */
const VOTHIQA_DIRECT_LAND_NIDS = new Set<string>([
  VOTHIQA_FILLABLE_NID,
  VOTHIQA_SPECIALIZED_OFFICERS_NID,
  VOTHIQA_LAW_BACHELOR_NID,
]);

/* Subset that's married — these get marital='married' pre-set in the
 * وثيقة تعارف snapshot so the new applicant-spouse + children
 * sections surface immediately. */
const VOTHIQA_MARRIED_NIDS = new Set<string>([
  VOTHIQA_SPECIALIZED_OFFICERS_NID,
  VOTHIQA_LAW_BACHELOR_NID,
]);

/* Demo NIDs are frontend-only and not all seeded in the .NET backend —
 * when VITE_USE_APPLICANT_AUTH_BACKEND=true the real `/api/auth/login-simple`
 * call returns 404 for them. Short-circuit the network call for every
 * NID that appears in DEMO_TEST_USERS so the full demo runs without a
 * backend seed change. Non-demo NIDs hit the backend as before. */
const DEMO_BYPASS_NIDS = new Set<string>(DEMO_TEST_USERS.map((u) => u.nationalId));

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
       * non-empty).
       *
       * For Case-1 demo NIDs the .NET backend has no seed row, so we
       * fabricate an AuthUser locally instead of hitting the backend
       * (which would 404 with «السجل غير موجود»). */
      const result = mockMoiLookup(values.nationalId);
      const fakeUser = DEMO_BYPASS_NIDS.has(values.nationalId)
        ? buildDemoApplicantUser(
            values.nationalId,
            result.kind === 'eligible' || result.kind === 'ineligible'
              ? result.session.fullName
              : 'متقدم تجريبي',
          )
        : null;
      const user = fakeUser
        ?? (await authService.login({
          username: values.nationalId,
          password: values.mobile,
          role: 'applicant',
        }));

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
          /* وثيقة تعارف direct-land demos (Cases 1/2/3):
           * the applicant has already paid, approved parents, and picked
           * an exam date — only the وثيقة تعارف remains. Land them on
           * the document page directly so the demo doesn't have to walk
           * through 10 already-completed stages.
           *
           * The two married professional NIDs (specialized_officers +
           * law_bachelor) get a pre-seeded document snapshot with
           * marital='married' so the new applicant-spouse + children
           * sections surface immediately. The fillable قسم-عام demo
           * stays single (no snapshot pre-seed).
           *
           * Difference vs the expired demo below: we do NOT stamp
           * `vothiqaTaarufSubmittedAt`, so the 24-hour edit window
           * never starts — every field stays editable. */
          if (VOTHIQA_DIRECT_LAND_NIDS.has(values.nationalId)) {
            const firstExam = new Date();
            firstExam.setDate(firstExam.getDate() + 3);
            firstExam.setHours(8, 0, 0, 0);
            portal.setPayment({
              paid: true,
              paymentMethod: 'fawry-code',
              paymentReference: '1234567898',
              fawryCode: '87654323',
            });
            portal.setParentsApproved(true);
            portal.setFirstExamDate(firstExam.toISOString());
            portal.setSubmittedDemo(true);
            if (VOTHIQA_MARRIED_NIDS.has(values.nationalId)) {
              const doc = emptyDocument();
              doc.personal.personal.maritalStatus = 'married';
              doc.personal.personal.fullName = result.session.fullName;
              doc.personal.personal.nationalId = result.session.nationalId;
              doc.personal.personal.dateOfBirth = result.session.dateOfBirth;
              doc.personal.personal.religion = result.session.religion;
              doc.personal.personal.governorate = result.session.birthGovernorate;
              doc.personal.personal.birthPlace = result.session.birthDistrict;
              doc.personal.personal.mobile = result.session.mobile;
              doc.personal.cover.fullName = result.session.fullName;
              doc.personal.cover.admissionYear = '2026';
              saveVothiqaTaarufSnapshot(values.nationalId, doc);
            }
            dest = `${ROUTES.applicant}/acquaintance-doc`;
            break;
          }
          /* وثيقة تعارف — expired demo (user #6, Case 1 قسم عام):
           * pre-populate the wizard progress AND seed a complete
           * قسم-عام document whose 25-hour-old submission timestamp
           * trips the edit-window-expired gate on Stage 11. */
          if (values.nationalId === VOTHIQA_EXPIRED_NID) {
            const firstExam = new Date();
            firstExam.setDate(firstExam.getDate() + 3);
            firstExam.setHours(8, 0, 0, 0);
            portal.setPayment({
              paid: true,
              paymentMethod: 'fawry-code',
              paymentReference: '1234567899',
              fawryCode: '87654322',
            });
            portal.setParentsApproved(true);
            portal.setFirstExamDate(firstExam.toISOString());
            portal.setSubmittedDemo(true);
            /* 25 hours ago — past the 24h edit window. */
            portal.setVothiqaTaarufSubmittedAt(Date.now() - 25 * 60 * 60 * 1000);
            saveVothiqaTaarufSnapshot(values.nationalId, EXPIRED_DEMO_DOCUMENT);
            dest = `${ROUTES.applicant}/acquaintance-doc`;
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
