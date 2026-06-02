import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DoorClosed,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  History,
  IdCard,
  Link2,
  RotateCcw,
  ScanBarcode,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { BarChart } from '@/shared/components/charts';
import { date as fmtDate, maskNationalId, num, shortName } from '@/shared/lib/format';
import { biometricService } from '../api/biometric.service';
import type {
  BiometricApplicantLookup,
  BiometricAuditLog,
  BiometricPresence,
  EnrollmentStatus,
  ExportFormat,
  GateLog,
  SearchField,
  VerificationLog,
  VerificationMethod,
  VerificationModule,
  VerificationStatus,
  VerifyResult,
} from '../api/biometric.service';

const STATUS_LABEL: Record<VerificationStatus, string> = {
  match: 'تطابق',
  no_match: 'عدم تطابق',
  not_enrolled: 'غير مسجل',
  manual_review_required: 'مراجعة يدوية',
};

const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  enrolled: 'مسجل بالكامل',
  partial: 'تسجيل جزئي',
  not_enrolled: 'غير مسجل',
};

const MODULE_LABEL: Record<VerificationModule, string> = {
  'security-gate': 'بوابة التأمين',
  'exam-committee': 'لجنة الاختبار',
  'admissions-committee': 'لجنة القبول',
  'medical-commission': 'القومسيون الطبي',
  'medical-clinic': 'العيادة الطبية',
};

const METHOD_OPTIONS: ReadonlyArray<{ value: VerificationMethod; label: string }> = [
  { value: 'fingerprint', label: 'البصمة' },
  { value: 'face', label: 'صورة الوجه' },
  { value: 'barcode', label: 'الباركود' },
];

const AUDIT_LABEL: Record<BiometricAuditLog['action'], string> = {
  enrollment: 'تسجيل بيومتري',
  re_enrollment: 'إعادة تسجيل',
  link_previous: 'ربط بيانات سابقة',
  verification: 'تحقق',
  failed_verification: 'تحقق فاشل',
  manual_review: 'مراجعة يدوية',
  gate_entry: 'دخول بوابة',
  gate_exit: 'خروج بوابة',
};

const SEARCH_OPTIONS: ReadonlyArray<{ value: SearchField; label: string }> = [
  { value: 'barcode', label: 'الباركود' },
  { value: 'nationalId', label: 'الرقم القومي' },
  { value: 'name', label: 'اسم المتقدم' },
  { value: 'applicantNumber', label: 'رقم المتقدم' },
];

function statusTone(status: VerificationStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'match') return 'success';
  if (status === 'no_match') return 'danger';
  if (status === 'manual_review_required') return 'warning';
  return 'neutral';
}

function enrollmentTone(status: EnrollmentStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'enrolled') return 'success';
  if (status === 'partial') return 'warning';
  return 'neutral';
}

function methodLabel(method: VerificationMethod): string {
  if (method === 'face') return 'صورة الوجه';
  if (method === 'fingerprint') return 'البصمة';
  return 'الباركود';
}

function speakVoiceAlerts(alerts: readonly string[] = []): void {
  if (alerts.length === 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  for (const alert of alerts) {
    const utterance = new SpeechSynthesisUtterance(alert);
    utterance.lang = 'ar-EG';
    window.speechSynthesis.speak(utterance);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function VerificationResultPanel({ result }: { result: VerifyResult | null }): JSX.Element {
  if (!result) {
    return <EmptyState icon={<ScanFace size={32} />} title="لم يتم التحقق بعد" description="ابدأ عملية تحقق لعرض النتيجة" />;
  }

  return (
    <div className="space-y-4">
      <div className={result.ok ? 'alert alert-success' : result.status === 'no_match' ? 'alert alert-danger' : 'alert alert-warning'}>
        {result.ok ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        <div className="alert-body">
          <div className="alert-title">{STATUS_LABEL[result.status]}</div>
          <div>{result.reason ?? (result.canContinue ? 'يسمح باستكمال الاختبار' : 'لا يسمح باستكمال الإجراء قبل المراجعة')}</div>
        </div>
      </div>

      {result.applicant && (
        <ApplicantSummaryCard lookup={result.applicant} compact />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="النتيجة" value={STATUS_LABEL[result.status]} />
        <Metric label="درجة التطابق" value={result.matchScore ? `${Math.round(result.matchScore * 100)}%` : 'غير متاح'} />
        <Metric label="وقت التحقق" value={fmtDate(result.timestamp, 'short')} />
      </div>
    </div>
  );
}

function ApplicantSummaryCard({ lookup, compact = false }: { lookup: BiometricApplicantLookup; compact?: boolean }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 p-4">
      <div className="flex items-start gap-3">
        <Avatar name={lookup.applicant.name} src={lookup.applicant.photo ?? undefined} size={compact ? 'lg' : 'xl'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink-900">{lookup.applicant.name}</p>
            <Badge tone={enrollmentTone(lookup.enrollmentStatus)}>{ENROLLMENT_LABEL[lookup.enrollmentStatus]}</Badge>
          </div>
          <p className="mt-1 text-2xs text-ink-500 font-mono" dir="ltr">
            {lookup.applicant.id} · {maskNationalId(lookup.applicant.nationalId)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Metric label="الباركود" value={lookup.barcode} mono />
        <Metric label="اللجنة" value={lookup.committee} />
        <Metric label="الاختبار الحالي" value={lookup.currentExam} />
        <Metric label="تاريخ الاختبار" value={lookup.currentExamDate} mono />
        <Metric label="نتيجة الاختبار" value={lookup.currentExamResult} />
        <Metric label="حالة القبول" value={lookup.admissionStatus} />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Metric label="زيارات الأكاديمية" value={num(lookup.academyVisitCount)} />
          <Metric label="زيارات لجنة الطلبة" value={num(lookup.studentCommitteeVisitCount)} />
          <Metric label="زيارات لجنة الاختبار" value={num(lookup.examCommitteeVisitCount)} />
          <Metric label="زيارات القومسيون" value={num(lookup.medicalCommitteeVisitCount)} />
          <Metric label="زيارات العيادة" value={num(lookup.clinicVisitCount)} />
        </div>
      )}

      {!lookup.canProceed && (
        <div className="alert alert-danger mt-4">
          <AlertTriangle size={18} />
          <div className="alert-body">
            <div className="alert-title">إيقاف مسار المتقدم</div>
            <div>{lookup.blockedReason}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, mono }: { label: string; value: string | number; mono?: boolean }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">
      <p className="text-2xs text-ink-500">{label}</p>
      <p className={'mt-1 truncate text-sm font-bold text-ink-900 ' + (mono ? 'font-mono' : '')} dir={mono ? 'ltr' : undefined}>
        {value}
      </p>
    </div>
  );
}

function CapturePanel({
  kind,
  captured,
  busy,
  onCapture,
}: {
  kind: 'face' | 'fingerprint';
  captured: boolean;
  busy: boolean;
  onCapture: () => void;
}): JSX.Element {
  return (
    <div className="biometric-scan">
      <div className="biometric-frame">
        {kind === 'face' ? <ScanFace size={88} color="var(--gold-300)" /> : <Fingerprint size={88} color="var(--gold-300)" />}
        {busy && <span className="scan-pulse" />}
      </div>
      <div className="biometric-status">
        {busy ? 'جارٍ الالتقاط...' : captured ? 'تم الالتقاط بنجاح' : 'جاهز للتسجيل'}
      </div>
      {captured && (
        <Badge tone="success" className="mt-3" icon={<CheckCircle2 size={11} />}>
          {kind === 'face' ? 'وضوح 92%' : 'جودة 98%'}
        </Badge>
      )}
      <Button
        variant={captured ? 'secondary' : 'primary'}
        className="mt-4"
        onClick={onCapture}
        disabled={busy}
        leadingIcon={captured ? <RotateCcw size={14} /> : kind === 'face' ? <ScanFace size={14} /> : <Fingerprint size={14} />}
      >
        {captured ? 'إعادة الالتقاط' : 'بدء الالتقاط'}
      </Button>
    </div>
  );
}

function VerificationConsole({
  module,
  title,
  subtitle,
  defaultMethod = 'fingerprint',
  stationCommittee,
  onResult,
}: {
  module: VerificationModule;
  title: string;
  subtitle: string;
  defaultMethod?: VerificationMethod;
  stationCommittee?: string;
  onResult?: (result: VerifyResult) => void;
}): JSX.Element {
  const [method, setMethod] = useState<VerificationMethod>(defaultMethod);
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verify = async (): Promise<void> => {
    setBusy(true);
    try {
      const next = await biometricService.verify({
        method,
        module,
        operator: 'U-006',
        today: todayIso(),
        ...(stationCommittee ? { stationCommittee } : {}),
        ...(method === 'barcode' ? { barcode: identifier } : /^\d{14}$/.test(identifier) ? { nationalId: identifier } : { applicantId: identifier }),
      });
      setResult(next);
      speakVoiceAlerts(next.voiceAlerts);
      onResult?.(next);
      toast(next.ok ? 'تم التحقق ويسمح باستكمال الإجراء' : next.reason ?? STATUS_LABEL[next.status], next.ok ? 'success' : 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="مدخل التحقق" subtitle={MODULE_LABEL[module]} />
          <CardBody className="space-y-4">
            <Select
              label="طريقة التحقق"
              value={method}
              onChange={(event) => setMethod(event.target.value as VerificationMethod)}
              options={METHOD_OPTIONS}
            />
            <Input
              label="الباركود / الرقم القومي / رقم المتقدم"
              dir="ltr"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              trailingIcon={<ScanBarcode size={14} />}
            />
            <CapturePanel
              kind={method === 'face' ? 'face' : 'fingerprint'}
              captured={Boolean(result?.ok)}
              busy={busy}
              onCapture={verify}
            />
            {result?.voiceAlerts && result.voiceAlerts.length > 0 && (
              <div className="alert alert-warning">
                <Volume2 size={18} />
                <div className="alert-body">
                  <div className="alert-title">تنبيه صوتي</div>
                  <div>{result.voiceAlerts.join(' · ')}</div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="نتيجة التحقق" />
          <CardBody>
            <VerificationResultPanel result={result} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function BiometricVerifyPage(): JSX.Element {
  const [field, setField] = useState<SearchField>('barcode');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BiometricApplicantLookup[]>([]);
  const selected = results[0] ?? null;

  const search = async (): Promise<void> => {
    setBusy(true);
    try {
      setResults(await biometricService.searchApplicants({ field, query }));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void search();
  }, []);

  return (
    <>
      <PageHeader title="الاستعلام البيومتري" subtitle="بحث عن المتقدم بالباركود أو الرقم القومي أو الاسم أو رقم الطلب" />

      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader title="بحث المتقدم" actions={<Search size={18} className="text-ink-500" />} />
          <CardBody className="space-y-4">
            <Select
              label="نوع البحث"
              value={field}
              onChange={(event) => setField(event.target.value as SearchField)}
              options={SEARCH_OPTIONS}
            />
            <Input
              label="قيمة البحث"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              dir={field === 'name' ? 'rtl' : 'ltr'}
              trailingIcon={<Search size={14} />}
            />
            <Button variant="primary" fullWidth isLoading={busy} onClick={search}>
              بحث
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="بيانات المتقدم" subtitle={selected ? `${num(results.length)} نتيجة` : 'لا توجد نتيجة محددة'} />
          <CardBody>
            {!selected ? (
              <EmptyState icon={<IdCard size={32} />} title="ابدأ البحث" description="ستظهر بيانات المتقدم وصورته ولجنته وحالة التسجيل هنا" />
            ) : (
              <ApplicantSummaryCard lookup={selected} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="نتائج البحث" />
        {results.length === 0 ? (
          <EmptyState title="لا توجد نتائج مطابقة" />
        ) : (
          <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>المتقدم</th>
                  <th>الباركود</th>
                  <th>اللجنة</th>
                  <th>الاختبار الحالي</th>
                  <th>حالة القبول</th>
                  <th>التسجيل البيومتري</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.applicant.id}>
                    <td>{shortName(row.applicant.name, 3)}</td>
                    <td className="font-mono" dir="ltr">{row.barcode}</td>
                    <td>{row.committee}</td>
                    <td>{row.currentExam}</td>
                    <td><Badge tone={row.canProceed ? 'success' : 'danger'}>{row.admissionStatus}</Badge></td>
                    <td><Badge tone={enrollmentTone(row.enrollmentStatus)}>{ENROLLMENT_LABEL[row.enrollmentStatus]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function BiometricEnrollPage(): JSX.Element {
  const [field, setField] = useState<SearchField>('nationalId');
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<BiometricApplicantLookup | null>(null);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [fingerprintCaptured, setFingerprintCaptured] = useState(false);
  const [fingerprintCount, setFingerprintCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState<'face' | 'fingerprint' | null>(null);

  const findApplicant = async (): Promise<void> => {
    setBusy(true);
    try {
      let next: BiometricApplicantLookup | null = null;
      if (field === 'nationalId') next = await biometricService.getApplicant({ nationalId: query });
      else if (field === 'barcode') next = await biometricService.getApplicant({ barcode: query });
      else if (field === 'applicantNumber') next = await biometricService.getApplicant({ applicantId: query });
      else next = (await biometricService.searchApplicants({ field, query }))[0] ?? null;
      setLookup(next);
      if (!next) toast('لم يتم العثور على المتقدم', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const capture = (kind: 'face' | 'fingerprint'): void => {
    setScanBusy(kind);
    window.setTimeout(() => {
      if (kind === 'face') setFaceCaptured(true);
      else setFingerprintCaptured(true);
      setScanBusy(null);
    }, 700);
  };

  const save = async (retake = false): Promise<void> => {
    if (!lookup) return;
    setBusy(true);
    try {
      await biometricService.enroll({
        applicantId: lookup.applicant.id,
        nationalId: lookup.applicant.nationalId,
        barcode: lookup.barcode,
        cycleId: lookup.cycleId,
        userId: 'U-006',
        retake,
        faceCaptured,
        fingerprintCaptured,
        fingerprintCount,
      });
      toast(retake ? 'تمت إعادة التسجيل بنجاح' : 'تم تأكيد التسجيل البيومتري', 'success');
      setLookup(await biometricService.getApplicant({ applicantId: lookup.applicant.id }));
    } finally {
      setBusy(false);
    }
  };

  const linkPrevious = async (): Promise<void> => {
    if (!lookup) return;
    setBusy(true);
    try {
      await biometricService.linkPreviousEnrollment({
        applicantId: lookup.applicant.id,
        nationalId: lookup.applicant.nationalId,
        barcode: lookup.barcode,
        cycleId: lookup.cycleId,
        userId: 'U-006',
      });
      toast('تم ربط البيانات البيومترية السابقة بدورة القبول الحالية', 'success');
      setLookup(await biometricService.getApplicant({ applicantId: lookup.applicant.id }));
    } catch {
      toast('لا توجد بيانات بيومترية سابقة لهذا المتقدم', 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="تسجيل بيومتري" subtitle="تسجيل بصمة الإصبع وصورة الوجه وربطها بالمتقدم والرقم القومي والباركود ودورة القبول" />

      <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader title="تحديد المتقدم" />
          <CardBody className="space-y-4">
            <Select
              label="نوع البحث"
              value={field}
              onChange={(event) => setField(event.target.value as SearchField)}
              options={SEARCH_OPTIONS}
            />
            <Input
              label="قيمة البحث"
              dir={field === 'name' ? 'rtl' : 'ltr'}
              value={query}
              maxLength={field === 'nationalId' ? 14 : undefined}
              onChange={(event) => setQuery(field === 'nationalId' ? event.target.value.replace(/\D/g, '') : event.target.value)}
              trailingIcon={<IdCard size={14} />}
            />
            <Button variant="primary" fullWidth onClick={findApplicant} isLoading={busy} disabled={field === 'nationalId' ? query.length !== 14 : query.trim().length < 2}>
              استعلام
            </Button>
            {lookup && <ApplicantSummaryCard lookup={lookup} compact />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="التقاط العينات" subtitle="يدعم التسجيل وإعادة التسجيل / إعادة الالتقاط" />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <CapturePanel kind="face" captured={faceCaptured} busy={scanBusy === 'face'} onCapture={() => capture('face')} />
              <CapturePanel kind="fingerprint" captured={fingerprintCaptured} busy={scanBusy === 'fingerprint'} onCapture={() => capture('fingerprint')} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              <Metric label="المتقدم" value={lookup?.applicant.id ?? 'غير محدد'} mono />
              <Metric label="الرقم القومي" value={lookup ? maskNationalId(lookup.applicant.nationalId) : 'غير محدد'} mono />
              <Metric label="الباركود" value={lookup?.barcode ?? 'غير محدد'} mono />
              <Metric label="دورة القبول" value={lookup?.cycleId ?? 'غير محدد'} mono />
              <div className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">
                <label className="text-2xs text-ink-500" htmlFor="fingerprint-count">عدد البصمات</label>
                <input
                  id="fingerprint-count"
                  type="number"
                  min={1}
                  max={10}
                  value={fingerprintCount}
                  onChange={(event) => setFingerprintCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
                  className="mt-1 h-7 w-full rounded-sm border border-border-default bg-surface-card px-2 text-sm font-bold text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" leadingIcon={<Link2 size={14} />} onClick={() => void linkPrevious()} disabled={!lookup} isLoading={busy}>
                ربط بيانات سابقة
              </Button>
              <Button variant="secondary" leadingIcon={<RotateCcw size={14} />} onClick={() => void save(true)} disabled={!lookup || (!faceCaptured && !fingerprintCaptured)} isLoading={busy}>
                إعادة التسجيل
              </Button>
              <Button variant="primary" leadingIcon={<UserPlus size={14} />} onClick={() => void save(false)} disabled={!lookup || !faceCaptured || !fingerprintCaptured} isLoading={busy}>
                تأكيد التسجيل
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function BiometricIdentityVerifyPage(): JSX.Element {
  return (
    <VerificationConsole
      module="exam-committee"
      title="التحقق من الهوية"
      subtitle="تحقق بالبصمة أو الوجه أو الباركود قبل السماح باستكمال الاختبار"
    />
  );
}

export function BiometricGatePage(): JSX.Element {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [lastLog, setLastLog] = useState<GateLog | null>(null);
  const [busy, setBusy] = useState(false);

  const registerGate = async (direction: 'entry' | 'exit'): Promise<void> => {
    if (!result?.applicant) return;
    setBusy(true);
    try {
      const log = await biometricService.recordGateLog({
        applicantId: result.applicant.applicant.id,
        direction,
        verificationResult: result.status,
        operator: 'GATE-1',
        committee: result.applicant.committee,
      });
      setLastLog(log);
      toast(direction === 'entry' ? 'تم تسجيل دخول المتقدم إلى الأكاديمية' : 'تم تسجيل خروج المتقدم من الأكاديمية', 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <VerificationConsole
        module="security-gate"
        title="بوابة الدخول والخروج"
        subtitle="تحقق بيومتري ثم تسجيل دخول أو خروج المتقدم من الأكاديمية"
        defaultMethod="face"
        onResult={setResult}
      />

      <Card className="mt-5">
        <CardHeader title="تسجيل حركة البوابة" subtitle="لا يتم تسجيل الحركة إلا بعد ظهور بيانات المتقدم" />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="المتقدم" value={result?.applicant?.applicant.name ?? 'غير محدد'} />
            <Metric label="زيارات الأكاديمية" value={num(result?.applicant?.academyVisitCount ?? 0)} />
            <Metric label="آخر حركة" value={lastLog ? (lastLog.direction === 'entry' ? 'دخول' : 'خروج') : 'لا توجد'} />
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" leadingIcon={<DoorClosed size={14} />} disabled={!result?.applicant} isLoading={busy} onClick={() => void registerGate('exit')}>
              تسجيل خروج
            </Button>
            <Button variant="primary" leadingIcon={<DoorOpen size={14} />} disabled={!result?.applicant || !result.ok} isLoading={busy} onClick={() => void registerGate('entry')}>
              تسجيل دخول
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export function BiometricAttendancePage(): JSX.Element {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof biometricService.reports>> | null>(null);
  const [presence, setPresence] = useState<BiometricPresence | null>(null);

  const refresh = async (): Promise<void> => {
    const [nextReports, nextPresence] = await Promise.all([
      biometricService.reports(),
      biometricService.presence(),
    ]);
    setReports(nextReports);
    setPresence(nextPresence);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <PageHeader title="الحضور والتواجد" subtitle="تقرير حضور يومي وبيانات المتواجدين داخل لجان الأكاديمية" />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card><CardHeader title="حضور اليوم" /><Metric label="إجمالي الحركات" value={num(reports?.attendance.length ?? 0)} /></Card>
        <Card><CardHeader title="بيانات الحضور" /><Metric label="سجلات مفصلة" value={num(reports?.registeredAttendance.length ?? 0)} /></Card>
        <Card><CardHeader title="داخل الأكاديمية" /><Metric label="متقدم حالياً" value={num(presence?.totalInside ?? 0)} /></Card>
        <Card><CardHeader title="اللجان النشطة" /><Metric label="لجان بها متقدمون" value={num(presence?.byCommittee.length ?? 0)} /></Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="المتواجدون داخل اللجان" actions={<Button variant="secondary" size="sm" onClick={() => void refresh()}>تحديث</Button>} />
        {!presence || presence.byCommittee.length === 0 ? (
          <EmptyState icon={<Users size={32} />} title="لا توجد حالات تواجد حالية" />
        ) : (
          <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>اللجنة</th>
                  <th>عدد المتواجدين</th>
                  <th>آخر متقدمين</th>
                </tr>
              </thead>
              <tbody>
                {presence.byCommittee.map((row) => (
                  <tr key={row.committee}>
                    <td>{row.committee}</td>
                    <td>{num(row.count)}</td>
                    <td>{row.applicants.slice(0, 3).map((applicant) => applicant.applicantName).join('، ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title="بيانات الحضور المسجلة" />
        <GateLogTable rows={reports?.registeredAttendance ?? []} />
      </Card>
    </>
  );
}

export function BiometricRoleInquiryPage(): JSX.Element {
  const [module, setModule] = useState<VerificationModule>('admissions-committee');
  const [stationCommittee, setStationCommittee] = useState('لجنة طلبة 1');

  return (
    <>
      <PageHeader title="استعلام حسب الدور" subtitle="واجهة موحدة تتغير حسب موقع المستخدم: لجنة طلبة، لجنة اختبار، بوابة، قومسيون، أو عيادة" />
      <Card className="mb-5">
        <CardHeader title="سياق التشغيل" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Select
            label="الدور / الموقع"
            value={module}
            onChange={(event) => setModule(event.target.value as VerificationModule)}
            options={[
              { value: 'admissions-committee', label: 'رئيس لجنة الطلبة' },
              { value: 'exam-committee', label: 'رئيس لجنة الاختبار' },
              { value: 'security-gate', label: 'مستخدم بوابة التأمين' },
              { value: 'medical-commission', label: 'رئيس لجنة القومسيون' },
              { value: 'medical-clinic', label: 'مدير عيادة طبية' },
            ]}
          />
          <Input
            label="اللجنة الحالية"
            value={stationCommittee}
            onChange={(event) => setStationCommittee(event.target.value)}
            trailingIcon={<Users size={14} />}
          />
        </CardBody>
      </Card>
      <VerificationConsole
        module={module}
        title={MODULE_LABEL[module]}
        subtitle="يعرض بيانات المتقدم والعدادات المطلوبة لهذا الموقع مع تنبيهات عدم التسجيل أو اختلاف التاريخ أو اللجنة"
        stationCommittee={module === 'admissions-committee' ? stationCommittee : undefined}
      />
    </>
  );
}

export function BiometricHistoryPage(): JSX.Element {
  const [rows, setRows] = useState<VerificationLog[]>([]);
  const [auditRows, setAuditRows] = useState<BiometricAuditLog[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);
  const [module, setModule] = useState<VerificationModule | ''>('');
  const [reports, setReports] = useState<Awaited<ReturnType<typeof biometricService.reports>> | null>(null);

  const refresh = async (): Promise<void> => {
    setRows(await biometricService.listVerifications({ failedOnly, ...(module ? { module } : {}) }));
    setAuditRows(await biometricService.listAuditLogs());
    setReports(await biometricService.reports());
  };

  useEffect(() => {
    void refresh();
  }, [failedOnly, module]);

  const exportReport = async (format: ExportFormat): Promise<void> => {
    const file = await biometricService.exportReport(format);
    toast(`تم تجهيز ملف ${file.fileName}`, 'success');
  };

  const chartData = useMemo(
    () => reports?.daily.map((day) => ({ label: day.label, value: day.total })) ?? [],
    [reports],
  );

  return (
    <>
      <PageHeader title="سجل وتقارير التحقق البيومتري" subtitle="سجل العمليات والفشل والحضور وحالة التسجيل مع تصدير PDF / Excel / Word" />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card>
          <CardHeader title="تقرير يومي" />
          <Metric label="عمليات اليوم" value={num(reports?.daily.at(-1)?.total ?? 0)} />
        </Card>
        <Card>
          <CardHeader title="عمليات فاشلة" />
          <Metric label="تحتاج متابعة" value={num(reports?.failed.length ?? 0)} />
        </Card>
        <Card>
          <CardHeader title="حضور البوابة" />
          <Metric label="دخول / خروج" value={num(reports?.attendance.length ?? 0)} />
        </Card>
        <Card>
          <CardHeader title="حالة التسجيل" />
          <Metric label="مسجل بالكامل" value={num(reports?.enrollment[0]?.value ?? 0)} />
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="التقارير"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" leadingIcon={<Download size={14} />} onClick={() => void exportReport('pdf')}>PDF</Button>
              <Button variant="secondary" size="sm" leadingIcon={<FileSpreadsheet size={14} />} onClick={() => void exportReport('excel')}>Excel</Button>
              <Button variant="secondary" size="sm" leadingIcon={<FileText size={14} />} onClick={() => void exportReport('word')}>Word</Button>
            </div>
          }
        />
        <BarChart data={chartData} height={180} color="var(--accent-500)" />
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="سجل التحقق"
          actions={
            <div className="flex flex-wrap gap-2">
              <Select
                value={module}
                onChange={(event) => setModule(event.target.value as VerificationModule | '')}
                options={[
                  { value: '', label: 'كل المواقع' },
                  { value: 'security-gate', label: MODULE_LABEL['security-gate'] },
                  { value: 'admissions-committee', label: MODULE_LABEL['admissions-committee'] },
                  { value: 'exam-committee', label: MODULE_LABEL['exam-committee'] },
                  { value: 'medical-commission', label: MODULE_LABEL['medical-commission'] },
                  { value: 'medical-clinic', label: MODULE_LABEL['medical-clinic'] },
                ]}
              />
              <Button variant={failedOnly ? 'danger' : 'secondary'} size="sm" leadingIcon={<ShieldAlert size={14} />} onClick={() => setFailedOnly((v) => !v)}>
                العمليات الفاشلة
              </Button>
            </div>
          }
        />
        <VerificationTable rows={rows} />
      </Card>

      <Card className="mt-5">
        <CardHeader title="حضور البوابة" subtitle="دخول وخروج المتقدمين المسجلين" />
        <GateLogTable rows={reports?.attendance ?? []} />
      </Card>

      <Card className="mt-5">
        <CardHeader title="سجل التدقيق البيومتري" subtitle="المستخدم، التوقيت، المتقدم، الإجراء، والنتيجة" />
        <AuditTable rows={auditRows.slice(0, 20)} />
      </Card>
    </>
  );
}

function VerificationTable({ rows }: { rows: VerificationLog[] }): JSX.Element {
  if (rows.length === 0) {
    return <EmptyState icon={<History size={32} />} title="لا توجد عمليات" />;
  }

  return (
    <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
      <table className="table">
        <thead>
          <tr>
            <th>المتقدم</th>
            <th>التاريخ</th>
            <th>الطريقة</th>
            <th>النتيجة</th>
            <th>المستخدم / المشغل</th>
            <th>الموقع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="font-medium">{shortName(row.applicantName, 3)}</div>
                <div className="text-2xs text-ink-500 font-mono" dir="ltr">{row.applicantId}</div>
              </td>
              <td>{fmtDate(row.timestamp, 'short')}</td>
              <td>{methodLabel(row.method)}</td>
              <td>
                <Badge tone={statusTone(row.result)}>
                  {STATUS_LABEL[row.result]}{row.confidence ? ` · ${row.confidence}%` : ''}
                </Badge>
              </td>
              <td className="font-mono" dir="ltr">{row.operator}</td>
              <td>{MODULE_LABEL[row.module]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GateLogTable({ rows }: { rows: GateLog[] }): JSX.Element {
  if (rows.length === 0) {
    return <EmptyState icon={<DoorOpen size={32} />} title="لا توجد حركات بوابة" />;
  }

  return (
    <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
      <table className="table">
        <thead>
          <tr>
            <th>المتقدم</th>
            <th>الحركة</th>
            <th>الوقت</th>
            <th>نتيجة التحقق</th>
            <th>المشغل</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="font-medium">{shortName(row.applicantName, 3)}</div>
                <div className="text-2xs text-ink-500 font-mono" dir="ltr">{row.applicantId}</div>
              </td>
              <td>{row.direction === 'entry' ? 'دخول' : 'خروج'}</td>
              <td>{fmtDate(row.at, 'short')}</td>
              <td><Badge tone={statusTone(row.verificationResult)}>{STATUS_LABEL[row.verificationResult]}</Badge></td>
              <td className="font-mono" dir="ltr">{row.operator}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ rows }: { rows: BiometricAuditLog[] }): JSX.Element {
  if (rows.length === 0) {
    return <EmptyState icon={<History size={32} />} title="لا توجد أحداث تدقيق" />;
  }

  return (
    <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
      <table className="table">
        <thead>
          <tr>
            <th>المستخدم</th>
            <th>التوقيت</th>
            <th>المتقدم</th>
            <th>الإجراء</th>
            <th>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-mono" dir="ltr">{row.user}</td>
              <td>{fmtDate(row.timestamp, 'short')}</td>
              <td>
                <div className="font-medium">{shortName(row.applicantName, 3)}</div>
                <div className="text-2xs text-ink-500 font-mono" dir="ltr">{row.applicantId}</div>
              </td>
              <td>{AUDIT_LABEL[row.action]}</td>
              <td className="font-mono" dir="ltr">{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
