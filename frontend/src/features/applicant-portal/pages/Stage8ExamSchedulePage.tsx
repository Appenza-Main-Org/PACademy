/**
 * Stage 8 — first-exam date pick (PDF p.11, MOI-aligned).
 *
 * Read-only header rows: applicant name, NID, committee. Single Select
 * labelled "تاريخ الإختبار" sourced from the active cycle's exam-window
 * slots (mock). Primary "حفظ" button → modal "تم اختيار تاريخ الإختبار
 * بنجاح" → on dismiss navigates to /applicant/print-card.
 *
 * The PDF reference treats the day as the only choice — the academy
 * assigns the within-day time. We surface the slot's canonical 08:00
 * time on the print card but don't let the user pick it.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Check } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  toast,
} from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import { arabicDayOfWeek } from '@/shared/lib/arabic';
import { ROUTES } from '@/config/routes';
import {
  useExamSlots,
  usePickFirstExamDateMutation,
} from '../api/applicantPortal.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

export function Stage8ExamSchedulePage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useExamSlots();
  const setFirstExamDate = useApplicantPortalStore((s) => s.setFirstExamDate);
  const pickMut = usePickFirstExamDateMutation(APPLICANT_ID);
  const [picked, setPicked] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const slots = data ?? [];

  /* One entry per available day. Dedupe by date, keep only the first
   * three slots whose date is strictly after today — the picker is a
   * compact 3-card row of the soonest available days. */
  const dayOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seen = new Set<string>();
    const ordered: Array<{ value: string; dayName: string; dateLabel: string }> = [];
    for (const s of [...slots].sort((a, b) => a.date.localeCompare(b.date))) {
      const dayKey = s.date.slice(0, 10);
      if (seen.has(dayKey)) continue;
      const examDate = new Date(s.date);
      if (examDate.getTime() <= today.getTime()) continue;
      seen.add(dayKey);
      ordered.push({
        value: s.date,
        dayName: arabicDayOfWeek(examDate),
        dateLabel: fmtDate(s.date, 'full'),
      });
      if (ordered.length === 3) break;
    }
    return ordered;
  }, [slots]);

  if (isLoading) return <LoadingState variant="card-grid" count={2} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (dayOptions.length === 0) {
    return <EmptyState variant="generic" title="لا توجد مواعيد متاحة" />;
  }

  const onSave = async (): Promise<void> => {
    if (!picked) {
      toast('اختر تاريخ الإختبار أولاً', 'warning');
      return;
    }
    await pickMut.mutateAsync({ date: picked });
    setFirstExamDate(picked);
    setConfirmOpen(true);
  };

  return (
    <Card>
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700"
        >
          <CalendarCheck size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">تحديد موعد إختبار قدرات</h2>
          <p className="mt-1 text-sm text-ink-500 leading-normal">
            اختر يوماً واحداً من المواعيد المتاحة. تُحدِّد الأكاديمية ميعاد بدء الإختبار داخل اليوم
            وتُطبَع على بطاقة التردد.
          </p>
        </div>
      </header>

      <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border-default bg-ink-50/50 p-4 sm:grid-cols-3">
        <DefRow label="إسم الطالب" value={MOI_APPLICANT_SESSION.fullName} />
        <DefRow label="الرقم القومي" value={MOI_APPLICANT_SESSION.nationalId} ltr mono />
        <DefRow label="اللجنة" value="اللجنة الثانية" />
      </dl>

      <div role="radiogroup" aria-label="تاريخ الإختبار" className="mb-4 grid gap-3 sm:grid-cols-3">
        {dayOptions.map((opt) => {
          const selected = picked === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPicked(opt.value)}
              className={
                'group relative flex flex-col items-center justify-center gap-2 rounded-lg border px-4 py-6 text-center transition-all duration-fast ease-standard focus-visible:shadow-focus-teal focus-visible:outline-none ' +
                (selected
                  ? 'border-teal-500 bg-teal-50 shadow-sm'
                  : 'border-border-default bg-surface-card hover:border-teal-400 hover:bg-teal-50/40')
              }
            >
              {selected && (
                <span
                  aria-hidden
                  className="absolute end-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white"
                >
                  <Check size={14} strokeWidth={2.5} />
                </span>
              )}
              <span
                aria-hidden
                className={
                  'inline-flex h-10 w-10 items-center justify-center rounded-md ' +
                  (selected ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-700')
                }
              >
                <CalendarCheck size={20} strokeWidth={1.75} />
              </span>
              <span className="font-ar-display text-md font-bold text-ink-900">
                {opt.dayName}
              </span>
              <span className="text-2xs text-ink-500">{opt.dateLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={onSave}
          isLoading={pickMut.isPending}
          disabled={!picked}
        >
          حفظ
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          navigate(ROUTES.applicantPrintCard);
        }}
        title="تنبيه"
        size="sm"
      >
        <Modal.Body>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"
            >
              <CheckCircle2 size={28} strokeWidth={1.5} />
            </span>
            <p className="font-ar-display text-md font-bold text-ink-900">
              تم اختيار تاريخ الإختبار بنجاح
            </p>
            <p className="text-sm text-ink-500">
              يمكنك الآن طباعة بطاقة التردد.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmOpen(false);
              navigate(ROUTES.applicantPrintCard);
            }}
          >
            موافق
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}

function DefRow({
  label,
  value,
  ltr,
  mono,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={
          'mt-0.5 text-sm font-medium text-ink-900 ' +
          /* `text-end` resolves against the element's OWN dir. For LTR
           * values (digits) we set dir="ltr" so `text-end` = right,
           * which aligns them to the column edge under the RTL label.
           * For RTL values we leave the alignment default (right). */
          (ltr ? 'text-end ' : '') +
          (mono ? 'font-mono' : '')
        }
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
