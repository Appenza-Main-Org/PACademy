/**
 * طلب الالتحاق — printable application-form PDF.
 *
 * Generated alongside the بطاقة التردد print step (Stage 9). Opens a
 * new window with an HTML document drawing data from:
 *   - MOI session         (store: moiSession)
 *   - Wizard store        (paymentReference, fawryCode, firstExamDate,
 *                          selectedCategoryKey, selectedFaculty,
 *                          selectedSpecialization)
 *   - Profile snapshot    (Stage345 form values + manualPersonal)
 *   - Family snapshot     (Stage7 family blob)
 *
 * Any field that's not in the snapshots renders as "—" — see the
 * `fallback()` helper. The hard-copy layout the client provides will
 * drive the final field set; this is a structurally-complete first cut.
 */

import type { MoiApplicantSession } from './moi-session.mock';
import {
  loadFamilySnapshot,
  professionLabel,
  type FamilyDataSnapshot,
  type FamilyMemberForm,
  type GuardianForm,
  RELATIVE_LABEL,
  type RelativeKind,
} from './familyData';
import { loadProfileSnapshot, type ProfileSnapshot } from './profileData';

interface BuildInput {
  moiSession: MoiApplicantSession | null;
  fallbackNationalId: string | null;
  selectedCategoryLabel: string;
  selectedFaculty: string | null;
  selectedSpecialization: string | null;
  paymentReference: string | null;
  paymentMethodLabel: string | null;
  fawryCode: string | null;
  firstExamDate: string | null;
  fileNumber: string;
}

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

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return CATEGORY_LABEL[key] ?? key;
}

/**
 * Open a new browser window with the طلب الالتحاق document and trigger
 * the print dialog. Caller can stack this after their own print step so
 * the applicant ends up with two PDFs.
 */
export function downloadAdmissionForm(input: BuildInput): void {
  const profile = loadProfileSnapshot();
  const family = loadFamilySnapshot();
  const html = renderAdmissionFormHtml(input, profile, family);
  const win = window.open('', '_blank');
  if (!win) {
    /* Popup blocked — the bottom-row Toast in Stage 9 surfaces a user
     * notice in that case. Silent failure here. */
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  /* Wait for fonts/layout before triggering print so Arabic renders
   * correctly in the PDF preview. */
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}

function fallback(v: string | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s.length === 0 ? '—' : escapeHtml(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

function row(label: string, value: string | null | undefined, ltr = false): string {
  return `
    <div class="row">
      <span class="row-label">${escapeHtml(label)}</span>
      <span class="row-value${ltr ? ' ltr' : ''}">${fallback(value)}</span>
    </div>`;
}

function section(title: string, body: string): string {
  return `
    <section class="card">
      <h2 class="card-title">${escapeHtml(title)}</h2>
      <div class="grid">${body}</div>
    </section>`;
}

function memberRow(label: string, m: FamilyMemberForm | undefined): string {
  if (!m) return row(label, '—');
  const name = m.name || '';
  const prof = professionLabel(m.profession);
  return `
    <div class="member-row">
      <span class="member-relation">${escapeHtml(label)}</span>
      <span class="member-name">${fallback(name)}</span>
      <span class="member-prof">${fallback(prof)}</span>
      <span class="member-status">${m.deceased ? 'متوفي' : 'على قيد الحياة'}</span>
    </div>`;
}

function guardianRow(g: GuardianForm | undefined): string {
  if (!g) return memberRow('ولي الأمر', undefined);
  return `
    <div class="member-row">
      <span class="member-relation">ولي الأمر</span>
      <span class="member-name">${fallback(g.name)}</span>
      <span class="member-prof">${fallback(professionLabel(g.profession))}</span>
      <span class="member-status">—</span>
    </div>`;
}

function relativesList(family: FamilyDataSnapshot | null): string {
  if (!family) return '';
  const out: string[] = [];
  (Object.keys(RELATIVE_LABEL) as RelativeKind[]).forEach((kind) => {
    family.relatives[kind].forEach((m, i) => {
      out.push(memberRow(`${RELATIVE_LABEL[kind].singular} ${i + 1}`, m));
    });
  });
  return out.join('');
}

function renderAdmissionFormHtml(
  input: BuildInput,
  profile: ProfileSnapshot | null,
  family: FamilyDataSnapshot | null,
): string {
  const s = input.moiSession;
  const v = profile?.values ?? null;
  const mp = profile?.manualPersonal ?? null;

  const fullName = s?.fullName || mp?.fullName || '';
  const nationalId = s?.nationalId || input.fallbackNationalId || '';
  const dob = s?.dateOfBirthAr || mp?.dateOfBirthAr || '';
  const gender = s ? (s.gender === 'male' ? 'ذكر' : 'أنثى') : mp?.gender === 'male' ? 'ذكر' : mp?.gender === 'female' ? 'أنثى' : '';
  const religion = s?.religion || mp?.religion || '';
  const birthGov = s?.birthGovernorate || mp?.birthGovernorate || '';
  const birthDistrict = s?.birthDistrict || mp?.birthDistrict || v?.birthDistrict || '';
  const mobile = s?.mobile || mp?.mobile || '';
  const email = s?.email || mp?.email || '';
  const maritalCode = mp?.maritalStatus || '';
  const marital = maritalCode ? MARITAL_LABEL[maritalCode] ?? '—' : '';
  const shuhra = mp?.shuhra || '';

  const personalBlock = [
    row('الإسم رباعي', fullName),
    row('الرقم القومي', nationalId, true),
    row('تاريخ الميلاد', dob, true),
    row('النوع', gender),
    row('الديانة', religion),
    row('محل الميلاد', `${birthGov}${birthDistrict ? ' - ' + birthDistrict : ''}`),
    row('الحالة الاجتماعية', marital),
    row('اسم الشهرة', shuhra),
    row('رقم المحمول', mobile, true),
    row('البريد الإلكتروني', email, true),
  ].join('');

  const addressBlock = [
    row('محافظة الإقامة', v?.addressGovernorate ?? ''),
    row('القسم / مركز الإقامة', v?.addressDistrict ?? ''),
    row('العنوان التفصيلي', v?.currentAddressDetail ?? ''),
    row('رقم تليفون المنزل', v?.homePhone ?? '', true),
    row('رقم محمول آخر', v?.secondaryMobile ?? '', true),
    row('فيسبوك', v?.facebook ?? '', true),
    row('تويتر', v?.twitter ?? '', true),
    row('إنستجرام', v?.instagram ?? '', true),
  ].join('');

  const thanawiBlock = [
    row('دولة المدرسة', v?.thanawiCountry ?? ''),
    row('نوع الشهادة', v?.thanawiType ?? ''),
    row('اسم المدرسة', v?.schoolNameAr ?? ''),
    row('عنوان المدرسة', v?.schoolAddress ?? ''),
    row('تاريخ الحصول على الشهادة', v?.thanawiGradDate ?? '', true),
    row('التقدير', v?.thanawiGrade ?? ''),
    row('المجموع', v?.thanawiTotal != null ? String(v.thanawiTotal) : '', true),
    row('النسبة المئوية', v?.thanawiPercentage != null ? String(v.thanawiPercentage) + '%' : '', true),
  ].join('');

  const bachelorBlock = [
    row('الجامعة', input.selectedFaculty ? v?.bachelorUniversity ?? '' : v?.bachelorUniversity ?? ''),
    row('الكلية', input.selectedFaculty ?? v?.bachelorFaculty ?? ''),
    row('التخصص', input.selectedSpecialization ?? v?.bachelorSpecialization ?? ''),
    row('المجموعة', v?.bachelorMajor ?? ''),
    row('الشعبة', v?.bachelorBranch ?? ''),
    row('النسبة المئوية', v?.bachelorPercentage != null && v?.bachelorPercentage !== '' ? String(v.bachelorPercentage) + '%' : '', true),
    row('سنة التخرج', v?.bachelorYear != null && v?.bachelorYear !== '' ? String(v.bachelorYear) : '', true),
    row('التقدير العام', v?.bachelorGrade ?? ''),
  ].join('');

  const qlevel = profile?.qualificationLevel ?? '';
  const showMaster = qlevel === 'master' || qlevel === 'doctorate';
  const showDoctorate = qlevel === 'doctorate';

  const postgradMasterBlock = showMaster
    ? section(
        'بيانات الماجستير',
        [
          row('سنة الحصول على الشهادة', v?.postgradYear != null && v?.postgradYear !== '' ? String(v.postgradYear) : '', true),
          row('التقدير', v?.postgradGrade ?? ''),
        ].join(''),
      )
    : '';

  const postgradDoctorateBlock = showDoctorate
    ? section(
        'بيانات الدكتوراه',
        [
          row('سنة الحصول على الشهادة', v?.doctorateYear != null && v?.doctorateYear !== '' ? String(v.doctorateYear) : '', true),
          row('التقدير', v?.doctorateGrade ?? ''),
        ].join(''),
      )
    : '';

  const categoryBlock = [
    row('الفئة المتقدم لها', input.selectedCategoryLabel),
    row('الكلية', input.selectedFaculty ?? ''),
    row('التخصص', input.selectedSpecialization ?? ''),
    qlevel ? row('المؤهل / الدرجة العلمية', QUALIFICATION_LEVEL_LABEL[qlevel] ?? '') : '',
  ].join('');

  const paymentBlock = [
    row('طريقة السداد', input.paymentMethodLabel ?? ''),
    row('الرقم المرجعي', input.paymentReference, true),
    row('كود فوري', input.fawryCode, true),
    row('رقم الملف', input.fileNumber, true),
  ].join('');

  const examBlock = row('تاريخ أول إختبار', fmtDateAr(input.firstExamDate), true);

  const familyHeader = `
    <div class="member-row member-row-head">
      <span class="member-relation">القرابة</span>
      <span class="member-name">الإسم</span>
      <span class="member-prof">الوظيفة</span>
      <span class="member-status">الحالة</span>
    </div>`;
  const familyBody = family
    ? [
        memberRow('الأب', family.father),
        memberRow('الأم', family.mother),
        memberRow('الجد لأب', family.grandparents.paternalGrandfather),
        memberRow('الجدة لأب', family.grandparents.paternalGrandmother),
        memberRow('الجد لأم', family.grandparents.maternalGrandfather),
        memberRow('الجدة لأم', family.grandparents.maternalGrandmother),
        relativesList(family),
        guardianRow(family.guardian),
      ].join('')
    : '<div class="empty">لم تُسجَّل بيانات العائلة بعد.</div>';

  const familySection = `
    <section class="card">
      <h2 class="card-title">بيانات العائلة وولي الأمر</h2>
      <div class="member-table">${familyHeader}${familyBody}</div>
    </section>`;

  const now = new Date();
  const generatedAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طلب الإلتحاق — أكاديمية الشرطة</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Sans Arabic', 'Tajawal', Tahoma, system-ui, Arial;
      color: #1a1a1a;
      line-height: 1.65;
      max-width: 760px;
      margin: 0 auto;
      padding: 8px;
      font-size: 13px;
    }
    header.doc-header {
      border-bottom: 3px solid #1a6868;
      padding-bottom: 10px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    header.doc-header h1 {
      font-size: 22px;
      color: #1a6868;
      margin: 0;
    }
    header.doc-header p {
      font-size: 11px;
      color: #555;
      margin: 2px 0 0;
    }
    header .meta {
      font-size: 11px;
      color: #555;
      text-align: end;
    }
    .card {
      border: 1px solid #d8d4c8;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 12px;
      break-inside: avoid;
    }
    .card-title {
      font-size: 14px;
      color: #1a6868;
      margin: 0 0 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #d4a445;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 18px;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 2px 0;
      border-bottom: 1px dotted #eee;
    }
    .row:last-child { border-bottom: none; }
    .row-label {
      flex-shrink: 0;
      min-width: 140px;
      font-size: 11px;
      color: #6b7280;
      letter-spacing: 0.04em;
    }
    .row-value {
      flex: 1;
      font-weight: 600;
      color: #1a1a1a;
    }
    .row-value.ltr {
      direction: ltr;
      text-align: end;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-weight: 500;
    }
    .member-table {
      display: flex;
      flex-direction: column;
    }
    .member-row {
      display: grid;
      grid-template-columns: 1.5fr 2fr 1.5fr 1fr;
      gap: 8px;
      padding: 6px 4px;
      border-bottom: 1px solid #eee;
      align-items: baseline;
    }
    .member-row-head {
      background: #f4f2ed;
      font-weight: 600;
      font-size: 11px;
      color: #6b7280;
      letter-spacing: 0.04em;
    }
    .member-row span { font-size: 13px; }
    .member-row .member-relation { color: #6b7280; }
    .empty {
      padding: 12px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
      border: 1px dashed #d8d4c8;
      border-radius: 6px;
      background: #fffaf2;
    }
    .signature {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 18px;
      padding: 12px 0;
      border-top: 1px dashed #d4a445;
    }
    .signature .box {
      border: 1px solid #d8d4c8;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      min-height: 64px;
    }
    .signature .label {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 22px;
    }
    .declaration {
      margin-top: 14px;
      padding: 10px 12px;
      background: #fff8e6;
      border: 1px dashed #d4a445;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.7;
    }
    footer.doc-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
      font-size: 10px;
      color: #777;
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="doc-header">
    <div>
      <h1>طلب الإلتحاق بأكاديمية الشرطة</h1>
      <p>منظومة القبول — وزارة الداخلية</p>
    </div>
    <div class="meta">
      <div>رقم الملف: <strong>${fallback(input.fileNumber)}</strong></div>
      <div>تاريخ الطباعة: ${escapeHtml(generatedAt)}</div>
    </div>
  </header>

  ${section('البيانات الشخصية', personalBlock)}
  ${section('الفئة المتقدم لها', categoryBlock)}
  ${section('بيانات الشهادة الثانوية', thanawiBlock)}
  ${section('بيانات المؤهل الجامعي', bachelorBlock)}
  ${postgradMasterBlock}
  ${postgradDoctorateBlock}
  ${section('عنوان الإقامة وبيانات التواصل', addressBlock)}
  ${familySection}
  ${section('بيانات السداد', paymentBlock)}
  ${section('موعد الإختبار', examBlock)}

  <div class="declaration">
    أُقرّ أنا الموقّع أدناه بأن جميع البيانات المُدرَجة في هذا الطلب صحيحة ومطابقة
    للأوراق الثبوتية، وأتحمّل مسؤولية أي مخالفة بين البيان المُدرَج والأوراق
    الأصلية، وأتعهد بإحضارها يوم الإختبار.
  </div>

  <div class="signature">
    <div class="box">
      <div class="label">توقيع المتقدم</div>
    </div>
    <div class="box">
      <div class="label">توقيع ولي الأمر</div>
    </div>
  </div>

  <footer class="doc-footer">
    طلب الإلتحاق — أكاديمية الشرطة · وزارة الداخلية · ${now.getFullYear()}
  </footer>
</body>
</html>`;
}
