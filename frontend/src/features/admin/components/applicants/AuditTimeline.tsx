/**
 * AuditTimeline — vertical RTL audit log scoped to one applicant.
 * Renders all audit entries (create, update, applicant.transition) in
 * reverse-chronological order, with:
 *   - Action icon coloured from AuditColor map
 *   - Actor (rank + name) and relative time + exact-time tooltip
 *   - Status changes show a `from → to` chip pair with a directional arrow
 *   - Data edits expose a "عرض التغييرات" disclosure that reveals the diff
 *     (max 8 rows visible with "عرض المزيد" if longer)
 */

import { useState } from 'react';
import {
  ArrowRight,
  CircleDot,
  ClipboardList,
  FilePenLine,
  FilePlus2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantAudit, useAuditDiff } from '@/features/applicants';
import type { ApplicantStatus, AuditAction, AuditEntry } from '@/shared/types/domain';

const STATUS_LABEL: Record<ApplicantStatus, string> = {
  pending: 'في الانتظار',
  'under-review': 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  'on-hold': 'موقوف',
  'documents-required': 'مستندات ناقصة',
  under_medical_review: 'قيد الكشف الطبي',
  passed_physical: 'اجتاز اللياقة',
  failed_interview: 'لم يجتز المقابلة',
  awaiting_board_decision: 'بانتظار قرار الهيئة',
};

const ACTION_ICON: Partial<Record<AuditAction, typeof FilePlus2>> = {
  create: FilePlus2,
  update: FilePenLine,
  delete: Trash2,
  'applicant.transition': ArrowRight,
};

const ACTION_COLOR_DOT: Record<string, string> = {
  success: 'var(--success, #2E7D32)',
  warning: 'var(--gold-700, #B8860B)',
  danger: 'var(--terra-700, #A0341E)',
  info: 'var(--teal-700, #0F4F4F)',
  neutral: 'var(--ink-500, #6B6B6B)',
};

interface Props {
  applicantId: string;
}

export function AuditTimeline({ applicantId }: Props): JSX.Element {
  const { data: entries = [], isLoading, error, refetch } = useApplicantAudit(applicantId);

  if (isLoading) return <LoadingState variant="list" />;
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader title="سجل التغييرات" />
        <EmptyState
          variant="generic"
          title="لا توجد إجراءات مُسجّلة"
          description="ستظهر هنا كل عمليات الإضافة والتعديل وتحديث الحالة."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="سجل التغييرات"
        subtitle={`عدد الإجراءات: ${entries.length}`}
      />
      <ol className="relative flex flex-col gap-3 ps-4">
        <span
          aria-hidden
          className="absolute inset-y-2 inset-inline-start-1.5 w-px bg-border-subtle"
        />
        {entries.map((e) => (
          <TimelineItem key={e.id} entry={e} />
        ))}
      </ol>
    </Card>
  );
}

function TimelineItem({ entry }: { entry: AuditEntry }): JSX.Element {
  const Icon = ACTION_ICON[entry.action] ?? ClipboardList;
  const dotColor = ACTION_COLOR_DOT[entry.actionColor] ?? ACTION_COLOR_DOT.info;

  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute inset-inline-start-[-13px] top-1 inline-flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-surface-page"
        style={{ background: dotColor }}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900">
            <Icon size={12} strokeWidth={1.75} aria-hidden />
            {entry.actionLabel}
          </span>
          {entry.action === 'applicant.transition' && (
            <TransitionChips details={entry.details} />
          )}
          <span
            className="text-2xs text-ink-500"
            title={fmtDate(entry.timestamp, 'full')}
          >
            · {fmtDate(entry.timestamp, 'rel')}
          </span>
        </div>
        <p className="text-2xs text-ink-500">
          {entry.userName}
          {entry.action !== 'applicant.transition' && (
            <span className="block whitespace-pre-wrap text-ink-700">
              {entry.details}
            </span>
          )}
        </p>
        {entry.action === 'update' && <DiffDisclosure auditId={entry.id} />}
      </div>
    </li>
  );
}

function TransitionChips({ details }: { details: string }): JSX.Element | null {
  /* The service formats the transition as "FROM_STATUS → TO_STATUS · reason" */
  const arrowIdx = details.indexOf('→');
  if (arrowIdx === -1) return null;
  const from = details.slice(0, arrowIdx).trim() as ApplicantStatus;
  const rest = details.slice(arrowIdx + 1).trim();
  const reasonIdx = rest.indexOf('·');
  const to = (reasonIdx === -1 ? rest : rest.slice(0, reasonIdx).trim()) as ApplicantStatus;
  const reason = reasonIdx === -1 ? '' : rest.slice(reasonIdx + 1).trim();
  return (
    <>
      <Badge tone="neutral">{STATUS_LABEL[from] ?? from}</Badge>
      <ArrowRight
        size={12}
        strokeWidth={1.75}
        aria-hidden
        className="text-ink-500 rtl:rotate-180"
      />
      <Badge tone="warning">{STATUS_LABEL[to] ?? to}</Badge>
      {reason && (
        <span className="ms-2 max-w-md truncate text-2xs italic text-ink-500" title={reason}>
          «{reason}»
        </span>
      )}
    </>
  );
}

function DiffDisclosure({ auditId }: { auditId: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const { data: diff, isLoading } = useAuditDiff(open ? auditId : null);

  return (
    <div className="mt-1 self-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card px-2 py-0.5 text-2xs text-ink-700 hover:border-border-strong"
      >
        <ChevronDown
          size={11}
          strokeWidth={2}
          className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`}
        />
        {open ? 'إخفاء التغييرات' : 'عرض التغييرات'}
      </button>
      {open && (
        <div className="mt-1 overflow-x-auto rounded-md border border-border-subtle">
          {isLoading && <LoadingState variant="list" />}
          {!isLoading && diff && <DiffTable before={diff.before} after={diff.after} />}
        </div>
      )}
    </div>
  );
}

function DiffTable({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  if (!before && !after) {
    return <p className="p-2 text-2xs text-ink-500">لا توجد تفاصيل تغييرات متاحة.</p>;
  }
  const flatBefore = flatten(before);
  const flatAfter = flatten(after);
  const allKeys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]));
  const changed = allKeys.filter((k) => safeStringify(flatBefore[k]) !== safeStringify(flatAfter[k]));
  const visible = showAll ? changed : changed.slice(0, 8);
  if (changed.length === 0) {
    return <p className="p-2 text-2xs text-ink-500">لا توجد فروقات قابلة للعرض.</p>;
  }
  return (
    <table className="w-full table-fixed text-2xs">
      <thead className="border-b border-border-subtle bg-ink-50/50 text-ink-500">
        <tr>
          <th className="w-1/3 px-2 py-1 text-start">الحقل</th>
          <th className="w-1/3 px-2 py-1 text-start">السابق</th>
          <th className="w-1/3 px-2 py-1 text-start">الجديد</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((k) => (
          <tr key={k} className="border-b border-border-subtle/50 last:border-b-0">
            <td className="px-2 py-1 font-medium text-ink-700">{k}</td>
            <td className="px-2 py-1 text-terra-700"><CellValue value={flatBefore[k]} /></td>
            <td className="px-2 py-1 text-success"><CellValue value={flatAfter[k]} /></td>
          </tr>
        ))}
      </tbody>
      {!showAll && changed.length > 8 && (
        <tfoot>
          <tr>
            <td colSpan={3} className="px-2 py-1 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-2xs text-ink-500 underline-offset-2 hover:underline"
              >
                عرض المزيد ({changed.length - 8})
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function CellValue({ value }: { value: unknown }): JSX.Element {
  if (value === null || value === undefined || value === '') {
    return <span className="inline-flex items-center gap-1 text-ink-400"><CircleDot size={9} /> فارغ</span>;
  }
  if (typeof value === 'boolean') return <>{value ? 'نعم' : 'لا'}</>;
  if (typeof value === 'object') return <>{JSON.stringify(value)}</>;
  return <>{String(value)}</>;
}

function flatten(input: unknown, prefix = ''): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, path));
    } else {
      out[path] = v;
    }
  }
  return out;
}

function safeStringify(v: unknown): string {
  if (v === undefined || v === null) return '';
  try { return JSON.stringify(v); } catch { return String(v); }
}
