/**
 * Step 9 — MergeSplitApplyDrawer (spec 009 T057).
 *
 * Opens when the admin clicks "تطبيق" on a planned merge/split rule.
 * Workflow:
 *   1. On open → POST /merge-split-rules/{id}/preview (lazy via refetch)
 *   2. Render impact summary (counts) + applicant-moves table + capacity
 *      changes list + broken-references warning if any.
 *   3. Admin clicks "تأكيد التطبيق" → POST /merge-split-rules/{id}/apply
 *      with confirmPreviewHash + rowVersion. Server runs the cross-module
 *      transaction (≤10s for 5k applicants) and emits merge_rule_applied
 *      audit.
 *   4. On success → close drawer + invalidate rule list + committees cache.
 *
 * Errors handled:
 *   - 409 ROW_VERSION_CONFLICT: rule changed mid-flight → typed dialog
 *     auto-surfaces via the apiClient interceptor; user re-opens the rule.
 *   - Other 409/422: red Arabic toast from the error message.
 *
 * The applicants table is paginated client-side (default page size 50,
 * keeps the DOM light even for 5k-row previews — server caps preview to
 * the moves; if it ever exceeds the typical wizard scale we'd switch to
 * server pagination).
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  toast,
  type DataTableColumn,
} from '@/shared/components';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type {
  CommitteeMergeSplitRule,
  MergeSplitPreviewDto,
} from '../types';
import {
  useApplyMergeSplitRule,
  useMergeSplitPreview,
} from '../api/admission-setup.queries';

export interface MergeSplitApplyDrawerProps {
  open: boolean;
  onClose: () => void;
  rule: CommitteeMergeSplitRule | null;
  /** cycleId for cache invalidation on success. */
  cycleId: string | null;
  /** Map of committeeId → display label, used to humanize the moves table. */
  committeeNames: Record<string, string>;
}

interface MoveRow {
  applicantId: string;
  fromCommitteeId: string;
  toCommitteeId: string;
}

const PAGE_SIZE = 50;

export function MergeSplitApplyDrawer({
  open,
  onClose,
  rule,
  cycleId,
  committeeNames,
}: MergeSplitApplyDrawerProps): JSX.Element | null {
  const preview = useMergeSplitPreview(rule?.id ?? null);
  const applyMut = useApplyMergeSplitRule(cycleId);
  const [page, setPage] = useState(1);

  /* On open (or rule change), fetch a fresh preview. The hash returned is
   * echoed back on apply so a stale preview gets rejected with 409. */
  useEffect(() => {
    if (open && rule) {
      preview.refetch().catch(() => {/* error state below handles it */});
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  if (!rule) return null;

  const handleApply = (): void => {
    if (!preview.data) return;
    applyMut.mutate(
      {
        ruleId: rule.id,
        confirmPreviewHash: preview.data.previewHash,
        rowVersion: rule.rowVersion,
      },
      {
        onSuccess: (result) => {
          toast(
            `تم تطبيق القاعدة — ${toEasternArabicNumerals(result.applicantsMoved)} متقدم في ${toEasternArabicNumerals(result.durationMs)}ms`,
            'success',
          );
          onClose();
        },
        onError: (err: unknown) => {
          const message =
            (err as { messageAr?: string; message?: string })?.messageAr ??
            (err as { message?: string })?.message ??
            'فشل التطبيق';
          toast(message, 'danger');
        },
      },
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <span>تطبيق قاعدة {rule.type === 'merge' ? 'دمج' : 'فصل'}</span>
          <Badge tone="warning" className="text-2xs">
            {rule.status === 'planned' ? 'مخططة' : rule.status}
          </Badge>
        </div>
      }
      subtitle={
        rule.reason
          ? `السبب: ${rule.reason}`
          : 'مراجعة الأثر قبل تنفيذ القاعدة. سيتم تحريك المتقدمين وتحديث الطاقة الاستيعابية في معاملة واحدة.'
      }
    >
      <Body
        preview={preview.data}
        loading={preview.isFetching}
        error={preview.error}
        committeeNames={committeeNames}
        page={page}
        onPageChange={setPage}
      />
      <Footer
        canApply={Boolean(preview.data) && !preview.isFetching}
        applying={applyMut.isPending}
        onCancel={onClose}
        onApply={handleApply}
      />
    </Drawer>
  );
}

function Body({
  preview,
  loading,
  error,
  committeeNames,
  page,
  onPageChange,
}: {
  preview: MergeSplitPreviewDto | undefined;
  loading: boolean;
  error: unknown;
  committeeNames: Record<string, string>;
  page: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  if (loading && !preview) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="text-sm">جارٍ احتساب الأثر…</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="تعذر حساب الأثر"
        description={(error as { messageAr?: string; message?: string })?.messageAr ?? 'حدث خطأ غير متوقع'}
      />
    );
  }

  if (!preview) {
    return <EmptyState variant="generic" title="لا توجد بيانات" />;
  }

  const movesCount = preview.applicantsMoved.length;
  const capacityChanges = preview.capacityChanges.length;
  const hasBrokenRefs = preview.brokenReferences.length > 0;

  const moveColumns: DataTableColumn<MoveRow>[] = [
    {
      key: 'applicantId',
      label: 'رقم المتقدم',
      render: (row) => (
        <span className="font-mono text-2xs text-ink-700">
          {row.applicantId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'fromCommitteeId',
      label: 'من اللجنة',
      render: (row) => (
        <span className="text-sm text-ink-700">
          {committeeNames[row.fromCommitteeId] ?? row.fromCommitteeId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'toCommitteeId',
      label: 'إلى اللجنة',
      render: (row) => (
        <span className="text-sm text-ink-900 font-medium">
          {committeeNames[row.toCommitteeId] ?? row.toCommitteeId.slice(0, 8)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 px-5 py-4">
      {/* Impact summary */}
      <section className="grid grid-cols-3 gap-3">
        <SummaryStat
          label="متقدمون سيُنقلون"
          value={movesCount}
          tone={movesCount > 0 ? 'info' : 'neutral'}
        />
        <SummaryStat
          label="تغييرات الطاقة"
          value={capacityChanges}
          tone={capacityChanges > 0 ? 'info' : 'neutral'}
        />
        <SummaryStat
          label="مراجع منكسرة"
          value={preview.brokenReferences.length}
          tone={hasBrokenRefs ? 'danger' : 'success'}
        />
      </section>

      {hasBrokenRefs && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-terra-300 bg-terra-50 px-3 py-2 text-2xs text-terra-700"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
          <span>
            بعض المراجع لن تُحل بعد التطبيق. راجع القائمة أدناه قبل التأكيد.
          </span>
        </div>
      )}

      {/* Capacity changes */}
      {capacityChanges > 0 && (
        <section>
          <h3 className="mb-2 font-ar-display text-sm font-bold text-ink-900">
            تغييرات الطاقة الاستيعابية
          </h3>
          <ul className="grid gap-1">
            {preview.capacityChanges.map((cc) => {
              const delta = cc.after - cc.before;
              return (
                <li
                  key={cc.committeeId}
                  className="flex items-center justify-between rounded-md border border-border-default bg-surface-card px-3 py-2 text-2xs"
                >
                  <span className="text-ink-700">
                    {committeeNames[cc.committeeId] ?? cc.committeeId.slice(0, 8)}
                  </span>
                  <span className="font-mono text-ink-700 tabular-nums">
                    {toEasternArabicNumerals(cc.before)} → {toEasternArabicNumerals(cc.after)}
                    <span
                      className={
                        'ms-2 font-medium ' +
                        (delta > 0 ? 'text-teal-600' : delta < 0 ? 'text-terra-600' : 'text-ink-400')
                      }
                    >
                      ({delta > 0 ? '+' : ''}{toEasternArabicNumerals(delta)})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Applicant moves table */}
      <section>
        <h3 className="mb-2 font-ar-display text-sm font-bold text-ink-900">
          المتقدمون المتأثرون
        </h3>
        {movesCount === 0 ? (
          <EmptyState
            variant="generic"
            title="لا يوجد متقدمون سيُنقلون"
          />
        ) : (
          <DataTable<MoveRow>
            columns={moveColumns}
            data={preview.applicantsMoved}
            rowKey={(row) => row.applicantId}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: movesCount,
              onPageChange,
            }}
            density="compact"
          />
        )}
      </section>
    </div>
  );
}

function Footer({
  canApply,
  applying,
  onCancel,
  onApply,
}: {
  canApply: boolean;
  applying: boolean;
  onCancel: () => void;
  onApply: () => void;
}): JSX.Element {
  return (
    <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border-default bg-surface-elevated px-5 py-3">
      <Button variant="ghost" onClick={onCancel} disabled={applying}>
        <X size={14} className="me-1.5" />
        إلغاء
      </Button>
      <Button
        variant="primary"
        onClick={onApply}
        disabled={!canApply || applying}
        isLoading={applying}
      >
        <CheckCircle2 size={14} className="me-1.5" />
        تأكيد التطبيق
      </Button>
    </footer>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'neutral' | 'danger' | 'success';
}): JSX.Element {
  const toneClasses: Record<typeof tone, string> = {
    info: 'border-teal-300 bg-teal-50 text-teal-700',
    neutral: 'border-border-default bg-surface-card text-ink-700',
    danger: 'border-terra-300 bg-terra-50 text-terra-700',
    success: 'border-green-300 bg-green-50 text-green-700',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClasses[tone]}`}>
      <p className="text-2xs">{label}</p>
      <p className="mt-0.5 font-ar-display text-lg font-bold tabular-nums">
        {toEasternArabicNumerals(value)}
      </p>
    </div>
  );
}
