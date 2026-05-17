/**
 * ApplicantPortalPage — applicant summary screen (PDF p.5 top, MOI-aligned).
 *
 * The index of `/applicant`. Renders the application as a read-only
 * summary with the top-bar action cluster (الدفع / تعديل الطلب / عرض
 * إرشادات التقدم) and a yellow modification-deadline banner. Primary CTA
 * adapts based on draft state:
 *   - unpaid                → 'الدفع' → /applicant/payment
 *   - paid, parents unset   → 'إدراج بيانات الوالدين' → /applicant/profile/family
 *   - parents approved,
 *     exam-date unset       → 'تحديد موعد الإختبار' → /applicant/exam-schedule
 *   - exam-date set         → 'بطاقة التردد' → /applicant/print-card
 *
 * The previous generic wizard-hub view (welcome card, notifications,
 * support cards) is gone — those affordances move into the global
 * shell's NotificationCenter and the support page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CreditCard,
  Info,
  Pencil,
  Phone,
  ScrollText,
} from 'lucide-react';
import { Badge, Button, Card, Drawer, IconStamp } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { useActiveCycle, useCategories } from '../api/categories.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { deterministicFileNumber } from '../lib/deterministic-codes';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

export function ApplicantPortalPage(): JSX.Element {
  const paid = useApplicantPortalStore((s) => s.paid);
  const parentsApproved = useApplicantPortalStore((s) => s.parentsApproved);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const categoriesQuery = useCategories();
  const activeCycle = useActiveCycle();
  const [showInstructions, setShowInstructions] = useState(false);

  const session = MOI_APPLICANT_SESSION;
  const fileNumber = paid ? deterministicFileNumber(APPLICANT_ID) : null;
  const committeeNumber = paid ? 'اللجنة الثانية' : null;
  const category = (categoriesQuery.data ?? []).find((c) => c.key === selectedCategoryKey);
  /* PDF p.5 calls out a separate "modification deadline" — we don't have a
   * dedicated cycle field for that yet, so we surface the cycle's
   * closeDate as the latest moment edits are accepted. Backend-integration
   * day will introduce `AdmissionCycle.modificationDeadline` and we'll
   * switch to that. */
  const modificationDeadline = activeCycle.data?.closeDate;

  const primaryCta = (() => {
    if (!paid) {
      return {
        label: 'الدفع',
        to: ROUTES.applicantPayment,
        variant: 'primary' as const,
        leadingIcon: <CreditCard size={14} strokeWidth={1.75} />,
      };
    }
    if (!parentsApproved) {
      return {
        label: 'إدراج بيانات الوالدين',
        to: ROUTES.applicantFamily,
        variant: 'primary' as const,
        leadingIcon: <ArrowLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />,
      };
    }
    if (!firstExamDate) {
      return {
        label: 'تحديد موعد الإختبار',
        to: ROUTES.applicantExamSchedule,
        variant: 'primary' as const,
        leadingIcon: <CalendarCheck size={14} strokeWidth={1.75} />,
      };
    }
    return {
      label: 'بطاقة التردد',
      to: ROUTES.applicantPrintCard,
      variant: 'primary' as const,
      leadingIcon: <ArrowLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />,
    };
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top-bar action cluster ───────────────────────────── */}
      <Card>
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">ملخّص طلب الإلتحاق</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              راجع البيانات المُسجَّلة. يمكنك تعديل الطلب قبل سداد رسوم الخدمة، وبعد السداد لا
              تُعدَّل البيانات إلا بإجراء إداري.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paid ? (
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                تم الدفع
              </Badge>
            ) : (
              <Link to={ROUTES.applicantPayment}>
                <Button
                  variant="primary"
                  leadingIcon={<CreditCard size={14} strokeWidth={1.75} />}
                >
                  الدفع
                </Button>
              </Link>
            )}
            <Link to={ROUTES.applicantApplicationSummary}>
              <Button variant="secondary" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>
                تعديل الطلب
              </Button>
            </Link>
            <Button
              variant="ghost"
              leadingIcon={<ScrollText size={14} strokeWidth={1.75} />}
              onClick={() => setShowInstructions(true)}
            >
              عرض إرشادات التقدم
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Yellow modification-deadline banner ─────────────── */}
      {modificationDeadline && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-gold-300 bg-gold-50 px-4 py-3 text-2xs text-gold-800"
        >
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            برجاء الإنتباه: آخر موعد لتعديل البيانات وتحصيل رسوم مقابل الخدمة يوم:{' '}
            <span className="font-bold">{fmtDate(modificationDeadline, 'short')}</span>
          </p>
        </div>
      )}

      {/* ── بيانات الطالب ──────────────────────────────────── */}
      <Card>
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Info size={14} strokeWidth={1.75} />
          </span>
          <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات الطالب</h3>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          <Row label="إسم الطالب" value={session.fullName} />
          <Row label="الرقم القومي" value={session.nationalId} ltr mono />
          <Row label="القسم" value={category?.labelAr ?? '— لم يُختر —'} />
          <Row label="اللجنة" value={committeeNumber ?? '—'} />
          <Row label="النوع" value={session.gender === 'male' ? 'ذكر' : 'أنثى'} />
          <Row label="تاريخ الميلاد" value={session.dateOfBirthAr} />
          <Row label="رقم الملف" value={fileNumber ?? '—'} ltr mono />
          <Row label="الديانة" value={session.religion} />
          <Row label="محل الميلاد" value={`${session.birthGovernorate} — ${session.birthDistrict}`} />
          <Row
            label="العنوان"
            value={`${session.birthGovernorate}`}
            containerClassName="sm:col-span-2 md:col-span-3"
          />
        </dl>
      </Card>

      {/* ── بيانات التواصل ────────────────────────────────── */}
      <Card>
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Phone size={14} strokeWidth={1.75} />
          </span>
          <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات التواصل</h3>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          <Row label="أرقام التليفون" value={session.mobile} ltr mono />
          <Row label="البريد الإلكتروني" value={session.email} ltr mono />
          <Row label="تويتر" value="—" />
          <Row label="إنستجرام" value="—" />
        </dl>
      </Card>

      {/* ── بيانات الوالدين (only when approved) ────────────── */}
      {parentsApproved && <ParentsSection />}

      {/* ── Primary CTA strip ────────────────────────────────── */}
      <Card className="border-teal-500 bg-teal-50/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-ar-display text-md font-bold text-ink-900">الخطوة التالية</p>
            <p className="mt-0.5 text-sm text-ink-500">{nextStepCaption(paid, parentsApproved, firstExamDate)}</p>
          </div>
          <Link to={primaryCta.to}>
            <Button variant={primaryCta.variant} size="lg" leadingIcon={primaryCta.leadingIcon}>
              {primaryCta.label}
            </Button>
          </Link>
        </div>
      </Card>

      {/* ── Instructions drawer ──────────────────────────────── */}
      <Drawer open={showInstructions} onClose={() => setShowInstructions(false)} title="إرشادات التقدم">
        <Drawer.Body>
          <div className="flex flex-col gap-3 text-sm leading-normal text-ink-800">
            <p>
              <strong>قبل التقدم:</strong> راجع البيانات المُسجَّلة على بوابة وزارة الداخلية، وتأكد من
              صحتها.
            </p>
            <p>
              <strong>أثناء التقدم:</strong> سيُطلب منك إدخال بيانات الدراسة بدقة. أي مخالفة قد تؤدي إلى
              منعك من الإختبار.
            </p>
            <p>
              <strong>مقابل الخدمة:</strong> ٢٥٠ جنيه — يُسدَّد مرة واحدة خلال الدورة الحالية.
            </p>
            <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
              احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم
              وولي الأمر.
            </p>
          </div>
        </Drawer.Body>
      </Drawer>
    </div>
  );

  function ParentsSection(): JSX.Element {
    return (
      <Card>
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Info size={14} strokeWidth={1.75} />
          </span>
          <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات الوالدين</h3>
          <Badge tone="success">
            <IconStamp width={11} height={11} className="me-1 inline-block" />
            معتمد
          </Badge>
        </header>
        <p className="text-sm text-ink-700">
          تم اعتماد بيانات الوالدين. يمكنك المتابعة لتحديد موعد الإختبار.
        </p>
      </Card>
    );
  }
}

function Row({
  label,
  value,
  ltr,
  mono,
  containerClassName,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
  containerClassName?: string;
}): JSX.Element {
  return (
    <div className={containerClassName}>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={'mt-0.5 text-sm font-medium text-ink-900 ' + (mono ? 'font-mono' : '')}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function nextStepCaption(paid: boolean, parentsApproved: boolean, firstExamDate: string | null): string {
  if (!paid) return 'لإتمام التقدم يلزم سداد مقابل الخدمة عبر كود فوري.';
  if (!parentsApproved) return 'بعد السداد يلزم إدراج واعتماد بيانات الوالدين قبل تحديد موعد الإختبار.';
  if (!firstExamDate) return 'البيانات مكتملة — اختر يوم اختبار قدرات من المواعيد المتاحة.';
  return 'البيانات مكتملة وموعد الإختبار محجوز. اطبع بطاقة التردد قبل الذهاب للأكاديمية.';
}
