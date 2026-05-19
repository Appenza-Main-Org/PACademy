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
import { categoryLabel, downloadAdmissionForm } from '../lib/admissionFormPdf';
import { toast } from '@/shared/components';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;
const COMMITTEE_NUMBER = 2;

export function Stage9PrintCardPage(): JSX.Element {
  const { data: draft } = useDraft(APPLICANT_ID);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);
  const paymentReference =
    useApplicantPortalStore((s) => s.paymentReference) ??
    deterministicPaymentReference(APPLICANT_ID);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const categoriesQuery = useCategories();
  const category = (categoriesQuery.data ?? []).find((c) => c.key === selectedCategoryKey);
  const fileNumber = deterministicFileNumber(APPLICANT_ID);
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const selectedFaculty = useApplicantPortalStore((s) => s.selectedFaculty);
  const selectedSpecialization = useApplicantPortalStore((s) => s.selectedSpecialization);
  const paymentMethod = useApplicantPortalStore((s) => s.paymentMethod);
  const fawryCode = useApplicantPortalStore((s) => s.fawryCode);

  const paymentMethodLabel = paymentMethod === 'fawry-code' ? 'فوري — كود الدفع' : null;

  /* Print the on-screen بطاقة التردد and ALSO open the طلب الالتحاق PDF
   * in a new window. Two prints fire in sequence — the popup blocker
   * might suppress the second window; surface a toast if so. */
  const handlePrintBoth = (): void => {
    downloadAdmissionForm({
      moiSession,
      fallbackNationalId: storeNid,
      selectedCategoryLabel: categoryLabel(selectedCategoryKey),
      selectedFaculty,
      selectedSpecialization,
      paymentReference,
      paymentMethodLabel,
      fawryCode,
      firstExamDate,
      fileNumber,
    });
    /* Tiny delay so the new window claims focus before we trigger the
     * current-window print dialog — otherwise some browsers stack them
     * and the user only sees one. */
    window.setTimeout(() => {
      window.print();
    }, 600);
    toast('يتم تجهيز بطاقة التردد وطلب الإلتحاق للطباعة', 'info');
  };

  /* Prefer the explicit firstExamDate from the store (set on Stage 8); fall
   * back to the draft's examSlot for the legacy reservation flow. */
  const slot = firstExamDate
    ? { date: firstExamDate, time: '08:00', location: 'كلية الشرطة - مبنى الاختبارات - القاهرة' }
    : draft?.examSlot ?? {
        date: '2026-03-15T08:00:00.000Z',
        time: '08:00',
        location: 'كلية الشرطة - مبنى الاختبارات - القاهرة',
      };

  const barcodeValue = `${MOI_APPLICANT_SESSION.nationalId}-${paymentReference}`;

  return (
    <div
      className="mx-auto flex flex-col gap-4"
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
                {MOI_APPLICANT_SESSION.fullName}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">اللجنة</p>
                <p className="font-ar-display text-md font-bold text-ink-900">
                  {arabicOrdinal(COMMITTEE_NUMBER)}
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">رقم الملف</p>
                <p className="font-mono text-sm text-ink-900" dir="ltr">
                  {fileNumber}
                </p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">الرقم القومي</p>
                <p className="font-mono text-sm text-ink-900" dir="ltr">
                  {MOI_APPLICANT_SESSION.nationalId}
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

        <KhayameyaStripe height="lg" />
      </PrintLayout>

      {/* ── Bottom action row: print + download (screen only) ── */}
      <Card className="no-print">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<FileDown size={16} strokeWidth={1.75} />}
            onClick={handlePrintBoth}
          >
            تحميل
          </Button>
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<Printer size={16} strokeWidth={1.75} />}
            onClick={handlePrintBoth}
          >
            طباعة
          </Button>
        </div>
      </Card>
    </div>
  );
}

