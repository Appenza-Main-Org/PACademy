/**
 * Stage 8 — first-exam date pick (PDF p.11, MOI-aligned).
 *
 * Calls /api/applicants/{nid}/eligible-categories to resolve the committee
 * (committeeName) and available exam dates (examDates[]) for the applicant's
 * chosen category. The date is the only choice — time and location are
 * assigned by the academy and printed on the card.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Check, ScrollText } from 'lucide-react';
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
  usePickFirstExamDateMutation,
} from '../api/applicantPortal.queries';
import { useEligibleCategories } from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import {
  filterBookableExamDates,
  normalizeExamDateValue,
} from '../lib/exam-date-availability';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

export function Stage8ExamSchedulePage(): JSX.Element {
  const navigate = useNavigate();
  const setFirstExamDate = useApplicantPortalStore((s) => s.setFirstExamDate);
  const setAssignedCommittee = useApplicantPortalStore((s) => s.setAssignedCommittee);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const nid = moiSession?.nationalId ?? storeNid ?? MOI_APPLICANT_SESSION.nationalId;

  /* Always fetch eligible-categories to get committeeName + examDates. */
  const eligibilityQuery = useEligibleCategories(nid);

  const matchedCategory = eligibilityQuery.data?.categories.find(
    (c) => c.categoryId === selectedCategoryKey,
  );
  const firstCommittee = matchedCategory?.committees?.[0] ?? null;
  const committeeName = firstCommittee?.committeeName ?? (eligibilityQuery.isLoading ? '…' : '—');
  const examDates: string[] = firstCommittee?.examDates ?? [];

  /* Persist the resolved committee into the store for the print-card page. */
  useEffect(() => {
    if (!firstCommittee) return;
    setAssignedCommittee(firstCommittee.committeeId, firstCommittee.committeeName);
  }, [firstCommittee, setAssignedCommittee]);

  const pickMut = usePickFirstExamDateMutation(APPLICANT_ID);
  const [picked, setPicked] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dayOptions = useMemo(() =>
    filterBookableExamDates(examDates).map((dateStr) => ({
      value: normalizeExamDateValue(dateStr) ?? dateStr,
      dayName: formatExamDayName(dateStr),
      dateLabel: formatExamDateLabel(dateStr),
    })),
  [examDates]);

  if (eligibilityQuery.isLoading) return <LoadingState variant="card-grid" count={2} />;
  if (eligibilityQuery.error) {
    return <ErrorState error={eligibilityQuery.error} onRetry={() => void eligibilityQuery.refetch()} />;
  }
  if (dayOptions.length === 0) {
    return <EmptyState variant="generic" title="لا توجد مواعيد متاحة" />;
  }

  const onSave = async (): Promise<void> => {
    if (!picked) {
      toast('اختر تاريخ الإختبار أولاً', 'warning');
      return;
    }
    await pickMut.mutateAsync({ slotId: picked });
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
            ويظهر اليوم المختار على بطاقة التردد.
          </p>
        </div>
      </header>

      <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border-default bg-ink-50/50 p-4 sm:grid-cols-3">
        <DefRow label="إسم الطالب" value={moiSession?.fullName ?? MOI_APPLICANT_SESSION.fullName} />
        <DefRow label="الرقم القومي" value={nid} ltr mono />
        <DefRow label="اللجنة" value={committeeName} />
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
              يمكنك الآن معاينة طلب الإلتحاق وطباعته أو حفظه PDF، ثم طباعة بطاقة التردد.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            leadingIcon={<ScrollText size={14} strokeWidth={1.75} />}
            onClick={() => {
              setConfirmOpen(false);
              navigate(ROUTES.applicantApplicationForm);
            }}
          >
            معاينة الطلب
          </Button>
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

function dateFromIsoDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatExamDayName(value: string): string {
  const normalized = normalizeExamDateValue(value);
  return arabicDayOfWeek(normalized ? dateFromIsoDay(normalized) : new Date(value));
}

function formatExamDateLabel(value: string): string {
  const normalized = normalizeExamDateValue(value);
  return fmtDate(normalized ? dateFromIsoDay(normalized) : value, 'full');
}
