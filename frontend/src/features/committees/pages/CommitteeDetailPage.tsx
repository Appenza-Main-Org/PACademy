/**
 * Committee detail + results entry + chair approval + bulk upload.
 * Source: RFP Scope Document §3 sections B, C, D, F.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  Hourglass,
  ListChecks,
  Pencil,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  SuspendedBadge,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { IconStamp } from '@/shared/components/icons';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import {
  useApproveResults,
  useBulkUploadResults,
  useCommittee,
  useCommitteeAssignedApplicants,
  useCommitteeQueue,
  useCommitteeResults,
  useCommitteeSpecializations,
  useEligibleOfficers,
  useEnterResult,
  useRejectResult,
} from '../api/committee.queries';
import { MOCK } from '@/shared/mock-data';
import type { Applicant, Committee, CommitteeResult } from '@/shared/types/domain';
import { formatCommitteeGrade } from '../lib/formatCommitteeGrade';
import { CommitteeEditDialog } from '../components/CommitteeEditDialog';

export function CommitteeDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: committee, isLoading, error, refetch } = useCommittee(id);
  const { data: queue } = useCommitteeQueue(id);
  const { data: results } = useCommitteeResults(id);
  const { data: specializations = [] } = useCommitteeSpecializations();
  const { data: officers = [] } = useEligibleOfficers();
  const { data: assignedApplicants = [] } = useCommitteeAssignedApplicants(id);
  const enterMut = useEnterResult(id);
  const approveMut = useApproveResults(id);
  const rejectMut = useRejectResult(id);
  const bulkMut = useBulkUploadResults(id);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [target, setTarget] = useState<Applicant | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<CommitteeResult | null>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!committee) return <CenteredShell><EmptyState variant="generic" title="اللجنة غير موجودة" /></CenteredShell>;

  const preliminary = (results ?? []).filter((r) => r.phase === 'preliminary');

  const queueColumns: DataTableColumn<Applicant>[] = [
    {
      key: 'applicant',
      label: 'المتقدم',
      render: (a) => {
        const suspended = a.status === 'on-hold';
        return (
          <div className="flex items-center gap-3">
            <Avatar name={a.name} size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-ink-900">{shortName(a.name, 4)}</span>
              <span className="text-2xs text-ink-500 font-mono" dir="ltr">{a.id}</span>
            </div>
            {suspended && <SuspendedBadge />}
          </div>
        );
      },
    },
    { key: 'gov', label: 'المحافظة', render: (a) => a.governorate, hideOn: 'sm' },
    { key: 'cert', label: 'الشهادة', render: (a) => a.certType, hideOn: 'sm' },
    {
      key: '_actions',
      label: <span className="sr-only">إدخال نتيجة</span>,
      align: 'end',
      render: (a) => {
        const suspended = a.status === 'on-hold';
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled={suspended}
            title={suspended ? 'هذا المتقدم موقوف — لا يمكن التعديل' : 'إدخال نتيجة'}
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            onClick={() => {
              setTarget(a);
              setDrawerOpen(true);
            }}
          >
            إدخال نتيجة
          </Button>
        );
      },
    },
  ];

  const resultColumns: DataTableColumn<CommitteeResult>[] = [
    { key: 'applicant', label: 'المتقدم', render: (r) => shortName(r.applicantName, 3) },
    {
      key: 'phase',
      label: 'الحالة',
      render: (r) => (
        <Badge tone={r.phase === 'final' ? 'success' : r.phase === 'rejected' ? 'danger' : 'warning'}>
          {r.phase === 'final' && <IconStamp width={12} height={12} className="me-1 inline-block" />}
          {r.phase === 'final' ? 'معتمد' : r.phase === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
        </Badge>
      ),
    },
    { key: 'passFail', label: 'النتيجة', render: (r) => (r.passFail === 'pass' ? <Badge tone="success">ناجح</Badge> : <Badge tone="danger">راسب</Badge>) },
    { key: 'enteredBy', label: 'بواسطة', render: (r) => shortName(r.enteredBy, 3), hideOn: 'sm' },
    { key: 'enteredAt', label: 'الوقت', render: (r) => <span className="text-2xs text-ink-500">{fmtDate(r.enteredAt, 'rel')}</span> },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (r) => (
        r.phase === 'preliminary' ? (
          <Button variant="ghost" size="sm" onClick={() => setRejectFor(r)}>رفض</Button>
        ) : null
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title={committee.name}
        subtitle={`رئيس اللجنة: ${committee.head} · الأعضاء: ${committee.members}`}
        breadcrumbs={[
          { label: 'اللجان', href: ROUTES.admin.adminLookupsType('committees') },
          { label: committee.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              leadingIcon={<Users size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.committee.applicants(id))}
            >
              عرض المتقدمين
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Pencil size={14} strokeWidth={1.75} />}
              onClick={() => setEditOpen(true)}
              aria-label="تعديل اللجنة"
            >
              تعديل
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
              onClick={() => setBulkOpen(true)}
            >
              رفع نتائج جماعي
            </Button>
            <Button
              variant="primary"
              leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
              disabled={selected.length === 0}
              onClick={() => {
                approveMut.mutate(selected.map(String), {
                  onSuccess: ({ approved }) => {
                    toast(`تم اعتماد ${approved} نتيجة`, 'success');
                    setSelected([]);
                  },
                });
              }}
            >
              اعتماد المحدد ({selected.length})
            </Button>
          </div>
        }
      />

      {/* ── Committee summary — officers, specs, capacity, rules ─────── */}
      <CommitteeSummary
        committee={committee}
        specializations={specializations}
        officers={officers}
        assignedCount={assignedApplicants.length}
      />

      {/* Two-phase workflow explainer */}
      <Card className="mb-5 border-s-4 border-gold-500 bg-gold-50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gold-500 text-white" aria-hidden>
              <ShieldCheck size={18} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="font-ar-display text-md font-bold text-gold-700">سياسة الاعتماد المزدوج</p>
              <p className="mt-1 text-2xs text-gold-700/85 leading-normal">
                النتيجة المُدخَلة من العضو تُحفظ كـ <strong>«قيد المراجعة»</strong>؛ ولا تُعتبر معتمدة إلا بعد توقيع
                رئيس اللجنة <strong>«{committee.head}»</strong> عليها — وذلك لمنع تغيير النتائج بصورة فردية.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-dashed border-gold-300 bg-surface-card px-3 py-2 text-2xs lg:flex">
            <Badge tone="warning">
              <Hourglass size={11} strokeWidth={1.75} className="me-1 inline-block" />
              قيد المراجعة
            </Badge>
            <Check size={12} strokeWidth={1.75} className="text-gold-700" aria-hidden />
            <Badge tone="success">
              <IconStamp width={11} height={11} className="me-1 inline-block" />
              معتمد
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard
          label="طابور اليوم"
          value={queue?.length ?? 0}
          icon={<Users size={16} strokeWidth={1.75} />}
          trend={{ label: 'بانتظار الاستدعاء', tone: 'neutral' }}
        />
        <StatCard
          label="قيد مراجعة الرئيس"
          value={preliminary.length}
          icon={<Hourglass size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
          trend={{ label: 'في انتظار التوقيع', tone: 'neutral' }}
        />
        <StatCard
          label="المعتمد"
          value={(results ?? []).filter((r) => r.phase === 'final').length}
          icon={<ClipboardCheck size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
          trend={{ label: 'مُسجَّل بالملف', tone: 'success' }}
        />
        <StatCard
          label="إجمالي المُسنَد"
          value={committee.applicants}
          icon={<CheckCircle2 size={16} strokeWidth={1.75} />}
          trend={{
            label: `${Math.round((committee.completed / Math.max(1, committee.applicants)) * 100)}% مكتمل`,
            tone: 'success',
          }}
        />
      </div>

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="طابور اليوم" subtitle="المتقدمون المسنّدون لهذه اللجنة اليوم" />
          <DataTable
            data={queue ?? []}
            columns={queueColumns}
            rowKey={(a) => a.id}
            empty={<EmptyState variant="no-applicants-yet" />}
            density="compact"
          />
        </Card>

        <Card>
          <CardHeader
            title="نتائج اليوم"
            subtitle={`${preliminary.length} قيد المراجعة · ${((results ?? []).length - preliminary.length)} نهائي`}
          />
          <DataTable
            data={results ?? []}
            columns={resultColumns}
            rowKey={(r) => r.id}
            empty={<EmptyState variant="no-results-medical" title="لم تُدخَل نتائج بعد" />}
            density="compact"
            selectionMode="multi"
            selectedRowKeys={selected}
            onSelectionChange={setSelected}
          />
        </Card>
      </div>

      <ResultEntryDrawer
        open={drawerOpen}
        applicant={target}
        onClose={() => setDrawerOpen(false)}
        onSubmit={(payload) => {
          enterMut.mutate(payload, {
            onSuccess: () => {
              toast('تم إدخال نتيجة أولية. تحتاج اعتماد رئيس اللجنة.', 'success');
              setDrawerOpen(false);
            },
          });
        }}
      />

      <Modal open={Boolean(rejectFor)} onClose={() => setRejectFor(null)} title="رفض النتيجة" size="sm">
        <Modal.Body>
          <p className="mb-3 text-sm text-ink-700">رفض النتيجة سيُعيدها للمستخدم لتصحيحها. أدخِل سبباً واضحاً للرفض.</p>
          <RejectReasonForm onConfirm={(reason) => {
            if (!rejectFor) return;
            rejectMut.mutate(
              { resultId: rejectFor.id, reason },
              { onSuccess: () => { toast('تم الرفض', 'warning'); setRejectFor(null); } },
            );
          }} />
        </Modal.Body>
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onConfirm={(rows) =>
          bulkMut.mutate(rows, {
            onSuccess: ({ imported, errors }) => {
              toast(`تم استيراد ${imported} نتيجة, ${errors.length} خطأ`, errors.length ? 'warning' : 'success');
              setBulkOpen(false);
            },
          })
        }
      />

      <CommitteeEditDialog
        committee={editOpen ? committee : null}
        onClose={() => setEditOpen(false)}
      />
    </CenteredShell>
  );
}

function ResultEntryDrawer({
  open,
  applicant,
  onClose,
  onSubmit,
}: {
  open: boolean;
  applicant: Applicant | null;
  onClose: () => void;
  onSubmit: (p: Parameters<ReturnType<typeof useEnterResult>['mutate']>[0]) => void;
}): JSX.Element {
  const [writtenTest, setWrittenTest] = useState(70);
  const [interview, setInterview] = useState(70);
  const [passFail, setPassFail] = useState<'pass' | 'fail'>('pass');
  const [notes, setNotes] = useState('');

  if (!applicant) {
    return (
      <Drawer open={open} onClose={onClose} title="إدخال نتيجة" size="sm">
        <Drawer.Body><EmptyState variant="generic" title="اختر متقدماً من الطابور" /></Drawer.Body>
      </Drawer>
    );
  }

  const total = writtenTest + interview;
  const avg = Math.round(total / 2);
  const passThreshold = 60;
  const meetsThreshold = avg >= passThreshold;

  return (
    <Drawer open={open} onClose={onClose} title={`إدخال نتيجة · ${shortName(applicant.name, 4)}`} size="md">
      <Drawer.Body>
        <div className="mb-4 flex items-center gap-3 rounded-md border border-border-subtle bg-ink-50 px-3 py-3">
          <Avatar name={applicant.name} size="md" />
          <div className="flex-1">
            <p className="font-medium text-ink-900">{applicant.name}</p>
            <p className="text-2xs text-ink-500 font-mono" dir="ltr">{applicant.id} · {applicant.nationalId}</p>
          </div>
          <div className="text-end">
            <p className="text-2xs text-ink-500">المحافظة</p>
            <p className="text-sm font-medium text-ink-900">{applicant.governorate}</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              applicantId: applicant.id,
              applicantName: applicant.name,
              enteredBy: 'النقيب وليد سامح الديب',
              scores: { writtenTest, interview },
              passFail,
              notes: notes || undefined,
            });
          }}
          className="flex flex-col gap-3"
        >
          <Input label="درجة الاختبار التحريري (من 100)" type="number" min={0} max={100} value={writtenTest} onChange={(e) => setWrittenTest(Number(e.target.value))} />
          <Input label="درجة المقابلة الشخصية (من 100)" type="number" min={0} max={100} value={interview} onChange={(e) => setInterview(Number(e.target.value))} />

          {/* Live score preview */}
          <div className="rounded-md border border-border-subtle bg-surface-card p-3">
            <p className="mb-2 text-2xs uppercase tracking-wide text-ink-500">المعاينة الحيّة</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xs text-ink-500">المجموع</p>
                <p className="mt-0.5 font-mono text-md font-bold tnum text-ink-900" dir="ltr">{total} / 200</p>
              </div>
              <div>
                <p className="text-2xs text-ink-500">المتوسط</p>
                <p className={'mt-0.5 font-mono text-md font-bold tnum ' + (meetsThreshold ? 'text-success' : 'text-terra-600')} dir="ltr">{avg}%</p>
              </div>
              <div>
                <p className="text-2xs text-ink-500">حدّ النجاح</p>
                <p className="mt-0.5 font-mono text-md font-bold tnum text-ink-700" dir="ltr">{passThreshold}%</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className={'h-full rounded-full ' + (meetsThreshold ? 'bg-success' : 'bg-terra-500')} style={{ width: `${Math.min(100, avg)}%` }} />
            </div>
          </div>

          <Select
            label="النتيجة"
            value={passFail}
            onChange={(e) => setPassFail(e.target.value as 'pass' | 'fail')}
            options={[
              { value: 'pass', label: 'ناجح' },
              { value: 'fail', label: 'راسب' },
            ]}
          />
          <Textarea label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
            ستُحفظ هذه النتيجة كـ <span className="font-bold">«قيد المراجعة»</span> ولن تُعتمد إلا بموافقة رئيس اللجنة.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" variant="primary" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>
              حفظ كنتيجة أوليّة
            </Button>
          </div>
        </form>
      </Drawer.Body>
    </Drawer>
  );
}

function RejectReasonForm({ onConfirm }: { onConfirm: (reason: string) => void }): JSX.Element {
  const [reason, setReason] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onConfirm(reason);
      }}
    >
      <Textarea label="سبب الرفض" required value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3 flex justify-end gap-2">
        <Button type="submit" variant="danger" leadingIcon={<Ban size={14} strokeWidth={1.75} />}>
          رفض
        </Button>
      </div>
    </form>
  );
}

interface SummaryEligibleOfficer {
  id: string;
  name: string;
  role: string;
}

interface SummarySpecialization {
  id: string;
  nameAr: string;
  code: string;
  active: boolean;
}

function CommitteeSummary({
  committee,
  specializations,
  officers,
  assignedCount,
}: {
  committee: Committee;
  specializations: SummarySpecialization[];
  officers: SummaryEligibleOfficer[];
  assignedCount: number;
}): JSX.Element {
  const capacity = committee.capacity ?? 0;
  const used = assignedCount || committee.applicants;
  const remaining = Math.max(0, capacity - used);
  const isFull = capacity > 0 && used >= capacity;

  const specs = (committee.specializationIds ?? [])
    .map((sid) => specializations.find((s) => s.id === sid))
    .filter((s): s is SummarySpecialization => Boolean(s));

  const officerObjs = (committee.officerIds ?? [])
    .map((oid) => officers.find((o) => o.id === oid))
    .filter((o): o is SummaryEligibleOfficer => Boolean(o));

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="معلومات اللجنة" />
        <div className="grid grid-cols-2 gap-4 p-4">
          <SummaryItem label="رئيس اللجنة" value={committee.head} />
          <SummaryItem label="عدد الضباط" value={String(officerObjs.length || committee.members)} />
          <SummaryItem label="العام الدراسي" value={committee.academicYearId ?? '—'} />
          <SummaryItem
            label="الحالة"
            value={
              committee.status === 'inactive' ? (
                <Badge tone="neutral">موقوفة</Badge>
              ) : isFull ? (
                <Badge tone="danger">مكتمل</Badge>
              ) : (
                <Badge tone="success">مفعّلة</Badge>
              )
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="السعة" subtitle="السعة الكلية / المسنّد / المتبقي" />
        <div className="p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xs text-ink-500">المسنّد</p>
              <p className="font-mono text-xl font-bold tnum text-ink-900" dir="ltr">
                {num(used)} / {num(capacity || used)}
              </p>
            </div>
            <Badge tone={isFull ? 'danger' : 'success'}>
              {capacity > 0 ? `${num(remaining)} متبقي` : 'بدون سقف'}
            </Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full"
              style={{
                width: capacity > 0 ? `${Math.min(100, Math.round((used / capacity) * 100))}%` : '0%',
                background: isFull ? 'var(--terra-500)' : 'var(--accent-500)',
              }}
            />
          </div>
          {isFull && (
            <p className="mt-3 text-2xs text-terra-700">
              ⚠ اللجنة بلغت السعة القصوى — تم إيقاف التوزيع التلقائي.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="التخصصات المرتبطة" />
        <div className="p-4">
          {specs.length === 0 ? (
            <p className="text-2xs text-ink-500">لا توجد تخصصات معيّنة لهذه اللجنة.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {specs.map((s) => (
                <Badge key={s.id} tone="brand">
                  {s.nameAr}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="شروط التوزيع" subtitle="الفئة، السعة، معيار القبول" />
        <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          <SummaryItem
            label="الفئة"
            value={
              MOCK.categories.find((cat) => cat.key === committee.categoryKey)?.labelAr ??
              committee.categoryKey
            }
          />
          <SummaryItem label="السعة" value={num(committee.capacity)} />
          <SummaryItem
            label="المسنّد"
            value={num(committee.applicants)}
          />
          <SummaryItem label="معيار القبول" value={formatCommitteeGrade(committee)} />
        </div>
      </Card>

      {officerObjs.length > 0 && (
        <Card className="lg:col-span-3">
          <CardHeader title="الضباط المعيّنون" />
          <div className="flex flex-wrap gap-2 p-4">
            {officerObjs.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-3 py-1.5 text-xs"
              >
                <Avatar name={o.name} size="sm" />
                <span className="font-medium text-ink-900">{o.name}</span>
                {o.id === committee.headUserId && <Badge tone="warning">رئيس</Badge>}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="text-2xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}

function BulkUploadModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: Record<string, unknown>[]) => void;
}): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title="رفع نتائج جماعي" size="md">
      <Modal.Body>
        <p className="mb-3 text-sm text-ink-700">
          نزّل النموذج الفارغ، املأ النتائج، ثم ارفع الملف للتحقق منه قبل اعتماده.
        </p>
        <Button
          variant="secondary"
          leadingIcon={<FileSpreadsheet size={14} strokeWidth={1.75} />}
          onClick={() => toast('تنزيل النموذج — متاح في Sprint 10 مع xlsx الأصلي', 'info')}
        >
          تنزيل نموذج Excel
        </Button>
        <p className="mt-4 text-2xs text-ink-500">
          Sprint 10 يضيف parsing فعلي لـ xlsx؛ مؤقتاً يقبل الـ mock أي صفوف.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button
          variant="primary"
          leadingIcon={<Check size={14} strokeWidth={1.75} />}
          onClick={() =>
            onConfirm([
              { applicantId: 'APP-2026000005', passFail: 'pass' },
              { applicantId: 'APP-2026000006', passFail: 'fail' },
            ])
          }
        >
          استيراد بيانات تجريبية
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
