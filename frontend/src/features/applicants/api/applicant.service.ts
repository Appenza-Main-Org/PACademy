/**
 * Applicants API Contract.
 *
 * READ ENDPOINTS:
 *   GET /api/applicants
 *   GET /api/applicants/:id
 *   GET /api/applicants/:id/timeline
 *   GET /api/applicants/stats
 *   GET /api/applicants/status-options
 *   GET /api/applicants/distribution?field=
 *
 * WRITE / WORKFLOW ENDPOINTS:
 *   GET  /api/v1/applicants/check-nid
 *   POST /api/v1/applicants
 *   PUT  /api/v1/applicants/:id
 *   POST /api/v1/applicants/:id/transition
 *   GET  /api/v1/applicants/:id/workflow-progress
 *   GET  /api/v1/applicants/:id/workflow-transitions
 *   GET  /api/v1/applicants/:id/active-workflow
 *   GET  /api/v1/audit?entity=applicant&entityId=:id
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  Applicant,
  ApplicantCategoryKey,
  ApplicantResults,
  ApplicantStatus,
  ApplicantWorkflowProgress,
  AuditColor,
  AuditEntry,
  DepartmentWorkflow,
  MaritalStatus,
  Kpis,
  Religion,
  TimelineEvent,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';
import type { Pagination } from '@/shared/types/api';
import { parseNationalId } from '@/shared/lib/national-id';
import type { ApplicantInput } from '../schemas';

export interface ApplicantFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApplicantStatus | 'all';
  governorate?: string | 'all';
  certType?: string | 'all';
  gender?: 'male' | 'female' | 'all';
  religion?: string | 'all';
  source?: string | 'all';
  birthGovernorate?: string | 'all';
}

export interface ApplicantStatusOption {
  value: ApplicantStatus;
  label: string;
  color: AuditColor;
}

export class ApplicantTransitionError extends Error {
  public readonly code: 422 | 409;
  constructor(message: string, code: 422 | 409 = 422) {
    super(message);
    this.name = 'ApplicantTransitionError';
    this.code = code;
  }
}

const CATEGORY_CERTIFICATE_LABELS: Partial<Record<ApplicantCategoryKey, string>> = {
  officers_general: 'الثانوية العامة أو ما يعادلها',
  law_bachelor: 'ليسانس حقوق',
  physical_education_bachelor: 'بكالوريوس تربية رياضية',
  specialized_officers: 'مؤهل جامعي',
};

const DEPARTMENT_CERTIFICATE_LABELS: Partial<Record<NonNullable<Applicant['department']>, string>> = {
  general_first: 'الثانوية العامة أو ما يعادلها',
  general_second: 'الثانوية العامة أو ما يعادلها',
  lawyers: 'ليسانس حقوق',
  masters: 'ماجستير',
  doctorate: 'دكتوراه',
  special: 'مؤهل جامعي',
};

const EDUCATION_KIND_CERTIFICATE_LABELS: Partial<Record<NonNullable<Applicant['education']>['kind'], string>> = {
  general: 'الثانوية العامة',
  overseas: 'الشهادة الثانوية من الخارج',
  higher: 'مؤهل جامعي',
};

const STAGE_LABELS: Record<number, string> = {
  1: 'تسجيل أولي',
  2: 'التحقق من البيانات',
  3: 'استكمال البيانات الشخصية',
  4: 'بيانات المؤهل',
  5: 'المراجعة',
  6: 'سداد الرسوم',
  7: 'بيانات الأسرة',
  8: 'حجز الاختبارات',
  9: 'طباعة بطاقة التردد',
  10: 'المتابعة',
  11: 'وثائق التعارف',
};

const EMPTY_RESULTS: ApplicantResults = {
  medical: null,
  fitness: null,
  interview: null,
  finalExam: null,
};

const NID_GOVERNORATE_LABELS: Record<string, string> = {
  '01': 'القاهرة',
  '02': 'الإسكندرية',
  '03': 'بورسعيد',
  '04': 'السويس',
  '11': 'دمياط',
  '12': 'الدقهلية',
  '13': 'الشرقية',
  '14': 'القليوبية',
  '15': 'كفر الشيخ',
  '16': 'الغربية',
  '17': 'المنوفية',
  '18': 'البحيرة',
  '19': 'الإسماعيلية',
  '21': 'الجيزة',
  '22': 'بني سويف',
  '23': 'الفيوم',
  '24': 'المنيا',
  '25': 'أسيوط',
  '26': 'سوهاج',
  '27': 'قنا',
  '28': 'أسوان',
  '29': 'الأقصر',
  '31': 'البحر الأحمر',
  '32': 'الوادي الجديد',
  '33': 'مطروح',
  '34': 'شمال سيناء',
  '35': 'جنوب سيناء',
  '88': 'خارج الجمهورية',
};

function hasCorruptedArabic(value: unknown): value is string {
  return typeof value === 'string' && /\?{2,}/.test(value);
}

function usableText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && !hasCorruptedArabic(trimmed) ? trimmed : undefined;
}

function joinedFullName(applicant: Applicant): string | undefined {
  const parts = [
    applicant.fullName?.first,
    applicant.fullName?.second,
    applicant.fullName?.third,
    applicant.fullName?.fourth,
  ]
    .map(usableText)
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function governorateFromNationalId(nationalId: string): string | undefined {
  const info = parseNationalId(nationalId);
  const code = info.governorateCode;
  return code ? NID_GOVERNORATE_LABELS[code] : undefined;
}

function certificateFallback(applicant: Applicant): string {
  const categoryKey = (applicant as Applicant & { categoryKey?: ApplicantCategoryKey }).categoryKey;
  const educationKind = applicant.education?.kind;
  return (educationKind ? EDUCATION_KIND_CERTIFICATE_LABELS[educationKind] : undefined)
    ?? CATEGORY_CERTIFICATE_LABELS[categoryKey ?? 'officers_general']
    ?? DEPARTMENT_CERTIFICATE_LABELS[applicant.department ?? 'general_first']
    ?? 'غير محدد';
}

function educationCertificateName(applicant: Applicant): string | undefined {
  const education = applicant.education;
  if (!education) return undefined;
  if (education.kind === 'higher') return usableText(education.secondary.certificateName);
  return usableText(education.certificateName);
}

function educationBranch(applicant: Applicant): string | undefined {
  const education = applicant.education;
  return education?.kind === 'general' ? usableText(education.branch) : undefined;
}

function isGeneralBranch(value: string): value is 'علمي علوم' | 'علمي رياضة' | 'أدبي' {
  return value === 'علمي علوم' || value === 'علمي رياضة' || value === 'أدبي';
}

function normalizeEducation(applicant: Applicant, certType: string, certSection: string): Applicant['education'] {
  const education = applicant.education;
  if (!education) return education;
  if (education.kind === 'higher') {
    return {
      ...education,
      secondary: {
        ...education.secondary,
        certificateName: usableText(education.secondary.certificateName) ?? certType,
      },
    };
  }
  if (education.kind === 'general') {
    return {
      ...education,
      certificateName: certType,
      branch: isGeneralBranch(certSection) ? certSection : education.branch,
    };
  }
  return {
    ...education,
    certificateName: certType,
  };
}

function normalizeReligion(value: Applicant['religion']): Religion | undefined {
  const text = usableText(value);
  return text === 'مسلم' || text === 'مسيحي' ? text : undefined;
}

function normalizeMaritalStatus(value: Applicant['maritalStatus']): MaritalStatus | undefined {
  const text = usableText(value);
  return text === 'أعزب' || text === 'متزوج' || text === 'مطلق' || text === 'أرمل' ? text : undefined;
}

function normalizeApplicant(applicant: Applicant): Applicant {
  const name = usableText(applicant.name) ?? joinedFullName(applicant) ?? applicant.name;
  const governorate = usableText(applicant.governorate)
    ?? usableText(applicant.currentAddress?.governorate)
    ?? governorateFromNationalId(applicant.nationalId)
    ?? 'غير محدد';
  const city = usableText(applicant.city)
    ?? usableText(applicant.currentAddress?.city)
    ?? usableText(applicant.birthDistrict)
    ?? 'غير محدد';
  const certType = usableText(applicant.certType)
    ?? educationCertificateName(applicant)
    ?? certificateFallback(applicant);
  const certSection = usableText(applicant.certSection)
    ?? educationBranch(applicant)
    ?? 'غير محدد';
  const stageLabel = usableText(applicant.stageLabel) ?? STAGE_LABELS[applicant.stage] ?? 'مرحلة غير محددة';
  const religion = normalizeReligion(applicant.religion);
  const maritalStatus = normalizeMaritalStatus(applicant.maritalStatus);

  return {
    ...applicant,
    name,
    governorate,
    city,
    certType,
    certSection,
    stageLabel,
    religion,
    maritalStatus,
    results: {
      ...EMPTY_RESULTS,
      ...(applicant.results ?? {}),
    },
    currentAddress: applicant.currentAddress
      ? {
          ...applicant.currentAddress,
          governorate,
          city,
        }
      : applicant.currentAddress,
    education: normalizeEducation(applicant, certType, certSection),
  };
}

function normalizeApplicantPage(page: Pagination<Applicant>): Pagination<Applicant> {
  return {
    ...page,
    data: page.data.map(normalizeApplicant),
  };
}

function normalizeDistribution(rows: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = usableText(row.label) ?? 'غير محدد';
    grouped.set(label, (grouped.get(label) ?? 0) + row.value);
  }
  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function diffApplicants(
  prev: Applicant,
  next: Applicant,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const compareKeys: Array<keyof Applicant> = [
    'name',
    'governorate',
    'city',
    'certType',
    'certSection',
    'certScore',
    'religion',
    'maritalStatus',
    'department',
    'status',
    'stage',
  ];
  for (const k of compareKeys) {
    const a = prev[k];
    const b = next[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[String(k)] = { from: a, to: b };
    }
  }
  if (prev.contact || next.contact) {
    const subkeys = [
      'mobilePhone',
      'homePhone',
      'email',
      'socialFacebook',
      'socialInstagram',
      'socialX',
      'socialOther',
    ] as const;
    for (const sk of subkeys) {
      const a = prev.contact?.[sk];
      const b = next.contact?.[sk];
      if ((a ?? '') !== (b ?? '')) {
        out[`contact.${sk}`] = { from: a ?? null, to: b ?? null };
      }
    }
  }
  return out;
}

export const applicantService = {
  async list(filters: ApplicantFilters = {}): Promise<Pagination<Applicant>> {
    const page = await apiClient.get<Pagination<Applicant>>('/api/applicants', { query: filters });
    return normalizeApplicantPage(page);
  },

  async getById(id: string): Promise<Applicant | null> {
    const applicant = await apiClient.get<Applicant | null>(`/api/applicants/${encodeURIComponent(id)}`);
    return applicant ? normalizeApplicant(applicant) : applicant;
  },

  async getStats(): Promise<Kpis> {
    return apiClient.get('/api/applicants/stats');
  },

  async getStatusOptions(): Promise<ApplicantStatusOption[]> {
    return apiClient.get('/api/applicants/status-options');
  },

  async getTimeline(id: string): Promise<TimelineEvent[]> {
    return apiClient.get(`/api/applicants/${encodeURIComponent(id)}/timeline`);
  },

  async getDistribution(field: 'governorate' | 'certType' | 'status'): Promise<Array<{ label: string; value: number }>> {
    const rows = await apiClient.get<Array<{ label: string; value: number }>>('/api/applicants/distribution', { query: { field } });
    return normalizeDistribution(rows);
  },

  async checkNidCollision(nationalId: string, excludeId?: string): Promise<boolean> {
    const result = await apiClient.get<{ exists: boolean }>('/api/v1/applicants/check-nid', {
      query: { nationalId, excludeId },
    });
    return result.exists;
  },

  async create(input: ApplicantInput): Promise<Applicant> {
    const applicant = await apiClient.post<Applicant>('/api/v1/applicants', input);
    return normalizeApplicant(applicant);
  },

  async update(id: string, patch: Partial<ApplicantInput>): Promise<Applicant> {
    const applicant = await apiClient.put<Applicant>(`/api/v1/applicants/${encodeURIComponent(id)}`, patch);
    return normalizeApplicant(applicant);
  },

  async transition(
    id: string,
    payload: { toStatus: ApplicantStatus; reason: string },
  ): Promise<Applicant> {
    const applicant = await apiClient.post<Applicant>(`/api/v1/applicants/${encodeURIComponent(id)}/transition`, payload);
    return normalizeApplicant(applicant);
  },

  async getProgress(id: string): Promise<ApplicantWorkflowProgress | null> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/workflow-progress`);
  },

  async getWorkflowTransitions(id: string): Promise<WorkflowTransitionEvent[]> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/workflow-transitions`);
  },

  async getActiveWorkflowFor(id: string): Promise<DepartmentWorkflow | null> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/active-workflow`);
  },

  async getAuditTrail(id: string): Promise<AuditEntry[]> {
    return apiClient.get('/api/v1/audit', { query: { entity: 'applicant', entityId: id } });
  },
};
