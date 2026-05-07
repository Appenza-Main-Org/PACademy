/**
 * ApplicantPortalPage — index landing of the applicant portal.
 * Shown when the user lands on /applicant before picking a stage.
 */

import { Link } from 'react-router-dom';
import { Bell, Calendar, ClipboardList, FileText, GraduationCap, HelpCircle, Mail, Phone, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components';
import { useDraft } from '../api/applicantPortal.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { date as fmtDate } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useApplicantNotifications } from '@/features/admin';

const APPLICANT_ID = 'APP-2026000';

export function ApplicantPortalPage(): JSX.Element {
  const { data: draft } = useDraft(APPLICANT_ID);
  const { data: notifications = [] } = useApplicantNotifications(APPLICANT_ID);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const next = nextStagePath(draft?.furthestStage ?? 0);
  const hasStartedApplication = Boolean(selectedCategoryKey);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-ar-display text-2xl font-bold text-ink-900">
              أهلاً بك في منظومة القبول الإلكتروني
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              تابع كل مراحل تقدمك من تسجيل الطلب وحتى ظهور النتيجة النهائية.
            </p>
            <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs text-ink-500">
              <li className="inline-flex items-center gap-1">
                <Calendar size={12} strokeWidth={1.75} />
                {fmtDate(Date.now(), 'short')}
              </li>
              <li className="inline-flex items-center gap-1">
                <GraduationCap size={12} strokeWidth={1.75} />
                <span dir="ltr" className="font-mono">{APPLICANT_ID}</span>
              </li>
              <li className="inline-flex items-center gap-1">
                <ShieldCheck size={12} strokeWidth={1.75} />
                <Badge tone="success">حساب مفعّل</Badge>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {!hasStartedApplication && (
              <Link to={ROUTES.applicantStart}>
                <Button variant="primary" size="lg">
                  ابدأ التقديم
                </Button>
              </Link>
            )}
            {hasStartedApplication && (
              <Link to={`${ROUTES.applicant}/${next.path}`}>
                <Button variant="primary" size="lg">
                  {next.label}
                </Button>
              </Link>
            )}
            <Link to={ROUTES.applicantTests}>
              <Button
                variant="secondary"
                leadingIcon={<ClipboardList size={14} strokeWidth={1.75} />}
              >
                مواعيد الاختبارات
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {notifications.length > 0 && (
        <section>
          <h2 className="mb-3 inline-flex items-center gap-2 font-ar-display text-md font-bold text-ink-900">
            <Bell size={18} strokeWidth={1.75} />
            إشعارات النظام
          </h2>
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <Card key={n.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{n.titleAr}</p>
                    <p className="mt-1 text-sm leading-normal text-ink-700">{n.bodyAr}</p>
                    <p className="mt-2 text-2xs text-ink-500">
                      منشور في {fmtDate(n.publishAt, 'short')}
                      {n.expireAt && ` · ينتهي ${fmtDate(n.expireAt, 'short')}`}
                    </p>
                  </div>
                  <Badge tone={n.type === 'general' ? 'neutral' : 'info'}>
                    {n.type === 'general'
                      ? 'عام'
                      : n.type === 'student'
                      ? 'موجه لك'
                      : n.type === 'category'
                      ? 'فئة'
                      : n.type === 'committee'
                      ? 'لجنة'
                      : 'قسم'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 font-ar-display text-md font-bold text-ink-900">
          <HelpCircle size={18} strokeWidth={1.75} />
          الدعم والمساعدة
        </h2>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <SupportCard icon={<Phone size={18} strokeWidth={1.75} />} title="الخط الساخن" body="19000" hint="الأحد إلى الخميس · 9 ص — 9 م" />
          <SupportCard icon={<Mail size={18} strokeWidth={1.75} />} title="البريد الإلكتروني" body="support@police-academy.gov.eg" hint="ردنا خلال 24 ساعة عمل" />
          <SupportCard icon={<FileText size={18} strokeWidth={1.75} />} title="الأسئلة الشائعة" body="مكتبة الإجابات" hint="مفهرسة بحسب مرحلة التقدم" />
        </div>
      </section>
    </div>
  );
}

function nextStagePath(furthestStage: number): { path: string; label: string } {
  const stages = [
    { path: 'auth/step-1', label: 'ابدأ التسجيل' },
    { path: 'auth/step-2', label: 'استكمل التحقق' },
    { path: 'profile/personal', label: 'أكمل البيانات الشخصية' },
    { path: 'profile/education', label: 'أدخل البيانات التعليمية' },
    { path: 'profile/marital', label: 'حدّد الحالة الاجتماعية' },
    { path: 'payment', label: 'سدّد رسوم التقديم' },
    { path: 'profile/family', label: 'أكمل بيانات الأسرة' },
    { path: 'exam-schedule', label: 'احجز موعد الاختبار' },
    { path: 'print-card', label: 'اطبع كارت التردد' },
    { path: 'follow-up', label: 'تابع إجراءاتك' },
    { path: 'acquaintance-doc', label: 'وثيقة التعارف' },
  ];
  const idx = Math.min(stages.length - 1, Math.max(0, furthestStage));
  return stages[idx]!;
}

function SupportCard({
  icon,
  title,
  body,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  hint: string;
}): JSX.Element {
  return (
    <Card>
      <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
        {icon}
      </span>
      <p className="text-md font-bold text-ink-900">{title}</p>
      <p className="mt-1 font-mono text-sm text-ink-700" dir="ltr">{body}</p>
      <p className="mt-1 text-2xs text-ink-500">{hint}</p>
    </Card>
  );
}
