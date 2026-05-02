/**
 * Committee detail + results entry + chair approval + bulk upload.
 * Source: KARASA §3 sections B, C, D, F.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Ban, Check, FileSpreadsheet, ListChecks, Pencil, Upload } from 'lucide-react';
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
  SuspendedBadge,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import {
  useApproveResults,
  useBulkUploadResults,
  useCommittee,
  useCommitteeQueue,
  useCommitteeResults,
  useEnterResult,
  useRejectResult,
} from '../api/committee.queries';
import type { Applicant, CommitteeResult } from '@/shared/types/domain';

export function CommitteeDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: committee, isLoading, error, refetch } = useCommittee(id);
  const { data: queue } = useCommitteeQueue(id);
  const { data: results } = useCommitteeResults(id);
  const enterMut = useEnterResult(id);
  const approveMut = useApproveResults(id);
  const rejectMut = useRejectResult(id);
  const bulkMut = useBulkUploadResults(id);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [target, setTarget] = useState<Applicant | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<CommitteeResult | null>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);

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
          { label: 'لجان القبول', href: ROUTES.committee.list },
          { label: committee.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-500">طابور اليوم</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">{num(queue?.length ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">قيد المراجعة</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">{num(preliminary.length)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">المعتمد إجمالاً</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">{num((results ?? []).filter((r) => r.phase === 'final').length)}</p>
        </Card>
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

  return (
    <Drawer open={open} onClose={onClose} title={`إدخال نتيجة · ${shortName(applicant.name, 4)}`} size="md">
      <Drawer.Body>
        <div className="mb-4 rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-sm">
          <p className="font-medium text-ink-900">{applicant.name}</p>
          <p className="text-2xs text-ink-500 font-mono" dir="ltr">{applicant.id} · {applicant.nationalId}</p>
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
          <Input label="درجة الاختبار التحريري" type="number" min={0} max={100} value={writtenTest} onChange={(e) => setWrittenTest(Number(e.target.value))} />
          <Input label="درجة المقابلة الشخصية" type="number" min={0} max={100} value={interview} onChange={(e) => setInterview(Number(e.target.value))} />
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
              حفظ
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
