/**
 * MedicalCertificatePage — master verdict aggregating 8 stations.
 * Source: RFP Scope Document §6.2.D + TIER 2 print polish.
 *
 * Polished print layout: stamped overall verdict box + per-station table
 * + chair signature blocks + medical commission seal placeholder.
 */

import { useState } from 'react';
import { CheckCircle2, Printer, Stethoscope, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  KhayameyaStripe,
  LoadingState,
  PageHeader,
  PrintLayout,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useQuery } from '@tanstack/react-query';
import { medicalService, STATION_LABELS, ALL_STATION_KEYS } from '../api/medical.service';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { LogoMark } from '@/shared/components';

const APPLICANT_NAME_DEMO = 'يوسف أحمد محمد الخطيب';
const APPLICANT_NID_DEMO = '30506121601234';

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
      ) : certQ.isError ? (
        <ErrorState error={certQ.error} onRetry={() => certQ.refetch()} />
      ) : !certQ.data ? (
        <EmptyState variant="generic" title="لا توجد بيانات" />
      ) : (
        <PrintLayout
          title="الشهادة الطبية النهائية"
          subtitle="قومسيون الخدمات الطبية — أكاديمية الشرطة"
          reportId={`MED-${applicantId}`}
          generatedAt={fmtDate(Date.now())}
        >
          {/* Identity block */}
          <div className="mb-5 grid grid-cols-3 gap-3 rounded-md border border-border-default bg-ink-50 p-4">
            <Field label="اسم المتقدم" value={APPLICANT_NAME_DEMO} />
            <Field label="الرقم القومي" value={APPLICANT_NID_DEMO} mono />
            <Field label="رقم الطلب" value={applicantId} mono />
          </div>

          {/* Verdict stamp */}
          <div
            className={
              'mb-6 flex items-center justify-between gap-3 rounded-lg border-2 p-4 ' +
              (certQ.data.overall === 'pass'
                ? 'border-success bg-success-bg'
                : certQ.data.overall === 'fail'
                  ? 'border-terra-500 bg-terra-50'
                  : certQ.data.overall === 'board-review'
                    ? 'border-gold-500 bg-gold-50'
                    : 'border-ink-300 bg-ink-50')
            }
          >
            <div className="flex items-center gap-3">
              {certQ.data.overall === 'pass' ? (
                <CheckCircle2 size={28} strokeWidth={1.75} className="text-success" aria-hidden />
              ) : certQ.data.overall === 'fail' ? (
                <XCircle size={28} strokeWidth={1.75} className="text-terra-600" aria-hidden />
              ) : (
                <Stethoscope size={28} strokeWidth={1.75} className="text-gold-700" aria-hidden />
              )}
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">الحكم العام للقومسيون</p>
                <p className="font-ar-display text-xl font-bold text-ink-900">
                  {certQ.data.overall === 'pass' && 'لائق طبياً'}
                  {certQ.data.overall === 'fail' && 'غير لائق طبياً'}
                  {certQ.data.overall === 'board-review' && 'يُحال إلى مراجعة الهيئة'}
                  {certQ.data.overall === 'incomplete' && 'الفحص غير مكتمل'}
                </p>
              </div>
            </div>
            <div className="text-end">
              <p className="font-mono text-2xs text-ink-500" dir="ltr">{fmtDate(Date.now(), 'short')}</p>
              <p className="mt-0.5 text-2xs text-ink-500">{formatHijri(new Date())} هـ</p>
            </div>
          </div>

          {/* Per-station table */}
          <Card>
            <CardHeader title="نتائج العيادات الثمانية" subtitle="بحسب ترتيب الكرّاسة §6.2.B" />
            <ol className="flex flex-col">
              {ALL_STATION_KEYS.map((s, i) => {
                const ps = certQ.data!.perStation[s];
                return (
                  <li key={s} className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-pill bg-teal-50 font-numeric tnum text-2xs font-bold text-teal-700">{i + 1}</span>
                      <Stethoscope size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
                      <span className="text-sm font-medium text-ink-900">{STATION_LABELS[s]}</span>
                    </div>
                    {ps ? (
                      <div className="flex items-center gap-4 text-2xs text-ink-500">
                        <span>{ps.doctor}</span>
                        <Badge tone={ps.verdict === 'pass' ? 'success' : ps.verdict === 'fail' ? 'danger' : 'warning'}>
                          {ps.verdict === 'pass' ? 'لائق' : ps.verdict === 'fail' ? 'غير لائق' : 'لائق بشرط'}
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

          {/* Auto-rule note */}
          <p className="mt-4 text-2xs text-ink-500 leading-normal">
            هذه الشهادة مولَّدة آلياً وفقاً لـ RFP Scope Document §6.2.D — أيّ حُكم «بشرط» يُحال إلى مراجعة الهيئة،
            وأيّ «غير لائق» في عيادة واحدة يُسقط الترشّح طبياً.
          </p>

          {/* Signature blocks */}
          <div className="mt-9 grid grid-cols-3 gap-6 text-2xs">
            <SignatureBlock title="رئيس قومسيون الخدمات الطبية" name="الرائد د. أحمد محمد الفقي" />
            <SignatureBlock title="أمين سرّ القومسيون" name="النقيب د. كريم زياد فاروق" />
            <SignatureBlock title="ختم الإدارة الطبية" />
          </div>

          <div className="mt-6">
            <KhayameyaStripe height="lg" />
          </div>
        </PrintLayout>
      )}
    </CenteredShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className={mono ? 'mt-0.5 font-mono text-sm text-ink-900' : 'mt-0.5 text-sm font-medium text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>{value}</p>
    </div>
  );
}

function SignatureBlock({ title, name }: { title: string; name?: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center text-center">
      {name ? (
        <>
          <span aria-hidden className="block h-12 w-full border-b border-dashed border-ink-700/60" />
          <p className="mt-2 font-medium text-ink-900">{title}</p>
          <p className="mt-0.5 text-ink-500">{name}</p>
        </>
      ) : (
        <>
          <LogoMark size={56} />
          <p className="mt-2 font-medium text-ink-900">{title}</p>
        </>
      )}
    </div>
  );
}

function formatHijri(d: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d).replace('هـ', '').trim();
  } catch {
    return '';
  }
}
