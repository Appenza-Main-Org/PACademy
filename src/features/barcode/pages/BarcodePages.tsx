import { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, EmptyState } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';
import { barcodeService } from '../api/barcode.service';
import type { BarcodeRecord } from '@/shared/types/domain';

function BarcodeBars({ code }: { code: string }): JSX.Element {
  const widths = code.split('').flatMap((ch) => {
    const c = ch.charCodeAt(0);
    return [(c % 4) + 1, ((c >> 2) % 3) + 1, ((c >> 4) % 4) + 1];
  });
  return (
    <div className="barcode-bars">
      {widths.map((w, i) => (
        <span key={i} className="barcode-bar" style={{ width: w }} />
      ))}
    </div>
  );
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
      <PageHeader title="إنشاء كارت تردد" subtitle="توليد باركود فريد لكل متقدم لاستخدامه في كل المراحل" />

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="اختيار المتقدم" />
          <CardBody>
            <div className="filters">
              <select className="select flex-1" value={applicantId} onChange={(e) => { setApplicantId(e.target.value); setRecord(null); }}>
                {MOCK.applicants.slice(0, 30).map((a) => (
                  <option key={a.id} value={a.id}>{a.id} — {shortName(a.name, 3)}</option>
                ))}
              </select>
            </div>
            {applicant && (
              <div className="flex flex-col gap-2 text-sm mb-4">
                <div className="detail-row"><span className="detail-label">الاسم</span><span className="detail-value">{applicant.name}</span></div>
                <div className="detail-row"><span className="detail-label">الرقم القومي</span><span className="detail-value mono">{maskNationalId(applicant.nationalId)}</span></div>
                <div className="detail-row"><span className="detail-label">المحافظة</span><span className="detail-value">{applicant.governorate}</span></div>
                <div className="detail-row"><span className="detail-label">اللجنة</span><span className="detail-value">اللجنة {applicant.committee}</span></div>
              </div>
            )}
            <Button variant="primary" onClick={handleGenerate} isLoading={busy} fullWidth>توليد الباركود</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="كارت التردد" subtitle={record ? `صادر بتاريخ ${fmtDate(record.issuedAt, 'short')}` : 'لم يتم التوليد بعد'} />
          <CardBody>
            {!record ? (
              <EmptyState title="لا يوجد كارت" description="اختر متقدماً واضغط على «توليد الباركود»" />
            ) : (
              <div className="barcode-display">
                <div className="font-bold text-md mb-2">منظومة القبول · أكاديمية الشرطة</div>
                <div className="text-xs text-tertiary mb-4">{shortName(applicant?.name ?? '', 3)} — {applicantId}</div>
                <BarcodeBars code={record.code} />
                <div className="barcode-num">{record.code.replace(/(.{4})/g, '$1 ').trim()}</div>
                <div className="text-xs text-tertiary mt-3">صالح حتى {fmtDate(record.issuedAt + 90 * 86_400_000, 'short')}</div>
                <div className="mt-4 flex justify-center">
                  <Button variant="secondary" leadingIcon={<Printer size={16} />}>طباعة الكارت</Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
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
            {MOCK.applicants.slice(0, 12).map((a) => (
              <div key={a.id} className="barcode-display">
                <div className="text-xs text-tertiary mb-2">{shortName(a.name, 2)}</div>
                <BarcodeBars code={a.id.replace('APP-', '')} />
                <div className="barcode-num">{a.id.replace('APP-', '').replace(/(.{4})/g, '$1 ').trim()}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" leadingIcon={<Printer size={16} />}>طباعة {num(12)} كارت</Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
