/**
 * تعديل الطلب — applicant-facing read-only snapshot of the saved draft
 * with per-section "تعديل" buttons that route back into the wizard's
 * existing stage forms (which already accept editing because they read
 * from the draft).
 *
 * AF-3 — closes the MOI portal's "view+edit my application" surface.
 * Reachable from the applicant hub and the layout's top nav.
 */

import { Link } from 'react-router-dom';
import { Eye, FileDown, Pencil, Printer, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, LoadingState, PageHeader } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useDraft } from '../api/applicantPortal.queries';
import { APPLICANT_STAGE_KEYS, APPLICANT_STAGE_LABELS } from '..';
import {
  isApplicantAppointmentLocked,
  isApplicantFamilyLocked,
  isApplicantPaymentLocked,
} from '../lib/application-lock';
import {
  APPLICATION_FORM_ACTIONS,
  canUseApplicationFormActions,
} from '../lib/application-form-actions';
import { useApplicantPortalStore } from '../store/applicantPortal.store';

const APPLICANT_ID = 'APP-2026000';

interface SectionRow {
  stageIndex: number;
  /** Short label that appears as the section heading. */
  heading: string;
  /** One-line summary rendered under the heading. */
  summary: string;
  /** Whether this section is gated read-only (e.g. payment after-paid). */
  locked: boolean;
}

export function ApplicationSummaryPage(): JSX.Element {
  const { data: draft, isLoading } = useDraft(APPLICANT_ID);
  const storePaid = useApplicantPortalStore((s) => s.paid);
  const storeParentsApproved = useApplicantPortalStore((s) => s.parentsApproved);
  const storeFirstExamDate = useApplicantPortalStore((s) => s.firstExamDate);

  if (isLoading || !draft) return <LoadingState variant="page" />;

  const furthest = draft.furthestStage;
  const profile = draft.personal as Record<string, unknown> | undefined;
  const profileSummary = profile?.firstName
    ? `${profile.firstName ?? ''} ${profile.fourthName ?? ''}`.trim()
    : 'بيانات شخصية ودراسية';
  const paymentSummary = draft.payment?.paidAt
    ? `تم السداد · ${draft.payment.method === 'fawry' ? 'فوري' : 'بطاقة ائتمانية'}`
    : '— لم يُسدَّد بعد —';
  const familySummary = (draft.family as Record<string, unknown> | undefined)?.father
    ? 'تم إدخال بيانات الوالدين'
    : '— لم تُدخَل بعد —';
  const examSummary = draft.examSlot
    ? `${draft.examSlot.date.slice(0, 10)} · ${draft.examSlot.time}`
    : '— لم يُحجَز موعد —';
  const paymentLocked = isApplicantPaymentLocked(draft, false);
  const familyLocked = isApplicantFamilyLocked(draft, false);
  const appointmentLocked = isApplicantAppointmentLocked(draft) || Boolean(storeFirstExamDate);
  const showApplicationFormActions = canUseApplicationFormActions({
    paid: storePaid || Boolean(draft.payment?.paidAt),
    parentsApproved: storeParentsApproved || Boolean(draft.parentsApproved || draft.parentsApprovedAt),
    firstExamDate: storeFirstExamDate ?? draft.examSlot?.date ?? null,
    appointmentLocked,
  });

  /* MOI-aligned: stageIndex values mirror the new STAGE_KEYS order:
   *   2 = profile (collapsed 3/4/5)
   *   5 = payment
   *   6 = profile/family
   *   7 = exam-schedule */
  const sections: SectionRow[] = [
    {
      stageIndex: 2,
      heading: 'البيانات الشخصية والدراسية',
      summary: profileSummary,
      locked: paymentLocked,
    },
    {
      stageIndex: 5,
      heading: 'سداد الرسوم',
      summary: paymentSummary,
      locked: paymentLocked,
    },
    {
      stageIndex: 6,
      heading: 'بيانات الوالدين',
      summary: familySummary,
      locked: familyLocked,
    },
    {
      stageIndex: 7,
      heading: 'موعد الاختبار',
      summary: examSummary,
      locked: appointmentLocked,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={paymentLocked ? 'عرض الطلب' : 'تعديل الطلب'}
        subtitle={
          paymentLocked
            ? 'بياناتك الأساسية مقفلة بعد السداد، ويمكنك استكمال الخطوات غير المكتملة'
            : 'مراجعة وتعديل بياناتك المُسجَّلة قبل الإغلاق النهائي للطلب'
        }
        breadcrumbs={[
          { label: 'بوابة المتقدم', href: ROUTES.applicant },
          { label: 'تعديل الطلب' },
        ]}
      />

      {draft.suspended && (
        <Card className="border-terra-500 bg-terra-50">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-terra-700" aria-hidden />
            <div>
              <p className="text-md font-bold text-terra-700">الطلب موقوف مؤقتاً</p>
              <p className="mt-1 text-sm text-terra-700/85">
                لا يمكن تعديل أيّ قسم في الوقت الحالي. سيتم إخطارك فور تحديث الحالة.
              </p>
            </div>
          </div>
        </Card>
      )}

      {showApplicationFormActions && (
        <Card className="border-teal-500 bg-teal-50/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-ar-display text-md font-bold text-ink-900">طلب الإلتحاق النهائي</h3>
              <p className="mt-1 text-sm text-ink-600">
                يمكنك معاينة طلب الإلتحاق، أو طباعته، أو حفظه كملف PDF بعد اكتمال التقديم.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={ROUTES.applicantApplicationForm}>
                <Button
                  variant="secondary"
                  leadingIcon={<Eye size={14} strokeWidth={1.75} />}
                >
                  {APPLICATION_FORM_ACTIONS[0].label}
                </Button>
              </Link>
              <Link to={`${ROUTES.applicantApplicationForm}${APPLICATION_FORM_ACTIONS[1].query}`}>
                <Button
                  variant="secondary"
                  leadingIcon={<Printer size={14} strokeWidth={1.75} />}
                >
                  {APPLICATION_FORM_ACTIONS[1].label}
                </Button>
              </Link>
              <Link to={`${ROUTES.applicantApplicationForm}${APPLICATION_FORM_ACTIONS[2].query}`}>
                <Button
                  variant="primary"
                  leadingIcon={<FileDown size={14} strokeWidth={1.75} />}
                >
                  {APPLICATION_FORM_ACTIONS[2].label}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {sections.map((section) => {
          const reachable = furthest >= section.stageIndex;
          const stageKey = APPLICANT_STAGE_KEYS[section.stageIndex];
          const stageLabel = APPLICANT_STAGE_LABELS[section.stageIndex];
          const editDisabled = !reachable || section.locked || draft.suspended;
          return (
            <Card key={section.stageIndex} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-ar-display text-md font-bold text-ink-900">{section.heading}</h3>
                  {section.locked && <Badge tone="neutral">مغلق</Badge>}
                  {!reachable && <Badge tone="warning">لم يُكتمل بعد</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-700">{section.summary}</p>
                <p className="mt-0.5 text-2xs text-ink-500">{stageLabel}</p>
              </div>
              <div>
                {editDisabled ? (
                  <Button variant="ghost" disabled leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>
                    تعديل
                  </Button>
                ) : (
                  <Link to={`${ROUTES.applicant}/${stageKey}`}>
                    <Button variant="secondary" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>
                      تعديل
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="compact" className="border-dashed border-gold-300 bg-gold-50">
        <p className="text-2xs text-gold-700">
          <span className="font-bold">ملاحظة:</span> الأقسام المُقفلة (الدفع بعد التأكيد، موعد الاختبار بعد الحجز) لا يمكن تعديلها
          عبر بوابة المتقدم. للتعديل تواصل مع لجنة القبول.
        </p>
      </Card>
    </div>
  );
}
