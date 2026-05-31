/**
 * ApplicantPortalPage — applicant summary screen (PDF p.5 top, MOI-aligned).
 *
 * The index of `/applicant`. Renders the application as a read-only
 * summary with the top-bar action cluster (الدفع / تعديل الطلب / عرض
 * إرشادات التقدم) and a yellow modification-deadline banner. Primary CTA
 * adapts based on draft state:
 *   - unpaid                → 'الدفع' → /applicant/payment
 *   - paid, parents unset   → 'إدراج بيانات الوالدين' → /applicant/profile/family
 *   - parents approved,
 *     exam-date unset       → 'تحديد موعد الإختبار' → /applicant/exam-schedule
 *   - exam-date set         → 'بطاقة التردد' → /applicant/print-card
 *
 * The previous generic wizard-hub view (welcome card, notifications,
 * support cards) is gone — those affordances move into the global
 * shell's NotificationCenter and the support page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CreditCard,
  Info,
  Pencil,
  Phone,
  ScrollText,
} from 'lucide-react';
import { Badge, Button, Card, Drawer, IconStamp } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { useApplicationInstructions, useDraft } from '../api/applicantPortal.queries';
import { useActiveCycle, useCategories } from '../api/categories.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { deterministicFileNumber } from '../lib/deterministic-codes';
import {
  DEFAULT_APPLICATION_INSTRUCTIONS,
  isApplicationLocked,
} from '../lib/application-lock';
import {
  RELATIVE_LABEL,
  formatMemberName,
  professionLabel,
  type FamilyMemberForm,
  type GrandparentsForm,
  type GuardianForm,
  type RelativeKind,
} from '../lib/familyData';

export function ApplicantPortalPage(): JSX.Element {
  const storePaid = useApplicantPortalStore((s) => s.paid);
  const storeParentsApproved = useApplicantPortalStore((s) => s.parentsApproved);
  const storeFirstExamDate = useApplicantPortalStore((s) => s.firstExamDate);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  /* Read the MOI session from the store first — it's set by the login
   * form per the picked demo user. Fall back to the static default only
   * for direct-link visits that bypass login (e.g. dev navigation). */
  const session = moiSession ?? MOI_APPLICANT_SESSION;
  const APPLICANT_ID = session.applicantId;
  const { data: draft } = useDraft(APPLICANT_ID);
  const instructionsQuery = useApplicationInstructions();
  const instructionLines = instructionsQuery.data ?? DEFAULT_APPLICATION_INSTRUCTIONS;
  const paid = storePaid || Boolean(draft?.payment?.paidAt);
  const parentsApproved = storeParentsApproved || Boolean(draft?.parentsApproved || draft?.parentsApprovedAt);
  const firstExamDate = storeFirstExamDate ?? draft?.examSlot?.date ?? null;
  const applicationLocked = isApplicationLocked(draft, storePaid);
  /* Profile fields come from the draft saved in Stage 3 (real data).
   * The draft is undefined until fetched, so every field is optional. */
  const profile = draft?.profile;
  const categoriesQuery = useCategories();
  const activeCycle = useActiveCycle();
  const [showInstructions, setShowInstructions] = useState(false);
  const fileNumber = paid ? deterministicFileNumber(APPLICANT_ID) : null;
  const committeeNumber = paid ? 'اللجنة الثانية' : null;
  const category = (categoriesQuery.data ?? []).find((c) => c.key === selectedCategoryKey);
  /* PDF p.5 calls out a separate "modification deadline" — we don't have a
   * dedicated cycle field for that yet, so we surface the cycle's
   * closeDate as the latest moment edits are accepted. Backend-integration
   * day will introduce `AdmissionCycle.modificationDeadline` and we'll
   * switch to that. */
  const modificationDeadline = activeCycle.data?.closeDate;

  const primaryCta = (() => {
    if (applicationLocked && firstExamDate) {
      return {
        label: 'بطاقة التردد',
        to: ROUTES.applicantPrintCard,
        variant: 'primary' as const,
        leadingIcon: <ArrowLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />,
      };
    }
    if (applicationLocked) return null;
    if (!paid) {
      return {
        label: 'الدفع',
        to: ROUTES.applicantPayment,
        variant: 'primary' as const,
        leadingIcon: <CreditCard size={14} strokeWidth={1.75} />,
      };
    }
    if (!parentsApproved) {
      return {
        label: 'إدراج بيانات الوالدين',
        to: ROUTES.applicantFamily,
        variant: 'primary' as const,
        leadingIcon: <ArrowLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />,
      };
    }
    if (!firstExamDate) {
      return {
        label: 'تحديد موعد الإختبار',
        to: ROUTES.applicantExamSchedule,
        variant: 'primary' as const,
        leadingIcon: <CalendarCheck size={14} strokeWidth={1.75} />,
      };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top-bar action cluster ───────────────────────────── */}
      <Card>
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">ملخّص طلب الإلتحاق</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              راجع البيانات المُسجَّلة. يمكنك تعديل الطلب قبل سداد رسوم الخدمة، وبعد السداد لا
              تُعدَّل البيانات إلا بإجراء إداري.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paid ? (
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                تم الدفع
              </Badge>
            ) : (
              <Link to={ROUTES.applicantPayment}>
                <Button
                  variant="primary"
                  leadingIcon={<CreditCard size={14} strokeWidth={1.75} />}
                >
                  الدفع
                </Button>
              </Link>
            )}
            <Link to={ROUTES.applicantApplicationSummary}>
              <Button
                variant="secondary"
                leadingIcon={
                  applicationLocked
                    ? <ScrollText size={14} strokeWidth={1.75} />
                    : <Pencil size={14} strokeWidth={1.75} />
                }
              >
                {applicationLocked ? 'عرض الطلب' : 'تعديل الطلب'}
              </Button>
            </Link>
            <Button
              variant="ghost"
              leadingIcon={<ScrollText size={14} strokeWidth={1.75} />}
              onClick={() => setShowInstructions(true)}
            >
              عرض إرشادات التقدم
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Yellow modification-deadline banner ─────────────── */}
      {modificationDeadline && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-gold-300 bg-gold-50 px-4 py-3 text-2xs text-gold-800"
        >
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            برجاء الإنتباه: آخر موعد لتعديل البيانات وتحصيل رسوم مقابل الخدمة يوم:{' '}
            <span className="font-bold">{fmtDate(modificationDeadline, 'short')}</span>
          </p>
        </div>
      )}

      {/* ── بيانات الطالب ──────────────────────────────────── */}
      <Card>
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Info size={14} strokeWidth={1.75} />
          </span>
          <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات الطالب</h3>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          <Row label="إسم الطالب" value={session.fullName} />
          <Row label="اسم الشهرة" value={profile?.shuhra ?? '—'} />
          <Row label="الرقم القومي" value={session.nationalId} ltr mono />
          <Row label="القسم" value={category?.labelAr ?? '— لم يُختر —'} />
          <Row label="اللجنة" value={committeeNumber ?? '—'} />
          <Row label="النوع" value={session.gender === 'male' ? 'ذكر' : 'أنثى'} />
          <Row label="تاريخ الميلاد" value={session.dateOfBirthAr} />
          <Row label="رقم الملف" value={fileNumber ?? '—'} ltr mono />
          <Row label="الديانة" value={session.religion} />
          <Row label="الحالة الاجتماعية" value={maritalLabel(profile?.maritalStatus)} />
          <Row label="محل الميلاد" value={`${session.birthGovernorate} — ${session.birthDistrict}`} />
          <Row
            label="العنوان"
            value={
              profile?.addressGovernorate
                ? `${profile.addressGovernorate} — ${profile.addressDistrict ?? ''} — ${profile.currentAddressDetail ?? ''}`
                : session.birthGovernorate
            }
            containerClassName="sm:col-span-2 md:col-span-3"
          />
        </dl>
      </Card>

      {/* ── بيانات التواصل ────────────────────────────────── */}
      <Card>
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Phone size={14} strokeWidth={1.75} />
          </span>
          <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات التواصل</h3>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          <Row label="رقم تليفون المنزل" value={profile?.homePhone ?? '—'} ltr mono />
          <Row label="رقم المحمول" value={session.mobile} ltr mono />
          <Row label="رقم محمول آخر" value={profile?.secondaryMobile ?? '—'} ltr mono />
          <Row label="البريد الإلكتروني" value={session.email} ltr mono />
          <Row label="فيسبوك" value={profile?.facebook ?? '—'} ltr />
          <Row label="تويتر" value={profile?.twitter ?? '—'} ltr />
          <Row label="إنستجرام" value={profile?.instagram ?? '—'} ltr />
        </dl>
      </Card>

      {/* ── بيانات الدراسة — shown only when the draft has at least one field */}
      {profile && (() => {
        const studyRows: Array<{ label: string; value: string; ltr?: boolean }> = [
          ...(profile.schoolNameAr          ? [{ label: 'اسم المدرسة',                   value: profile.schoolNameAr }]                                 : []),
          ...(profile.schoolAddress         ? [{ label: 'عنوان المدرسة',                  value: profile.schoolAddress }]                                : []),
          ...(profile.thanawiCountry        ? [{ label: 'دولة المدرسة',                   value: profile.thanawiCountry }]                               : []),
          ...(profile.thanawiGradDate       ? [{ label: 'تاريخ الحصول على الثانوية',       value: profile.thanawiGradDate, ltr: true }]                  : []),
          ...(profile.thanawiType           ? [{ label: 'الشعبة',                         value: profile.thanawiType }]                                  : []),
          ...(profile.thanawiTotal   != null ? [{ label: 'المجموع',                        value: `${profile.thanawiTotal} / 410`, ltr: true }]           : []),
          ...(profile.thanawiPercentage != null ? [{ label: 'النسبة المئوية',             value: `${profile.thanawiPercentage}%`, ltr: true }]            : []),
          ...(profile.bachelorFaculty       ? [{ label: 'الكلية',                         value: profile.bachelorFaculty }]                              : []),
          ...(profile.bachelorUniversity    ? [{ label: 'الجامعة',                        value: `جامعة ${profile.bachelorUniversity}` }]                : []),
          ...(profile.bachelorMajor         ? [{ label: 'المجموعة',                       value: profile.bachelorMajor }]                                : []),
          ...(profile.bachelorBranch        ? [{ label: 'الشعبة (المؤهل العالي)',          value: profile.bachelorBranch }]                               : []),
          ...(profile.bachelorSpecialization ? [{ label: 'التخصص',                        value: profile.bachelorSpecialization }]                       : []),
          ...(profile.bachelorPercentage != null ? [{ label: 'النسبة المئوية للمؤهل',    value: `${profile.bachelorPercentage}%`, ltr: true }]           : []),
          ...(profile.bachelorYear   != null ? [{ label: 'سنة التخرج',                    value: String(profile.bachelorYear), ltr: true }]              : []),
        ];
        if (studyRows.length === 0) return null;
        return (
          <Card>
            <header className="mb-3 flex items-center gap-2">
              <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                <ScrollText size={14} strokeWidth={1.75} />
              </span>
              <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات الدراسة</h3>
            </header>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
              {studyRows.map((r) => (
                <Row key={r.label} label={r.label} value={r.value} ltr={r.ltr} />
              ))}
            </dl>
          </Card>
        );
      })()}

      {/* ── بيانات الوالدين (only when approved) ────────────── */}
      <FamilySection family={draft?.family} parentsApproved={parentsApproved} />

      {/* ── Primary CTA strip ────────────────────────────────── */}
      <Card className="border-teal-500 bg-teal-50/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-ar-display text-md font-bold text-ink-900">الخطوة التالية</p>
            <p className="mt-0.5 text-sm text-ink-500">
              {nextStepCaption(paid, parentsApproved, firstExamDate, applicationLocked)}
            </p>
          </div>
          {primaryCta && (
            <Link to={primaryCta.to}>
              <Button variant={primaryCta.variant} size="lg" leadingIcon={primaryCta.leadingIcon}>
                {primaryCta.label}
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* ── Instructions drawer ──────────────────────────────── */}
      <Drawer open={showInstructions} onClose={() => setShowInstructions(false)} title="إرشادات التقدم">
        <Drawer.Body>
          <div className="flex flex-col gap-3 text-sm leading-normal text-ink-800">
            {instructionLines.map((line, index) => (
              <p
                key={`${index}-${line}`}
                className={
                  index === instructionLines.length - 1
                    ? 'rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700'
                    : undefined
                }
              >
                {line}
              </p>
            ))}
          </div>
        </Drawer.Body>
      </Drawer>
    </div>
  );
}

const MARITAL_LABEL: Record<string, string> = {
  single: 'أعزب',
  married: 'متزوج',
  divorced: 'مطلق',
  widowed: 'أرمل',
};

const GRANDPARENT_LABELS: Array<{ key: keyof GrandparentsForm; label: string }> = [
  { key: 'paternalGrandfather', label: 'الجد لأب' },
  { key: 'paternalGrandmother', label: 'الجدة لأب' },
  { key: 'maternalGrandfather', label: 'الجد لأم' },
  { key: 'maternalGrandmother', label: 'الجدة لأم' },
];

const RELATIVE_KINDS: readonly RelativeKind[] = [
  'brothers',
  'sisters',
  'paternal_uncles',
  'paternal_aunts',
  'maternal_aunts',
  'maternal_uncles',
];

function maritalLabel(key: string | undefined): string {
  if (!key) return '—';
  return MARITAL_LABEL[key] ?? '—';
}

function Row({
  label,
  value,
  ltr,
  mono,
  containerClassName,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
  containerClassName?: string;
}): JSX.Element {
  return (
    <div className={containerClassName}>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={
          'mt-0.5 text-sm font-medium text-ink-900 ' +
          /* LTR values (digits, emails) need text-end so they align to
           * the right edge of the column under the RTL right-aligned
           * label — without it they hug the left edge. */
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

function FamilySection({
  family,
  parentsApproved,
}: {
  family: Record<string, unknown> | undefined;
  parentsApproved: boolean;
}): JSX.Element | null {
  const storedFamily = readStoredFamily(family);
  if (!storedFamily && !parentsApproved) return null;

  const familyRows: Array<{ key: string; relation: string; member: FamilyMemberForm }> = [];
  const pushMember = (key: string, relation: string, member: FamilyMemberForm | null): void => {
    if (!member) return;
    familyRows.push({ key, relation, member });
  };

  pushMember('father', 'الأب', storedFamily?.father ?? null);
  pushMember('mother', 'الأم', storedFamily?.mother ?? null);
  storedFamily?.fatherWives.forEach((member, index) =>
    pushMember(`father-wife-${index}`, `زوجة الأب ${index + 1}`, member),
  );
  storedFamily?.motherHusbands.forEach((member, index) =>
    pushMember(`mother-husband-${index}`, `زوج الأم ${index + 1}`, member),
  );
  GRANDPARENT_LABELS.forEach(({ key, label }) =>
    pushMember(key, label, storedFamily?.grandparents?.[key] ?? null),
  );
  for (const kind of RELATIVE_KINDS) {
    storedFamily?.relatives[kind]?.forEach((member, index) =>
      pushMember(`${kind}-${index}`, `${RELATIVE_LABEL[kind].singular} ${index + 1}`, member),
    );
  }

  return (
    <Card>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Info size={14} strokeWidth={1.75} />
        </span>
        <h3 className="font-ar-display text-md font-bold text-ink-900">بيانات العائلة</h3>
        {parentsApproved && (
          <Badge tone="success">
            <IconStamp width={11} height={11} className="me-1 inline-block" />
            معتمد
          </Badge>
        )}
      </header>
      {familyRows.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {familyRows.map((row) => (
            <FamilyMemberPanel key={row.key} relation={row.relation} member={row.member} />
          ))}
          {storedFamily?.guardian && <GuardianPanel guardian={storedFamily.guardian} />}
        </div>
      ) : (
        <p className="text-sm text-ink-700">
          تم اعتماد بيانات الوالدين. لا توجد تفاصيل إضافية محفوظة للعرض.
        </p>
      )}
    </Card>
  );
}

function FamilyMemberPanel({
  relation,
  member,
}: {
  relation: string;
  member: FamilyMemberForm;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-page px-4 py-3">
      <p className="text-2xs font-bold uppercase tracking-wide text-ink-500">{relation}</p>
      <p className="mt-1 font-ar-display text-sm font-bold text-ink-900">
        {formatMemberName(member)}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Row label="الرقم القومي" value={member.nationalId || member.nidUnavailableReason || '—'} ltr mono />
        <Row label="الديانة" value={member.religion || '—'} />
        <Row label="تاريخ الميلاد" value={member.dateOfBirth || '—'} ltr />
        <Row label="المهنة" value={professionLabel(member.profession)} />
        <Row label="المؤهل" value={member.qualificationDetail || member.qualification || '—'} />
        <Row
          label="محل الإقامة"
          value={
            member.residenceGovernorate
              ? `${member.residenceGovernorate} — ${member.residenceDistrict} — ${member.residenceDetail}`
              : '—'
          }
          containerClassName="sm:col-span-2"
        />
      </dl>
    </div>
  );
}

function GuardianPanel({ guardian }: { guardian: GuardianForm }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-page px-4 py-3">
      <p className="text-2xs font-bold uppercase tracking-wide text-ink-500">ولي الأمر</p>
      <p className="mt-1 font-ar-display text-sm font-bold text-ink-900">
        {formatGuardianName(guardian)}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <Row label="المهنة" value={professionLabel(guardian.profession)} />
        <Row label="رقم الأقدمية" value={guardian.seniorityNumber || '—'} ltr mono />
        <Row label="المؤهل" value={guardian.qualificationDetail || guardian.qualification || '—'} />
        <Row label="جهة العمل" value={guardian.workplaceDetail || guardian.professionDetail || '—'} />
      </dl>
    </div>
  );
}

interface StoredFamily {
  father?: FamilyMemberForm;
  mother?: FamilyMemberForm;
  fatherWives: readonly FamilyMemberForm[];
  motherHusbands: readonly FamilyMemberForm[];
  grandparents?: Partial<GrandparentsForm>;
  relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>;
  guardian?: GuardianForm;
}

function readStoredFamily(family: Record<string, unknown> | undefined): StoredFamily | null {
  if (!family) return null;
  const stored: StoredFamily = {
    father: toFamilyMember(family.father),
    mother: toFamilyMember(family.mother),
    fatherWives: toFamilyMemberArray(family.fatherWives),
    motherHusbands: toFamilyMemberArray(family.motherHusbands),
    grandparents: toGrandparents(family.grandparents),
    relatives: toRelatives(family.relatives),
    guardian: toGuardian(family.guardian),
  };
  const hasMembers = Boolean(
    stored.father ||
      stored.mother ||
      stored.fatherWives.length > 0 ||
      stored.motherHusbands.length > 0 ||
      (stored.grandparents && Object.keys(stored.grandparents).length > 0) ||
      Object.values(stored.relatives).some((rows) => (rows?.length ?? 0) > 0) ||
      stored.guardian,
  );
  return hasMembers ? stored : null;
}

function toFamilyMember(value: unknown): FamilyMemberForm | undefined {
  if (!isRecord(value)) return undefined;
  const member = value as Partial<FamilyMemberForm>;
  if (!member.firstName && !member.nationalId) return undefined;
  return member as FamilyMemberForm;
}

function toFamilyMemberArray(value: unknown): readonly FamilyMemberForm[] {
  if (!Array.isArray(value)) return [];
  return value.map(toFamilyMember).filter((member): member is FamilyMemberForm => Boolean(member));
}

function toGrandparents(value: unknown): Partial<GrandparentsForm> | undefined {
  if (!isRecord(value)) return undefined;
  const grandparents: Partial<GrandparentsForm> = {};
  for (const { key } of GRANDPARENT_LABELS) {
    const member = toFamilyMember(value[key]);
    if (member) grandparents[key] = member;
  }
  return Object.keys(grandparents).length > 0 ? grandparents : undefined;
}

function toRelatives(value: unknown): Partial<Record<RelativeKind, readonly FamilyMemberForm[]>> {
  if (!isRecord(value)) return {};
  const relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>> = {};
  for (const kind of RELATIVE_KINDS) {
    const members = toFamilyMemberArray(value[kind]);
    if (members.length > 0) relatives[kind] = members;
  }
  return relatives;
}

function toGuardian(value: unknown): GuardianForm | undefined {
  if (!isRecord(value)) return undefined;
  const guardian = value as Partial<GuardianForm>;
  if (!guardian.firstName && !guardian.workplaceDetail) return undefined;
  return guardian as GuardianForm;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatGuardianName(guardian: GuardianForm): string {
  const joined = [guardian.firstName, guardian.secondName, guardian.thirdName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
  return joined || '—';
}

function nextStepCaption(
  paid: boolean,
  parentsApproved: boolean,
  firstExamDate: string | null,
  applicationLocked: boolean,
): string {
  if (applicationLocked && firstExamDate) {
    return 'البيانات مكتملة ومقفلة بعد السداد. اطبع بطاقة التردد قبل الذهاب للأكاديمية.';
  }
  if (applicationLocked) {
    return 'تم قفل بيانات الطلب بعد السداد. البيانات متاحة للعرض فقط من بوابة المتقدم.';
  }
  if (!paid) return 'لإتمام التقدم يلزم سداد مقابل الخدمة عبر كود فوري.';
  if (!parentsApproved) return 'بعد السداد يلزم إدراج واعتماد بيانات الوالدين قبل تحديد موعد الإختبار.';
  if (!firstExamDate) return 'البيانات مكتملة — اختر يوم اختبار قدرات من المواعيد المتاحة.';
  return 'البيانات مكتملة وموعد الإختبار محجوز. اطبع بطاقة التردد قبل الذهاب للأكاديمية.';
}
