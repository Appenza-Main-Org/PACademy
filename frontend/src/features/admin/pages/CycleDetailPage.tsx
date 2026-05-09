/**
 * CycleDetailPage — full configuration of one admission cycle.
 * Source: Tasks/KARASA_GAPS.md §1.2.D.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ChevronRight, Copy, ListChecks, PauseCircle, PlayCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconStamp,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import {
  useCycle,
  useCycleActivate,
  useCycleArchive,
  useCycleClone,
  useCycleClose,
  useCycleTransition,
  useToggleCycleCategory,
} from '../api/cycles.queries';
import { useCategoriesAdmin } from '../api/categories.queries';
import { useRulesForCycle } from '../api/admissionRules.queries';
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategory,
  CycleStatus,
} from '@/shared/types/domain';


const STATUS_OPTIONS: CycleStatus[] = ['draft', 'open', 'active', 'closed', 'processing', 'finalized', 'archived'];

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

export function CycleDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: cycle, isLoading, error, refetch } = useCycle(id);
  const { data: rules } = useRulesForCycle(id);
  const { data: categories = [] } = useCategoriesAdmin();
  const cloneMut = useCycleClone();
  const transitionMut = useCycleTransition();
  const activateMut = useCycleActivate();
  const closeMut = useCycleClose();
  const archiveMut = useCycleArchive();
  const toggleCategoryMut = useToggleCycleCategory();
  const [pendingTransition, setPendingTransition] = useState<'activate' | 'close' | 'archive' | null>(null);

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!cycle) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="الدورة غير موجودة" />
      </CenteredShell>
    );
  }

  const fillPct = Math.round((cycle.applicantCount / Math.max(1, cycle.expectedCapacity)) * 100);

  return (
    <CenteredShell>
      <PageHeader
        title={cycle.nameAr}
        subtitle={`دورة عام ${cycle.year} · ${cycle.cohort === 'male' ? 'ذكور' : 'إناث'}`}
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'الدورات', href: ROUTES.admin.cycles },
          { label: cycle.nameAr },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Copy size={14} strokeWidth={1.75} />}
              onClick={() => {
                cloneMut.mutate(cycle.id, {
                  onSuccess: (next) => toast(`تم إنشاء نسخة: ${next.nameAr}`, 'success'),
                  onError: (err) => toast((err as Error).message, 'warning'),
                });
              }}
            >
              نسخ كمسودة
            </Button>
            <Link to={ROUTES.admin.admissionRules} className="inline-flex">
              <Button
                variant="primary"
                leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
                trailingIcon={<ChevronRight size={14} strokeWidth={1.75} />}
              >
                شروط القبول
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-500">السعة المتوقعة</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">
            {num(cycle.expectedCapacity)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">المتقدمون حتى الآن</p>
          <p className="mt-1 text-2xl font-bold font-numeric tnum text-ink-900">
            {num(cycle.applicantCount)}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, fillPct)}%`, background: 'var(--accent-500)' }} />
          </div>
          <p className="mt-1 text-2xs text-ink-500">{fillPct}% من السعة</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-500">الفترة</p>
          <p className="mt-1 text-sm text-ink-900">
            {fmtDate(cycle.openDate, 'short')} إلى {fmtDate(cycle.closeDate, 'short')}
          </p>
          <div className="mt-3">
            <Select
              label="الحالة"
              value={cycle.status}
              onChange={(e) => {
                transitionMut.mutate(
                  { id: cycle.id, next: e.target.value as CycleStatus },
                  { onSuccess: () => toast('تم تحديث حالة الدورة', 'success') },
                );
              }}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>
        </Card>
      </div>

      <CategoriesPanel
        cycle={cycle}
        categories={categories}
        readOnly={cycle.status === 'archived' || cycle.status === 'finalized'}
        onToggle={(categoryKey, config) => {
          toggleCategoryMut.mutate(
            { cycleId: cycle.id, categoryKey, config },
            { onSuccess: () => toast('تم تحديث حالة الفئة', 'success') },
          );
        }}
      />

      <LifecycleActions
        cycle={cycle}
        onRequest={setPendingTransition}
      />

      <section className="mt-6">
        <h2 className="mb-3 font-ar-display text-xl font-bold text-ink-900">سجل تحديثات شروط القبول</h2>
        <Card>
          <ul className="flex flex-col">
            {(rules ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    النسخة <span className="font-numeric tnum" dir="ltr">{r.version}</span>
                  </p>
                  <p className="text-xs text-ink-500">{r.changedBy.name} · {fmtDate(r.effectiveAt, 'short')}</p>
                </div>
                <Badge tone={r.version === 1 ? 'neutral' : 'info'}>
                  {r.version === 1 ? 'الإصدار الأول' : `تعديل #${r.version - 1}`}
                </Badge>
              </li>
            ))}
            {(rules ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-ink-500">لم يتم حفظ شروط بعد</li>
            )}
          </ul>
        </Card>
      </section>

      <Modal
        open={pendingTransition !== null}
        onClose={() => setPendingTransition(null)}
        title={
          pendingTransition === 'activate'
            ? 'تأكيد تفعيل الدورة'
            : pendingTransition === 'close'
            ? 'تأكيد إغلاق الدورة'
            : 'تأكيد أرشفة الدورة'
        }
        size="md"
      >
        <Modal.Body>
          {pendingTransition === 'activate' && (
            <p className="text-sm text-ink-700">
              سيتم تفعيل دورة "{cycle.nameAr}" وإغلاق أي دورة نشطة أخرى تلقائياً. هل تريد المتابعة؟
            </p>
          )}
          {pendingTransition === 'close' && (
            <p className="text-sm text-ink-700">
              سيتم إغلاق دورة "{cycle.nameAr}". لن يتمكن المتقدمون الجدد من التقديم. هل تريد المتابعة؟
            </p>
          )}
          {pendingTransition === 'archive' && (
            <p className="text-sm text-ink-700">
              سيتم أرشفة دورة "{cycle.nameAr}" وإخراجها من قائمة الدورات النشطة. هل تريد المتابعة؟
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPendingTransition(null)}>إلغاء</Button>
          <Button
            variant="primary"
            isLoading={activateMut.isPending || closeMut.isPending || archiveMut.isPending}
            onClick={() => {
              const handlers = { onSuccess: () => toast('تم تحديث الدورة', 'success'), onError: (err: Error) => toast(err.message, 'danger') };
              if (pendingTransition === 'activate') activateMut.mutate(cycle.id, handlers);
              else if (pendingTransition === 'close') closeMut.mutate(cycle.id, handlers);
              else if (pendingTransition === 'archive') archiveMut.mutate(cycle.id, handlers);
              setPendingTransition(null);
            }}
          >
            تأكيد
          </Button>
        </Modal.Footer>
      </Modal>
    </CenteredShell>
  );
}

function CategoriesPanel({
  cycle,
  categories,
  readOnly,
  onToggle,
}: {
  cycle: AdmissionCycle;
  categories: ApplicantCategory[];
  readOnly: boolean;
  onToggle: (key: ApplicantCategory['key'], config: AdmissionCycleCategoryConfig) => void;
}): JSX.Element {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-ar-display text-xl font-bold text-ink-900">حالة الفئات في هذه الدورة</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 text-start">الفئة</th>
                <th className="py-2 text-start">النوع</th>
                <th className="py-2 text-start">الحالة</th>
                <th className="py-2 text-start">السعة</th>
                <th className="py-2 text-start">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const cfg = cycle.openCategories?.[cat.key] ?? {
                  isOpen: false,
                  capacity: null,
                  notes: '',
                };
                return (
                  <CategoryRow
                    key={cat.key}
                    cycle={cycle}
                    category={cat}
                    config={cfg}
                    readOnly={readOnly}
                    onToggle={(c) => onToggle(cat.key, c)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function CategoryRow({
  cycle,
  category,
  config,
  readOnly,
  onToggle,
}: {
  cycle: AdmissionCycle;
  category: ApplicantCategory;
  config: AdmissionCycleCategoryConfig;
  readOnly: boolean;
  onToggle: (config: AdmissionCycleCategoryConfig) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(config);
  const dirty =
    draft.isOpen !== config.isOpen ||
    draft.capacity !== config.capacity ||
    draft.notes !== config.notes;

  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="py-3 font-medium text-ink-900">{category.labelAr}</td>
      <td className="py-3">
        {category.conditions.nominationOnly ? (
          <Badge tone="warning">بالترشيح</Badge>
        ) : (
          <Badge tone="neutral">تقديم عام</Badge>
        )}
      </td>
      <td className="py-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={draft.isOpen}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, isOpen: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          {draft.isOpen ? 'مفتوح' : 'مغلق'}
        </label>
      </td>
      <td className="py-3">
        <Input
          type="number"
          value={draft.capacity ?? ''}
          disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, capacity: e.target.value ? Number(e.target.value) : null })}
          containerClassName="!mb-0"
          className="w-24"
        />
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <Textarea
            value={draft.notes}
            disabled={readOnly}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            containerClassName="!mb-0 flex-1"
            rows={1}
          />
          {dirty && !readOnly && (
            <Button variant="primary" size="sm" onClick={() => onToggle(draft)}>
              حفظ
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
  void cycle;
}

function LifecycleActions({
  cycle,
  onRequest,
}: {
  cycle: AdmissionCycle;
  onRequest: (next: 'activate' | 'close' | 'archive') => void;
}): JSX.Element {
  const isActive = cycle.status === 'active' || cycle.status === 'open';
  const isClosed = cycle.status === 'closed' || cycle.status === 'finalized' || cycle.status === 'processing';
  const isArchived = cycle.status === 'archived';
  return (
    <section className="mt-6">
      <Card variant="elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-ar-display text-md font-bold text-ink-900">إجراءات الدورة</h3>
            <p className="mt-0.5 text-2xs text-ink-500">
              تفعيل / إغلاق / أرشفة هذه الدورة
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isActive && !isArchived && (
              <Button
                variant="primary"
                leadingIcon={<PlayCircle size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('activate')}
              >
                تفعيل
              </Button>
            )}
            {isActive && (
              <Button
                variant="secondary"
                leadingIcon={<PauseCircle size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('close')}
              >
                إغلاق
              </Button>
            )}
            {isClosed && (
              <Button
                variant="ghost"
                leadingIcon={<Archive size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('archive')}
              >
                أرشفة
              </Button>
            )}
            {isActive && (
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                نشطة
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
