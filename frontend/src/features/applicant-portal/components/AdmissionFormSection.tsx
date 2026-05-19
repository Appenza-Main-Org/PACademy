/**
 * طلب الإلتحاق — printable + on-screen application-form section.
 *
 * Rendered on Stage 9 (print-card) directly under the بطاقة التردد so
 * the applicant sees both documents at once and a single window.print()
 * produces a unified PDF.
 *
 * Data sources (all read-only):
 *   - MOI session         (store: moiSession)
 *   - Wizard store        (paymentReference, fawryCode, firstExamDate,
 *                          selectedCategoryKey, selectedFaculty,
 *                          selectedSpecialization, paymentMethod)
 *   - Profile snapshot    (Stage345 form values + manualPersonal)
 *   - Family snapshot     (Stage7 family blob)
 *
 * Missing fields render as "—". The hard-copy form the client provides
 * will drive the final field set; this is a structurally-complete pass.
 */

import { useMemo } from 'react';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { loadProfileSnapshot } from '../lib/profileData';
import {
  loadFamilySnapshot,
  professionLabel,
  RELATIVE_LABEL,
  type FamilyMemberForm,
  type GuardianForm,
  type RelativeKind,
} from '../lib/familyData';

const CATEGORY_LABEL: Record<string, string> = {
  officers_general: 'قسم الضباط (قسم عام)',
  law_bachelor: 'ليسانس حقوق',
  specialized_officers: 'الضباط المتخصصون',
  physical_education_bachelor: 'بكالوريوس تربية رياضية',
};

const MARITAL_LABEL: Record<string, string> = {
  single: 'أعزب',
  married: 'متزوج',
  divorced: 'مطلق',
  widowed: 'أرمل',
};

const QUALIFICATION_LEVEL_LABEL: Record<string, string> = {
  license: 'ليسانس',
  bachelor: 'بكالوريوس',
  master: 'ماجستير',
  doctorate: 'دكتوراه',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  'fawry-code': 'فوري — كود الدفع',
};

interface Props {
  fileNumber: string;
}

export function AdmissionFormSection({ fileNumber }: Props): JSX.Element {
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const selectedFaculty = useApplicantPortalStore((s) => s.selectedFaculty);
  const selectedSpecialization = useApplicantPortalStore((s) => s.selectedSpecialization);
  const paymentReference = useApplicantPortalStore((s) => s.paymentReference);
  const paymentMethod = useApplicantPortalStore((s) => s.paymentMethod);
  const fawryCode = useApplicantPortalStore((s) => s.fawryCode);
  const firstExamDate = useApplicantPortalStore((s) => s.firstExamDate);

  const profile = useMemo(() => loadProfileSnapshot(), []);
  const family = useMemo(() => loadFamilySnapshot(), []);

  const v = profile?.values ?? null;
  const mp = profile?.manualPersonal ?? null;
  const qlevel = profile?.qualificationLevel ?? '';

  const fullName = moiSession?.fullName || mp?.fullName || '';
  const nationalId = moiSession?.nationalId || storeNid || '';
  const dob = moiSession?.dateOfBirthAr || mp?.dateOfBirthAr || '';
  const gender = moiSession
    ? moiSession.gender === 'male'
      ? 'ذكر'
      : 'أنثى'
    : mp?.gender === 'male'
      ? 'ذكر'
      : mp?.gender === 'female'
        ? 'أنثى'
        : '';
  const religion = moiSession?.religion || mp?.religion || '';
  const birthGov = moiSession?.birthGovernorate || mp?.birthGovernorate || '';
  const birthDistrict =
    moiSession?.birthDistrict || mp?.birthDistrict || v?.birthDistrict || '';
  const mobile = moiSession?.mobile || mp?.mobile || '';
  const email = moiSession?.email || mp?.email || '';
  const maritalCode = mp?.maritalStatus || '';
  const marital = maritalCode ? MARITAL_LABEL[maritalCode] ?? '—' : '';
  const shuhra = mp?.shuhra || '';

  const categoryLabelText = selectedCategoryKey
    ? CATEGORY_LABEL[selectedCategoryKey] ?? selectedCategoryKey
    : '';
  const paymentMethodLabel = paymentMethod ? PAYMENT_METHOD_LABEL[paymentMethod] ?? null : null;

  const showMaster = qlevel === 'master' || qlevel === 'doctorate';
  const showDoctorate = qlevel === 'doctorate';

  return (
    /* No PrintLayout wrapper here — the parent (Stage 9) places this
     * inside the same PrintLayout as بطاقة التردد so print/download
     * produces a single document with a shared ministry letterhead.
     * The `break-before-page` style makes طلب الإلتحاق start on its
     * own page when printing, but stays inline on-screen. */
    <div
      className="mt-8 border-t-2 border-dashed border-gold-300 pt-6 print:break-before-page"
      style={{ breakBefore: 'page' }}
    >
      <header className="mb-4">
        <h2 className="font-ar-display text-2xl font-bold leading-snug text-ink-900">
          طلب الإلتحاق
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          دفعة قبول 2026 — {categoryLabelText || 'أكاديمية الشرطة'} · تاريخ الإصدار:{' '}
          <span dir="ltr">{fmtDate(Date.now(), 'short')}</span>
        </p>
      </header>
      <Section title="البيانات الشخصية">
        <Row label="الإسم رباعي" value={fullName} />
        <Row label="الرقم القومي" value={nationalId} ltr mono />
        <Row label="تاريخ الميلاد" value={dob} ltr />
        <Row label="النوع" value={gender} />
        <Row label="الديانة" value={religion} />
        <Row
          label="محل الميلاد"
          value={`${birthGov}${birthDistrict ? ' - ' + birthDistrict : ''}`}
        />
        <Row label="الحالة الاجتماعية" value={marital} />
        <Row label="اسم الشهرة" value={shuhra} />
        <Row label="رقم المحمول" value={mobile} ltr mono />
        <Row label="البريد الإلكتروني" value={email} ltr />
      </Section>

      <Section title="الفئة المتقدم لها">
        <Row label="الفئة" value={categoryLabelText} />
        <Row label="الكلية" value={selectedFaculty ?? v?.bachelorFaculty ?? ''} />
        <Row
          label="التخصص"
          value={selectedSpecialization ?? v?.bachelorSpecialization ?? ''}
        />
        {qlevel && (
          <Row
            label="المؤهل / الدرجة العلمية"
            value={QUALIFICATION_LEVEL_LABEL[qlevel] ?? ''}
          />
        )}
      </Section>

      <Section title="بيانات الشهادة الثانوية">
        <Row label="دولة المدرسة" value={v?.thanawiCountry ?? ''} />
        <Row label="نوع الشهادة" value={v?.thanawiType ?? ''} />
        <Row label="اسم المدرسة" value={v?.schoolNameAr ?? ''} />
        <Row label="عنوان المدرسة" value={v?.schoolAddress ?? ''} />
        <Row label="تاريخ الحصول على الشهادة" value={v?.thanawiGradDate ?? ''} ltr />
        <Row label="التقدير" value={v?.thanawiGrade ?? ''} />
        <Row
          label="المجموع"
          value={v?.thanawiTotal != null ? String(v.thanawiTotal) : ''}
          ltr
        />
        <Row
          label="النسبة المئوية"
          value={
            v?.thanawiPercentage != null ? String(v.thanawiPercentage) + '%' : ''
          }
          ltr
        />
      </Section>

      <Section title="بيانات المؤهل الجامعي">
        <Row label="الجامعة" value={v?.bachelorUniversity ?? ''} />
        <Row label="الكلية" value={selectedFaculty ?? v?.bachelorFaculty ?? ''} />
        <Row
          label="التخصص"
          value={selectedSpecialization ?? v?.bachelorSpecialization ?? ''}
        />
        <Row label="المجموعة" value={v?.bachelorMajor ?? ''} />
        <Row label="الشعبة" value={v?.bachelorBranch ?? ''} />
        <Row
          label="النسبة المئوية"
          value={
            v?.bachelorPercentage != null && v?.bachelorPercentage !== ''
              ? String(v.bachelorPercentage) + '%'
              : ''
          }
          ltr
        />
        <Row
          label="سنة التخرج"
          value={
            v?.bachelorYear != null && v?.bachelorYear !== ''
              ? String(v.bachelorYear)
              : ''
          }
          ltr
        />
        <Row label="التقدير العام" value={v?.bachelorGrade ?? ''} />
      </Section>

      {showMaster && (
        <Section title="بيانات الماجستير">
          <Row
            label="سنة الحصول على الشهادة"
            value={
              v?.postgradYear != null && v?.postgradYear !== ''
                ? String(v.postgradYear)
                : ''
            }
            ltr
          />
          <Row label="التقدير" value={v?.postgradGrade ?? ''} />
        </Section>
      )}

      {showDoctorate && (
        <Section title="بيانات الدكتوراه">
          <Row
            label="سنة الحصول على الشهادة"
            value={
              v?.doctorateYear != null && v?.doctorateYear !== ''
                ? String(v.doctorateYear)
                : ''
            }
            ltr
          />
          <Row label="التقدير" value={v?.doctorateGrade ?? ''} />
        </Section>
      )}

      <Section title="عنوان الإقامة وبيانات التواصل">
        <Row label="محافظة الإقامة" value={v?.addressGovernorate ?? ''} />
        <Row label="القسم / مركز الإقامة" value={v?.addressDistrict ?? ''} />
        <Row label="العنوان التفصيلي" value={v?.currentAddressDetail ?? ''} />
        <Row label="رقم تليفون المنزل" value={v?.homePhone ?? ''} ltr mono />
        <Row label="رقم محمول آخر" value={v?.secondaryMobile ?? ''} ltr mono />
        <Row label="فيسبوك" value={v?.facebook ?? ''} ltr />
        <Row label="تويتر" value={v?.twitter ?? ''} ltr />
        <Row label="إنستجرام" value={v?.instagram ?? ''} ltr />
      </Section>

      <FamilyTable family={family} />

      <Section title="بيانات السداد">
        <Row label="طريقة السداد" value={paymentMethodLabel ?? ''} />
        <Row label="الرقم المرجعي" value={paymentReference ?? ''} ltr mono />
        <Row label="كود فوري" value={fawryCode ?? ''} ltr mono />
        <Row label="رقم الملف" value={fileNumber} ltr mono />
      </Section>

      <Section title="موعد الإختبار">
        <Row
          label="تاريخ أول إختبار"
          value={firstExamDate ? fmtDate(firstExamDate, 'short') : ''}
          ltr
        />
      </Section>

      <div className="mt-4 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-2xs leading-relaxed text-gold-700">
        أُقرّ أنا الموقّع أدناه بأن جميع البيانات المُدرَجة في هذا الطلب صحيحة ومطابقة
        للأوراق الثبوتية، وأتحمّل مسؤولية أي مخالفة بين البيان المُدرَج والأوراق الأصلية،
        وأتعهد بإحضارها يوم الإختبار.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6 border-t border-dashed border-gold-300 pt-4">
        <SignatureBox label="توقيع المتقدم" />
        <SignatureBox label="توقيع ولي الأمر" />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="mb-4 rounded-md border border-border-default p-3 break-inside-avoid">
      <h3 className="mb-2 border-b border-dashed border-gold-300 pb-1.5 font-ar-display text-sm font-bold text-teal-700">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Row({
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
  const display = value && value.trim().length > 0 ? value : '—';
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-border-subtle py-1 last:border-b-0">
      <dt className="min-w-[140px] flex-shrink-0 text-2xs uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd
        className={
          'flex-1 text-sm font-medium text-ink-900 ' +
          (ltr ? 'text-end ' : '') +
          (mono ? 'font-mono' : '')
        }
        dir={ltr ? 'ltr' : undefined}
      >
        {display}
      </dd>
    </div>
  );
}

function SignatureBox({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border-default p-3 text-center">
      <p className="text-2xs uppercase tracking-wide text-ink-500">{label}</p>
      <div className="mt-6 h-6" />
    </div>
  );
}

function FamilyTable({
  family,
}: {
  family: ReturnType<typeof loadFamilySnapshot>;
}): JSX.Element {
  if (!family) {
    return (
      <section className="mb-4 rounded-md border border-border-default p-3 break-inside-avoid">
        <h3 className="mb-2 border-b border-dashed border-gold-300 pb-1.5 font-ar-display text-sm font-bold text-teal-700">
          بيانات العائلة وولي الأمر
        </h3>
        <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-2 text-2xs text-ink-500">
          لم تُسجَّل بيانات العائلة بعد.
        </p>
      </section>
    );
  }

  const rows: Array<{ relation: string; member: FamilyMemberForm | undefined }> = [
    { relation: 'الأب', member: family.father },
    { relation: 'الأم', member: family.mother },
    { relation: 'الجد لأب', member: family.grandparents.paternalGrandfather },
    { relation: 'الجدة لأب', member: family.grandparents.paternalGrandmother },
    { relation: 'الجد لأم', member: family.grandparents.maternalGrandfather },
    { relation: 'الجدة لأم', member: family.grandparents.maternalGrandmother },
  ];
  family.fatherWives.forEach((m, i) =>
    rows.push({ relation: `زوجة الأب ${i + 1}`, member: m }),
  );
  family.motherHusbands.forEach((m, i) =>
    rows.push({ relation: `زوج الأم ${i + 1}`, member: m }),
  );
  (Object.keys(RELATIVE_LABEL) as RelativeKind[]).forEach((kind) => {
    family.relatives[kind].forEach((m, i) =>
      rows.push({ relation: `${RELATIVE_LABEL[kind].singular} ${i + 1}`, member: m }),
    );
  });

  return (
    <section className="mb-4 rounded-md border border-border-default p-3 break-inside-avoid">
      <h3 className="mb-2 border-b border-dashed border-gold-300 pb-1.5 font-ar-display text-sm font-bold text-teal-700">
        بيانات العائلة وولي الأمر
      </h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-ink-50 text-ink-600">
            <th className="border border-border-default px-2 py-1 text-start font-medium">القرابة</th>
            <th className="border border-border-default px-2 py-1 text-start font-medium">الإسم</th>
            <th className="border border-border-default px-2 py-1 text-start font-medium">الوظيفة</th>
            <th className="border border-border-default px-2 py-1 text-start font-medium">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.relation}-${i}`}>
              <td className="border border-border-default px-2 py-1 text-ink-600">{r.relation}</td>
              <td className="border border-border-default px-2 py-1 text-ink-900">
                {r.member?.name || '—'}
              </td>
              <td className="border border-border-default px-2 py-1 text-ink-900">
                {r.member ? professionLabel(r.member.profession) : '—'}
              </td>
              <td className="border border-border-default px-2 py-1 text-ink-900">
                {r.member ? (r.member.deceased ? 'متوفي' : 'على قيد الحياة') : '—'}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-border-default px-2 py-1 text-ink-600">ولي الأمر</td>
            <td className="border border-border-default px-2 py-1 text-ink-900">
              {familyGuardianName(family.guardian)}
            </td>
            <td className="border border-border-default px-2 py-1 text-ink-900">
              {family.guardian.profession ? professionLabel(family.guardian.profession) : '—'}
            </td>
            <td className="border border-border-default px-2 py-1 text-ink-900">—</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function familyGuardianName(g: GuardianForm): string {
  return g.name && g.name.trim().length > 0 ? g.name : '—';
}
