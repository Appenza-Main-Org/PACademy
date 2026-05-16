/**
 * MergeSplitApplyDrawer — Preview → Confirm → Apply flow for a merge/split rule.
 *
 * Opens when the admin clicks "تطبيق" on a planned rule in the merge/split step.
 * Immediately POSTs to the preview endpoint, renders the impact summary, then
 * lets the admin confirm with the server-issued previewHash.
 *
 * Broken references block Apply and surface an Arabic warning. The admin must
 * resolve the referenced committees before applying.
 */

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, Users } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  toast,
} from '@/shared/components';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { CommitteeMergeSplitRule, MergeSplitCapacityChange } from '../types';
import {
  usePreviewMergeSplitRule,
  useApplyMergeSplitRule,
} from '../api/admission-setup.queries';

interface Props {
  rule: CommitteeMergeSplitRule | null;
  cycleId: string;
  onClose: () => void;
}

export function MergeSplitApplyDrawer({ rule, cycleId, onClose }: Props): JSX.Element {
  const previewMut = usePreviewMergeSplitRule();
  const applyMut = useApplyMergeSplitRule();

  /* Fire preview as soon as drawer opens. */
  useEffect(() => {
    if (rule?.id) {
      previewMut.mutate(rule.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule?.id]);

  const preview = previewMut.data ?? null;
  const hasBrokenRefs = (preview?.brokenReferences?.length ?? 0) > 0;
  const canApply =
    Boolean(preview) && !hasBrokenRefs && !applyMut.isPending && !previewMut.isPending;

  const handleApply = (): void => {
    if (!rule || !preview) return;
    applyMut.mutate(
      {
        id: rule.id,
        cycleId,
        confirmPreviewHash: preview.previewHash,
        rowVersion: rule.rowVersion,
      },
      {
        onSuccess: (res) => {
          toast(
            `تم تطبيق القاعدة — نُقل ${toEasternArabicNumerals(res.applicantsMoved)} متقدم`,
            'success',
          );
          onClose();
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const ruleLabel = rule?.type === 'merge' ? 'دمج اللجان' : 'فصل اللجنة';

  return (
    <Drawer
      open={Boolean(rule)}
      onClose={onClose}
      title={`تطبيق قاعدة ${ruleLabel}`}
      subtitle={rule?.reason ?? undefined}
      size="md"
      transparentBackdrop={false}
    >
      <div className="flex flex-col gap-5 p-1">
        {/* Loading */}
        {previewMut.isPending && (
          <div className="flex items-center justify-center py-12 text-sm text-ink-500">
            جارٍ حساب التأثير…
          </div>
        )}

        {/* Preview error */}
        {previewMut.isError && (
          <div className="flex items-center gap-2 rounded-md border border-terra-300 bg-terra-50 px-4 py-3 text-sm text-terra-700">
            <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" />
            تعذّر جلب معاينة التأثير. يرجى إغلاق الدرج والمحاولة مرة أخرى.
          </div>
        )}

        {/* Broken references warning */}
        {preview && hasBrokenRefs && (
          <div className="flex flex-col gap-2 rounded-md border border-terra-300 bg-terra-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-terra-700">
              <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" />
              مراجع معطلة — يتعذّر التطبيق
            </div>
            <ul className="list-inside list-disc text-2xs text-terra-700">
              {preview.brokenReferences.map((ref, i) => (
                <li key={i}>{ref.reason}</li>
              ))}
            </ul>
            <p className="text-2xs text-terra-600">
              يرجى مراجعة اللجان المرجعية وتصحيح المشكلة قبل التطبيق.
            </p>
          </div>
        )}

        {/* Impact summary */}
        {preview && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                icon={<Users size={16} strokeWidth={1.75} />}
                label="متقدمون سيُنقلون"
                value={toEasternArabicNumerals(preview.applicantsMoved.length)}
              />
              <SummaryCard
                icon={<CheckCircle size={16} strokeWidth={1.75} />}
                label="تغييرات في السعة"
                value={toEasternArabicNumerals(preview.capacityChanges.length)}
              />
            </div>

            {/* Capacity changes table */}
            {preview.capacityChanges.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink-900">تغييرات السعة</h3>
                <CapacityTable rows={preview.capacityChanges} />
              </section>
            )}

            {/* Applicant moves table */}
            {preview.applicantsMoved.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink-900">
                  تفاصيل نقل المتقدمين{' '}
                  <Badge tone="neutral">
                    {toEasternArabicNumerals(preview.applicantsMoved.length)}
                  </Badge>
                </h3>
                <ApplicantMovesTable
                  rows={preview.applicantsMoved.map((m) => ({
                    applicantId: m.applicantId,
                    fromCommitteeId: m.fromCommitteeId,
                    toCommitteeId: m.toCommitteeId,
                  }))}
                />
              </section>
            )}
          </>
        )}

        {/* Action footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <Button variant="ghost" onClick={onClose} disabled={applyMut.isPending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={!canApply}
            isLoading={applyMut.isPending}
            leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
          >
            تطبيق القاعدة
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface-card p-3">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-md"
        style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
      >
        {icon}
      </span>
      <p className="font-numeric text-xl font-bold text-ink-900 tnum">{value}</p>
      <p className="text-2xs text-ink-500">{label}</p>
    </div>
  );
}

function CapacityTable({ rows }: { rows: MergeSplitCapacityChange[] }): JSX.Element {
  return (
    <DataTable
      data={rows}
      rowKey={(r) => r.committeeId}
      columns={[
        { key: 'committeeId', label: 'اللجنة', render: (r) => r.committeeId },
        {
          key: 'before',
          label: 'السعة قبل',
          numeric: true,
          render: (r) => toEasternArabicNumerals(r.before),
        },
        {
          key: 'after',
          label: 'السعة بعد',
          numeric: true,
          render: (r) => toEasternArabicNumerals(r.after),
        },
      ]}
      empty="لا تغييرات في السعة"
    />
  );
}

type ApplicantMoveRow = { applicantId: string; fromCommitteeId: string; toCommitteeId: string };

function ApplicantMovesTable({ rows }: { rows: ApplicantMoveRow[] }): JSX.Element {
  return (
    <DataTable
      data={rows}
      rowKey={(r) => r.applicantId}
      columns={[
        { key: 'applicantId', label: 'رقم المتقدم', render: (r) => r.applicantId },
        { key: 'from', label: 'من لجنة', render: (r) => r.fromCommitteeId },
        { key: 'to', label: 'إلى لجنة', render: (r) => r.toCommitteeId },
      ]}
      empty="لا يوجد متقدمون للنقل"
    />
  );
}
