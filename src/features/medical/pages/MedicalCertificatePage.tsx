/**
 * MedicalCertificatePage — master verdict aggregating 8 stations.
 * Source: KARASA §6.2.D.
 */

import { useState } from 'react';
import { Printer, Stethoscope } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  PrintLayout,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useQuery } from '@tanstack/react-query';
import { medicalService, STATION_LABELS, ALL_STATION_KEYS } from '../api/medical.service';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';

export function MedicalCertificatePage(): JSX.Element {
  const [applicantId, setApplicantId] = useState('APP-2026000005');
  const certQ = useQuery({
    queryKey: ['medical', 'certificate', applicantId],
    queryFn: () => medicalService.getCertificate(applicantId),
    enabled: Boolean(applicantId),
  });

  return (
    <CenteredShell>
      <PageHeader
        title="الشهادة الطبية النهائية"
        subtitle="جامعة لكافة العيادات الثمانية مع الحكم العام للقومسيون"
        breadcrumbs={[
          { label: 'القومسيون الطبي', href: ROUTES.medical.overview },
          { label: 'الشهادة النهائية' },
        ]}
        actions={
          <Button variant="primary" leadingIcon={<Printer size={14} strokeWidth={1.75} />} onClick={() => window.print()}>
            طباعة الشهادة
          </Button>
        }
      />

      <Card className="mb-5 no-print">
        <Input label="رقم المتقدم" dir="ltr" value={applicantId} onChange={(e) => setApplicantId(e.target.value)} />
      </Card>

      {certQ.isLoading ? (
        <LoadingState variant="detail" />
      ) : !certQ.data ? (
        <EmptyState variant="generic" title="لا توجد بيانات" />
      ) : (
        <PrintLayout
          title={`الشهادة الطبية النهائية — ${applicantId}`}
          subtitle="قومسيون الخدمات الطبية - أكاديمية الشرطة"
          reportId={`MED-${applicantId}`}
          generatedAt={fmtDate(Date.now())}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="font-medium">الحكم العام:</p>
            {certQ.data.overall === 'pass' && <Badge tone="success">لائق طبياً</Badge>}
            {certQ.data.overall === 'fail' && <Badge tone="danger">غير لائق</Badge>}
            {certQ.data.overall === 'board-review' && <Badge tone="warning">يُحال إلى مراجعة الهيئة</Badge>}
            {certQ.data.overall === 'incomplete' && <Badge tone="neutral">الفحص غير مكتمل</Badge>}
          </div>

          <Card>
            <CardHeader title="نتائج العيادات" subtitle="مرتبة بحسب رقم العيادة في القومسيون" />
            <ol className="flex flex-col">
              {ALL_STATION_KEYS.map((s) => {
                const ps = certQ.data!.perStation[s];
                return (
                  <li key={s} className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
                      <span className="text-sm font-medium text-ink-900">{STATION_LABELS[s]}</span>
                    </div>
                    {ps ? (
                      <div className="flex items-center gap-3 text-2xs text-ink-500">
                        <span>{ps.doctor}</span>
                        <Badge tone={ps.verdict === 'pass' ? 'success' : ps.verdict === 'fail' ? 'danger' : 'warning'}>
                          {ps.verdict === 'pass' ? 'لائق' : ps.verdict === 'fail' ? 'غير لائق' : 'بشرط'}
                        </Badge>
                      </div>
                    ) : (
                      <Badge tone="neutral">لم يُفحص بعد</Badge>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <p className="mt-6 text-2xs text-ink-500">
            هذه الشهادة مولّدة آلياً وفقاً لـ KARASA §6.2.D — أي حُكم «بشرط» يُحال إلى مراجعة الهيئة، وأي «غير لائق» في عيادة واحدة يُسقط الترشّح طبياً.
          </p>
        </PrintLayout>
      )}
    </CenteredShell>
  );
}
