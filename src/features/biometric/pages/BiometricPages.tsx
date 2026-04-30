import { useState } from 'react';
import { ScanFace, Fingerprint, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, EmptyState, Avatar } from '@/shared/components';
import { biometricService, type VerifyResult } from '../api/biometric.service';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';

export function BiometricVerifyPage(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'face' | 'fingerprint'>('face');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [nid, setNid] = useState(MOCK.applicants[0]!.nationalId);

  const handleVerify = async (): Promise<void> => {
    setBusy(true);
    setResult(null);
    try {
      const r = await biometricService.verify({ nationalId: nid });
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="التحقق البيومتري" subtitle="تحقق فوري من هوية المتقدم بالوجه أو البصمة" />

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="مدخل التحقق" actions={
            <div className="flex gap-2">
              <Button variant={mode === 'face' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('face')} leadingIcon={<ScanFace size={14} />}>الوجه</Button>
              <Button variant={mode === 'fingerprint' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('fingerprint')} leadingIcon={<Fingerprint size={14} />}>البصمة</Button>
            </div>
          } />
          <CardBody>
            <div className="biometric-scan" style={{ position: 'relative' }}>
              <div className="biometric-frame" style={{ position: 'relative' }}>
                {mode === 'face' ? <ScanFace size={88} color="#C9A961" /> : <Fingerprint size={88} color="#C9A961" />}
                {busy && <span className="scan-pulse" />}
              </div>
              <div className="biometric-status">{busy ? 'جارٍ المسح…' : 'جاهز للمسح'}</div>
              {result?.matchScore && <div className="biometric-match">{(result.matchScore * 100).toFixed(1)}% تطابق</div>}
            </div>

            <div className="mt-4">
              <div className="field">
                <label className="field-label">الرقم القومي للمتقدم</label>
                <input className="input mono" value={nid} onChange={(e) => setNid(e.target.value)} maxLength={14} />
              </div>
              <Button variant="primary" fullWidth className="mt-3" onClick={handleVerify} isLoading={busy}>
                بدء التحقق
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="نتيجة التحقق" />
          <CardBody>
            {!result ? (
              <EmptyState icon={<ScanFace size={32} />} title="لم يتم التحقق بعد" description="ابدأ مسحاً جديداً من اللوحة المجاورة" />
            ) : !result.ok ? (
              <div className="alert alert-danger">
                <ShieldAlert size={20} />
                <div className="alert-body">
                  <div className="alert-title">فشل التحقق</div>
                  <div>{result.reason}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="alert alert-success mb-4">
                  <ShieldCheck size={20} />
                  <div className="alert-body">
                    <div className="alert-title">تم التحقق بنجاح</div>
                    <div>درجة التطابق: {(result.matchScore! * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={result.applicant!.name} size="lg" />
                  <div>
                    <div className="font-bold">{result.applicant!.name}</div>
                    <div className="text-xs text-tertiary mono">{result.applicant!.id}</div>
                  </div>
                </div>
                <div className="detail-row"><span className="detail-label">الرقم القومي</span><span className="detail-value mono">{maskNationalId(result.applicant!.nationalId)}</span></div>
                <div className="detail-row"><span className="detail-label">التاريخ والوقت</span><span className="detail-value">{fmtDate(result.timestamp, 'full')}</span></div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function BiometricEnrollPage(): JSX.Element {
  const [step, setStep] = useState(0);
  const STEPS = ['تحديد المتقدم', 'مسح الوجه', 'مسح البصمة', 'الاعتماد'];
  return (
    <>
      <PageHeader title="تسجيل بصمة جديدة" subtitle="معالج خطوات لتسجيل بصمة وجه وبصمة إصبع لمتقدم" />
      <Card>
        <CardHeader title={`الخطوة ${step + 1} / ${STEPS.length}: ${STEPS[step]}`} />
        <CardBody>
          <div className="steps mb-6">
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'contents' }}>
                <div className={`step ${i < step ? 'done' : i === step ? 'current' : ''}`}>
                  <div className="step-dot">{i + 1}</div>
                  <span>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="step-line" />}
              </div>
            ))}
          </div>

          <div className="biometric-scan" style={{ position: 'relative' }}>
            <div className="biometric-frame" style={{ position: 'relative' }}>
              {step <= 1 ? <ScanFace size={88} color="#C9A961" /> : <Fingerprint size={88} color="#C9A961" />}
              <span className="scan-pulse" />
            </div>
            <div className="biometric-status">{STEPS[step]}</div>
          </div>

          <div className="flex justify-between mt-5">
            <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>السابق</Button>
            <Button variant="primary" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>التالي</Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export function BiometricHistoryPage(): JSX.Element {
  const rows = MOCK.applicants.slice(0, 20).map((a, i) => ({
    id: a.id,
    name: a.name,
    type: i % 2 === 0 ? 'face' : 'fingerprint',
    score: 0.9 + (i % 9) / 100,
    status: i % 7 === 0 ? 'failed' : 'success',
    ts: Date.now() - i * 1800_000,
  }));

  return (
    <>
      <PageHeader title="سجل التحقق البيومتري" subtitle={`آخر ${num(rows.length)} عمليات تحقق`} />
      <Card>
        <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>المتقدم</th>
                <th>نوع التحقق</th>
                <th>درجة التطابق</th>
                <th>النتيجة</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.id}-${i}`}>
                  <td>{shortName(r.name, 3)}</td>
                  <td>{r.type === 'face' ? <Badge tone="info"><ScanFace size={12} /> وجه</Badge> : <Badge tone="brand"><Fingerprint size={12} /> بصمة</Badge>}</td>
                  <td className="mono">{(r.score * 100).toFixed(1)}%</td>
                  <td>{r.status === 'success' ? <Badge tone="success">نجح</Badge> : <Badge tone="danger">فشل</Badge>}</td>
                  <td className="text-xs text-tertiary">{fmtDate(r.ts, 'rel')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
