/**
 * LiveSessionsTable — proctor's main grid of running sessions.
 *
 * Wraps the shared `<DataTable>` with status pills + search input, and
 * a per-row kebab menu (عرض / إنهاء / إعادة فتح). Cell-level flash effect
 * highlights the answered/total or الحالة column when it changes between
 * polls — respects `prefers-reduced-motion` via the keyframes file.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, MoreHorizontal, RotateCcw, Search, StopCircle, Wifi } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { num } from '@/shared/lib/format';
import { truncateName } from '@/shared/lib/arabic';
import type { ExamSession, SessionStatus } from '@/shared/types/domain';
import { ProgressBar } from './ProgressBar';
import { SESSION_STATUS_LABEL, SessionStatusBadge } from './SessionStatusBadge';

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  'in-progress': 0,
  started: 1,
  'not-started': 2,
  dropped: 3,
  finished: 4,
};

const FILTER_OPTIONS: ReadonlyArray<{ key: 'all' | SessionStatus; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'not-started', label: SESSION_STATUS_LABEL['not-started'] },
  { key: 'started', label: SESSION_STATUS_LABEL.started },
  { key: 'in-progress', label: SESSION_STATUS_LABEL['in-progress'] },
  { key: 'dropped', label: SESSION_STATUS_LABEL.dropped },
];

interface LiveSessionsTableProps {
  sessions: readonly ExamSession[];
  loading: boolean;
  /** Wall-clock used to derive elapsed/remaining time. Defaults to Date.now(). */
  now?: number;
  totalsByStatus: Record<SessionStatus, number>;
  filter: 'all' | SessionStatus;
  onFilterChange: (next: 'all' | SessionStatus) => void;
  search: string;
  onSearchChange: (next: string) => void;
}

export function LiveSessionsTable({
  sessions,
  loading,
  now = Date.now(),
  totalsByStatus,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: LiveSessionsTableProps): JSX.Element {
  /* Per-row diff tracking — flash the relevant cell when a value changes. */
  const previous = useRef<Map<string, { answered: number; status: SessionStatus }>>(new Map());
  const [flashes, setFlashes] = useState<Map<string, { answered: boolean; status: boolean }>>(new Map());

  useEffect(() => {
    const next = new Map<string, { answered: boolean; status: boolean }>();
    for (const s of sessions) {
      const prev = previous.current.get(s.id);
      next.set(s.id, {
        answered: prev ? prev.answered !== s.questionsAnswered : false,
        status: prev ? prev.status !== s.status : false,
      });
      previous.current.set(s.id, { answered: s.questionsAnswered, status: s.status });
    }
    setFlashes(next);
    /* Clear flashes after the animation runs. */
    const t = window.setTimeout(() => setFlashes(new Map()), 320);
    return () => window.clearTimeout(t);
  }, [sessions]);

  const filteredSorted = useMemo(() => {
    const search_n = search.trim();
    const out = sessions.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!search_n) return true;
      return (
        s.applicantId.toLowerCase().includes(search_n.toLowerCase()) ||
        s.applicantName.includes(search_n)
      );
    });
    return [...out].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status];
      const pb = STATUS_PRIORITY[b.status];
      if (pa !== pb) return pa - pb;
      return a.applicantId.localeCompare(b.applicantId);
    });
  }, [sessions, filter, search]);

  const columns: DataTableColumn<ExamSession>[] = [
    {
      key: 'applicantId',
      label: 'الكود',
      width: 170,
      render: (s) => <span className="font-mono text-xs" dir="ltr">{s.applicantId}</span>,
    },
    {
      key: 'applicantName',
      label: 'اسم المختبر',
      render: (s) => <span className="text-ink-900">{truncateName(s.applicantName, 3)}</span>,
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (s) => {
        const flash = flashes.get(s.id)?.status;
        return (
          <span
            className="inline-block"
            style={{
              animation: flash
                ? 'sessionCellFlash 320ms cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <SessionStatusBadge status={s.status} />
          </span>
        );
      },
    },
    {
      key: 'progress',
      label: 'التقدّم',
      width: 220,
      render: (s) => {
        const flash = flashes.get(s.id)?.answered;
        return (
          <span
            className="block"
            style={{
              animation: flash
                ? 'sessionCellFlash 320ms cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <ProgressBar value={s.questionsAnswered} max={s.totalQuestions} />
          </span>
        );
      },
    },
    {
      key: 'elapsed',
      label: 'الزمن المستغرق',
      align: 'center',
      hideOn: 'md',
      render: (s) => (
        <span className="font-numeric tnum" dir="ltr">
          {s.startedAt === null ? '—' : formatHms(now - s.startedAt)}
        </span>
      ),
    },
    {
      key: 'remaining',
      label: 'الزمن المتبقي',
      align: 'center',
      render: (s) => {
        if (s.startedAt === null) return <span className="text-ink-500">—</span>;
        if (s.status === 'finished') return <Badge tone="success">مكتمل</Badge>;
        const remainingMs = s.startedAt + s.durationSeconds * 1000 - now;
        const isCritical = remainingMs > 0 && remainingMs <= 5 * 60_000;
        return (
          <span
            className="font-numeric tnum"
            dir="ltr"
            style={{
              color: remainingMs <= 0
                ? 'var(--terra-700)'
                : isCritical
                  ? 'var(--terra-700)'
                  : 'var(--ink-900)',
              fontWeight: isCritical ? 600 : 500,
            }}
          >
            {remainingMs <= 0 ? 'انتهى' : formatHms(remainingMs)}
          </span>
        );
      },
    },
    {
      key: 'ip',
      label: 'IP / MAC',
      hideOn: 'md',
      render: (s) => (
        <div className="flex flex-col text-2xs leading-tight" dir="ltr">
          <span className="font-mono">{s.ip}</span>
          <span className="font-mono text-ink-500">{s.mac}</span>
        </div>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      width: 60,
      render: (s) => <SessionActions session={s} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.key;
          const count = opt.key === 'all'
            ? sessions.length
            : totalsByStatus[opt.key] ?? 0;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onFilterChange(opt.key)}
              className="inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-2xs font-medium transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus-teal"
              style={{
                borderColor: active ? 'var(--accent-500)' : 'var(--border-subtle)',
                background: active ? 'var(--accent-500)' : 'var(--surface-card)',
                color: active ? '#fff' : 'var(--ink-700)',
              }}
            >
              {opt.label}
              <span
                className="font-numeric tnum text-2xs"
                style={{ opacity: active ? 0.85 : 0.7 }}
              >
                {num(count)}
              </span>
            </button>
          );
        })}
        <div className="ms-auto w-full max-w-xs">
          <Input
            placeholder="بحث بالكود أو الاسم"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            leadingIcon={<Search size={14} strokeWidth={1.75} />}
          />
        </div>
      </div>

      <DataTable
        data={filteredSorted}
        columns={columns}
        rowKey={(s) => s.id}
        loading={loading && sessions.length === 0}
        density="compact"
        zebraStripes
        empty={
          <EmptyState
            variant="generic"
            title={search || filter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا يوجد مختبرون نشطون'}
            description={
              search || filter !== 'all'
                ? 'جرّب إزالة البحث أو تغيير المرشح.'
                : 'سيظهر المختبرون هنا فور تسجيل الدخول لقاعة الاختبار.'
            }
            icon={<Wifi size={28} strokeWidth={1.5} aria-hidden />}
          />
        }
      />
    </div>
  );
}

/* ─────────── Internals ─────────── */

function SessionActions({ session }: { session: ExamSession }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const fire = (label: string, kind: 'success' | 'warning' = 'success'): void => {
    toast(label, kind);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label="إجراءات الجلسة"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={14} strokeWidth={1.75} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-border-subtle bg-surface-card shadow-md"
        >
          <MenuItem
            icon={<Eye size={13} strokeWidth={1.75} />}
            onClick={() => fire(`عرض جلسة ${session.applicantId}`, 'success')}
          >
            عرض الجلسة
          </MenuItem>
          <MenuItem
            icon={<StopCircle size={13} strokeWidth={1.75} />}
            tone="danger"
            onClick={() => fire(`تم إنهاء جلسة ${session.applicantId}`, 'warning')}
          >
            إنهاء الجلسة
          </MenuItem>
          <MenuItem
            icon={<RotateCcw size={13} strokeWidth={1.75} />}
            onClick={() => fire(`أُعيد فتح جلسة ${session.applicantId}`, 'success')}
          >
            إعادة فتح الجلسة
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  tone = 'default',
}: {
  icon: JSX.Element;
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-start text-2xs transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none"
      style={tone === 'danger' ? { color: 'var(--terra-700)' } : undefined}
    >
      <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
      {children}
    </button>
  );
}

function formatHms(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
