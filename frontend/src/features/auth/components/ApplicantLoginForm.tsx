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
  lookupMoiSession,
} from '@/features/applicant-portal/lib/moi-session.mock';
import { useApplicantPortalStore } from '@/features/applicant-portal/store/applicantPortal.store';
import { applicantPortalService } from '@/features/applicant-portal/api/applicantPortal.service';
import { saveVothiqaTaarufSnapshot } from '@/features/applicant-portal/lib/vothiqaTaaruf.snapshot';
import { EXPIRED_DEMO_DOCUMENT } from '@/features/applicant-portal/lib/vothiqaTaaruf.expiredDemo';
import { emptyDocument } from '@/features/applicant-portal/lib/vothiqaTaaruf.types';
import { ROLE_DEFINITIONS } from '../rbac';
import type { AuthUser } from '../types';
import type { ApplicantDraft } from '@/shared/types/domain';

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

/* When VITE_DEMO_BYPASS=false all NIDs (including demo ones) hit the
 * real applicant backend auth flow. Default is true so the demo
 * presentation runs without a backend dependency. */
const DEMO_BYPASS_ENABLED = import.meta.env.VITE_DEMO_BYPASS !== 'false';
const DEMO_BYPASS_NIDS = new Set<string>(DEMO_TEST_USERS.map((u) => u.nationalId));

/** Map a saved backend draft to the correct wizard route to resume from. */
function resolveResumeRoute(draft: ApplicantDraft | null): string {
  if (!draft) return ROUTES.applicantStart;
  const stage = draft.furthestStage;
  if (stage >= 9) return ROUTES.applicantFollowUp;
  if (stage >= 8) return ROUTES.applicantPrintCard;
  if (stage >= 7) return ROUTES.applicantExamSchedule;
  if (stage >= 6) return ROUTES.applicantFamily;
  if (stage >= 3) return ROUTES.applicantPayment;
  if (draft.categoryKey) return ROUTES.applicantProfile;
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

  const finishLogin = async (
    nationalId: string,
    user: Awaited<ReturnType<typeof authService.login>>,
    sessionOverride?: import('@/features/applicant-portal/lib/moi-session.mock').MoiApplicantSession | null,
  ): Promise<void> => {
    const result = sessionOverride !== undefined
      ? sessionOverride
        ? { kind: 'eligible' as const, session: sessionOverride, categoryKey: null as unknown as import('@/shared/types/domain').ApplicantCategoryKey }
        : { kind: 'not_found' as const }
      : await lookupMoiSession(nationalId);
    const portal = useApplicantPortalStore.getState();
    portal.setNationalId(nationalId);

    let dest: string = ROUTES.applicantStart;
    switch (result.kind) {
      case 'eligible':
        portal.setMoiSession(result.session);
        portal.setSelectedCategoryKey(result.categoryKey);
        if (nationalId === SUBMITTED_APPLICANT_NID) {
          const firstExam = new Date();
          firstExam.setDate(firstExam.getDate() + 3);
          firstExam.setHours(8, 0, 0, 0);
          portal.setPayment({ paid: true, paymentMethod: 'fawry-code', paymentReference: '1234567890', fawryCode: '87654321' });
          portal.setParentsApproved(true);
          portal.setFirstExamDate(firstExam.toISOString());
          portal.setSubmittedDemo(true);
          dest = ROUTES.applicant;
          break;
        }
        if (VOTHIQA_DIRECT_LAND_NIDS.has(nationalId)) {
          const firstExam = new Date();
          firstExam.setDate(firstExam.getDate() + 3);
          firstExam.setHours(8, 0, 0, 0);
          portal.setPayment({ paid: true, paymentMethod: 'fawry-code', paymentReference: '1234567898', fawryCode: '87654323' });
          portal.setParentsApproved(true);
          portal.setFirstExamDate(firstExam.toISOString());
          portal.setSubmittedDemo(true);
          if (VOTHIQA_MARRIED_NIDS.has(nationalId)) {
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
            saveVothiqaTaarufSnapshot(nationalId, doc);
          }
          dest = `${ROUTES.applicant}/acquaintance-doc`;
          break;
        }
        if (nationalId === VOTHIQA_EXPIRED_NID) {
          const firstExam = new Date();
          firstExam.setDate(firstExam.getDate() + 3);
          firstExam.setHours(8, 0, 0, 0);
          portal.setPayment({ paid: true, paymentMethod: 'fawry-code', paymentReference: '1234567899', fawryCode: '87654322' });
          portal.setParentsApproved(true);
          portal.setFirstExamDate(firstExam.toISOString());
          portal.setSubmittedDemo(true);
          portal.setVothiqaTaarufSubmittedAt(Date.now() - 25 * 60 * 60 * 1000);
          saveVothiqaTaarufSnapshot(nationalId, EXPIRED_DEMO_DOCUMENT);
          dest = `${ROUTES.applicant}/acquaintance-doc`;
          break;
        }
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

    useAuthStore.getState().setUser(user);
    navigate(dest, { replace: true });
  };

  const performLogin = async (values: FormValues): Promise<void> => {
    setSubmitting(true);
    try {
      useAuthStore.getState().clear();
      useApplicantPortalStore.getState().clear();

      if (DEMO_BYPASS_ENABLED && DEMO_BYPASS_NIDS.has(values.nationalId)) {
        // Demo bypass — build fake user from mock session without hitting backend.
        const result = await lookupMoiSession(values.nationalId);
        const user = buildDemoApplicantUser(
          values.nationalId,
          result.kind === 'eligible' || result.kind === 'ineligible' ? result.session.fullName : 'متقدم تجريبي',
        );
        await finishLogin(values.nationalId, user);
      } else {
        // Real backend auth — initiate then auto-verify (no UI step needed).
        const { sessionId } = await applicantPortalService.initiateAuth(values.nationalId, values.mobile);
        const { token, applicantId, profile } = await applicantPortalService.verifyAuth(sessionId, '123456');
        const user = buildDemoApplicantUser(values.nationalId, profile?.fullName ?? 'متقدم');
        const backendUser = { ...user, id: applicantId, token };

        // Build moiSession from backend profile so بيانات المتقدم shows real data.
        const backendSession = profile ? {
          applicantId: profile.applicantId,
          fullName: profile.fullName,
          nationalId: profile.nationalId,
          dateOfBirth: profile.dateOfBirth,
          dateOfBirthAr: profile.dateOfBirth
            ? new Date(profile.dateOfBirth).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          gender: (profile.gender as 'male' | 'female') ?? 'male',
          mobile: profile.mobile,
          email: profile.email,
          birthGovernorate: profile.birthGovernorate,
          birthDistrict: profile.birthDistrict,
          religion: (profile.religion as 'مسلم' | 'مسيحي') ?? 'مسلم',
        } : null;

        // Write token to sessionStorage BEFORE fetching draft so readAuthToken()
        // finds it when applicantApiClient sends the Bearer header.
        useAuthStore.getState().setUser(backendUser);

        // Fetch saved draft to restore wizard progress across logout/login cycles.
        let savedDraft: ApplicantDraft | null = null;
        try {
          const fetched = await applicantPortalService.getDraft(applicantId);
          // A blank draft (furthestStage=0, no categoryKey) means new applicant.
          savedDraft = (fetched.furthestStage > 0 || fetched.categoryKey) ? fetched : null;
        } catch {
          // Network error — proceed to start, user can re-select category.
        }

        // Hydrate portal store from draft so every wizard step sees correct state
        // on first render without requiring a re-fetch.
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
          /* parentsApproved may not be in older drafts — derive from furthestStage:
           * stage 8+ (exam scheduling) requires parent approval, so if they got there
           * they must have approved. */
          if (savedDraft.parentsApproved || (savedDraft.furthestStage ?? 0) >= 8) {
            portal.setParentsApproved(true);
          }
          if (savedDraft.examSlot?.date) portal.setFirstExamDate(savedDraft.examSlot.date);
          // Switch to the post-submission tab view (PostExamNav) once the
          // applicant has reached exam scheduling — mirrors what the demo
          // SUBMITTED_APPLICANT_NID triggers via the mock path.
          if ((savedDraft.furthestStage ?? 0) >= 8) {
            portal.setSubmittedDemo(true);
          }
        }

        navigate(resolveResumeRoute(savedDraft), { replace: true });
      }
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
