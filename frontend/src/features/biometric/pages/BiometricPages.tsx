import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { exportBiometricHistory, type HistoryExportData } from '../lib/exportHistory';
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

      {result.found && (
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="البوابة" value={result.identifiedAreaName || '—'} />
          <Metric label="الجهاز" value={result.identifiedTerminalAlias || result.identifiedTerminalSn || '—'} mono />
          <Metric label="كود الموظف (الجهاز)" value={result.identifiedEmpCode || '—'} mono />
        </div>
      )}

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
        <Metric label="الرقم القومي" value={lookup.applicant.nationalId} mono />
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
      <p
        className={'mt-1 text-sm font-bold text-ink-900 ' + (mono ? 'font-mono break-all' : 'break-words')}
        dir={mono ? 'ltr' : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function StepDot({ n, done, active }: { n: string; done: boolean; active: boolean }): JSX.Element {
  return (
    <span
      className={
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold ' +
        (done ? 'bg-emerald-100 text-emerald-700' : active ? 'text-white' : 'bg-ink-100 text-ink-500')
      }
      style={active && !done ? { background: 'var(--accent-600)' } : undefined}
    >
      {done ? <CheckCircle2 size={14} /> : n}
    </span>
  );
}

function CapturePanel({
  kind,
  captured,
  busy,
  onCapture,
  listening = false,
  label,
  statusText,
}: {
  kind: 'face' | 'fingerprint';
  captured: boolean;
  busy: boolean;
  onCapture: () => void;
  /** Live-listen mode: pulse + waiting status, button toggles the listener. */
  listening?: boolean;
  /** Override the button label. */
  label?: string;
  /** Override the status line. */
  statusText?: string;
}): JSX.Element {
  const active = busy || listening;
  const status =
    statusText ??
    (listening
      ? 'جارٍ الاستماع للجهاز... ضع البصمة أو الوجه'
      : busy
        ? 'جارٍ الالتقاط...'
        : captured
          ? 'تم الالتقاط بنجاح'
          : 'جاهز للتسجيل');
  const btnLabel = label ?? (captured ? 'إعادة الالتقاط' : 'بدء الالتقاط');
  return (
    <div className="biometric-scan">
      <div className="biometric-frame">
        {kind === 'face' ? <ScanFace size={88} color="var(--gold-300)" /> : <Fingerprint size={88} color="var(--gold-300)" />}
        {active && <span className="scan-pulse" />}
      </div>
      <div className="biometric-status">{status}</div>
      {captured && !listening && (
        <Badge tone="success" className="mt-3" icon={<CheckCircle2 size={11} />}>
          {kind === 'face' ? 'وضوح 92%' : 'جودة 98%'}
        </Badge>
      )}
      <Button
        variant={listening ? 'secondary' : captured ? 'secondary' : 'primary'}
        className="mt-4"
        onClick={onCapture}
        disabled={busy && !listening}
        leadingIcon={listening ? <RotateCcw size={14} /> : kind === 'face' ? <ScanFace size={14} /> : <Fingerprint size={14} />}
      >
        {btnLabel}
      </Button>
    </div>
  );
}

function VerificationConsole({
  module,
  title,
  subtitle,
  stationCommittee,
  onResult,
}: {
  module: VerificationModule;
  title: string;
  subtitle: string;
  stationCommittee?: string;
  onResult?: (result: VerifyResult) => void;
}): JSX.Element {
  const [identifier, setIdentifier] = useState('');
  const [terminalSn, setTerminalSn] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const baselineRef = useRef<string | null>(null);

  // Live device list to choose which terminal to verify against.
  const devicesQuery = useQuery({
    queryKey: ['biometric', 'zk', 'devices', 'console'],
    queryFn: () => biometricService.getZkDevices(),
    staleTime: 60_000,
    retry: false,
  });
  const deviceOptions = [
    { value: '', label: 'كل الأجهزة' },
    ...(devicesQuery.data?.data ?? []).map((d) => ({
      value: d.sn,
      label: `${d.terminal_name || d.alias || d.sn}${d.area_name ? ` · ${d.area_name}` : ''}`,
    })),
  ];

  const applyResult = (next: VerifyResult): void => {
    setResult(next);
    speakVoiceAlerts(next.voiceAlerts);
    onResult?.(next);
    toast(next.ok ? 'تم التحقق ويسمح باستكمال الإجراء' : next.reason ?? STATUS_LABEL[next.status], next.ok ? 'success' : 'danger');
  };

  // 1:1 verify — operator typed a national id / applicant number / barcode.
  // Modality (face/finger) is auto-detected from the punch, not pre-selected.
  const verifyTyped = async (): Promise<void> => {
    const id = identifier.trim();
    setBusy(true);
    try {
      applyResult(
        await biometricService.verify({
          module,
          operator: 'U-006',
          today: todayIso(),
          ...(terminalSn ? { terminalSn } : {}),
          ...(stationCommittee ? { stationCommittee } : {}),
          ...(/^\d{14}$/.test(id) ? { nationalId: id } : { applicantId: id }),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  // Live listener — poll the chosen device until a NEW punch arrives, then verify.
  useEffect(() => {
    if (!listening) return;
    let cancelled = false;
    baselineRef.current = null; // first tick records the current latest punch and skips it
    const tick = async (): Promise<void> => {
      try {
        const r = await biometricService.verifyLive({ module, ...(terminalSn ? { terminalSn } : {}) });
        if (cancelled) return;
        const ut = r.identifiedUploadTime ?? '';
        if (baselineRef.current === null) {
          baselineRef.current = ut; // baseline; wait for the next punch
          return;
        }
        if (r.found && ut && ut > baselineRef.current) {
          applyResult(r);
          setListening(false);
        }
      } catch {
        /* keep listening through transient errors */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, terminalSn, module]);

  const handleCapture = (): void => {
    // Empty identifier → toggle the live listener (1:N, finger or face — auto-detected).
    if (!identifier.trim()) {
      setListening((v) => !v);
      return;
    }
    setListening(false);
    void verifyTyped();
  };

  // Modality icon follows the actual punch (15 = face, else fingerprint).
  const captureKind: 'face' | 'fingerprint' = result?.identifiedVerifyType === 15 ? 'face' : 'fingerprint';

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="مدخل التحقق" subtitle={MODULE_LABEL[module]} />
          <CardBody className="space-y-4">
            <Select
              label="الجهاز / البوابة"
              value={terminalSn}
              onChange={(event) => setTerminalSn(event.target.value)}
              options={deviceOptions}
            />
            <Input
              label="الباركود / الرقم القومي / رقم المتقدم (اتركه فارغاً للاستماع المباشر)"
              dir="ltr"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              trailingIcon={<ScanBarcode size={14} />}
            />
            <p className="text-2xs text-ink-500">
              يتم التعرّف على البصمة أو الوجه تلقائياً حسب ما يقدّمه المتقدم على الجهاز.
            </p>
            <CapturePanel
              kind={captureKind}
              captured={Boolean(result?.ok)}
              busy={busy}
              listening={listening}
              label={listening ? 'إيقاف الاستماع' : !identifier.trim() ? 'بدء الاستماع المباشر' : 'تحقق'}
              onCapture={handleCapture}
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
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      setResults(await biometricService.searchApplicants({ field, query }));
    } finally {
      setBusy(false);
    }
  };

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
  const [busy, setBusy] = useState(false);
  const [terminalSn, setTerminalSn] = useState('');
  const [addDeviceSn, setAddDeviceSn] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [confirmResult, setConfirmResult] = useState<VerifyResult | null>(null);
  const baselineRef = useRef<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ['biometric', 'zk', 'devices', 'enroll'],
    queryFn: () => biometricService.getZkDevices(),
    staleTime: 60_000,
    retry: false,
  });
  const deviceChoices = (devicesQuery.data?.data ?? []).map((d) => ({
    value: d.sn,
    label: `${d.terminal_name || d.alias || d.sn}${d.area_name ? ` · ${d.area_name}` : ''}`,
  }));
  const deviceOptions = [{ value: '', label: 'كل الأجهزة' }, ...deviceChoices];
  // Step 1 creates the employee in the picked terminal's area — selection is
  // required whenever the ZK directory actually lists devices (in simulated
  // mode there are none, and creation proceeds without a device).
  const createDeviceOptions = [{ value: '', label: 'اختر الجهاز…' }, ...deviceChoices];
  const deviceRequired = deviceChoices.length > 0;

  // Live employees on the device — the source of truth for "is this applicant
  // actually created on the device?" (our enrollment record may reference a
  // code the device no longer has, e.g. after a device wipe).
  const zkEmployeesQuery = useQuery({
    queryKey: ['biometric', 'zk', 'employees', 'enroll'],
    queryFn: () => biometricService.getZkEmployees(1, 500),
    staleTime: 5_000,
    refetchInterval: 5_000, // keep the on-device biometric status fresh as the admin enrolls
    retry: false,
  });
  const onDeviceCodes = new Set((zkEmployeesQuery.data?.data ?? []).map((e) => String(e.emp_code)));

  // Confirm-by-punch: poll the chosen device until THIS applicant presents a
  // biometric on the terminal — the real proof the template was enrolled.
  useEffect(() => {
    if (!listening || !lookup) return;
    const myId = lookup.applicant.id;
    let cancelled = false;
    baselineRef.current = null;
    const tick = async (): Promise<void> => {
      try {
        const r = await biometricService.verifyLive({ module: 'admissions-committee', ...(terminalSn ? { terminalSn } : {}) });
        if (cancelled) return;
        const ut = r.identifiedUploadTime ?? '';
        if (baselineRef.current === null) {
          baselineRef.current = ut;
          return;
        }
        if (r.found && ut && ut > baselineRef.current) {
          baselineRef.current = ut;
          if (r.applicant?.applicant?.id === myId) {
            setConfirmResult(r);
            setListening(false);
            toast('تم التحقق من البصمة على الجهاز بنجاح', 'success');
            void biometricService.getApplicant({ applicantId: myId }).then(setLookup);
          } else {
            toast('بصمة لمتقدم آخر — في انتظار بصمة هذا المتقدم', 'warning');
          }
        }
      } catch {
        /* keep listening through transient errors */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, lookup, terminalSn]);

  const findApplicant = async (): Promise<void> => {
    setBusy(true);
    setConfirmResult(null);
    setListening(false);
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

  // Step 1 — create the applicant's employee record on the ZK device (real write).
  // The biometric template itself is captured on the G4 terminal afterwards.
  const createOnDevice = async (retake = false): Promise<void> => {
    if (!lookup) return;
    if (deviceRequired && !terminalSn) {
      toast('اختر الجهاز الذي سيُنشأ عليه سجل المتقدم أولاً', 'warning');
      return;
    }
    setBusy(true);
    try {
      await biometricService.enroll({
        applicantId: lookup.applicant.id,
        nationalId: lookup.applicant.nationalId,
        barcode: lookup.barcode,
        cycleId: lookup.cycleId,
        userId: 'U-006',
        retake,
        faceCaptured: true,
        fingerprintCaptured: true,
        fingerprintCount: 1,
        ...(terminalSn ? { terminalSn } : {}),
      });
      toast('تم إنشاء سجل المتقدم على الجهاز — سجّل البصمة على الجهاز ثم اطلب منه البصم للتأكيد', 'success');
      setConfirmResult(null);
      setLookup(await biometricService.getApplicant({ applicantId: lookup.applicant.id }));
      void zkEmployeesQuery.refetch();
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'تعذر إنشاء سجل المتقدم على الجهاز', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const deviceEmpCode = lookup?.enrollment?.deviceEmpCode;
  // Created only if the assigned code actually exists on the device right now.
  const deviceCreated = Boolean(deviceEmpCode && onDeviceCodes.has(String(deviceEmpCode)));
  // Read the live biometric enrollment state from the device employee record:
  // a value like "Ver 12:1" means enrolled; "-" / empty means none.
  const deviceEmp = (zkEmployeesQuery.data?.data ?? []).find((e) => String(e.emp_code) === String(deviceEmpCode));
  const hasBio = (v?: string | null): boolean => Boolean(v && String(v).trim() !== '' && String(v).trim() !== '-');
  // "Ver 12:1" → 1 enrolled fingerprint; the device exposes the COUNT, not which finger.
  const fingerCount = (() => {
    const m = String(deviceEmp?.fingerprint ?? '').match(/:(\d+)/);
    return m ? Number(m[1]) : hasBio(deviceEmp?.fingerprint) ? 1 : 0;
  })();
  const hasFingerprint = fingerCount > 0;
  // Face is registered if a face/visible-light template OR a VL face photo exists.
  const hasFace =
    hasBio(deviceEmp?.face) || hasBio(deviceEmp?.vl_face) || Number(deviceEmp?.vl_face_photo ?? 0) > 0;
  const bioRegistered = hasFingerprint || hasFace;

  // Devices the created employee is NOT yet on (by area membership) — offered
  // as "also register on this device". A device with an unknown area stays
  // listed; the backend validates it on submit.
  const employeeAreaIds = new Set((deviceEmp?.area ?? []).map((a) => a.id));
  const otherDeviceChoices = (devicesQuery.data?.data ?? [])
    .filter((d) => {
      const area = d.area as { id?: number } | undefined;
      return !(area?.id && employeeAreaIds.has(area.id));
    })
    .map((d) => ({
      value: d.sn,
      label: `${d.terminal_name || d.alias || d.sn}${d.area_name ? ` · ${d.area_name}` : ''}`,
    }));

  const addToAnotherDevice = async (): Promise<void> => {
    if (!lookup || !addDeviceSn) return;
    setAddBusy(true);
    try {
      await biometricService.addToZkDevice({ nationalId: lookup.applicant.nationalId, terminalSn: addDeviceSn });
      toast('تمت إضافة المتقدم إلى الجهاز — سجّل البصمة عليه ثم اطلب منه البصم للتأكيد', 'success');
      setAddDeviceSn('');
      void zkEmployeesQuery.refetch();
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'تعذر إضافة المتقدم إلى الجهاز', 'danger');
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="تسجيل بيومتري لمتقدم" subtitle="إنشاء سجل المتقدم على الجهاز، ثم تسجيل البصمة والوجه على الجهاز، ثم التأكيد ببصمة حية" />

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
          <CardHeader
            title="التسجيل على الجهاز"
            subtitle="إنشاء سجل المتقدم على جهاز ZKBioTime ثم تسجيل البصمة على الجهاز والتأكيد ببصمة حية"
          />
          <CardBody className="space-y-5">
            {/* Step 1 — create the device employee (real write) */}
            <div className="rounded-lg border border-border-subtle bg-ink-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <StepDot n="١" done={deviceCreated} active={Boolean(lookup) && !deviceCreated} />
                <span className="text-sm font-bold text-ink-900">إنشاء سجل المتقدم على الجهاز</span>
                {deviceCreated && (
                  <Badge tone="success" className="ms-auto" icon={<CheckCircle2 size={11} />}>تم الإنشاء</Badge>
                )}
              </div>
              {!lookup ? (
                <p className="text-sm text-ink-500">ابحث عن المتقدم بالرقم القومي أولاً.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="اسم المتقدم" value={lookup.applicant.name} />
                    <Metric label="الرقم القومي" value={lookup.applicant.nationalId} mono />
                    <Metric label="كود المتقدم على الجهاز (الرقم القومي)" value={deviceEmpCode ?? lookup.applicant.nationalId} mono />
                    <Metric label="معرّف الجهاز (id)" value={lookup.enrollment?.deviceEmpId ?? '—'} mono />
                  </div>
                  {deviceRequired && !deviceCreated && (
                    <div className="mt-3">
                      <Select
                        label="جهاز التسجيل"
                        value={terminalSn}
                        onChange={(event) => setTerminalSn(event.target.value)}
                        options={createDeviceOptions}
                      />
                      {!terminalSn && (
                        <p className="mt-1 text-2xs text-ink-500">اختر الجهاز الذي سيُنشأ عليه سجل المتقدم.</p>
                      )}
                    </div>
                  )}
                </>
              )}
              {deviceCreated && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-3 py-2">
                  <span className="text-2xs text-ink-500">حالة البيومتري على الجهاز:</span>
                  <Badge tone={hasFingerprint ? 'success' : 'warning'} icon={hasFingerprint ? <CheckCircle2 size={11} /> : undefined}>
                    البصمة {hasFingerprint ? `مسجّلة (${fingerCount === 1 ? 'إصبع واحد' : fingerCount === 2 ? 'إصبعان' : fingerCount <= 10 ? `${fingerCount} أصابع` : `${fingerCount} إصبع`})` : 'غير مسجّلة'}
                  </Badge>
                  <Badge tone={hasFace ? 'success' : 'warning'} icon={hasFace ? <CheckCircle2 size={11} /> : undefined}>
                    الوجه {hasFace ? 'مسجّلة' : 'غير مسجّلة'}
                  </Badge>
                  {!bioRegistered && (
                    <span className="text-2xs text-gold-700">— سجّل البصمة/الوجه على الجهاز</span>
                  )}
                </div>
              )}
              {deviceCreated && otherDeviceChoices.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Select
                      label="إضافة إلى جهاز آخر"
                      value={addDeviceSn}
                      onChange={(event) => setAddDeviceSn(event.target.value)}
                      options={[{ value: '', label: 'اختر الجهاز…' }, ...otherDeviceChoices]}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    leadingIcon={<UserPlus size={14} />}
                    onClick={() => void addToAnotherDevice()}
                    disabled={!addDeviceSn}
                    isLoading={addBusy}
                  >
                    إضافة
                  </Button>
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  variant={deviceCreated ? 'secondary' : 'primary'}
                  leadingIcon={deviceCreated ? <CheckCircle2 size={14} /> : <UserPlus size={14} />}
                  onClick={() => void createOnDevice(false)}
                  disabled={!lookup || deviceCreated || (deviceRequired && !terminalSn)}
                  isLoading={busy}
                >
                  {deviceCreated ? 'تم الإنشاء على الجهاز' : 'إنشاء السجل على الجهاز'}
                </Button>
              </div>
            </div>

            {/* Step 2 — confirm with a live punch */}
            <div className={`rounded-lg border border-border-subtle bg-surface-card p-4 ${deviceCreated ? '' : 'opacity-60'}`}>
              <div className="mb-2 flex items-center gap-2">
                <StepDot n="٢" done={Boolean(confirmResult)} active={deviceCreated && !confirmResult} />
                <span className="text-sm font-bold text-ink-900">التأكيد الحي على الجهاز (بصمة أو وجه)</span>
              </div>
              <p className="mb-3 text-2xs text-ink-500">
                بعد تسجيل البصمة/الوجه للمتقدم بكود <b className="font-mono">{deviceEmpCode ?? lookup?.applicant.nationalId ?? '—'}</b> على الجهاز،
                اطلب من المتقدم البصم للتأكيد.
              </p>
              <Select
                label="الجهاز / البوابة"
                value={terminalSn}
                onChange={(event) => setTerminalSn(event.target.value)}
                options={deviceOptions}
                disabled={!deviceCreated}
              />
              <div className="mt-4">
                <CapturePanel
                  kind={confirmResult?.identifiedVerifyType === 15 ? 'face' : 'fingerprint'}
                  captured={Boolean(confirmResult)}
                  busy={false}
                  listening={listening}
                  statusText={
                    !deviceCreated
                      ? 'أنشئ السجل على الجهاز أولاً'
                      : confirmResult
                        ? `تم التحقق من ${confirmResult.identifiedVerifyType === 15 ? 'الوجه' : 'البصمة'} على الجهاز`
                        : listening
                          ? 'جارٍ الاستماع... اطلب من المتقدم البصم على الجهاز'
                          : 'جاهز للتأكيد'
                  }
                  label={listening ? 'إيقاف الاستماع' : 'بدء الاستماع للتأكيد'}
                  onCapture={() => {
                    if (!deviceCreated) return;
                    setConfirmResult(null);
                    setListening((v) => !v);
                  }}
                />
              </div>
              {confirmResult && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="المتقدم" value={confirmResult.applicant?.applicant?.name ?? '—'} />
                  <Metric label="طريقة التحقق" value={confirmResult.identifiedVerifyType === 15 ? 'صورة الوجه' : 'البصمة'} />
                  <Metric label="البوابة" value={confirmResult.identifiedAreaName ?? '—'} />
                </div>
              )}
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

  const exportReport = (format: ExportFormat): void => {
    if (!reports) {
      toast('لا توجد بيانات للتصدير بعد', 'warning');
      return;
    }
    const exportData: HistoryExportData = {
      title: 'سجل وتقارير التحقق البيومتري',
      generatedAt: `تاريخ التصدير: ${fmtDate(Date.now(), 'short')}`,
      fileSlug: todayIso(),
      summary: [
        ['عمليات اليوم', num(reports.daily.at(-1)?.total ?? 0)],
        ['عمليات فاشلة (تحتاج متابعة)', num(reports.failed.length)],
        ['حضور البوابة (دخول / خروج)', num(reports.attendance.length)],
        ['مسجل بالكامل', num(reports.enrollment[0]?.value ?? 0)],
      ],
      daily: reports.daily.map((day) => [day.label, num(day.total)] as [string, string]),
      log: {
        headers: ['المتقدم', 'التاريخ', 'الطريقة', 'النتيجة', 'المشغل', 'الموقع'],
        rows: rows.map((row) => [
          row.applicantName,
          fmtDate(row.timestamp, 'short'),
          methodLabel(row.method),
          `${STATUS_LABEL[row.result]}${row.confidence ? ` (${row.confidence}%)` : ''}`,
          row.operator,
          MODULE_LABEL[row.module],
        ]),
      },
    };
    try {
      exportBiometricHistory(format, exportData);
      if (format === 'pdf') toast('تم فتح نافذة الطباعة — اختر «حفظ كـ PDF»', 'info');
      else toast('تم تجهيز الملف للتحميل', 'success');
    } catch {
      toast('تعذّر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة وأعد المحاولة', 'danger');
    }
  };

  const chartData = useMemo(
    () => reports?.daily.map((day) => ({ label: day.label, value: day.total })) ?? [],
    [reports],
  );

  return (
    <>
      <PageHeader
        title="سجل وتقارير التحقق البيومتري"
        subtitle="سجل العمليات والفشل والحضور وحالة التسجيل مع تصدير PDF / Excel / Word"
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<RotateCcw size={14} />} onClick={() => void refresh()}>
            تحديث
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card>
          <CardHeader title="تقرير يومي" />
          <Metric label="عمليات اليوم" value={reports ? num(reports.daily.at(-1)?.total ?? 0) : '—'} />
        </Card>
        <Card>
          <CardHeader title="عمليات فاشلة" />
          <Metric label="تحتاج متابعة" value={reports ? num(reports.failed.length) : '—'} />
        </Card>
        <Card>
          <CardHeader title="حضور البوابة" />
          <Metric label="دخول / خروج" value={reports ? num(reports.attendance.length) : '—'} />
        </Card>
        <Card>
          <CardHeader title="حالة التسجيل" />
          <Metric label="مسجل بالكامل" value={reports ? num(reports.enrollment[0]?.value ?? 0) : '—'} />
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
