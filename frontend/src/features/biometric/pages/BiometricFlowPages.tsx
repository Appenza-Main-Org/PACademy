import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Fingerprint,
  History,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
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
import { useAuthStore } from '@/features/auth';
import { date as fmtDate, maskNationalId, num } from '@/shared/lib/format';
import { biometricService } from '../api/biometric.service';
import type {
  AssignmentKind,
  AssignmentTarget,
  BiometricApplicantLookup,
  EnrollmentHistoryEntry,
  SearchField,
} from '../api/biometric.service';

const SEARCH_OPTIONS: ReadonlyArray<{ value: SearchField; label: string }> = [
  { value: 'nationalId', label: 'الرقم القومي' },
  { value: 'name', label: 'اسم المتقدم' },
  { value: 'barcode', label: 'الباركود' },
  { value: 'applicantNumber', label: 'رقم المتقدم' },
];

const KIND_LABEL: Record<AssignmentKind, string> = {
  gate: 'بوابة',
  committee: 'لجنة',
  checkpoint: 'نقطة تفتيش',
};

const KIND_OPTIONS: ReadonlyArray<{ value: AssignmentKind; label: string }> = [
  { value: 'gate', label: 'بوابة' },
  { value: 'committee', label: 'لجنة' },
  { value: 'checkpoint', label: 'نقطة تفتيش' },
];

/* ── Shared in-file applicant search ───────────────────────────────── */

function ApplicantSearchPanel({
  picked,
  onPick,
}: {
  picked: BiometricApplicantLookup | null;
  onPick: (lookup: BiometricApplicantLookup | null) => void;
}): JSX.Element {
  const [field, setField] = useState<SearchField>('nationalId');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BiometricApplicantLookup[]>([]);

  const search = useMutation({
    mutationFn: () => biometricService.searchApplicants({ field, query }),
    onSuccess: (rows) => {
      setResults(rows);
      if (rows.length === 0) toast('لا يوجد متقدم مطابق', 'warning');
    },
    onError: () => toast('تعذّر تنفيذ البحث', 'danger'),
  });

  return (
    <Card>
      <CardHeader title="البحث عن متقدم" />
      <CardBody className="space-y-4">
        <Select
          label="نوع البحث"
          value={field}
          onChange={(event) => setField(event.target.value as SearchField)}
          options={SEARCH_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) search.mutate();
          }}
        >
          <Input
            label="قيمة البحث"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1"
            placeholder="أدخل قيمة البحث ثم اضغط بحث"
          />
          <Button type="submit" isLoading={search.isPending} disabled={!query.trim()}>
            بحث
          </Button>
        </form>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((row) => {
              const isPicked = picked?.applicant.id === row.applicant.id;
              return (
                <button
                  key={row.applicant.id}
                  type="button"
                  onClick={() => onPick(row)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors"
                  style={{
                    borderColor: isPicked ? 'var(--accent-500)' : 'var(--border)',
                    background: isPicked ? 'var(--accent-50)' : 'transparent',
                  }}
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{row.applicant.name}</span>
                    <span className="block text-2xs text-ink-500">
                      {maskNationalId(row.applicant.nationalId)} · {row.committee || 'بدون لجنة'}
                    </span>
                  </span>
                  <Badge tone={row.enrollmentStatus === 'enrolled' ? 'success' : row.enrollmentStatus === 'partial' ? 'warning' : 'neutral'}>
                    {row.enrollmentStatus === 'enrolled' ? 'مسجل' : row.enrollmentStatus === 'partial' ? 'جزئي' : 'غير مسجل'}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function PickedApplicantCard({ lookup }: { lookup: BiometricApplicantLookup }): JSX.Element {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink-900">{lookup.applicant.name}</p>
          <p className="text-2xs text-ink-500">
            {maskNationalId(lookup.applicant.nationalId)} · {lookup.barcode}
          </p>
        </div>
        <Badge tone={lookup.enrollmentStatus === 'enrolled' ? 'success' : lookup.enrollmentStatus === 'partial' ? 'warning' : 'neutral'}>
          {lookup.enrollmentStatus === 'enrolled' ? 'مسجل بالكامل' : lookup.enrollmentStatus === 'partial' ? 'تسجيل جزئي' : 'غير مسجل'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-2xs text-ink-600">
        <span>اللجنة: <b className="text-ink-900">{lookup.committee || '—'}</b></span>
        <span>الاختبار الحالي: <b className="text-ink-900">{lookup.currentExam}</b></span>
        <span>تاريخ الاختبار: <b className="text-ink-900">{lookup.currentExamDate}</b></span>
        <span>الحالة: <b className="text-ink-900">{lookup.admissionStatus}</b></span>
      </div>
    </div>
  );
}

/* ── 1. Applicant assignment ───────────────────────────────────────── */

export function BiometricAssignmentPage(): JSX.Element {
  const queryClient = useQueryClient();
  const operator = useAuthStore((state) => state.user?.id ?? 'system');
  const [picked, setPicked] = useState<BiometricApplicantLookup | null>(null);
  const [kind, setKind] = useState<AssignmentKind>('committee');
  const [targetId, setTargetId] = useState('');

  const targetsQuery = useQuery({
    queryKey: ['biometric', 'assignment-targets'],
    queryFn: () => biometricService.listAssignmentTargets(),
    staleTime: 60_000,
  });
  const targets = useMemo(
    () => (targetsQuery.data ?? []).filter((target) => target.kind === kind),
    [targetsQuery.data, kind],
  );

  const historyQuery = useQuery({
    queryKey: ['biometric', 'assignments', picked?.applicant.id],
    queryFn: () => biometricService.listAssignments({ applicantId: picked!.applicant.id }),
    enabled: Boolean(picked),
  });

  const assign = useMutation({
    mutationFn: (target: AssignmentTarget) =>
      biometricService.assignApplicant({
        applicantId: picked!.applicant.id,
        nationalId: picked!.applicant.nationalId,
        kind: target.kind,
        targetId: target.id,
        targetLabel: target.label,
        operator,
      }),
    onSuccess: (record) => {
      toast(`تم تعيين ${record.applicantName} إلى ${record.targetLabel}`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['biometric', 'assignments', picked?.applicant.id] });
    },
    onError: () => toast('تعذّر حفظ التعيين', 'danger'),
  });

  const handleAssign = (): void => {
    const target = targets.find((option) => option.id === targetId);
    if (!target) {
      toast('اختر الجهة المراد التعيين إليها', 'warning');
      return;
    }
    assign.mutate(target);
  };

  return (
    <>
      <PageHeader title="تعيين المتقدمين" subtitle="تعيين المتقدم إلى بوابة أو لجنة أو نقطة تفتيش قبل تسجيل البصمة" />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <ApplicantSearchPanel
          picked={picked}
          onPick={(lookup) => {
            setPicked(lookup);
            setTargetId('');
          }}
        />

        <Card>
          <CardHeader title="بيانات التعيين" />
          <CardBody className="space-y-4">
            {!picked ? (
              <EmptyState icon={<Users size={32} />} title="ابحث عن متقدم لبدء التعيين" />
            ) : (
              <>
                <PickedApplicantCard lookup={picked} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="نوع الجهة"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value as AssignmentKind);
                      setTargetId('');
                    }}
                    options={KIND_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  />
                  <Select
                    label="الجهة"
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    options={[
                      { value: '', label: targetsQuery.isPending ? 'جارٍ التحميل…' : 'اختر الجهة' },
                      ...targets.map((target) => ({ value: target.id, label: target.label })),
                    ]}
                  />
                </div>
                <Button leadingIcon={<MapPin size={16} />} onClick={handleAssign} isLoading={assign.isPending} disabled={!targetId}>
                  تعيين المتقدم
                </Button>

                <div>
                  <CardHeader title="سجل تعيينات المتقدم" className="px-0" />
                  {historyQuery.isPending ? (
                    <p className="py-3 text-2xs text-ink-500">جارٍ التحميل…</p>
                  ) : (historyQuery.data ?? []).length === 0 ? (
                    <EmptyState icon={<History size={28} />} title="لا توجد تعيينات سابقة" />
                  ) : (
                    <div className="table-wrap mt-2">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>الجهة</th>
                            <th>النوع</th>
                            <th>المستخدم</th>
                            <th>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historyQuery.data ?? []).map((row) => (
                            <tr key={row.id}>
                              <td>{row.targetLabel}</td>
                              <td>{KIND_LABEL[row.kind]}</td>
                              <td>{row.operator}</td>
                              <td>{fmtDate(row.at, 'short')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ── 2. Committee attendance ───────────────────────────────────────── */

export function BiometricCommitteeAttendancePage(): JSX.Element {
  const queryClient = useQueryClient();
  const operator = useAuthStore((state) => state.user?.id ?? 'system');
  const [picked, setPicked] = useState<BiometricApplicantLookup | null>(null);
  const [committeeId, setCommitteeId] = useState('');
  const [verified, setVerified] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const targetsQuery = useQuery({
    queryKey: ['biometric', 'assignment-targets'],
    queryFn: () => biometricService.listAssignmentTargets(),
    staleTime: 60_000,
  });
  const committees = useMemo(
    () => (targetsQuery.data ?? []).filter((target) => target.kind === 'committee'),
    [targetsQuery.data],
  );

  const attendanceQuery = useQuery({
    queryKey: ['biometric', 'committee-attendance', committeeId, today],
    queryFn: () => biometricService.listCommitteeAttendance({ committeeId, date: today }),
    enabled: Boolean(committeeId),
  });

  const verify = useMutation({
    mutationFn: () =>
      biometricService.verify({
        applicantId: picked!.applicant.id,
        module: 'exam-committee',
        operator,
        stationCommittee: picked!.committee,
        today,
      }),
    onSuccess: (result) => {
      if (result.status === 'match') {
        setVerified(true);
        toast('تم التحقق من الهوية بنجاح', 'success');
      } else {
        setVerified(false);
        toast(result.reason ?? 'فشل التحقق من الهوية', 'danger');
      }
    },
    onError: () => toast('تعذّر تنفيذ التحقق', 'danger'),
  });

  const register = useMutation({
    mutationFn: () => {
      const committee = committees.find((option) => option.id === committeeId);
      return biometricService.registerCommitteeAttendance({
        applicantId: picked!.applicant.id,
        nationalId: picked!.applicant.nationalId,
        committeeId,
        committeeLabel: committee?.label ?? committeeId,
        operator,
      });
    },
    onSuccess: (record) => {
      toast(`تم تسجيل حضور ${record.applicantName}`, 'success');
      setPicked(null);
      setVerified(false);
      void queryClient.invalidateQueries({ queryKey: ['biometric', 'committee-attendance', committeeId, today] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'تعذّر تسجيل الحضور', 'danger'),
  });

  return (
    <>
      <PageHeader title="حضور اللجان" subtitle="التحقق من الهوية وتسجيل حضور المتقدم في لجان الاختبار والقومسيون مع منع التكرار" />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <ApplicantSearchPanel
          picked={picked}
          onPick={(lookup) => {
            setPicked(lookup);
            setVerified(false);
          }}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader title="تسجيل الحضور" />
            <CardBody className="space-y-4">
              {!picked ? (
                <EmptyState icon={<Users size={32} />} title="ابحث عن متقدم لتسجيل الحضور" />
              ) : (
                <>
                  <PickedApplicantCard lookup={picked} />
                  <Select
                    label="اللجنة"
                    value={committeeId}
                    onChange={(event) => setCommitteeId(event.target.value)}
                    options={[
                      { value: '', label: targetsQuery.isPending ? 'جارٍ التحميل…' : 'اختر اللجنة' },
                      ...committees.map((committee) => ({ value: committee.id, label: committee.label })),
                    ]}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      leadingIcon={verified ? <CheckCircle2 size={16} /> : <Fingerprint size={16} />}
                      onClick={() => verify.mutate()}
                      isLoading={verify.isPending}
                    >
                      {verified ? 'تم التحقق' : 'التحقق من الهوية'}
                    </Button>
                    <Button
                      leadingIcon={<ShieldCheck size={16} />}
                      onClick={() => register.mutate()}
                      isLoading={register.isPending}
                      disabled={!verified || !committeeId}
                    >
                      تسجيل الحضور
                    </Button>
                  </div>
                  {!verified && (
                    <p className="text-2xs text-ink-500">يجب التحقق من هوية المتقدم قبل تسجيل الحضور.</p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="حضور اليوم"
              actions={committeeId ? <Badge tone="neutral">{num((attendanceQuery.data ?? []).length)}</Badge> : undefined}
            />
            {!committeeId ? (
              <EmptyState icon={<Users size={28} />} title="اختر لجنة لعرض الحضور" />
            ) : attendanceQuery.isPending ? (
              <p className="p-5 text-2xs text-ink-500">جارٍ التحميل…</p>
            ) : (attendanceQuery.data ?? []).length === 0 ? (
              <EmptyState icon={<Users size={28} />} title="لا يوجد حضور مسجل اليوم" />
            ) : (
              <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>المتقدم</th>
                      <th>الرقم القومي</th>
                      <th>المستخدم</th>
                      <th>الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(attendanceQuery.data ?? []).map((row) => (
                      <tr key={row.id}>
                        <td>{row.applicantName}</td>
                        <td className="font-mono">{maskNationalId(row.nationalId)}</td>
                        <td>{row.operator}</td>
                        <td>{fmtDate(row.at, 'time')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ── 3. Enrollment history ─────────────────────────────────────────── */

export function BiometricEnrollmentHistoryPage(): JSX.Element {
  const [picked, setPicked] = useState<BiometricApplicantLookup | null>(null);

  const historyQuery = useQuery({
    queryKey: ['biometric', 'enrollment-history', picked?.applicant.id ?? 'all'],
    queryFn: () => biometricService.listEnrollmentHistory(picked ? { applicantId: picked.applicant.id } : {}),
  });

  const actionLabel: Record<string, string> = {
    enrollment: 'تسجيل بيومتري',
    re_enrollment: 'إعادة تسجيل',
    link_previous: 'ربط بيانات سابقة',
    device_bind: 'ربط جهاز',
  };

  return (
    <>
      <PageHeader title="سجل التسجيل" subtitle="متابعة جميع أنشطة التسجيل البيومتري للمتقدمين والأجهزة المسجّل عليها" />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <ApplicantSearchPanel picked={picked} onPick={setPicked} />
          {picked && (
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              عرض كل السجلات
            </Button>
          )}
        </div>

        <Card>
          <CardHeader
            title={picked ? `سجل تسجيل ${picked.applicant.name}` : 'أحدث أنشطة التسجيل'}
            actions={<Badge tone="neutral">{num((historyQuery.data ?? []).length)}</Badge>}
          />
          {historyQuery.isPending ? (
            <p className="p-5 text-2xs text-ink-500">جارٍ التحميل…</p>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <EmptyState icon={<History size={32} />} title="لا توجد أنشطة تسجيل" />
          ) : (
            <div className="table-wrap -mx-5 -mb-5" style={{ borderRadius: 0, border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>المتقدم</th>
                    <th>النشاط</th>
                    <th>الجهاز</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyQuery.data ?? []).map((row: EnrollmentHistoryEntry) => (
                    <tr key={row.id}>
                      <td>{row.applicantName}</td>
                      <td>{actionLabel[row.action] ?? row.action}</td>
                      <td className="font-mono text-2xs">{row.deviceEmpCode ?? '—'}</td>
                      <td>
                        <Badge tone={row.status === 'enrolled' ? 'success' : row.status === 'partial' ? 'warning' : 'neutral'}>
                          {row.status === 'enrolled' ? 'مسجل' : row.status === 'partial' ? 'جزئي' : '—'}
                        </Badge>
                      </td>
                      <td>{fmtDate(row.at, 'short')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
