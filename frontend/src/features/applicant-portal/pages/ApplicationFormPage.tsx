import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FileDown, Printer } from 'lucide-react';
import {
  Button,
  Card,
  LoadingState,
  PageHeader,
  PrintLayout,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useDraft } from '../api/applicantPortal.queries';
import { AdmissionFormSection } from '../components/AdmissionFormSection';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { deterministicFileNumber } from '../lib/deterministic-codes';
import {
  APPLICATION_FORM_ACTIONS,
  formatApplicationFormFilename,
} from '../lib/application-form-actions';

export function ApplicationFormPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const applicantId = moiSession?.applicantId ?? MOI_APPLICANT_SESSION.applicantId;
  const { data: draft, isLoading } = useDraft(applicantId);
  const fileNumber = deterministicFileNumber(applicantId);
  const filename = formatApplicationFormFilename(applicantId);
  const shouldPrint = searchParams.get('print') === '1';
  const shouldDownload = searchParams.get('download') === 'pdf';

  useEffect(() => {
    if (!draft || (!shouldPrint && !shouldDownload)) return;
    const previousTitle = document.title;
    if (shouldDownload) document.title = filename;
    const timer = window.setTimeout(() => {
      window.print();
      if (shouldDownload) toast('اختر "حفظ كـ PDF" من نافذة الطباعة لتنزيل الطلب.', 'info');
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 500);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      document.title = previousTitle;
    };
  }, [draft, filename, shouldDownload, shouldPrint]);

  if (isLoading || !draft) return <LoadingState variant="page" />;

  return (
    <div className="application-form-page mx-auto flex max-w-[230mm] flex-col gap-4">
      <div className="no-print">
        <PageHeader
          title="طلب الإلتحاق"
          subtitle="معاينة النسخة النهائية من طلب الإلتحاق بعد إتمام التقديم وحجز موعد الاختبار."
          breadcrumbs={[
            { label: 'بوابة المتقدم', href: ROUTES.applicant },
            { label: 'طلب الإلتحاق' },
          ]}
          actions={
            <Link to={ROUTES.applicant}>
              <Button
                variant="ghost"
                leadingIcon={<ArrowRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />}
              >
                العودة للملخص
              </Button>
            </Link>
          }
        />
      </div>

      <Card className="no-print">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-ar-display text-md font-bold text-ink-900">إجراءات الطلب النهائي</p>
            <p className="mt-1 text-sm text-ink-600">
              تحتوي النسخة المطبوعة على بيانات الطالب والدراسة والعائلة والإقرار وتوقيع الطالب وولي الأمر.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Printer size={14} strokeWidth={1.75} />}
              onClick={() => window.print()}
            >
              {APPLICATION_FORM_ACTIONS[1].label}
            </Button>
            <Button
              variant="primary"
              leadingIcon={<FileDown size={14} strokeWidth={1.75} />}
              onClick={() => {
                const previousTitle = document.title;
                document.title = filename;
                window.print();
                toast('اختر "حفظ كـ PDF" من نافذة الطباعة لتنزيل الطلب.', 'info');
                window.setTimeout(() => {
                  document.title = previousTitle;
                }, 500);
              }}
            >
              {APPLICATION_FORM_ACTIONS[2].label}
            </Button>
          </div>
        </div>
      </Card>

      <PrintLayout
        title="طلب الإلتحاق"
        subtitle="أكاديمية الشرطة · نسخة بيانات المتقدم النهائية"
        reportId={fileNumber}
        generatedAt={fmtDate(Date.now(), 'short')}
        className="application-form-print"
      >
        <AdmissionFormSection fileNumber={fileNumber} draft={draft} breakBefore={false} />
      </PrintLayout>
    </div>
  );
}
