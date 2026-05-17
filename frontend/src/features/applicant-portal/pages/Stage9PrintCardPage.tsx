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

import { FileDown, Printer, ShieldCheck, Square } from 'lucide-react';
import {
  Button,
  Card,
  Code128Barcode,
  KhayameyaStripe,
  LogoMark,
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
    <div className="flex flex-col gap-4">
      {/* ── Top non-print card: notice + action buttons ── */}
      <Card className="no-print flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div
          role="note"
          className="flex flex-1 items-start gap-2 rounded-md border border-teal-500/40 bg-teal-50 px-3 py-2 text-2xs text-teal-800"
        >
          <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p className="leading-relaxed text-end" dir="rtl">
            <strong>عزيزي الطالب:</strong> برجاء طباعة هذه الصفحة حيث أنها تُعدّ تصريح الدخول للكلية.
            <br />
            ** برجاء التأكد من ظهور الباركود الخاص بالطالب في بطاقة التردد.
            <br />
            ** برجاء طباعة هذا الطلب والتوقيع عليه بمعرفة الطالب وولي الأمر.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Button
            variant="primary"
            leadingIcon={<Printer size={14} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            طباعة
          </Button>
          <Button
            variant="secondary"
            leadingIcon={<FileDown size={14} strokeWidth={1.75} />}
            onClick={() => window.print()}
            title="تحميل الإقرار للتوقيع"
          >
            تحميل
          </Button>
        </div>
      </Card>

      {/* ── Required documents — instruction card shown above the printable
            card (not inside it). `no-print` so it's screen-only. ── */}
      <Card
        className="no-print"
        aria-label="المستندات المطلوبة يوم الاختبار"
      >
        <h3 className="mb-3 text-start font-ar-display text-md font-bold text-ink-900">
          المستندات المطلوبة يوم الاختبار
        </h3>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm text-ink-800 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'بطاقة الرقم القومي (الأصل)',
            'أصل شهادة الثانوية العامة',
            'شهادة طبية معتمدة',
            'كارت تردد مطبوع',
            '4 صور شخصية حديثة',
            'شهادة حسن السير والسلوك',
          ].map((doc) => (
            <li key={doc} className="flex items-center gap-2">
              <Square
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-ink-500"
                aria-hidden
              />
              <span>{doc}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── The printable card itself ── */}
      <PrintLayout
        title="بطاقة التردد"
        subtitle={`دفعة قبول 2026 — ${category?.labelAr ?? 'أكاديمية الشرطة'}`}
        reportId={APPLICANT_ID}
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

          {/* Verification stamp column */}
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-500 text-teal-700"
            >
              <ShieldCheck size={24} strokeWidth={1.75} />
            </span>
            <p className="text-2xs font-bold text-teal-700">مُوثَّق</p>
          </div>
        </div>

        {/* Payment reference line (PDF p.12) */}
        <p className="mb-5 rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-sm text-ink-700">
          تم الدفع بالبطاقة البنكية بالرقم المرجعي:{' '}
          <span className="font-numeric tnum font-bold text-ink-900" dir="ltr">
            {toEasternArabicNumerals(paymentReference)}
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

        {/* Signature block */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <SignatureLine label="توقيع المتقدم" />
          <SignatureLine label="توقيع ولي الأمر" />
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-border-subtle bg-ink-50 px-3 pt-3 pb-2">
            <LogoMark size={40} />
            <span className="text-2xs uppercase tracking-wide text-ink-500">ختم الإدارة</span>
          </div>
        </div>

        <p className="my-4 text-center text-2xs text-ink-500">
          يجب أن يكون الكارت في صورته الأصلية يوم الاختبار · أيّ تعديل أو نسخ يبطل صلاحيته
        </p>

        <KhayameyaStripe height="lg" />
      </PrintLayout>
    </div>
  );
}

function SignatureLine({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-border-subtle bg-ink-50 px-3 pt-3 pb-2">
      <span aria-hidden className="block h-10 w-full border-b border-dashed border-ink-700/60" />
      <span className="text-2xs uppercase tracking-wide text-ink-500">{label}</span>
    </div>
  );
}

