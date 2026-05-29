/**
 * Stage 9 — printable attendance card (PDF p.11 lower + p.12, MOI-aligned).
 *
 * Top non-print card: accent-coloured notice + two top-end action buttons
 * (طباعة + تحميل الإقرار). Card body: barcode column + identity column +
 * verification stamp + payment reference line + prose exam-date sentence
 * + كشف ومواعيد الإختبارات table.
 *
 * Payload values come from the wizard store (paymentReference, fileNumber,
 * firstExamDate) so the printed card stays in sync with the choices the
 * applicant made earlier in the flow.
 */

import { FileDown, Printer } from 'lucide-react';
import {
  Button,
  Card,
  Code128Barcode,
  KhayameyaStripe,
  PrintLayout,
} from '@/shared/components';
import { useDraft } from '../api/applicantPortal.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { useCategories } from '../api/categories.queries';
import { date as fmtDate } from '@/shared/lib/format';
import {
  arabicDayOfWeek,
  arabicOrdinal,
  arabicTimeOfDay,
  toEasternArabicNumerals,
} from '@/shared/lib/arabic';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import {
  deterministicFileNumber,
  deterministicPaymentReference,
} from '../lib/deterministic-codes';
import { AdmissionFormSection } from '../components/AdmissionFormSection';

const COMMITTEE_NUMBER = 2;

export function Stage9PrintCardPage(): JSX.Element {
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const applicantId = moiSession?.applicantId ?? MOI_APPLICANT_SESSION.applicantId;
  const { data: draft } = useDraft(applicantId);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);
  const paymentReference =
    useApplicantPortalStore((s) => s.paymentReference) ??
    deterministicPaymentReference(applicantId);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const categoriesQuery = useCategories();
  const category = (categoriesQuery.data ?? []).find((c) => c.key === selectedCategoryKey);
  const fileNumber = deterministicFileNumber(applicantId);

  /* Prefer the draft's examSlot (has real time + location from DB); fall
   * back to the store's firstExamDate (set on Stage 8 completion) with
   * sensible defaults. */
  const slot = draft?.examSlot ?? (firstExamDate
    ? { date: firstExamDate, time: '08:00', location: 'كلية الشرطة - مبنى الاختبارات - القاهرة' }
    : { date: '2026-03-15T08:00:00.000Z', time: '08:00', location: 'كلية الشرطة - مبنى الاختبارات - القاهرة' });

  const displayNationalId = moiSession?.nationalId ?? MOI_APPLICANT_SESSION.nationalId;
  const displayFullName = moiSession?.fullName ?? MOI_APPLICANT_SESSION.fullName;
  const barcodeValue = `${displayNationalId}-${paymentReference}`;

  return (
    <div
      className="print-card-page mx-auto flex flex-col gap-4"
      style={{ width: '210mm' }}
    >
      {/* ── Required documents — bullet list, on-screen only ── */}
      <Card
        className="no-print"
        aria-label="المستندات المطلوبة يوم الاختبار"
      >
        <h3 className="mb-4 text-start font-ar-display text-md font-bold text-ink-900">
          المستندات المطلوبة يوم الاختبار
        </h3>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm text-ink-800 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'بطاقة الرقم القومي (الأصل)',
            'أصل شهادة الثانوية العامة',
            'شهادة طبية معتمدة',
            'كارت تردد مطبوع',
            '4 صور شخصية حديثة',
            'شهادة حسن السير والسلوك',
          ].map((doc) => (
            <li
              key={doc}
              className="relative ps-5 leading-relaxed before:absolute before:start-0 before:top-[0.55em] before:h-2 before:w-2 before:rounded-full before:bg-teal-600 before:content-['']"
            >
              {doc}
            </li>
          ))}
        </ul>
      </Card>

      {/* ── The printable card itself ── */}
      <PrintLayout
        title="بطاقة التردد"
        subtitle={`دفعة قبول 2026 — ${category?.labelAr ?? 'أكاديمية الشرطة'}`}
        generatedAt={fmtDate(Date.now(), 'short')}
        className="attendance-card-print"
      >
        <div className="mb-6 grid grid-cols-[140px_1fr_auto] gap-5 rounded-lg border-2 border-teal-500 bg-teal-50/40 p-4">
          {/* Barcode column (PDF p.12 left) */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-teal-300 bg-surface-card p-2">
            <Code128Barcode value={barcodeValue} height={56} moduleWidth={2} showText={false} />
            <p className="font-mono text-2xs tracking-widest text-ink-500" dir="ltr">
              {barcodeValue}
            </p>
            <p className="text-2xs text-ink-500">
              رقم الملف: <span className="font-mono" dir="ltr">{fileNumber}</span>
            </p>
          </div>

          {/* Identity column */}
          <div className="flex flex-col justify-center gap-2">
            <div>
              <p className="text-2xs uppercase tracking-wide text-ink-500">إسم الطالب</p>
              <p className="font-ar-display text-lg font-bold text-ink-900">
                {displayFullName}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">اللجنة</p>
                <p className="font-ar-display text-md font-bold text-ink-900">
                  {arabicOrdinal(COMMITTEE_NUMBER)}
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">رقم الملف</p>
                <p className="font-mono text-sm text-ink-900">
                  <span dir="ltr">{fileNumber}</span>
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">الرقم القومي</p>
                <p className="font-mono text-sm text-ink-900">
                  <span dir="ltr">{displayNationalId}</span>
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Payment reference + date line */}
        <p className="mb-5 rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-sm text-ink-700">
          تم الدفع بالرقم المرجعي:{' '}
          <span className="font-numeric tnum font-bold text-ink-900" dir="ltr">
            {toEasternArabicNumerals(paymentReference)}
          </span>
          {' '}— تاريخ السداد:{' '}
          <span className="font-numeric tnum font-bold text-ink-900" dir="ltr">
            {toEasternArabicNumerals(
              fmtDate(draft?.payment?.paidAt ?? Date.now(), 'short'),
            )}
          </span>
        </p>

        {/* Exam-date prose sentence (PDF p.12) */}
        {(() => {
          const examDate = new Date(slot.date);
          const dayName = arabicDayOfWeek(examDate);
          const dateStr = toEasternArabicNumerals(
            `${examDate.getFullYear()}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${String(examDate.getDate()).padStart(2, '0')}`,
          );
          const { hourWord, periodWord } = arabicTimeOfDay(slot.time);
          return (
            <p className="mb-5 rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-sm text-ink-900">
              تاريخ إختبار قدرات يوم {dayName}{' '}
              <span dir="ltr" className="font-numeric tnum">
                {dateStr}
              </span>{' '}
              الساعة {hourWord} {periodWord}
            </p>
          );
        })()}

        {/* كشف ومواعيد الإختبارات table */}
        <div className="mb-4">
          <h3 className="mb-2 text-center font-ar-display text-md font-bold text-ink-900">
            كشف ومواعيد الإختبارات
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink-50 text-ink-700">
                <th className="border border-border-default px-2 py-1.5 text-center font-medium">م</th>
                <th className="border border-border-default px-2 py-1.5 text-center font-medium">الإختبار</th>
                <th className="border border-border-default px-2 py-1.5 text-center font-medium">التاريخ</th>
                <th className="border border-border-default px-2 py-1.5 text-center font-medium">النتيجة</th>
                <th className="border border-border-default px-2 py-1.5 text-center font-medium">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const examDate = new Date(slot.date);
                const dateStr = toEasternArabicNumerals(
                  `${examDate.getFullYear()}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${String(examDate.getDate()).padStart(2, '0')}`,
                );
                return (
                  <tr className="text-center">
                    <td className="border border-border-default px-2 py-1.5 font-numeric tnum">١</td>
                    <td className="border border-border-default px-2 py-1.5">قدرات</td>
                    <td className="border border-border-default px-2 py-1.5 font-numeric tnum" dir="ltr">
                      {dateStr}
                    </td>
                    <td className="border border-border-default px-2 py-1.5 text-ink-500">غير محدد</td>
                    <td className="border border-border-default px-2 py-1.5 text-ink-500">—</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        <p className="my-4 text-center text-2xs text-ink-500">
          يجب أن يكون الكارت في صورته الأصلية يوم الاختبار · أيّ تعديل أو نسخ يبطل صلاحيته
        </p>

        {/* ── طلب الإلتحاق — inlined inside the same PrintLayout so print
              produces a single document with one ministry letterhead. The
              section itself sets break-before:page so the form starts on
              its own printed page. ── */}
        <AdmissionFormSection fileNumber={fileNumber} />

        <KhayameyaStripe height="lg" />
      </PrintLayout>

      {/* ── Bottom action row: print + download (screen only) ── */}
      <Card className="no-print">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<FileDown size={16} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            تحميل
          </Button>
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<Printer size={16} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            طباعة
          </Button>
        </div>
      </Card>
    </div>
  );
}
