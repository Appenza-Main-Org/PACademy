import { useState } from 'react';
import { CalendarRange, Hash, Printer, Search, Sparkles, User } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, EmptyState, KhayameyaStripe, Code128Barcode, LogoMark } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';
import { barcodeService } from '../api/barcode.service';
import type { Applicant, BarcodeRecord } from '@/shared/types/domain';

/**
 * Build the pipe-delimited Code 128B payload for an applicant card.
 * Format: PA|{applicantId}|{nationalId}|{cardCode}|{committee}
 */
function buildPayload(applicant: Applicant, cardCode: string): string {
  return ['PA', applicant.id, applicant.nationalId, cardCode, `C${applicant.committee}`].join('|');
}

export function BarcodeGeneratePage(): JSX.Element {
  const [applicantId, setApplicantId] = useState(MOCK.applicants[0]!.id);
  const [record, setRecord] = useState<BarcodeRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const applicant = MOCK.applicants.find((a) => a.id === applicantId);

  const handleGenerate = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await barcodeService.generate(applicantId);
      setRecord(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="إنشاء كارت تردد"
        subtitle="توليد باركود فريد لكل متقدم لاستخدامه في كل المراحل · يربط بين العيادات واللجان والامتحانات"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader
            title="اختيار المتقدم"
            subtitle="حدّد المتقدم لتوليد كارت التردد الخاص به"
            actions={<Badge tone="info" icon={<Sparkles size={11} strokeWidth={1.75} />}>توليد آلي</Badge>}
          />
          <CardBody>
            <div className="filters">
              <select className="select flex-1" value={applicantId} onChange={(e) => { setApplicantId(e.target.value); setRecord(null); }}>
                {MOCK.applicants.slice(0, 30).map((a) => (
                  <option key={a.id} value={a.id}>{a.id} — {shortName(a.name, 3)}</option>
                ))}
              </select>
            </div>
            {applicant && (
              <div className="mt-3 mb-4 rounded-md border border-border-subtle bg-ink-50 p-3">
                <div className="grid grid-cols-2 gap-2 text-2xs">
                  <FieldRow label="الاسم بالكامل" value={applicant.name} />
                  <FieldRow label="الرقم القومي" value={maskNationalId(applicant.nationalId)} mono />
                  <FieldRow label="المحافظة" value={applicant.governorate} />
                  <FieldRow label="اللجنة" value={`اللجنة ${applicant.committee}`} />
                </div>
              </div>
            )}
            <Button variant="primary" onClick={handleGenerate} isLoading={busy} fullWidth>
              توليد كارت التردد
            </Button>

            <div className="mt-4 rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
              <p className="font-bold mb-1">عن كارت التردد</p>
              <p className="leading-normal">
                كارت التردد هو الهوية الموحّدة للمتقدم داخل أكاديمية الشرطة طوال فترة الفحوصات.
                يُستخدم في جميع العيادات الـ8 واللجان الـ5 وفي تسجيل الحضور الإلكتروني.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="معاينة الكارت"
            subtitle={record ? `صادر بتاريخ ${fmtDate(record.issuedAt, 'short')}` : 'لم يتم التوليد بعد'}
            actions={record && <Button variant="secondary" size="sm" leadingIcon={<Printer size={14} strokeWidth={1.75} />} onClick={() => window.print()}>طباعة</Button>}
          />
          <CardBody>
            {!record ? (
              <EmptyState title="لا يوجد كارت" description="اختر متقدماً واضغط على «توليد كارت التردد»" />
            ) : (
              <div className="mx-auto max-w-md overflow-hidden rounded-lg border bg-white shadow-md" style={{ borderColor: 'var(--accent-500)', borderWidth: 2 }}>
                {/* Header strip */}
                <div className="px-4 py-3 text-white" style={{ background: 'var(--accent-700)' }}>
                  <p className="font-ar-display text-sm font-bold">أكاديمية الشرطة · منظومة القبول</p>
                  <p className="text-2xs text-white/75">كارت تردد رسمي · دورة 2026</p>
                </div>

                {/* Card body */}
                <div className="grid grid-cols-[auto_1fr] gap-3 p-4">
                  <div className="flex h-24 w-20 flex-col items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50 text-2xs text-ink-500">
                    <User size={28} strokeWidth={1.5} aria-hidden />
                    <span className="mt-1">صورة</span>
                  </div>
                  <div className="flex flex-col justify-between text-2xs">
                    <div>
                      <p className="text-ink-500">الاسم</p>
                      <p className="text-sm font-bold text-ink-900">{applicant?.name ?? ''}</p>
                    </div>
                    <div>
                      <p className="text-ink-500">رقم الطلب</p>
                      <p className="font-mono text-sm font-bold text-ink-900" dir="ltr">{applicantId}</p>
                    </div>
                    <div>
                      <p className="text-ink-500">المحافظة · اللجنة</p>
                      <p className="text-ink-700">{applicant?.governorate} · لجنة {applicant?.committee}</p>
                    </div>
                  </div>
                </div>

                {/* Barcode strip — real Code 128B carrying the card payload */}
                <div className="flex flex-col items-center gap-1 bg-ink-50 px-4 py-3 text-center">
                  <Code128Barcode
                    value={applicant ? buildPayload(applicant, record.code) : record.code}
                    height={56}
                    moduleWidth={1.4}
                    showText={false}
                  />
                  <p className="mt-1 font-mono text-xs text-ink-700" dir="ltr">{record.code.replace(/(.{4})/g, '$1 ').trim()}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-2xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Hash size={11} strokeWidth={1.75} />
                    <span className="font-mono" dir="ltr">{record.code}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <LogoMark size={16} />
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange size={11} strokeWidth={1.75} />
                      صالح حتى {fmtDate(record.issuedAt + 90 * 86_400_000, 'short')}
                    </span>
                  </span>
                </div>

                {/* Khayameya stripe */}
                <KhayameyaStripe height="md" />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div>
      <p className="text-ink-500">{label}</p>
      <p className={mono ? 'mt-0.5 font-mono text-sm font-medium text-ink-900' : 'mt-0.5 text-sm font-medium text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>{value}</p>
    </div>
  );
}

export function BarcodeLookupPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<typeof MOCK.applicants[number] | null>(null);

  const handleLookup = async (): Promise<void> => {
    const r = await barcodeService.lookup(query);
    setTarget(r.applicant);
  };

  return (
    <>
      <PageHeader title="استعلام بالباركود" subtitle="أدخل كود الكارت للوصول السريع لملف المتقدم" />
      <Card>
        <CardBody>
          <div className="filters">
            <div className="search flex-1">
              <input className="input" placeholder="أدخل كود الباركود…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Search size={18} />
            </div>
            <Button variant="primary" onClick={handleLookup}>استعلام</Button>
          </div>
          {target && (
            <div className="mt-4 grid grid-2">
              <div className="detail-row"><span className="detail-label">الاسم</span><span className="detail-value">{target.name}</span></div>
              <div className="detail-row"><span className="detail-label">كود التقدم</span><span className="detail-value mono">{target.id}</span></div>
              <div className="detail-row"><span className="detail-label">المحافظة</span><span className="detail-value">{target.governorate}</span></div>
              <div className="detail-row"><span className="detail-label">المرحلة</span><span className="detail-value"><Badge tone="info">{target.stageLabel}</Badge></span></div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

export function BarcodeBatchPage(): JSX.Element {
  return (
    <>
      <PageHeader title="دفعة كروت" subtitle="توليد كروت لمجموعة متقدمين دفعة واحدة" />
      <Card>
        <CardBody>
          <div className="alert alert-info mb-5">
            <span className="alert-icon">ℹ️</span>
            <div className="alert-body">يمكن طباعة دفعة كاملة (40 كارت في الصفحة الواحدة) لتوزيعها على لجان الفحص.</div>
          </div>
          <div className="grid grid-cols-auto" style={{ gap: 12 }}>
            {MOCK.applicants.slice(0, 12).map((a) => {
              const cardCode = `26-CAI-${a.id.replace('APP-', '').padStart(8, '0')}`;
              return (
                <div key={a.id} className="barcode-display flex flex-col items-center gap-1">
                  <div className="text-xs text-tertiary mb-2">{shortName(a.name, 2)}</div>
                  <Code128Barcode
                    value={buildPayload(a, cardCode)}
                    height={44}
                    moduleWidth={1}
                    showText={false}
                  />
                  <div className="barcode-num">{cardCode.replace(/(.{4})/g, '$1 ').trim()}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" leadingIcon={<Printer size={16} />}>طباعة {num(12)} كارت</Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
