/**
 * PrintableDocument — page-faithful mirror of the supplied PDF
 * "وثيقة تعارف · طالب قسم عام". Used for both the on-screen preview
 * (inside the review Drawer) and the actual paper output when the user
 * hits «طباعة».
 *
 * Structure: 35 pages total — cover + نموذج 1 → 31 + final تعليمات page.
 * Every page is one `<section className="vothiqa-form">` element with
 * `page-break-before: always` (the global rule lives in print.css).
 *
 * Cell visuals match the PDF: label cells use a 1px black border; value
 * cells are also bordered; empty value cells render as visible empty
 * boxes (so a printed copy retains the form-fillable look even when
 * the applicant left a row blank).
 *
 * The footer row («أقر أنا الطالب …») is rendered identically on every
 * form page that carries it in the PDF.
 */

import type {
  AdultRelativeList,
  AdultRelativeRecord,
  ApplicantSpouseRecord,
  CriminalCaseList,
  ForeignEmployedList,
  GrandparentRecord,
  NaturalizedList,
  RelativeChildList,
  SpouseSubRecord,
  VothiqaTaarufDocument,
} from '../../lib/vothiqaTaaruf.types';
import {
  PROFESSION_OPTIONS,
  QUALIFICATION_OPTIONS,
} from '../../lib/vothiqaTaaruf.options';

/* Stage 11 inputs store dropdown values as codes (e.g. `bachelor`,
 * `police_officer`); the print mirror needs the Arabic labels. The
 * lookup tolerates raw free-text (returned as-is) so historic snapshots
 * that pre-date the dropdown swap continue to render. */
const QUAL_LABEL = new Map(QUALIFICATION_OPTIONS.map((o) => [o.value, o.label]));
const PROF_LABEL = new Map(PROFESSION_OPTIONS.map((o) => [o.value, o.label]));
const OFFICER_CODES = new Set(['police_officer', 'army_officer']);

function qualLabel(code: string | undefined | null): string {
  if (!code) return '';
  return QUAL_LABEL.get(code) ?? code;
}
function profLabel(code: string | undefined | null): string {
  if (!code) return '';
  return PROF_LABEL.get(code) ?? code;
}
/** Render the profession with «(رقم الأقدمية: NNNN)» suffix when the
 * profession is an officer role and the seniority number is populated.
 * The PDF doesn't have a dedicated seniority cell, so the data lands
 * inline with the profession to stay page-faithful. */
function profPrint(code: string | undefined | null, seniority: string | undefined | null): string {
  const label = profLabel(code);
  if (!label) return '';
  if (code && OFFICER_CODES.has(code) && seniority && seniority.trim().length > 0) {
    return `${label} (رقم الأقدمية: ${seniority.trim()})`;
  }
  return label;
}

interface PrintableDocumentProps {
  doc: VothiqaTaarufDocument;
}

export function PrintableDocument({ doc }: PrintableDocumentProps): JSX.Element {
  return (
    <div className="vothiqa-print" dir="rtl">
      <style>{vothiqaPrintCss}</style>
      <CoverPage cover={doc.personal.cover} />
      <Form1Personal doc={doc} />
      {/* Applicant's spouse + children — only when married. The
       *  page-faithful نموذج 2 / 3 / 12 / 12·1 layout from the
       *  «نظام العامين الدارسيين» supplementary template. */}
      {doc.personal.personal.maritalStatus === 'married' && (
        <>
          <ApplicantSpousePage doc={doc} />
          {doc.applicantFamily.hasSecondSpouse && <ApplicantSecondSpousePage doc={doc} />}
          <ApplicantChildrenPage
            formNumber="نموذج (12)"
            title="بيانات أبناء الطالب الذكور وزوجاتهم"
            counterLabel="عدد أبناء الطالب"
            list={doc.applicantFamily.sons}
            subjectLabel="اسم الإبن"
            spouseLabel="اسم الزوجة"
          />
          <ApplicantChildrenPage
            formNumber="نموذج (12/1)"
            title="بيانات بنات الطالب وأزواجهن"
            counterLabel="عدد بنات الطالب"
            list={doc.applicantFamily.daughters}
            subjectLabel="اسم البنت"
            spouseLabel="اسم الزوج"
          />
        </>
      )}
      <Form2Father doc={doc} />
      <Form3Guardian doc={doc} />
      <Form4Mother doc={doc} />
      <Form5Housing doc={doc} />
      <Form6Income doc={doc} />
      <GrandparentPage formNumber="نموذج (7)" title="بيانات جد الطالب للوالد (والد الأب)" person={doc.grandparents.paternalGrandfather} />
      <GrandparentPage formNumber="نموذج (8)" title="بيانات جدة الطالب للوالد (والدة الأب)" person={doc.grandparents.paternalGrandmother} useFemaleLabels />
      <GrandparentPage formNumber="نموذج (9)" title="بيانات جد الطالب للوالدة (والد الأم)" person={doc.grandparents.maternalGrandfather} />
      <GrandparentPage formNumber="نموذج (10)" title="بيانات جدة الطالب للوالدة (والدة الأم)" person={doc.grandparents.maternalGrandmother} useFemaleLabels />
      <AdultRelativeTablePage formNumber="نموذج (11)" title="بيانات الإخوة الذكور الأشقاء وزوجاتهم" counterLabel="عدد الإخوة الذكور الأشقاء" subjectLabel="اسم الأخ" spouseLabel="اسم الزوجة" list={doc.siblings.fullBrothers} note="تذكر جميع البيانات في حالة الوفاة." />
      <AdultRelativeTablePage formNumber="نموذج (11/1)" title="بيانات الإخوة الذكور غير الأشقاء وزوجاتهم" counterLabel="عدد الإخوة الذكور غير الأشقاء" subjectLabel="اسم الأخ" spouseLabel="اسم الزوجة" list={doc.siblings.halfBrothers} note="يراعى ذكر إن كان أخاً لأب أو لأم فقط." secondNote="تذكر جميع البيانات في حالة الوفاة." />
      <RelativeChildTablePage formNumber="نموذج (12)" title="بيانات أبناء الإخوة وزوجاتهم" counterLabel="عدد أبناء الإخوة" subjectLabel="اسم ابن الأخ" spouseLabel="اسم الزوجة" list={doc.siblings.brothersSons} />
      <RelativeChildTablePage formNumber="نموذج (13)" title="بيانات بنات الإخوة وأزواجهن" counterLabel="عدد بنات الإخوة" subjectLabel="اسم بنت الأخ" spouseLabel="اسم الزوج" list={doc.siblings.brothersDaughters} />
      <AdultRelativeTablePage formNumber="نموذج (14)" title="بيانات الأخوات الشقيقات وأزواجهن" counterLabel="عدد الأخوات الشقيقات" subjectLabel="اسم الأخت" spouseLabel="اسم الزوج" list={doc.siblings.fullSisters} note="تذكر جميع البيانات في حالة الوفاة." />
      <AdultRelativeTablePage formNumber="نموذج (14/1)" title="بيانات الأخوات غير الشقيقات وأزواجهن" counterLabel="عدد الأخوات غير الشقيقات" subjectLabel="اسم الأخت" spouseLabel="اسم الزوج" list={doc.siblings.halfSisters} note="يراعى ذكر إذا كانت أختاً لأب أو لأم." secondNote="تذكر جميع البيانات في حالة الوفاة." />
      <RelativeChildTablePage formNumber="نموذج (15)" title="بيانات أبناء الأخوات وزوجاتهم" counterLabel="عدد أبناء الأخوات" subjectLabel="اسم ابن الأخت" spouseLabel="اسم الزوجة" list={doc.siblings.sistersSons} />
      <RelativeChildTablePage formNumber="نموذج (16)" title="بيانات بنات الأخوات وأزواجهن" counterLabel="عدد بنات الأخوات" subjectLabel="اسم بنت الأخت" spouseLabel="اسم الزوج" list={doc.siblings.sistersDaughters} />
      <AdultRelativeTablePage formNumber="نموذج (17)" title="بيانات الأعمام وزوجاتهم" counterLabel="عدد الأعمام" subjectLabel="اسم العم" spouseLabel="اسم الزوجة" list={doc.paternalRelatives.paternalUncles} note="يراعى ذكر الأعمام غير الأشقاء (إخوة الوالد من الأب، أو الأم) فقط وأبناؤهم إن وجدوا." />
      <RelativeChildTablePage formNumber="نموذج (18)" title="بيانات أبناء الأعمام" counterLabel="عدد أبناء الأعمام" subjectLabel="اسم ابن العم" spouseLabel="اسم الزوجة" list={doc.paternalRelatives.paternalUnclesSons} />
      <RelativeChildTablePage formNumber="نموذج (19)" title="بيانات بنات الأعمام" counterLabel="عدد بنات الأعمام" subjectLabel="اسم بنت العم" spouseLabel="اسم الزوج" list={doc.paternalRelatives.paternalUnclesDaughters} />
      <AdultRelativeTablePage formNumber="نموذج (20)" title="بيانات الأخوال وزوجاتهم" counterLabel="عدد الأخوال" subjectLabel="اسم الخال" spouseLabel="اسم الزوجة" list={doc.maternalRelatives.maternalUncles} note="يراعى ذكر الأخوال غير الأشقاء (إخوة الوالدة من الأب أو الأم فقط) وأبناؤهم إن وجدوا." />
      <RelativeChildTablePage formNumber="نموذج (21)" title="بيانات أبناء الأخوال" counterLabel="عدد أبناء الأخوال" subjectLabel="اسم ابن الخال" spouseLabel="اسم الزوجة" list={doc.maternalRelatives.maternalUnclesSons} />
      <RelativeChildTablePage formNumber="نموذج (22)" title="بيانات بنات الأخوال" counterLabel="عدد بنات الأخوال" subjectLabel="اسم بنت الخال" spouseLabel="اسم الزوج" list={doc.maternalRelatives.maternalUnclesDaughters} />
      <AdultRelativeTablePage formNumber="نموذج (23)" title="بيانات العمات وأزواجهن" counterLabel="عدد العمات" subjectLabel="اسم العمة" spouseLabel="اسم الزوج" list={doc.paternalRelatives.paternalAunts} note="يراعى ذكر العمات غير الأشقاء (أخوات الوالد من الأب، أو الأم) وأبناؤهم إن وجدوا." />
      <RelativeChildTablePage formNumber="نموذج (24)" title="بيانات أبناء العمات" counterLabel="عدد أبناء العمات" subjectLabel="اسم ابن العمة" spouseLabel="اسم الزوجة" list={doc.paternalRelatives.paternalAuntsSons} />
      <RelativeChildTablePage formNumber="نموذج (25)" title="بيانات بنات العمات" counterLabel="عدد بنات العمات" subjectLabel="اسم بنت العمة" spouseLabel="اسم الزوج" list={doc.paternalRelatives.paternalAuntsDaughters} />
      <AdultRelativeTablePage formNumber="نموذج (26)" title="بيانات الخالات وأزواجهن" counterLabel="عدد الخالات" subjectLabel="اسم الخالة" spouseLabel="اسم الزوج" list={doc.maternalRelatives.maternalAunts} note="يراعى ذكر الخالات غير الأشقاء (أخوات الوالدة من الأب، أو الأم) وأبناؤهن إن وجدوا." />
      <RelativeChildTablePage formNumber="نموذج (27)" title="بيانات أبناء الخالات" counterLabel="عدد أبناء الخالات" subjectLabel="اسم ابن الخالة" spouseLabel="اسم الزوجة" list={doc.maternalRelatives.maternalAuntsSons} />
      <RelativeChildTablePage formNumber="نموذج (28)" title="بيانات بنات الخالات" counterLabel="عدد بنات الخالات" subjectLabel="اسم بنت الخالة" spouseLabel="اسم الزوج" list={doc.maternalRelatives.maternalAuntsDaughters} />
      <ForeignEmployedPage list={doc.foreignAndCases.foreignEmployed} />
      <NaturalizedPage list={doc.foreignAndCases.naturalized} />
      <CriminalCasesPage list={doc.foreignAndCases.criminalCases} />
      <InstructionsPage />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */

function val(v: string | undefined | null): string {
  return v && v.trim().length > 0 ? v : '';
}

function dotted(v: string | undefined | null, width = '50ch'): JSX.Element {
  return (
    <span className="dotted-line" style={{ minWidth: width }}>
      {val(v)}
    </span>
  );
}

function FieldBox({
  label,
  value,
  colSpan = 1,
}: {
  label: string;
  value?: string | boolean;
  colSpan?: number;
}): JSX.Element {
  const display =
    typeof value === 'boolean'
      ? value
        ? '✓'
        : ''
      : val(value);
  return (
    <div className="field-box" style={{ gridColumn: `span ${colSpan}` }}>
      <div className="field-box-label">{label}</div>
      <div className="field-box-value">{display}</div>
    </div>
  );
}

function FooterDeclaration(): JSX.Element {
  return (
    <footer className="vothiqa-footer">
      <p>
        أقر أنا الطالب / .............................................. متضامناً مع ولي أمري / ......................... بأن البيانات المدونة عاليه صحيحة وكاملة.
      </p>
      <div className="vothiqa-footer-sign">
        <span>اسم الطالب /</span>
        <span>اسم ولي الأمر /</span>
      </div>
      <div className="vothiqa-footer-sign">
        <span>التوقيع /</span>
        <span>التوقيع /</span>
      </div>
    </footer>
  );
}

function FormHeader({
  formNumber,
  title,
  counterLabel,
  counterValue,
  notes,
}: {
  formNumber: string;
  title: string;
  counterLabel?: string;
  counterValue?: string | number;
  notes?: string[];
}): JSX.Element {
  return (
    <header className="form-header">
      <div className="form-header-row">
        <span className="form-number">{formNumber}</span>
        <h3 className="form-title">{title}</h3>
        {counterLabel ? (
          <span className="form-counter">
            {counterLabel} <strong>{counterValue ?? ''}</strong>
          </span>
        ) : (
          <span className="form-counter" />
        )}
      </div>
      {notes && notes.length > 0 && (
        <ul className="form-notes">
          {notes.map((n, i) => (
            <li key={i}>— {n}</li>
          ))}
        </ul>
      )}
    </header>
  );
}

/* ── Cover page ──────────────────────────────────────────────────── */

function CoverPage({ cover }: { cover: VothiqaTaarufDocument['personal']['cover'] }): JSX.Element {
  return (
    <section className="vothiqa-form vothiqa-cover">
      <h1 className="cover-title">
        وثيقة تعارف
        <br />
      </h1>
      <div className="cover-fields">
        <div className="cover-row">
          <span className="cover-label">اسم الطالب /</span>
          {dotted(cover.fullName, '60ch')}
        </div>
        <div className="cover-row">
          <span className="cover-label">رقم الملف /</span>
          {dotted(cover.fileNumber, '60ch')}
        </div>
        <div className="cover-row">
          <span className="cover-label">سنة التقدم للالتحاق /</span>
          {dotted(cover.admissionYear, '54ch')}
        </div>
        <div className="cover-row">
          <span className="cover-label">اللجنــــــة /</span>
          {dotted(cover.committee, '60ch')}
        </div>
        <div className="cover-row">
          <span className="cover-label">المحافظة /</span>
          {dotted(cover.governorate, '60ch')}
        </div>
      </div>
    </section>
  );
}

/* ── نموذج 1 ──────────────────────────────────────────────────────── */

function Form1Personal({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const p = doc.personal.personal;
  const cover = doc.personal.cover;
  const marital =
    p.maritalStatus === 'single'
      ? 'أعزب'
      : p.maritalStatus === 'married'
        ? 'متزوج'
        : '';

  return (
    <section className="vothiqa-form">
      <header className="form-header">
        <div className="form-header-row">
          <span className="form-number">نموذج (1)</span>
          <h3 className="form-title">بيانات الطالب الشخصية</h3>
          <span className="form-counter">
            رقم الملف: <strong>{val(cover.fileNumber)}</strong>
          </span>
        </div>
      </header>
      <div className="grid-2">
        <FieldBox label="اسم الطالب" value={p.fullName} colSpan={2} />
      </div>
      <div className="grid-3">
        <FieldBox label="اسم الشهرة" value={p.shuhraName} colSpan={2} />
        <FieldBox label="اللجنة" value={p.committee} />
      </div>
      <div className="grid-2">
        <FieldBox label="تاريخ الميلاد" value={p.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={p.birthPlace} />
        <FieldBox label="الجنسية" value={p.nationality} />
        <FieldBox label="الديانة" value={p.religion} />
        <FieldBox label="المحافظة" value={p.governorate} />
        <FieldBox label="الرقم القومي" value={p.nationalId} />
        <FieldBox label="المؤهل / الشعبة" value={p.qualificationOrTrack} />
        <FieldBox label="سنة الحصول على المؤهل" value={p.qualificationYear} />
        <FieldBox label="مجموع الدرجات" value={p.totalGrades} />
        <FieldBox label="النسبة المئوية %" value={p.gradesPercent} />
        <FieldBox label="تليفون المنزل" value={p.homePhone} />
        <FieldBox label="المحمول" value={p.mobile} />
      </div>
      <div className="grid-1">
        <FieldBox label="الحالة الاجتماعية (أعزب / متزوج)" value={marital} />
        <FieldBox label="العنوان" value={p.address} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 2 ──────────────────────────────────────────────────────── */

/* ── Applicant's spouse / children pages (married applicants only) ── */

function ApplicantSpousePage({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const s = doc.applicantFamily.spouse;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (2)" title="بيانات زوج/زوجة الطالب" />
      <div className="grid-2">
        <FieldBox label="الاسم" value={s.fullName} />
        <FieldBox label="الجنسية" value={s.nationality} />
        <FieldBox label="تاريخ الميلاد" value={s.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={s.birthPlace} />
        <FieldBox label="الديانة" value={s.religion} />
        <FieldBox label="المؤهل" value={qualLabel(s.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(s.profession, s.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={s.workplace} />
        <FieldBox label="العمل القائم به" value={s.workNature} />
      </div>
      <div className="grid-1">
        <FieldBox label="العنوان" value={s.address} />
      </div>
      <div className="grid-3">
        <FieldBox label="التليفون" value={s.homePhone} />
        <FieldBox label="المحمول" value={s.mobile} />
        <FieldBox label="الرقم القومي" value={s.nationalId} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

function ApplicantSecondSpousePage({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const s: ApplicantSpouseRecord = doc.applicantFamily.secondSpouse;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (3)" title="بيانات الزوج/الزوجة الثانية إن وجدت" />
      <div className="grid-2">
        <FieldBox label="الاسم" value={s.fullName} />
        <FieldBox label="تاريخ الميلاد" value={s.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={s.birthPlace} />
        <FieldBox label="المؤهل" value={qualLabel(s.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(s.profession, s.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={s.workplace} />
        <FieldBox label="الرقم القومي" value={s.nationalId} colSpan={2} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

function ApplicantChildrenPage({
  formNumber,
  title,
  counterLabel,
  subjectLabel,
  spouseLabel,
  list,
}: {
  formNumber: string;
  title: string;
  counterLabel: string;
  subjectLabel: string;
  spouseLabel: string;
  list: AdultRelativeList;
}): JSX.Element {
  const slots: (AdultRelativeRecord | null)[] = Array.from({ length: 4 }, (_, i) => list.items[i] ?? null);
  const notes = ['تذكر جميع البيانات في حالة الوفاة.', list.none ? 'لا يوجد.' : undefined].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <section className="vothiqa-form">
      <FormHeader
        formNumber={formNumber}
        title={title}
        counterLabel={counterLabel}
        counterValue={list.items.length || ''}
        notes={notes}
      />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th></th>
            <th>الاسم</th>
            <th>تاريخ الميلاد</th>
            <th>محل الميلاد</th>
            <th>المؤهل</th>
            <th>الوظيفة</th>
            <th>جهة العمل</th>
            <th>الرقم القومي</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => (
            <AdultRelativeRows
              key={i}
              row={slot}
              subjectLabel={subjectLabel}
              spouseLabel={spouseLabel}
            />
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

function Form2Father({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const f = doc.parents.father;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (2)" title="بيانات والد الطالب وزوجته (غير الأم) إن وجدت" />
      <div className="grid-2">
        <FieldBox label="اسم الوالد" value={f.fullName} />
        <FieldBox label="اسم الشهرة" value={f.shuhraName} />
        <FieldBox label="تاريخ الميلاد" value={f.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={f.birthPlace} />
        <FieldBox label="المؤهل" value={qualLabel(f.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(f.profession, f.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={f.workplace} />
        <FieldBox label="العمل القائم به" value={f.workNature} />
      </div>
      <div className="grid-1">
        <FieldBox label="العنوان" value={f.address} />
      </div>
      <div className="grid-3">
        <FieldBox label="التليفون" value={f.homePhone} />
        <FieldBox label="المحمول" value={f.mobile} />
        <FieldBox label="الرقم القومي" value={f.nationalId} />
      </div>
      <h4 className="form-subtitle">بيانات زوجة والد الطالب الحالية (غير الأم) إن وجدت</h4>
      <div className="grid-1">
        <FieldBox label="عدد الزوجات" value={f.hasCurrentWife ? f.currentWifeCount : ''} />
      </div>
      <SpouseSubBlock spouse={f.currentWife} subjectLabel="اسم الزوجة" />
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 3 ──────────────────────────────────────────────────────── */

function Form3Guardian({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const g = doc.parents.guardian;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (3)" title="بيانات ولي أمر الطالب (في حالة وفاة الوالد)" />
      <div className="grid-2">
        <FieldBox label="اسم ولي الأمر" value={g.fullName} />
        <FieldBox label="اسم الشهرة" value={g.shuhraName} />
        <FieldBox label="تاريخ الميلاد" value={g.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={g.birthPlace} />
        <FieldBox label="المؤهل" value={qualLabel(g.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(g.profession, g.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={g.workplace} />
        <FieldBox label="العمل القائم به" value={g.workNature} />
      </div>
      <div className="grid-1">
        <FieldBox label="العنوان" value={g.address} />
      </div>
      <div className="grid-2">
        <FieldBox label="الجنسية" value={g.nationality} />
        <FieldBox label="المحافظة" value={g.governorate} />
        <FieldBox label="الديانة" value={g.religion} />
        <FieldBox label="الرقم القومي" value={g.nationalId} />
      </div>
      <div className="grid-1">
        <FieldBox label="رقم التليفون / المحمول" value={g.mobile} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 4 ──────────────────────────────────────────────────────── */

function Form4Mother({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const m = doc.parents.mother;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (4)" title="بيانات والدة الطالب وزوجها (غير الأب) إن وجد" />
      <div className="grid-2">
        <FieldBox label="اسم الوالدة" value={m.fullName} />
        <FieldBox label="الجنسية" value={m.nationality} />
        <FieldBox label="تاريخ الميلاد" value={m.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={m.birthPlace} />
        <FieldBox label="الديانة" value={m.religion} />
        <FieldBox label="المؤهل" value={qualLabel(m.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(m.profession, m.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={m.workplace} />
        <FieldBox label="العمل القائم به" value={m.workNature} />
      </div>
      <div className="grid-1">
        <FieldBox label="العنوان" value={m.address} />
      </div>
      <div className="grid-3">
        <FieldBox label="التليفون" value={m.homePhone} />
        <FieldBox label="المحمول" value={m.mobile} />
        <FieldBox label="الرقم القومي" value={m.nationalId} />
      </div>
      <h4 className="form-subtitle">بيانات زوج والدة الطالب الحالي (غير الأب) إن وجد</h4>
      <div className="grid-1">
        <FieldBox label="عدد الزيجات" value={m.hasCurrentHusband ? m.currentHusbandCount : ''} />
      </div>
      <SpouseSubBlock spouse={m.currentHusband} subjectLabel="اسم الزوج" />
      <FooterDeclaration />
    </section>
  );
}

function SpouseSubBlock({ spouse, subjectLabel }: { spouse: SpouseSubRecord; subjectLabel: string }): JSX.Element {
  return (
    <>
      <div className="grid-2">
        <FieldBox label={subjectLabel} value={spouse.fullName} />
        <FieldBox label="تاريخ الميلاد" value={spouse.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={spouse.birthPlace} />
        <FieldBox label="الرقم القومي" value={spouse.nationalId} />
        <FieldBox label="المؤهل" value={qualLabel(spouse.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(spouse.profession, spouse.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={spouse.workplace} />
        <FieldBox label="العمل القائم به" value={spouse.workNature} />
      </div>
    </>
  );
}

/* ── نموذج 5 ──────────────────────────────────────────────────────── */

function Form5Housing({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const h = doc.personal.housing;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (5)" title="بيانات مسكن الأسرة" />
      <div className="grid-1 grid-1-narrow">
        <FieldBox label="نوع المسكن" value={h.housingType} />
        <FieldBox label="عدد الغرف" value={h.roomsCount} />
        <FieldBox label="عدد المقيمين بالمسكن" value={h.residentsCount} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 6 ──────────────────────────────────────────────────────── */

function Form6Income({ doc }: { doc: VothiqaTaarufDocument }): JSX.Element {
  const inc = doc.personal.income;
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber="نموذج (6)" title="بيانات دخل الأسرة" />
      <div className="grid-1">
        <div className="field-box income-detail-box">
          <div className="field-box-label">تفصيلات الدخل</div>
          <div className="field-box-value income-detail">{val(inc.incomeDetails)}</div>
        </div>
      </div>
      <div className="grid-1 grid-1-narrow">
        <FieldBox label="إجمالي الدخل" value={inc.totalIncome} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

/* ── Grandparents (نموذج 7-10) ─────────────────────────────────────── */

function GrandparentPage({
  formNumber,
  title,
  person,
  useFemaleLabels,
}: {
  formNumber: string;
  title: string;
  person: GrandparentRecord;
  useFemaleLabels?: boolean;
}): JSX.Element {
  const nameLabel = useFemaleLabels ? 'الاسم' : 'اسم الوالد';
  const aliveLabel = useFemaleLabels ? 'على قيد الحياة' : 'على قيد الحياة';
  const deceasedLabel = useFemaleLabels ? 'متوفية' : 'متوفى';
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber={formNumber} title={title} />
      <div className="grid-2">
        <FieldBox label={nameLabel} value={person.fullName} />
        <FieldBox label="اسم الشهرة" value={person.shuhraName} />
        <FieldBox label="تاريخ الميلاد" value={person.dateOfBirth} />
        <FieldBox label="محل الميلاد" value={person.birthPlace} />
        <FieldBox label="المحافظة" value={person.governorate} />
        <FieldBox label="الجنسية" value={person.nationality} />
      </div>
      <div className="grid-4">
        <FieldBox label="الديانة" value={person.religion} />
        <FieldBox label={aliveLabel} value={person.alive === 'alive'} />
        <FieldBox label={deceasedLabel} value={person.alive === 'deceased'} />
        <FieldBox label="الرقم القومي" value={person.nationalId} />
      </div>
      <div className="grid-2">
        <FieldBox label="المؤهل" value={qualLabel(person.qualification)} />
        <FieldBox label="الوظيفة" value={profPrint(person.profession, person.seniorityNumber)} />
        <FieldBox label="جهة العمل" value={person.workplace} />
        <FieldBox label="العمل القائم به" value={person.workNature} />
      </div>
      <div className="grid-1">
        <FieldBox label="العنوان" value={person.address} />
      </div>
      <FooterDeclaration />
    </section>
  );
}

/* ── Adult-relative table (نموذج 11/11.1/14/14.1/17/20/23/26) ──────── */

function AdultRelativeTablePage({
  formNumber,
  title,
  counterLabel,
  subjectLabel,
  spouseLabel,
  list,
  note,
  secondNote,
}: {
  formNumber: string;
  title: string;
  counterLabel: string;
  subjectLabel: string;
  spouseLabel: string;
  list: AdultRelativeList;
  note?: string;
  secondNote?: string;
}): JSX.Element {
  /* The PDF allocates 4 row groups per page; render up to 4 always so
   * the print preview keeps the form-fillable empty boxes visible even
   * when the applicant has fewer (or zero) records. */
  const slots: (AdultRelativeRecord | null)[] = Array.from({ length: 4 }, (_, i) => list.items[i] ?? null);
  const notes = [note, secondNote, list.none ? 'لا يوجد.' : undefined].filter((x): x is string => Boolean(x));
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber={formNumber} title={title} counterLabel={counterLabel} counterValue={list.items.length || ''} notes={notes} />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th></th>
            <th>الاسم</th>
            <th>تاريخ الميلاد</th>
            <th>محل الميلاد</th>
            <th>المؤهل</th>
            <th>الوظيفة</th>
            <th>جهة العمل</th>
            <th>الرقم القومي</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => (
            <AdultRelativeRows key={i} row={slot} subjectLabel={subjectLabel} spouseLabel={spouseLabel} />
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

function AdultRelativeRows({
  row,
  subjectLabel,
  spouseLabel,
}: {
  row: AdultRelativeRecord | null;
  subjectLabel: string;
  spouseLabel: string;
}): JSX.Element {
  return (
    <>
      <tr>
        <th className="row-label">{subjectLabel}</th>
        <td>{val(row?.name)}</td>
        <td>{val(row?.dateOfBirth)}</td>
        <td>{val(row?.birthPlace)}</td>
        <td>{qualLabel(row?.qualification)}</td>
        <td>{profPrint(row?.profession, row?.seniorityNumber)}</td>
        <td>{val(row?.workplace)}</td>
        <td>{val(row?.nationalId)}</td>
      </tr>
      <tr>
        <th className="row-label">الحالة الاجتماعية</th>
        <td colSpan={5}>{val(row?.maritalStatus)}</td>
        <th className="row-label">العنوان</th>
        <td>{val(row?.address)}</td>
      </tr>
      <tr>
        <th className="row-label">{spouseLabel}</th>
        <td colSpan={7}>{val(row?.spouseName)}</td>
      </tr>
      <tr className="row-divider" aria-hidden>
        <td colSpan={8}></td>
      </tr>
    </>
  );
}

/* ── Relative-child table (نموذج 12/13/15/16/18/19/21/22/24/25/27/28) ─ */

function RelativeChildTablePage({
  formNumber,
  title,
  counterLabel,
  subjectLabel,
  spouseLabel,
  list,
}: {
  formNumber: string;
  title: string;
  counterLabel: string;
  subjectLabel: string;
  spouseLabel: string;
  list: RelativeChildList;
}): JSX.Element {
  const slots: (AdultRelativeRecord | null)[] = Array.from({ length: 4 }, (_, i) => list.items[i] ?? null);
  const notes = ['تذكر جميع البيانات في حالة الوفاة.', 'في حالة زيادة العدد الوارد بالنموذج يتم إرفاق ورقة منفصلة بنفس البيانات المذكورة.', list.none ? 'لا يوجد.' : undefined].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <section className="vothiqa-form">
      <FormHeader formNumber={formNumber} title={title} counterLabel={counterLabel} counterValue={list.items.length || ''} notes={notes} />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th></th>
            <th>الاسم</th>
            <th>تاريخ الميلاد</th>
            <th>محل الميلاد</th>
            <th>المؤهل</th>
            <th>الوظيفة</th>
            <th>جهة العمل</th>
            <th>الرقم القومي</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, i) => (
            <AdultRelativeRows key={i} row={slot} subjectLabel={subjectLabel} spouseLabel={spouseLabel} />
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 29 — Foreign employed ───────────────────────────────────── */

function ForeignEmployedPage({ list }: { list: ForeignEmployedList }): JSX.Element {
  const slots = Array.from({ length: 10 }, (_, i) => list.items[i] ?? null);
  return (
    <section className="vothiqa-form">
      <FormHeader
        formNumber="نموذج (29)"
        title="بيانات خاصة بالأقارب الذين يعملون لدى جهات أجنبية"
        counterLabel="العدد"
        counterValue={list.items.length || ''}
        notes={['تذكر جميع البيانات في حالة الوفاة.', 'في حالة زيادة العدد الوارد بالنموذج يتم إرفاق ورقة منفصلة بنفس البيانات المذكورة.', list.none ? 'لا يوجد.' : undefined].filter((x): x is string => Boolean(x))}
      />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th>مسلسل</th>
            <th>الاسم رباعياً</th>
            <th>درجة القرابة</th>
            <th>تاريخ ومحل الميلاد</th>
            <th>المهنة والمؤهل</th>
            <th>الهيئة الأجنبية أو المنظمة الدولية</th>
            <th>محل الإقامة تفصيلاً</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{val(row?.fullNameQuad)}</td>
              <td>{val(row?.kinship)}</td>
              <td>{val(row?.dobAndPlace)}</td>
              <td>{val(row?.professionAndQualification)}</td>
              <td>{val(row?.foreignEntity)}</td>
              <td>{val(row?.residence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 30 — Naturalized ───────────────────────────────────────── */

function NaturalizedPage({ list }: { list: NaturalizedList }): JSX.Element {
  const slots = Array.from({ length: 10 }, (_, i) => list.items[i] ?? null);
  return (
    <section className="vothiqa-form">
      <FormHeader
        formNumber="نموذج (30)"
        title="بيانات خاصة بالأقارب المتجنسين بغير الجنسية المصرية حتى الدرجة الرابعة (نسباً ومصاهرة)"
        counterLabel="العدد"
        counterValue={list.items.length || ''}
        notes={['تذكر جميع البيانات في حالة الوفاة.', 'في حالة زيادة العدد الوارد بالنموذج يتم إرفاق ورقة منفصلة بنفس البيانات المذكورة.', list.none ? 'لا يوجد.' : undefined].filter((x): x is string => Boolean(x))}
      />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th>مسلسل</th>
            <th>الاسم رباعياً</th>
            <th>درجة القرابة</th>
            <th>تاريخ ومحل الميلاد</th>
            <th>المهنة والمؤهل</th>
            <th>الجنسية المنتسب إليها</th>
            <th>محل الإقامة تفصيلاً</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{val(row?.fullNameQuad)}</td>
              <td>{val(row?.kinship)}</td>
              <td>{val(row?.dobAndPlace)}</td>
              <td>{val(row?.professionAndQualification)}</td>
              <td>{val(row?.nationality)}</td>
              <td>{val(row?.residence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

/* ── نموذج 31 — Criminal cases ────────────────────────────────────── */

function CriminalCasesPage({ list }: { list: CriminalCaseList }): JSX.Element {
  const slots = Array.from({ length: 10 }, (_, i) => list.items[i] ?? null);
  return (
    <section className="vothiqa-form">
      <FormHeader
        formNumber="نموذج (31)"
        title="بيان القضايا المتهم فيها الطالب وأقاربه حتى الدرجة الرابعة (نسباً ومصاهرة) والأحكام الصادرة فيها"
        counterLabel="العدد"
        counterValue={list.items.length || ''}
        notes={['تذكر جميع البيانات في حالة الوفاة.', 'في حالة زيادة العدد الوارد بالنموذج يتم إرفاق ورقة منفصلة بنفس البيانات المذكورة.', list.none ? 'لا يوجد.' : undefined].filter((x): x is string => Boolean(x))}
      />
      <table className="vothiqa-table">
        <thead>
          <tr>
            <th>مسلسل</th>
            <th>الاسم رباعياً</th>
            <th>درجة القرابة</th>
            <th>رقم القضية ووصفها القانوني</th>
            <th>التصرف الجنائي النهائي لها وتاريخه</th>
            <th>الأحكام التي تم تنفيذها وتاريخ التنفيذ</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{val(row?.fullNameQuad)}</td>
              <td>{val(row?.kinship)}</td>
              <td>{val(row?.caseNumberAndDescription)}</td>
              <td>{val(row?.finalDisposition)}</td>
              <td>{val(row?.executedSentences)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FooterDeclaration />
    </section>
  );
}

/* ── Final page: instructions ─────────────────────────────────────── */

function InstructionsPage(): JSX.Element {
  return (
    <section className="vothiqa-form vothiqa-instructions">
      <h3 className="instructions-title">تعليمات هامة</h3>
      <p className="instructions-lead">
        أكاديمية الشرطة
        <br />
        قسم شؤون الطلبة
        <br />
        قائمة المرفقات المطلوبة
      </p>
      <p>
        كما يجب على الطالب إرفاق المستندات الأصلية والصور المعتمدة للوثائق التالية مع نموذج وثيقة التعارف:
      </p>
      <ol className="instructions-list">
        <li>(1) صورة بطاقة الرقم القومي للطالب وولي الأمر (سارية).</li>
        <li>(2) شهادة ميلاد كمبيوتر للطالب (الأصلية).</li>
        <li>(3) شهادة الميلاد الكمبيوتر للوالدين (أصلية).</li>
        <li>(4) عقد زواج الوالدين (صورة معتمدة).</li>
        <li>(5) شهادات الوفاة (الأصلية) لمن توفي من ذكر بيانهم.</li>
        <li>(6) شهادة المؤهل الدراسي للطالب — أصل + صورة معتمدة من المدرسة أو الجامعة.</li>
        <li>(7) مفردات المرتب لمن يعمل من أفراد الأسرة (الوالدان / الإخوة / الأخوات) موضحاً بها (المسمى الوظيفي - جهة العمل - تاريخ التعيين).</li>
        <li>(8) صور بطاقات الرقم القومي للإخوة والأخوات (سارية).</li>
      </ol>
      <h4 className="instructions-subtitle">ملاحظات هامة:</h4>
      <ul className="instructions-list">
        <li>(1) تكتب البيانات بخط اليد بمعرفة الطالب وولي الأمر بدقة وعناية تامة.</li>
        <li>(2) يراعى ذكر العنوان (المنطقة - الشارع - رقم العقار - الدور - الشقة).</li>
        <li>(3) في حالة وجود إخوة من أب أو من أم (غير أشقاء) تذكر بياناتهم بنفس الدقة.</li>
        <li>(4) أي بيان غير صحيح يعرض الطالب للمساءلة القانونية وفصله من الأكاديمية.</li>
        <li>(5) تسلم وثيقة التعارف بعد استيفائها لقسم شؤون الطلبة بمقر الأكاديمية بمدينة الشروق.</li>
        <li>(6) يُسلم الأصل وصور مطابقة منه لقسم شؤون الطلبة لإجراء التحريات اللازمة قبل بدء الدراسة.</li>
        <li>(7) لا يتم استلام النموذج إلا بعد التأكد من استيفائه كاملاً ومرفقاته كاملة وموثقة.</li>
        <li>(8) أي استفسار يتعلق بهذه الوثيقة يتم التواصل مع قسم شؤون الطلبة على الخط الساخن المعلن.</li>
      </ul>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Print stylesheet — scoped to `.vothiqa-print` so it doesn't bleed
 * into the rest of the on-screen entry page.
 * ──────────────────────────────────────────────────────────────────── */

const vothiqaPrintCss = `
.vothiqa-print { font-family: var(--font-ar); color: #000; line-height: 1.6; }
.vothiqa-form { padding: 16mm 12mm; background: #fff; }
.vothiqa-form + .vothiqa-form { page-break-before: always; break-before: page; }
.vothiqa-cover { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 36mm; }
.cover-title { font-size: 28px; font-weight: 800; text-align: center; line-height: 1.5; margin-bottom: 24mm; }
.cover-fields { width: 100%; display: flex; flex-direction: column; gap: 14mm; }
.cover-row { display: flex; flex-direction: row-reverse; align-items: baseline; gap: 8px; font-size: 16px; font-weight: 700; }
.cover-label { white-space: nowrap; }
.dotted-line { display: inline-block; border-bottom: 1px dotted #000; min-height: 18px; padding: 0 4px; flex: 1; text-align: center; font-weight: 400; }
.form-header { margin-bottom: 6mm; }
.form-header-row { display: grid; grid-template-columns: auto 1fr auto; gap: 8mm; align-items: center; }
.form-number { font-weight: 700; font-size: 13px; }
.form-title { font-weight: 700; font-size: 14px; text-align: center; margin: 0; }
.form-counter { text-align: end; font-size: 12px; }
.form-subtitle { margin: 5mm 0 2mm; font-weight: 700; font-size: 13px; text-decoration: underline; }
.form-notes { list-style: none; padding: 0; margin: 4mm 0 0; font-size: 11px; }
.form-notes li { margin-top: 1mm; font-weight: 700; }
.grid-1, .grid-1-narrow, .grid-2, .grid-3, .grid-4 { display: grid; gap: 1mm; margin-top: 1.5mm; }
.grid-1 { grid-template-columns: 1fr; }
.grid-1-narrow { grid-template-columns: minmax(0, 60mm) 1fr; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-3 { grid-template-columns: 1fr 1fr 1fr; }
.grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.field-box { display: grid; grid-template-columns: minmax(22mm, auto) 1fr; border: 1px solid #000; min-height: 11mm; }
.field-box-label { border-inline-end: 1px solid #000; padding: 2mm 3mm; font-size: 11px; display: flex; align-items: center; background: #fff; white-space: nowrap; }
.field-box-value { padding: 2mm 3mm; font-size: 12px; min-height: 9mm; display: flex; align-items: center; word-break: break-word; min-width: 0; }
/* In a 4-column row the cell width is ~46mm — squeeze the label so
 * the value cell has room (the bug screenshot showed NID values
 * wrapping one digit per line). */
.grid-4 > .field-box { grid-template-columns: minmax(16mm, auto) 1fr; }
.grid-4 .field-box-label { padding: 2mm 1.5mm; font-size: 10px; }
.grid-4 .field-box-value { padding: 2mm 1.5mm; font-size: 11px; }
.income-detail-box { grid-template-columns: minmax(0, 40mm) 1fr; min-height: 22mm; }
.income-detail { white-space: pre-wrap; line-height: 1.7; }
.vothiqa-table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 10px; }
.vothiqa-table th, .vothiqa-table td { border: 1px solid #000; padding: 1.5mm 2mm; min-height: 8mm; text-align: start; vertical-align: top; word-break: break-word; }
.vothiqa-table th { background: #fff; font-weight: 700; }
.vothiqa-table .row-label { background: #fff; font-weight: 700; white-space: nowrap; }
.vothiqa-table .row-divider td { border: none; height: 2mm; background: #000; padding: 0; }
.vothiqa-footer { margin-top: 8mm; border-top: 1px solid #000; padding-top: 3mm; font-size: 11px; line-height: 1.8; }
.vothiqa-footer-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 2mm; }
.vothiqa-instructions { padding: 20mm 16mm; }
.instructions-title { text-align: center; font-size: 16px; font-weight: 800; margin-bottom: 4mm; }
.instructions-lead { text-align: center; font-size: 12px; font-weight: 700; line-height: 1.8; margin-bottom: 6mm; }
.instructions-subtitle { font-weight: 800; font-size: 13px; margin-top: 6mm; margin-bottom: 2mm; }
.instructions-list { list-style: none; padding: 0; font-size: 11px; line-height: 2; }
.instructions-list li { margin-top: 1mm; }
/* Hide the dedicated print portal on screen — it only exists so that
 * window.print() can capture the full 35-page document without the
 * Drawer's overflow:auto scroll container clipping it to the viewport. */
#vothiqa-print-portal { display: none; }
@media print {
  /* When printing FROM the وثيقة تعارف drawer, the print portal becomes
   * the only visible top-level child of <body>. Every other element
   * (app shell, drawer chrome, accordion bodies, sticky strips, etc.)
   * is hidden so the 35 form pages flow naturally with their own
   * page-break-before rules. */
  body:has(#vothiqa-print-portal) > *:not(#vothiqa-print-portal) {
    display: none !important;
  }
  body:has(#vothiqa-print-portal) > #vothiqa-print-portal {
    display: block !important;
    position: static !important;
  }
  body:has(#vothiqa-print-portal),
  html:has(#vothiqa-print-portal) {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    background: #fff !important;
  }
  .vothiqa-print { color: #000; }
  .vothiqa-form { padding: 12mm 10mm; }
  .vothiqa-form + .vothiqa-form { page-break-before: always; break-before: page; }
  /* Override the global architecture-handout @page footer leak — the
   * وثيقة تعارف is a Ministry intake form, not a system reference. */
  @page {
    size: A4 portrait;
    margin: 12mm 10mm;
    @bottom-center { content: ""; }
    @top-center { content: ""; }
    @top-left { content: ""; }
    @top-right { content: ""; }
    @bottom-left { content: ""; }
    @bottom-right { content: ""; }
  }
}
`;
