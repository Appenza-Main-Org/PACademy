import type { XlsxWorkbookSheet } from '@/shared/lib/xlsx';
import {
  DEPARTMENT_LABELS,
  type Applicant,
  type ApplicantEducation,
  type ApplicantFamilyMember,
} from '@/shared/types/domain';
import { applicantService, type ApplicantFilters } from '@/features/applicants';

const DETAIL_BATCH_SIZE = 8;
const JSON_CHUNK_SIZE = 30_000;

type ApplicantWithCategory = Applicant & { categoryKey?: string };

interface FamilyMemberRow {
  applicantId: string;
  nationalId: string;
  relationshipType: string;
  sequence: number;
  member?: ApplicantFamilyMember;
}

function displayValue(value: string | number | boolean | null | undefined): string | number | boolean {
  if (value === undefined || value === null) return '';
  return value;
}

function boolValue(value: boolean | undefined): string {
  if (value === undefined) return '';
  return value ? 'true' : 'false';
}

function genderLabel(value: Applicant['gender'] | string | undefined): string {
  if (value === 'male' || value === 'ذكر') return 'ذكر';
  if (value === 'female' || value === 'أنثى') return 'أنثى';
  return '';
}

function paymentLabel(value: Applicant['paymentStatus']): string {
  if (value === 'paid') return 'تم السداد';
  if (value === 'failed') return 'فشل السداد';
  if (value === 'refunded') return 'تم رد المبلغ';
  return 'في انتظار السداد';
}

function sourceLabel(value: string | undefined): string {
  if (value === 'api') return 'إدخال إداري';
  if (value === 'admin_records') return 'ترحيل سابق';
  return displayValue(value) as string;
}

function resultLabel(value: Applicant['results'][keyof Applicant['results']]): string {
  if (value === 'pass') return 'ناجح';
  if (value === 'fail') return 'راسب';
  return '';
}

function departmentLabel(value: Applicant['department']): string {
  return value ? DEPARTMENT_LABELS[value] : '';
}

function educationKindLabel(value: ApplicantEducation['kind'] | undefined): string {
  if (value === 'general') return 'ثانوية عامة / أزهرية';
  if (value === 'overseas') return 'شهادة معادلة';
  if (value === 'higher') return 'مؤهل عال';
  return '';
}

function applicantKeyRows(applicant: Applicant): [string, string] {
  return [applicant.id, applicant.nationalId];
}

function stringChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += JSON_CHUNK_SIZE) {
    chunks.push(value.slice(i, i + JSON_CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}

function familyMemberRows(applicant: Applicant): FamilyMemberRow[] {
  const family = applicant.family;
  if (!family) return [];
  const rows: FamilyMemberRow[] = [];
  const pushOne = (relationshipType: string, member?: ApplicantFamilyMember): void => {
    if (!member) return;
    rows.push({
      applicantId: applicant.id,
      nationalId: applicant.nationalId,
      relationshipType,
      sequence: 1,
      member,
    });
  };
  const pushMany = (relationshipType: string, members?: ApplicantFamilyMember[]): void => {
    for (const [index, member] of (members ?? []).entries()) {
      rows.push({
        applicantId: applicant.id,
        nationalId: applicant.nationalId,
        relationshipType,
        sequence: index + 1,
        member,
      });
    }
  };

  pushOne('father', family.father);
  pushOne('mother', family.mother);
  pushOne('paternal_grandfather', family.paternalGrandfather);
  pushOne('paternal_grandmother', family.paternalGrandmother);
  pushOne('maternal_grandfather', family.maternalGrandfather);
  pushOne('maternal_grandmother', family.maternalGrandmother);
  pushOne('guardian', family.guardian);
  pushMany('father_wife', family.fatherWives);
  pushMany('mother_husband', family.motherHusbands);
  pushMany('sibling', family.siblings);
  pushMany('relative', family.relatives);
  return rows;
}

function relationCounts(applicant: Applicant): readonly unknown[] {
  const family = applicant.family;
  return [
    applicant.id,
    applicant.nationalId,
    family?.father ? 1 : 0,
    family?.mother ? 1 : 0,
    family?.guardian ? 1 : 0,
    family?.siblings?.length ?? 0,
    family?.relatives?.length ?? 0,
    family?.fatherWives?.length ?? 0,
    family?.motherHusbands?.length ?? 0,
    applicant.familySize,
    applicant.relativesCount,
  ];
}

async function hydrateApplicantDetails(applicants: readonly Applicant[]): Promise<Applicant[]> {
  const hydrated: Applicant[] = [];
  for (let i = 0; i < applicants.length; i += DETAIL_BATCH_SIZE) {
    const batch = applicants.slice(i, i + DETAIL_BATCH_SIZE);
    const detailed = await Promise.all(
      batch.map(async (applicant) => {
        try {
          return (await applicantService.getById(applicant.id)) ?? applicant;
        } catch (err) {
          // Detail fetch failed — export continues with list-level data for this row.
          console.warn(`[applicants-export] hydration failed for ${applicant.id}:`, err);
          return applicant;
        }
      }),
    );
    hydrated.push(...detailed);
  }
  return hydrated;
}

function normalizeExportFilters(filters: ApplicantFilters): ApplicantFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) =>
      value !== undefined && value !== null && value !== '' && value !== 'all',
    ),
  ) as ApplicantFilters;
}

export async function fetchApplicantsForExport(filters: ApplicantFilters = {}): Promise<Applicant[]> {
  const cleaned = normalizeExportFilters(filters);
  const rows = await applicantService.listFiltered(cleaned);
  return hydrateApplicantDetails(rows);
}

export function buildApplicantsWorkbookSheets(applicants: readonly Applicant[]): readonly XlsxWorkbookSheet[] {
  const familyRows = applicants.flatMap(familyMemberRows);

  return [
    {
      name: 'import_manifest',
      headers: ['key', 'value'],
      rows: [
        ['entity', 'applicants'],
        ['version', '1'],
        ['primary_key', 'applicant_id'],
        ['join_keys', 'applicant_id,national_id'],
        ['tabs', 'applicants,contact,addresses,education,family_summary,family_members,results,workflow,raw_json'],
        ['raw_json_note', 'Rebuild the applicant object from raw_json.chunk_text ordered by chunk_index when a lossless import is required.'],
      ],
    },
    {
      name: 'applicants',
      headers: [
        'applicant_id',
        'applicant_table_id',
        'admin_record_id',
        'national_id',
        'name',
        'first_name',
        'second_name',
        'third_name',
        'fourth_name',
        'gender',
        'religion',
        'marital_status',
        'birth_date',
        'birth_governorate',
        'birth_district',
        'department_key',
        'department_label',
        'category_key',
        'cycle_id',
        'source',
        'registered_at',
        'photo',
        'has_documents',
        'suspended',
        'suspension_reason',
        'attendance_card_printed_at',
      ],
      rows: applicants.map((applicant) => [
        applicant.id,
        applicant.applicantTableId ?? '',
        applicant.adminRecordId ?? '',
        applicant.nationalId,
        applicant.name,
        applicant.fullName?.first ?? '',
        applicant.fullName?.second ?? '',
        applicant.fullName?.third ?? '',
        applicant.fullName?.fourth ?? '',
        genderLabel(applicant.gender),
        displayValue(applicant.religion),
        displayValue(applicant.maritalStatus),
        applicant.birthDate,
        displayValue(applicant.birthGovernorate),
        displayValue(applicant.birthDistrict),
        displayValue(applicant.department),
        departmentLabel(applicant.department),
        displayValue((applicant as ApplicantWithCategory).categoryKey),
        displayValue(applicant.cycleId),
        sourceLabel(applicant.source),
        applicant.registeredAt,
        displayValue(applicant.photo),
        boolValue(applicant.hasDocuments),
        boolValue(applicant.suspended),
        displayValue(applicant.suspensionReason),
        displayValue(applicant.attendanceCardPrintedAt),
      ]),
    },
    {
      name: 'contact',
      headers: [
        'applicant_id',
        'national_id',
        'phone_number',
        'email',
        'home_phone',
        'mobile_phone',
        'contact_email',
        'social_facebook',
        'social_instagram',
        'social_x',
        'social_other',
      ],
      rows: applicants.map((applicant) => [
        ...applicantKeyRows(applicant),
        displayValue(applicant.phoneNumber),
        displayValue(applicant.email),
        displayValue(applicant.contact?.homePhone),
        displayValue(applicant.contact?.mobilePhone),
        displayValue(applicant.contact?.email),
        displayValue(applicant.contact?.socialFacebook),
        displayValue(applicant.contact?.socialInstagram),
        displayValue(applicant.contact?.socialX),
        displayValue(applicant.contact?.socialOther),
      ]),
    },
    {
      name: 'addresses',
      headers: [
        'applicant_id',
        'national_id',
        'governorate',
        'city',
        'current_governorate',
        'current_city',
        'current_detail',
        'current_street',
      ],
      rows: applicants.map((applicant) => [
        ...applicantKeyRows(applicant),
        applicant.governorate,
        applicant.city,
        displayValue(applicant.currentAddress?.governorate),
        displayValue(applicant.currentAddress?.city),
        displayValue(applicant.currentAddress?.detail),
        displayValue(applicant.currentAddress?.street),
      ]),
    },
    {
      name: 'education',
      headers: [
        'applicant_id',
        'national_id',
        'legacy_cert_type',
        'legacy_cert_section',
        'legacy_cert_score',
        'legacy_cert_percent',
        'legacy_cert_year',
        'education_kind',
        'education_kind_label',
        'certificate_name',
        'school_name',
        'total_score',
        'seat_type',
        'branch',
        'school_category',
        'country',
        'graduation_year',
        'percentage',
        'specialization',
        'university',
        'faculty',
        'grade',
        'higher_specialization',
        'secondary_certificate_name',
        'secondary_total_score',
        'secondary_school_category',
        'secondary_country',
        'secondary_percentage',
      ],
      rows: applicants.map((applicant) => {
        const education = applicant.education;
        const generalOrOverseas = education?.kind === 'general' || education?.kind === 'overseas' ? education : null;
        const higher = education?.kind === 'higher' ? education : null;
        return [
          ...applicantKeyRows(applicant),
          applicant.certType,
          applicant.certSection,
          applicant.certScore,
          applicant.certPercent,
          applicant.certYear,
          displayValue(education?.kind),
          educationKindLabel(education?.kind),
          displayValue(generalOrOverseas?.certificateName),
          displayValue(generalOrOverseas?.schoolName),
          displayValue(education?.totalScore),
          displayValue(generalOrOverseas?.seatType),
          displayValue(education?.kind === 'general' ? education.branch : undefined),
          displayValue(generalOrOverseas?.schoolCategory),
          displayValue(education?.kind === 'overseas' ? education.country : undefined),
          displayValue(education?.graduationYear),
          displayValue(education?.kind === 'general' ? education.percentage : undefined),
          displayValue(higher?.specialization),
          displayValue(higher?.university),
          displayValue(higher?.faculty),
          displayValue(higher?.grade),
          displayValue(higher?.higherSpecialization),
          displayValue(higher?.secondary.certificateName),
          displayValue(higher?.secondary.totalScore),
          displayValue(higher?.secondary.schoolCategory),
          displayValue(higher?.secondary.country),
          displayValue(higher?.secondary.percentage),
        ];
      }),
    },
    {
      name: 'family_summary',
      headers: [
        'applicant_id',
        'national_id',
        'has_father',
        'has_mother',
        'has_guardian',
        'siblings_count',
        'relatives_count_from_family',
        'father_wives_count',
        'mother_husbands_count',
        'legacy_family_size',
        'legacy_relatives_count',
      ],
      rows: applicants.map(relationCounts),
    },
    {
      name: 'family_members',
      headers: [
        'applicant_id',
        'national_id',
        'relationship_type',
        'sequence',
        'member_full_name',
        'member_national_id',
        'occupation',
        'alive',
        'governorate',
        'education',
        'relationship_id',
      ],
      rows: familyRows.map((row) => [
        row.applicantId,
        row.nationalId,
        row.relationshipType,
        row.sequence,
        displayValue(row.member?.fullName),
        displayValue(row.member?.nationalId),
        displayValue(row.member?.occupation),
        boolValue(row.member?.alive),
        displayValue(row.member?.governorate),
        displayValue(row.member?.education),
        displayValue(row.member?.relationshipId),
      ]),
    },
    {
      name: 'results',
      headers: [
        'applicant_id',
        'national_id',
        'medical',
        'fitness',
        'interview',
        'final_exam',
        'investigation',
        'payment_status',
        'payment_status_label',
        'payment_amount',
      ],
      rows: applicants.map((applicant) => [
        ...applicantKeyRows(applicant),
        resultLabel(applicant.results.medical),
        resultLabel(applicant.results.fitness),
        resultLabel(applicant.results.interview),
        resultLabel(applicant.results.finalExam),
        applicant.investigation,
        applicant.paymentStatus,
        paymentLabel(applicant.paymentStatus),
        applicant.paymentAmount,
      ]),
    },
    {
      name: 'workflow',
      headers: [
        'applicant_id',
        'national_id',
        'status',
        'stage',
        'stage_label',
        'committee',
      ],
      rows: applicants.map((applicant) => [
        ...applicantKeyRows(applicant),
        applicant.status,
        applicant.stage,
        applicant.stageLabel,
        applicant.committee,
      ]),
    },
    {
      name: 'raw_json',
      headers: ['applicant_id', 'national_id', 'chunk_index', 'chunk_text'],
      rows: applicants.flatMap((applicant) =>
        stringChunks(JSON.stringify(applicant)).map((chunk, index) => [
          applicant.id,
          applicant.nationalId,
          index + 1,
          chunk,
        ]),
      ),
    },
  ];
}
