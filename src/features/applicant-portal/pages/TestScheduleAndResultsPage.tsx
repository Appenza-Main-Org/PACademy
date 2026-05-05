/**
 * TestScheduleAndResultsPage — Bucket C.
 *
 * Four sections:
 *  1. Next required action banner (sticky-feeling card at top).
 *  2. Current test details (when there's a scheduled/attended/pending test).
 *  3. Previous tests history (DataTable, sortable by date).
 *  4. Per-test-kind instructions (canned copy from lib/test-instructions).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  HelpCircle,
  Home,
  Info,
  MapPin,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import type { TestSchedule, TestStatus } from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import {
  TEST_KIND_ICON,
  TEST_KIND_LABEL_AR,
} from '../lib/category-test-labels';
import {
  useApplicantTests,
  useCurrentTest,
} from '../api/test-schedule.queries';
import { TestTimeline } from '../components/TestTimeline';
import { TestInstructionsCards } from '../components/TestInstructionsCards';

const APPLICANT_ID = 'APP-2026000';

const LINK_GHOST =
  'inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-semibold text-teal-600 transition-colors duration-fast ease-standard hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none';

const LINK_SECONDARY =
  'inline-flex items-center gap-2 h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm font-semibold text-ink-900 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none';

const STATUS_LABEL: Record<TestStatus, string> = {
  scheduled: 'محدد',
  attended: 'تم الحضور',
  missed: 'متخلف عنه',
  passed: 'ناجح',
  failed: 'راسب',
  pending_result: 'في انتظار النتيجة',
};

const STATUS_TONE: Record<TestStatus, 'success' | 'warning' | 'info' | 'neutral' | 'danger'> = {
  scheduled: 'info',
  attended: 'info',
  missed: 'warning',
  passed: 'success',
  failed: 'danger',
  pending_result: 'neutral',
};

export function TestScheduleAndResultsPage(): JSX.Element {
  const listQuery = useApplicantTests(APPLICANT_ID);
  const currentQuery = useCurrentTest(APPLICANT_ID);
  const [drawerTest, setDrawerTest] = useState<TestSchedule | null>(null);

  if (listQuery.isLoading || currentQuery.isLoading) return <LoadingState variant="page" />;
  if (listQuery.error) {
    return <ErrorState error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  }

  const tests = listQuery.data ?? [];
  const current = currentQuery.data ?? null;
  const past = tests.filter((t) => t.status === 'passed' || t.status === 'failed' || t.status === 'missed');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="مواعيد ونتائج الاختبارات"
        subtitle="تابع جدول اختباراتك القادمة ونتائج الاختبارات السابقة"
        breadcrumbs={[
          { label: 'الرئيسية', href: ROUTES.hub },
          { label: 'بوابة المتقدم', href: ROUTES.applicant },
          { label: 'مواعيد ونتائج الاختبارات' },
        ]}
        actions={
          <>
            <Link to={ROUTES.applicant} className={LINK_GHOST}>
              <ArrowRight size={16} className="rtl:rotate-180" /> بوابة المتقدم
            </Link>
            <Link to={ROUTES.hub} className={LINK_SECONDARY}>
              <Home size={16} />
              الرئيسية
            </Link>
          </>
        }
      />

      <NextActionBanner test={current} hasAnyTest={tests.length > 0} />

      <TestTimeline tests={tests} />

      {current && (current.status === 'scheduled' || current.status === 'attended' || current.status === 'pending_result') && (
        <CurrentTestDetails test={current} />
      )}

      {past.length > 0 && (
        <Card>
          <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">سجل الاختبارات السابقة</h3>
          <PreviousTestsTable tests={past} onViewInstructions={setDrawerTest} />
        </Card>
      )}

      <TestInstructionsCards tests={tests} />

      <Drawer open={Boolean(drawerTest)} onClose={() => setDrawerTest(null)} title="تعليمات الاختبار">
        {drawerTest && (
          <Drawer.Body>
            <div className="flex flex-col gap-3">
              <p className="font-ar-display text-md font-bold text-ink-900">
                {TEST_KIND_LABEL_AR[drawerTest.kind]}
              </p>
              <ul className="space-y-1.5 text-sm text-ink-700">
                {drawerTest.instructions.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {drawerTest.notes && (
                <div className="mt-2 rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
                  <p className="font-bold">ملاحظات</p>
                  <p className="mt-1">{drawerTest.notes}</p>
                </div>
              )}
            </div>
          </Drawer.Body>
        )}
      </Drawer>
    </div>
  );
}

function NextActionBanner({
  test,
  hasAnyTest,
}: {
  test: TestSchedule | null;
  hasAnyTest: boolean;
}): JSX.Element {
  if (!hasAnyTest) {
    return (
      <EmptyState
        variant="generic"
        title="لم يتم تحديد مواعيد اختبارات بعد"
        description="ستظهر هنا مواعيد اختباراتك بمجرد تحديدها من قبل إدارة القبول."
      />
    );
  }

  if (!test) {
    return (
      <Card variant="elevated">
        <p className="font-ar-display text-md font-bold text-ink-900">
          تم استكمال جميع اختباراتك المسجلة
        </p>
        <p className="mt-1 text-sm text-ink-500">
          تابع تحديثات حالة طلبك من صفحة "متابعة الإجراءات".
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="border-l-2 border-l-teal-500">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <NextActionIcon status={test.status} />
        </span>
        <div className="flex-1">
          <p className="font-ar-display text-md font-bold text-ink-900">
            <NextActionTitle test={test} />
          </p>
          <p className="mt-1 text-sm text-ink-500">
            <NextActionBody test={test} />
          </p>
        </div>
        <Badge tone={STATUS_TONE[test.status]}>{STATUS_LABEL[test.status]}</Badge>
      </div>
    </Card>
  );
}

function NextActionIcon({ status }: { status: TestStatus }): JSX.Element {
  switch (status) {
    case 'scheduled':
      return <CalendarClock size={20} strokeWidth={1.75} />;
    case 'attended':
    case 'pending_result':
      return <Info size={20} strokeWidth={1.75} />;
    case 'passed':
      return <CheckCircle2 size={20} strokeWidth={1.75} />;
    case 'failed':
      return <XCircle size={20} strokeWidth={1.75} />;
    case 'missed':
      return <AlertTriangle size={20} strokeWidth={1.75} />;
  }
}

function NextActionTitle({ test }: { test: TestSchedule }): JSX.Element {
  switch (test.status) {
    case 'scheduled':
      return <>احضر اختبار {TEST_KIND_LABEL_AR[test.kind]}</>;
    case 'attended':
    case 'pending_result':
      return <>في انتظار نتيجة اختبار {TEST_KIND_LABEL_AR[test.kind]}</>;
    case 'passed':
      return <>اجتزت اختبار {TEST_KIND_LABEL_AR[test.kind]} — انتقل للخطوة التالية</>;
    case 'failed':
      return <>لم تجتز اختبار {TEST_KIND_LABEL_AR[test.kind]}</>;
    case 'missed':
      return <>تخلفت عن اختبار {TEST_KIND_LABEL_AR[test.kind]} — راجع إدارة القبول</>;
  }
}

function NextActionBody({ test }: { test: TestSchedule }): JSX.Element {
  switch (test.status) {
    case 'scheduled':
      return (
        <>
          <span className="font-numeric tnum">{fmtDate(test.scheduledAt, 'short')}</span>
          {' · '}
          <span>{test.location}</span>
        </>
      );
    case 'attended':
    case 'pending_result':
      return <>سيتم إخطارك فور صدور النتيجة.</>;
    case 'passed':
      return <>{test.notes ?? 'يمكنك المتابعة للاختبار التالي.'}</>;
    case 'failed':
      return <>{test.notes ?? 'تواصل مع إدارة القبول لمعرفة الخطوات المتاحة.'}</>;
    case 'missed':
      return <>تواصل مع إدارة القبول على 19000.</>;
  }
}

function CurrentTestDetails({ test }: { test: TestSchedule }): JSX.Element {
  const Icon = TEST_KIND_ICON[test.kind];
  return (
    <Card>
      <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">تفاصيل الاختبار الحالي</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow icon={<Icon size={14} strokeWidth={1.75} />} label="نوع الاختبار" value={TEST_KIND_LABEL_AR[test.kind]} />
        <DetailRow
          icon={<CalendarClock size={14} strokeWidth={1.75} />}
          label="الموعد"
          value={fmtDate(test.scheduledAt, 'short')}
        />
        <DetailRow
          icon={<MapPin size={14} strokeWidth={1.75} />}
          label="المكان"
          value={test.location}
          fullWidth
        />
      </div>

      {test.instructions.length > 0 && (
        <section className="mt-4">
          <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">التعليمات</h4>
          <ul className="space-y-1.5 text-sm text-ink-700">
            {test.instructions.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
  fullWidth,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  fullWidth?: boolean;
}): JSX.Element {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-ink-500">
        {icon}
        <span>{label}</span>
      </p>
      <p className="mt-1 text-sm text-ink-900">{value}</p>
    </div>
  );
}

function PreviousTestsTable({
  tests,
  onViewInstructions,
}: {
  tests: TestSchedule[];
  onViewInstructions: (t: TestSchedule) => void;
}): JSX.Element {
  const columns: DataTableColumn<TestSchedule>[] = [
    {
      key: 'date',
      label: 'التاريخ',
      render: (t) => <span className="font-numeric tnum">{fmtDate(t.scheduledAt, 'short')}</span>,
    },
    {
      key: 'kind',
      label: 'نوع الاختبار',
      render: (t) => TEST_KIND_LABEL_AR[t.kind],
    },
    {
      key: 'status',
      label: 'النتيجة',
      render: (t) => <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>,
    },
    {
      key: 'score',
      label: 'الدرجة',
      numeric: true,
      render: (t) => (t.score !== undefined ? `${t.score}%` : '—'),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (t) => (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<HelpCircle size={12} strokeWidth={1.75} />}
          onClick={() => onViewInstructions(t)}
        >
          عرض التعليمات
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={tests}
      columns={columns}
      rowKey={(t) => t.id}
      zebraStripes
    />
  );
}


