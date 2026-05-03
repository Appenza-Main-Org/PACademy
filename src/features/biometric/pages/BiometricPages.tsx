import { useState } from 'react';
import { CheckCircle2, ScanFace, Fingerprint, Search, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, EmptyState, Avatar, Input, toast } from '@/shared/components';
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
                {mode === 'face' ? <ScanFace size={88} color="var(--gold-300)" /> : <Fingerprint size={88} color="var(--gold-300)" />}
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
  const [nid, setNid] = useState('');
  const [scanning, setScanning] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [fpCaptured, setFpCaptured] = useState(false);

  const STEPS = [
    { label: 'تحديد المتقدم', desc: 'أدخل الرقم القومي للتحقق من بياناته' },
    { label: 'مسح الوجه', desc: 'التقاط 6 زوايا — وضوح ≥ 80%' },
    { label: 'مسح البصمة', desc: 'بصمة السبّابة لليد اليمنى — تطابق ≥ 96%' },
    { label: 'الاعتماد والحفظ', desc: 'مراجعة العيّنات وحفظها بقاعدة البيانات' },
  ];

  const applicant = MOCK.applicants.find((a) => a.nationalId === nid) ?? MOCK.applicants[0]!;

  const simulateScan = (kind: 'face' | 'fp'): void => {
    setScanning(true);
    setTimeout(() => {
      if (kind === 'face') setFaceCaptured(true);
      else setFpCaptured(true);
      setScanning(false);
    }, 1500);
  };

  const canAdvance =
    (step === 0 && nid.length === 14) ||
    (step === 1 && faceCaptured) ||
    (step === 2 && fpCaptured) ||
    step === 3;

  return (
    <>
      <PageHeader title="تسجيل بصمة جديدة" subtitle="معالج 4 خطوات: تحديد ← وجه ← بصمة ← اعتماد" />

      <Card>
        <CardBody>
          {/* Step indicator */}
          <ol className="mb-6 grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s.label} className="flex flex-col items-center text-center">
                  <span
                    aria-hidden
                    className={
                      'mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors duration-fast ' +
                      (done ? 'bg-success text-white'
                        : current ? 'bg-teal-500 text-white ring-4 ring-teal-100'
                        : 'bg-ink-100 text-ink-500')
                    }
                  >
                    {done ? <CheckCircle2 size={16} strokeWidth={2.2} /> : i + 1}
                  </span>
                  <p className={'text-2xs font-medium ' + (current ? 'text-teal-700' : done ? 'text-ink-900' : 'text-ink-500')}>{s.label}</p>
                </li>
              );
            })}
          </ol>

          {/* Step body */}
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <Input
                  label="الرقم القومي"
                  dir="ltr"
                  maxLength={14}
                  value={nid}
                  onChange={(e) => setNid(e.target.value.replace(/\D/g, ''))}
                  helper="14 رقماً — يتم التحقق فوراً عبر منصة MOIPASS"
                  trailingIcon={<Search size={14} strokeWidth={1.75} />}
                />
                {nid.length === 14 && (
                  <div className="mt-3 rounded-md border border-success bg-success-bg/30 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={applicant.name} size="lg" />
                      <div className="flex-1">
                        <p className="font-bold text-ink-900">{applicant.name}</p>
                        <p className="text-2xs text-ink-500 font-mono" dir="ltr">{applicant.id}</p>
                      </div>
                      <Badge tone="success" icon={<ShieldCheck size={11} strokeWidth={1.75} />}>تم التحقق</Badge>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-md border border-border-subtle bg-ink-50 p-4 text-2xs text-ink-700">
                <p className="font-bold text-ink-900 mb-1">قبل البدء</p>
                <ul className="space-y-1 list-disc pe-4">
                  <li>تأكّد من حضور المتقدم</li>
                  <li>طابق الصورة بالبطاقة</li>
                  <li>اطلب رفع غطاء الرأس إن وُجد</li>
                </ul>
              </div>
            </div>
          )}

          {(step === 1 || step === 2) && (
            <BiometricCapture
              kind={step === 1 ? 'face' : 'fp'}
              captured={step === 1 ? faceCaptured : fpCaptured}
              scanning={scanning}
              onScan={() => simulateScan(step === 1 ? 'face' : 'fp')}
              applicant={applicant}
            />
          )}

          {step === 3 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-success bg-success-bg/30 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={applicant.name} size="lg" />
                  <div className="flex-1">
                    <p className="font-bold text-ink-900">{applicant.name}</p>
                    <p className="text-2xs text-ink-500 font-mono" dir="ltr">{applicant.id}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-2 text-2xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-ink-700"><ScanFace size={12} strokeWidth={1.75} /> مسح الوجه</span>
                    <Badge tone="success" icon={<CheckCircle2 size={10} strokeWidth={2.2} />}>92.4% وضوح</Badge>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-ink-700"><Fingerprint size={12} strokeWidth={1.75} /> بصمة الإصبع</span>
                    <Badge tone="success" icon={<CheckCircle2 size={10} strokeWidth={2.2} />}>98.1% تطابق</Badge>
                  </li>
                </ul>
              </div>
              <div className="rounded-md border border-gold-300 bg-gold-50 p-4 text-2xs">
                <p className="font-bold text-gold-700 mb-2">جاهز للحفظ</p>
                <p className="text-gold-700/85 leading-normal">
                  سيتم تسجيل العيّنات بقاعدة بيانات المنظومة المركزية، ولا يمكن إعادة التسجيل إلا
                  بطلب رسمي من رئيس الإدارة. آخر دخول للنظام:
                  <span className="ms-1 font-mono" dir="ltr">{fmtDate(Date.now(), 'short')}</span>.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
            <p className="text-2xs text-ink-500">{STEPS[step]?.desc}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>السابق</Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" disabled={!canAdvance} onClick={() => setStep(step + 1)}>التالي</Button>
              ) : (
                <Button variant="primary" leadingIcon={<ShieldCheck size={14} strokeWidth={1.75} />} onClick={() => toast('تم اعتماد البصمة وحفظها بنجاح', 'success')}>اعتماد وحفظ</Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function BiometricCapture({
  kind,
  captured,
  scanning,
  onScan,
  applicant,
}: {
  kind: 'face' | 'fp';
  captured: boolean;
  scanning: boolean;
  onScan: () => void;
  applicant: { name: string; id: string };
}): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
      <div className="biometric-scan" style={{ position: 'relative' }}>
        <div className="biometric-frame" style={{ position: 'relative' }}>
          {kind === 'face' ? <ScanFace size={88} color="var(--gold-300)" /> : <Fingerprint size={88} color="var(--gold-300)" />}
          {scanning && <span className="scan-pulse" />}
        </div>
        <div className="biometric-status">
          {scanning ? 'جارٍ المسح…' : captured ? 'تمّ الالتقاط بنجاح' : 'جاهز للمسح'}
        </div>
        {captured && (
          <Badge tone="success" className="mt-3" icon={<Sparkles size={11} strokeWidth={1.75} />}>
            {kind === 'face' ? 'وضوح 92.4% · إضاءة جيدة' : 'تطابق 98.1% · جودة عالية'}
          </Badge>
        )}
        <Button variant={captured ? 'secondary' : 'primary'} className="mt-4" onClick={onScan} disabled={scanning}>
          {captured ? 'إعادة المسح' : 'بدء المسح'}
        </Button>
      </div>
      <div className="rounded-md border border-border-subtle bg-ink-50 p-4 text-2xs">
        <p className="mb-2 font-bold text-ink-900">المتقدم</p>
        <div className="flex items-center gap-2 mb-3">
          <Avatar name={applicant.name} size="md" />
          <div>
            <p className="font-medium text-ink-900">{applicant.name}</p>
            <p className="font-mono text-ink-500" dir="ltr">{applicant.id}</p>
          </div>
        </div>
        <p className="font-bold text-ink-900 mb-1">إرشادات</p>
        <ul className="space-y-1 list-disc pe-4 text-ink-700">
          {kind === 'face' ? (
            <>
              <li>وجِّه الكاميرا للوجه مباشرة</li>
              <li>يجب أن يكون الوجه مكشوفاً</li>
              <li>إضاءة طبيعية بدون انعكاس</li>
              <li>تتم 6 لقطات تلقائياً من 6 زوايا</li>
            </>
          ) : (
            <>
              <li>ضع السبّابة اليمنى على القارئ</li>
              <li>اضغط برفق دون تحريك</li>
              <li>الإصبع نظيف وجاف</li>
              <li>نظام AFIS يقارن مع 6 زوايا تلقائياً</li>
            </>
          )}
        </ul>
      </div>
    </div>
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
