/**
 * ApplyEntryPage — public `/apply` entry into the applicant flow.
 * Source: ARCH-02.
 *
 * Two paths, depending on whether the visitor already has a session:
 *  - Returning applicant (auth state present + draft has progress): resume
 *    at last completed stage.
 *  - First-time visitor: kick off Stage 1 (NID + phone) directly.
 *
 * In both cases, no separate "applicant login" — the wizard's Stage 1 + 2
 * IS the authentication.
 */

import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import { PublicShell } from '@/app/layouts/PublicShell';
import { Button } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useAuthStore } from '@/features/auth';
import { useDraft } from '@/features/applicant-portal/api/applicantPortal.queries';
import { nextApplicantStageUrl } from '@/features/applicant-portal/ApplicantPortalLayout';

const APPLICANT_ID = 'APP-2026000';

export function ApplyEntryPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const { data: draft, isLoading } = useDraft(APPLICANT_ID);
  const navigate = useNavigate();

  /* Returning applicant with progress: jump straight to next stage. */
  useEffect(() => {
    if (!user || user.role !== 'applicant' || !draft) return;
    const target = nextApplicantStageUrl(Math.max(0, draft.furthestStage));
    /* setTimeout so the splash flashes briefly — feels more confident. */
    const t = window.setTimeout(() => navigate(target, { replace: true }), 600);
    return () => window.clearTimeout(t);
  }, [user, draft, navigate]);

  /* Officer accidentally clicked apply: punt to staff hub. */
  if (user && user.role !== 'applicant') {
    return <Navigate to={ROUTES.hub} replace />;
  }

  /* Loading the draft to decide where to send the user. */
  if (user && user.role === 'applicant' && isLoading) {
    return (
      <PublicShell>
        <section className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <Loader2 size={32} strokeWidth={1.75} className="animate-spin text-teal-700" aria-hidden />
          <p className="text-sm text-ink-700">جارٍ تحميل ملفّك… سيتم متابعة آخر خطوة وصلت إليها.</p>
        </section>
      </PublicShell>
    );
  }

  /* New visitor: pre-Stage-1 splash to set context, then "ابدأ" CTA. */
  return (
    <PublicShell>
      <section className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-8 shadow-xs">
          <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
            <GraduationCap size={12} strokeWidth={1.75} />
            تقديم جديد · دفعة 2026
          </div>
          <h1 className="font-ar-display text-2xl font-bold text-ink-900">
            مرحباً بك في رحلة الالتحاق بأكاديمية الشرطة
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            ستمرّ ببعض الخطوات تشمل التحقق من الرقم القومي ورقم الهاتف، إدخال البيانات
            الشخصية والتعليمية، سداد الرسوم، رفع المستندات، وحجز موعد الاختبار. يمكنك حفظ
            تقدّمك والعودة في أي وقت.
          </p>

          <ol className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            {[
              ['1', 'تحقق برقم قومي + هاتف'],
              ['2', 'استلام رمز SMS'],
              ['3', 'بيانات شخصية وأسرية'],
              ['4', 'بيانات تعليمية وتحقق'],
              ['5', 'سداد رسم التقديم'],
              ['6', 'حجز موعد الاختبار'],
            ].map(([n, label]) => (
              <li key={n} className="flex items-center gap-3 rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
                <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-teal-500 font-numeric tnum text-xs font-bold text-white">
                  {n}
                </span>
                <span className="text-ink-900">{label}</span>
              </li>
            ))}
          </ol>

          <p className="mt-6 inline-flex items-center gap-2 rounded-md bg-gold-50 px-3 py-2 text-2xs text-gold-700">
            ⚠️ الباب مفتوح حتى <span className="font-numeric tnum font-bold" dir="rtl">31 مارس 2026</span>.
            لاحقاً، لن يُقبَل أيّ تقديم جديد.
          </p>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate(ROUTES.landing)}
            >
              العودة
            </Button>
            <Button
              variant="primary"
              size="lg"
              trailingIcon={<ArrowLeft size={16} strokeWidth={1.75} />}
              onClick={() => navigate(`${ROUTES.applicant}/auth/step-1`)}
            >
              ابدأ التقديم
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
