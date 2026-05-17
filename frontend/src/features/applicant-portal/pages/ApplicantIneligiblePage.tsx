/**
 * ApplicantIneligiblePage — shown after MOI returns a session for an
 * applicant who does not qualify for any open admission category.
 *
 * Surfaces the rejection reason carried in the store's MOI session
 * snapshot and offers two next steps: sign out, or contact support.
 */

import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, HelpCircle, LogOut } from 'lucide-react';
import { Button, Card } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useLogoutMutation } from '@/features/auth';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { mockMoiLookup } from '../lib/moi-session.mock';

export function ApplicantIneligiblePage(): JSX.Element {
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const logout = useLogoutMutation();
  const navigate = useNavigate();

  /* Re-derive the rejection reason from the same mock the login flow
   * called — the store carries only the session itself, not the
   * verdict. If somehow the user landed here without a stored session,
   * bounce them back to the login screen. */
  if (!moiSession) {
    return <Navigate to={ROUTES.applicantLogin} replace />;
  }
  const verdict = mockMoiLookup(moiSession.nationalId);
  const reasonAr =
    verdict.kind === 'ineligible'
      ? verdict.reasonAr
      : 'لا تتوفر فيك شروط القبول لأيٍّ من الفئات المتاحة في الدورة الحالية.';

  return (
    <main className="page-enter mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-12">
      <Card className="w-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden
            className="grid h-14 w-14 place-items-center rounded-full bg-terra-50 text-terra-600"
          >
            <AlertTriangle size={28} strokeWidth={1.75} />
          </span>
          <h1 className="font-ar-display text-2xl font-bold text-ink-900">
            عذراً، لا يمكن المتابعة في التقديم
          </h1>
          <p className="text-sm leading-relaxed text-ink-700">
            مرحباً <strong>{moiSession.fullName}</strong>.
          </p>
          <p className="rounded-md border border-dashed border-terra-300 bg-terra-50/40 px-4 py-3 text-sm leading-relaxed text-terra-700">
            {reasonAr}
          </p>
          <p className="text-2xs text-ink-500">
            إذا كنت تعتقد أن هناك خطأ في البيانات المُسترجَعة من وزارة الداخلية،
            تواصَل مع الدعم الفنّي للأكاديمية.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              leadingIcon={<LogOut size={14} strokeWidth={1.75} />}
              onClick={() => logout.mutate()}
              isLoading={logout.isPending}
            >
              تسجيل الخروج
            </Button>
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<HelpCircle size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.help)}
            >
              الدعم الفنّي
            </Button>
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />}
              onClick={() => navigate(ROUTES.landing)}
            >
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
