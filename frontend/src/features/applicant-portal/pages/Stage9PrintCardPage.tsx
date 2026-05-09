/**
 * Stage 9 — printable attendance card (RFP Scope Document §2.2 stage 9).
 * Source: TIER 2 print polish.
 *
 * Polished for evaluator demo: photo box + 4-part name + national ID +
 * exam appointment + barcode + Khayameya bottom band + corner flourishes
 * + required-documents checklist.
 */

import { MapPin, Printer, ShieldCheck, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Code128Barcode,
  KhayameyaStripe,
  LogoMark,
  PrintLayout,
} from '@/shared/components';
import { useDraft } from '../api/applicantPortal.queries';
import { date as fmtDate } from '@/shared/lib/format';
import {
  arabicDayOfWeek,
  arabicOrdinal,
  arabicTimeOfDay,
  toEasternArabicNumerals,
} from '@/shared/lib/arabic';

const APPLICANT_ID = 'APP-2026000';
const APPLICANT_NAME = 'يوسف أحمد محمد الخطيب';
const APPLICANT_NID = '30506121601234';
const BARCODE = '26-CAI-00001234';
/* Demo: committee number for the rendered card. Production sources this
 * from the reserved exam slot via committeeService once Gap H links
 * ExamSlot.committeeId through to the draft. */
const COMMITTEE_NUMBER = 2;

export function Stage9PrintCardPage(): JSX.Element {
  const navigate = useNavigate();
  const { data: draft } = useDraft(APPLICANT_ID);
  const slot = draft?.examSlot ?? {
    date: '2026-03-15T08:00:00.000Z',
    time: '08:00',
    location: 'كلية الشرطة - مبنى الاختبارات - القاهرة',
  };
  const fawryRef = draft?.payment?.fawryCode ?? draft?.payment?.refNumber ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between no-print">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">طباعة كارت التردد</h2>
          <p className="text-sm text-ink-500">
            احتفظ بالكارت معك يوم الاختبار. الكارت يحوي باركود لتسجيل الحضور تلقائياً.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            leadingIcon={<Printer size={14} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            طباعة
          </Button>
          <Button variant="ghost" onClick={() => navigate('/applicant/follow-up')}>
            تخطّي
          </Button>
        </div>
      </Card>

      <PrintLayout
        title="بطاقة التردد"
        subtitle="دفعة قبول 2026 — أكاديمية الشرطة"
        reportId={APPLICANT_ID}
        generatedAt={fmtDate(Date.now(), 'short')}
      >
        {/* Header strip with applicant identity */}
        <div className="mb-6 grid grid-cols-[120px_1fr_auto] gap-5 rounded-lg border-2 border-teal-500 bg-teal-50/40 p-4">
          {/* Photo */}
          <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-teal-300 bg-surface-card p-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-md bg-ink-100 text-ink-400">
              <User size={36} strokeWidth={1.25} />
            </div>
            <p className="mt-1 text-2xs text-ink-500">الصورة الشخصية</p>
          </div>

          {/* Identity */}
          <div className="flex flex-col justify-center gap-2">
            <div>
              <p className="text-2xs uppercase tracking-wide text-ink-500">اسم الطالب</p>
              <p className="font-ar-display text-lg font-bold text-ink-900">{APPLICANT_NAME}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wide text-ink-500">اللجنة</p>
              <p className="font-ar-display text-md font-bold text-ink-900">{arabicOrdinal(COMMITTEE_NUMBER)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">الرقم القومى</p>
                <p className="font-mono text-sm text-ink-900" dir="ltr">{APPLICANT_NID}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wide text-ink-500">رقم الملف</p>
                <p className="font-mono text-sm text-ink-900" dir="ltr">{APPLICANT_ID}</p>
              </div>
            </div>
          </div>

          {/* Verification stamp */}
          <div className="flex flex-col items-center justify-center text-center">
            <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-500 text-teal-700">
              <ShieldCheck size={24} strokeWidth={1.75} />
            </span>
            <p className="mt-1 text-2xs font-bold text-teal-700">مُوثَّق</p>
          </div>
        </div>

        {/* Fawry payment reference line — verbatim phrasing from the printed
            reference card. Falls back to the internal refNumber if no
            Fawry-side code was issued (card-method payment). */}
        {fawryRef && (
          <p className="mb-5 rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-sm text-ink-700">
            تم الدفع بواسطة فورى بالمدفوعة رقم:{' '}
            <span className="font-numeric tnum font-bold text-ink-900">
              {toEasternArabicNumerals(fawryRef)}
            </span>
          </p>
        )}

        {/* Exam-date sentence — prose form matching the printed reference:
            'تاريخ إختبار قدرات يوم الأربعاء YYYY/MM/DD الساعة السادسة صباحاً'.
            Day of week + Gregorian date + Arabic-word time of day. */}
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
              <span dir="ltr" className="font-numeric tnum">{dateStr}</span>{' '}
              الساعة {hourWord} {periodWord}
            </p>
          );
        })()}

        {/* Exam location — kept as a small icon-row so applicants can still
            see where to go without needing to read the prose sentence. */}
        <div className="mb-6 flex items-start gap-3 rounded-md border border-border-default bg-surface-card p-4">
          <span aria-hidden className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <MapPin size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-500">مكان الاختبار</p>
            <p className="mt-0.5 font-medium text-ink-900">{slot.location}</p>
            <p className="mt-0.5 text-2xs text-ink-500">احرص على الحضور قبل الموعد بـ 30 دقيقة</p>
          </div>
        </div>

        {/* Required documents */}
        <div className="mb-6 rounded-md border border-border-subtle bg-ink-50 p-4">
          <p className="mb-2 text-2xs uppercase tracking-wide text-ink-500">المستندات المطلوبة يوم الاختبار</p>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {[
              'بطاقة الرقم القومي (الأصل)',
              'كارت تردد مطبوع',
              'أصل شهادة الثانوية العامة',
              '4 صور شخصية حديثة',
              'شهادة طبية معتمدة',
              'شهادة حسن السير والسلوك',
            ].map((doc) => (
              <li key={doc} className="flex items-center gap-2">
                <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-ink-700 text-2xs">☐</span>
                <span className="text-ink-700">{doc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Barcode block — real Code 128 carrying the applicant payload.
            The label printed beneath the bars repeats the committee ordinal
            (matches the printed reference card); the numeric tracking string
            sits at the very bottom of the block for staff reference. */}
        <div className="mb-2 flex flex-col items-center gap-2 rounded-lg border-2 border-ink-700 bg-surface-card py-4 px-3">
          <Badge tone="brand">امسح هذا الكود لتسجيل الحضور</Badge>
          <Code128Barcode
            value={BARCODE}
            height={80}
            moduleWidth={2}
            showText={false}
          />
          <p className="font-ar-display text-md font-bold text-ink-900">
            اللجنة {arabicOrdinal(COMMITTEE_NUMBER)}
          </p>
          <p className="font-mono text-2xs tracking-widest text-ink-500" dir="ltr">{BARCODE}</p>
        </div>

        {/* Signature block */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <SignatureLine label="توقيع المتقدم" />
          <SignatureLine label="موظف الاستقبال — الاسم والرتبة" />
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-border-subtle bg-ink-50 px-3 pt-3 pb-2">
            <LogoMark size={40} />
            <span className="text-2xs uppercase tracking-wide text-ink-500">ختم الإدارة</span>
          </div>
        </div>

        {/* Footer note */}
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

