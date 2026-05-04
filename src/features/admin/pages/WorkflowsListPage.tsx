/**
 * WorkflowsListPage — Department workflow configurator landing.
 * Source: RFP §3 / §6 (per-department test pipelines).
 *
 * One card per department. Existing departments deep-link to the editor;
 * empty departments offer an "إنشاء" CTA that opens the editor pre-set to
 * that department.
 */

import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, PlusCircle, Workflow } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconStamp,
  LoadingState,
  PageHeader,
  Skeleton,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import {
  DEPARTMENT_LABELS,
  type DepartmentKey,
  type DepartmentWorkflow,
} from '@/shared/types/domain';
import { useWorkflows } from '../api/workflows.queries';

const DEPARTMENT_KEYS: DepartmentKey[] = [
  'general_first',
  'general_second',
  'special',
  'lawyers',
  'masters',
  'doctorate',
];

export function WorkflowsListPage(): JSX.Element {
  const { data, isLoading, error, refetch } = useWorkflows();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="إعدادات سير العمل"
          subtitle="تكوين مراحل القبول لكل قسم وربطها بالاختبارات والشروط"
          breadcrumbs={[
            { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
            { label: 'سير العمل' },
          ]}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DEPARTMENT_KEYS.map((k) => (
            <Skeleton key={k} height={172} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="إعدادات سير العمل" />
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      </div>
    );
  }

  const workflows = data ?? [];
  const byDept = new Map<DepartmentKey, DepartmentWorkflow>();
  for (const wf of workflows) byDept.set(wf.department, wf);

  if (workflows.length === 0) {
    return (
      <div>
        <PageHeader title="إعدادات سير العمل" />
        <EmptyState
          variant="generic"
          title="لا توجد سير عمل بعد"
          description="ابدأ بإنشاء سير عمل لكل قسم لتعريف مراحل القبول والاختبارات المطلوبة."
          icon={<Workflow size={32} strokeWidth={1.6} />}
          action={
            <Button
              variant="primary"
              leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.admin.workflowNew)}
            >
              سير عمل جديد
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="إعدادات سير العمل"
        subtitle="تكوين مراحل القبول لكل قسم وربطها بالاختبارات والشروط"
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'سير العمل' },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.workflowNew)}
          >
            سير عمل جديد
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENT_KEYS.map((dept) => {
          const wf = byDept.get(dept);
          if (!wf) return <DepartmentEmptyCard key={dept} department={dept} />;
          return <WorkflowCard key={wf.id} workflow={wf} />;
        })}
      </div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: DepartmentWorkflow }): JSX.Element {
  const stageCount = workflow.stages.length;
  const totalTests = workflow.stages.reduce((acc, s) => acc + s.tests.length, 0);
  const status = workflow.isActive ? 'نشط' : 'مسوّدة';
  const tone: 'success' | 'warning' = workflow.isActive ? 'success' : 'warning';
  return (
    <Card variant="feature" className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-md font-bold text-ink-900">
            {DEPARTMENT_LABELS[workflow.department]}
          </p>
          <p className="mt-1 truncate text-2xs text-ink-500">
            {workflow.name}
          </p>
        </div>
        <Badge tone={tone}>
          {workflow.isActive && <IconStamp width={12} height={12} className="me-1 inline-block" />}
          {status}
        </Badge>
      </header>

      <dl className="grid grid-cols-3 gap-3 rounded-md border border-border-subtle bg-ink-50/60 p-3 text-center">
        <Stat label="مراحل" value={String(stageCount)} />
        <Stat label="اختبارات" value={String(totalTests)} />
        <Stat label="الإصدار" value={`v${workflow.version}`} />
      </dl>

      <p className="text-2xs text-ink-500">
        آخر تحديث: {fmtDate(workflow.updatedAt, 'rel')}
      </p>

      <footer className="flex items-center justify-between gap-2 pt-1">
        <Link
          to={ROUTES.admin.workflowEdit(workflow.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 text-sm text-ink-900 transition-colors duration-fast ease-standard hover:bg-ink-50"
        >
          <span>تعديل</span>
          <ChevronLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />
        </Link>
        <span className="text-2xs text-ink-400">
          الدورة: <span dir="ltr" className="font-mono">{workflow.cycleId}</span>
        </span>
      </footer>
    </Card>
  );
}

function DepartmentEmptyCard({ department }: { department: DepartmentKey }): JSX.Element {
  const navigate = useNavigate();
  return (
    <Card className="flex flex-col items-start gap-3 border-dashed">
      <header className="min-w-0">
        <p className="text-md font-bold text-ink-900">{DEPARTMENT_LABELS[department]}</p>
        <p className="mt-1 text-2xs text-ink-500">
          لم يتم إنشاء سير عمل لهذا القسم بعد.
        </p>
      </header>
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
        onClick={() => navigate(`${ROUTES.admin.workflowNew}?department=${department}`)}
      >
        إنشاء سير عمل
      </Button>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-numeric tnum text-md font-bold text-ink-900" dir="ltr">
        {value}
      </span>
      <span className="text-2xs text-ink-500">{label}</span>
    </div>
  );
}

/* `LoadingState` is referenced for graceful fallback when re-fetches happen; */
void LoadingState;
