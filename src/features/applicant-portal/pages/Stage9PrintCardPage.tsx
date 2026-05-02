/**
 * Stage 9 — attendance card with barcode (KARASA §2.2 stage 9).
 * Renders the printable card; "barcode" rendered as an inline-SVG bar pattern.
 */

import { Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, KhayameyaStripe, PrintLayout } from '@/shared/components';
import { IconBarcode } from '@/shared/components/icons';
import { useDraft } from '../api/applicantPortal.queries';
import { date as fmtDate } from '@/shared/lib/format';

const APPLICANT_ID = 'APP-2026000';

export function Stage9PrintCardPage(): JSX.Element {
  const navigate = useNavigate();
  const { data: draft } = useDraft(APPLICANT_ID);
  const slot = draft?.examSlot;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between no-print">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">طباعة كارت التردد</h2>
          <p className="text-sm text-ink-500">
            احتفظ بالكارت معك يوم الاختبار. الكارت يحوي باركود لتسجيل الحضور.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            leadingIcon={<Printer size={14} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            طباعة
          </Button>
          <Button variant="ghost" onClick={() => navigate('/applicant/follow-up')}>
            تخطّي
          </Button>
        </div>
      </Card>

      <PrintLayout
        title="كارت تردد المتقدم"
        reportId={APPLICANT_ID}
        generatedAt={fmtDate(Date.now(), 'short')}
      >
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 flex flex-col gap-3 text-sm">
            <Field label="رقم المتقدم" value={APPLICANT_ID} mono />
            <Field label="موعد الاختبار" value={slot ? `${fmtDate(slot.date, 'full')} - ${slot.time}` : '—'} />
            <Field label="مكان الاختبار" value={slot?.location ?? '—'} />
            <Field label="المستندات المطلوبة" value="بطاقة الرقم القومي · أصل الشهادة · 4 صور شخصية حديثة" />
          </div>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-default p-3">
            <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-ink-100 text-ink-500">
              صورة
            </span>
            <p className="text-xs text-ink-500">الصورة الشخصية</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-card p-4">
          <IconBarcode width={32} height={32} />
          <span className="font-mono text-lg" dir="ltr">{APPLICANT_ID}</span>
        </div>

        <div className="mt-4">
          <KhayameyaStripe height="md" />
        </div>
      </PrintLayout>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border-subtle pb-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className={mono ? 'font-mono text-ink-900' : 'text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>
        {value}
      </dd>
    </div>
  );
}
