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
 *   POST /api/v1/applicants/:id/reset
 *   DELETE /api/v1/applicants/:id
 *   POST /api/v1/applicants/:id/suspension
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
import { normalizeArabic, normalizeArabicForSearch } from '@/shared/lib/arabic';
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
  cycleId?: string | 'all';
}

export interface ApplicantStatusOption {
  value: ApplicantStatus;
  label: string;
  color: AuditColor;
}

const CLIENT_FILTER_PAGE_SIZE = 10_000;

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
  '01': 'محافظة القاهرة',
  '02': 'محافظة الإسكندرية',
  '03': 'محافظة بورسعيد',
  '04': 'محافظة السويس',
  '11': 'محافظة دمياط',
  '12': 'محافظة الدقهلية',
  '13': 'محافظة الشرقية',
  '14': 'محافظة القليوبية',
  '15': 'محافظة كفر الشيخ',
  '16': 'محافظة الغربية',
  '17': 'محافظة المنوفية',
  '18': 'محافظة البحيرة',
  '19': 'محافظة الإسماعيلية',
  '21': 'محافظة الجيزة',
  '22': 'محافظة بني سويف',
  '23': 'محافظة الفيوم',
  '24': 'محافظة المنيا',
  '25': 'محافظة أسيوط',
  '26': 'محافظة سوهاج',
  '27': 'محافظة قنا',
  '28': 'محافظة أسوان',
  '29': 'محافظة الأقصر',
  '31': 'محافظة البحر الأحمر',
  '32': 'محافظة الوادي الجديد',
  '33': 'محافظة مطروح',
  '34': 'محافظة شمال سيناء',
  '35': 'محافظة جنوب سيناء',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFamilyMemberArray(value: unknown): NonNullable<NonNullable<Applicant['family']>['siblings']> {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as unknown as NonNullable<NonNullable<Applicant['family']>['siblings']>;
  }
  if (!isRecord(value)) return [];

  const values = Object.values(value);
  if (values.length > 0 && values.every(isRecord)) {
    return values as unknown as NonNullable<NonNullable<Applicant['family']>['siblings']>;
  }

  return [value as unknown as NonNullable<NonNullable<Applicant['family']>['siblings']>[number]];
}

function normalizeFamily(value: unknown): Applicant['family'] {
  if (!isRecord(value)) return undefined;
  return {
    ...(value as NonNullable<Applicant['family']>),
    siblings: toFamilyMemberArray(value.siblings),
    relatives: toFamilyMemberArray(value.relatives),
  };
}

function normalizeApplicant(applicant: Applicant): Applicant {
  const name = usableText(applicant.name) ?? joinedFullName(applicant) ?? applicant.name;
  const birthGovernorate = usableText(applicant.birthGovernorate)
    ?? governorateFromNationalId(applicant.nationalId);
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
    birthGovernorate,
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
    family: normalizeFamily((applicant as Applicant & { family?: unknown }).family),
  };
}

function normalizeApplicantPage(page: Pagination<Applicant>): Pagination<Applicant> {
  return {
    ...page,
    data: page.data.map(normalizeApplicant),
  };
}

export function compactApplicantFilters(filters: ApplicantFilters): ApplicantFilters {
  const out: ApplicantFilters = {};
  if (filters.page !== undefined) out.page = filters.page;
  if (filters.pageSize !== undefined) out.pageSize = filters.pageSize;

  const search = filters.search?.trim();
  if (search) out.search = search;
  if (filters.status && filters.status !== 'all') out.status = filters.status;
  if (filters.governorate && filters.governorate !== 'all') out.governorate = filters.governorate;
  if (filters.birthGovernorate && filters.birthGovernorate !== 'all') out.birthGovernorate = filters.birthGovernorate;
  if (filters.certType && filters.certType !== 'all') out.certType = filters.certType;
  if (filters.gender && filters.gender !== 'all') out.gender = filters.gender;
  if (filters.religion && filters.religion !== 'all') out.religion = filters.religion;
  if (filters.source && filters.source !== 'all') out.source = filters.source;
  if (filters.cycleId && filters.cycleId !== 'all') out.cycleId = filters.cycleId;
  return out;
}

function hasApplicantFilter(filters: ApplicantFilters): boolean {
  return Boolean(
    filters.search
      || filters.status
      || filters.governorate
      || filters.birthGovernorate
      || filters.certType
      || filters.gender
      || filters.religion
      || filters.source
      || filters.cycleId,
  );
}

function normalizedIncludes(value: string | number | null | undefined, needle: string): boolean {
  const haystack = String(value ?? '');
  return normalizeArabic(haystack).includes(normalizeArabic(needle))
    || normalizeArabicForSearch(haystack).includes(normalizeArabicForSearch(needle));
}

function normalizedEquals(value: string | number | null | undefined, expected: string): boolean {
  return normalizeArabic(String(value ?? '')) === normalizeArabic(expected);
}

function applicantSearchHaystack(applicant: Applicant): string {
  return [
    applicant.name,
    joinedFullName(applicant),
    applicant.nationalId,
    applicant.id,
    applicant.adminRecordId,
    applicant.applicantTableId,
    applicant.phoneNumber,
    applicant.contact?.mobilePhone,
    applicant.email,
    applicant.contact?.email,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join(' ');
}

function residenceGovernorate(applicant: Applicant): string {
  return applicant.currentAddress?.governorate ?? applicant.governorate;
}

function matchesApplicantFilters(applicant: Applicant, filters: ApplicantFilters): boolean {
  const search = filters.search?.trim();
  if (search && !normalizedIncludes(applicantSearchHaystack(applicant), search)) return false;
  if (filters.status && applicant.status !== filters.status) return false;
  if (filters.governorate && !normalizedEquals(residenceGovernorate(applicant), filters.governorate)) return false;
  if (filters.birthGovernorate && !normalizedEquals(applicant.birthGovernorate, filters.birthGovernorate)) return false;
  if (filters.certType && !normalizedEquals(applicant.certType, filters.certType)) return false;
  if (filters.gender && applicant.gender !== filters.gender) return false;
  if (filters.religion && !normalizedEquals(applicant.religion, filters.religion)) return false;
  if (filters.source && applicant.source !== filters.source) return false;
  if (filters.cycleId && applicant.cycleId !== filters.cycleId) return false;
  return true;
}

function timestampValue(applicant: Applicant): number | null {
  const createdAt = (applicant as Applicant & { createdAt?: unknown }).createdAt;
  if (typeof createdAt !== 'string' || createdAt.trim() === '') return null;
  const time = Date.parse(createdAt);
  return Number.isNaN(time) ? null : time;
}

function numericIdTail(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)(?!.*\d)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a !== null && b !== null && a !== b) return b - a;
  if (a !== null && b === null) return -1;
  if (a === null && b !== null) return 1;
  return 0;
}

function sortApplicantsNewestFirst(applicants: readonly Applicant[]): Applicant[] {
  return applicants
    .map((applicant, index) => ({ applicant, index }))
    .sort((a, b) => {
      const createdDiff = compareNullableDesc(timestampValue(a.applicant), timestampValue(b.applicant));
      if (createdDiff !== 0) return createdDiff;

      const idDiff = compareNullableDesc(
        numericIdTail(a.applicant.adminRecordId ?? a.applicant.applicantTableId ?? a.applicant.id),
        numericIdTail(b.applicant.adminRecordId ?? b.applicant.applicantTableId ?? b.applicant.id),
      );
      if (idDiff !== 0) return idDiff;

      return a.index - b.index;
    })
    .map(({ applicant }) => applicant);
}

export function paginateApplicants(
  applicants: readonly Applicant[],
  page = 1,
  pageSize = 20,
): Pagination<Applicant> {
  const total = applicants.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: applicants.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Concurrent callers (e.g. the dashboard's KPI + recent-rows queries mounting
 * together) share one in-flight round-trip instead of each pulling the full
 * dataset. The promise is dropped once settled, so every later call still
 * fetches fresh data — the no-server-state-cache policy is unchanged.
 */
let inflightApplicantsFetch: Promise<Applicant[]> | null = null;

async function listAllApplicantsForClientFilter(): Promise<Applicant[]> {
  if (inflightApplicantsFetch) return inflightApplicantsFetch;
  inflightApplicantsFetch = (async () => {
    const firstPage = await apiClient.get<Pagination<Applicant>>('/api/applicants', {
      query: { page: 1, pageSize: CLIENT_FILTER_PAGE_SIZE },
    });
    const normalizedFirstPage = normalizeApplicantPage(firstPage);
    const rows = [...normalizedFirstPage.data];
    for (let page = 2; page <= normalizedFirstPage.totalPages; page += 1) {
      const nextPage = await apiClient.get<Pagination<Applicant>>('/api/applicants', {
        query: { page, pageSize: CLIENT_FILTER_PAGE_SIZE },
      });
      rows.push(...normalizeApplicantPage(nextPage).data);
    }
    return rows;
  })();
  try {
    return await inflightApplicantsFetch;
  } finally {
    inflightApplicantsFetch = null;
  }
}

/**
 * Mutations drop the shared in-flight list fetch so a post-write refetch
 * never joins a request that started before the write and misses it.
 */
function dropInflightApplicantsFetch(): void {
  inflightApplicantsFetch = null;
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
  /** Full filtered + newest-first sorted list, no pagination — one backend round-trip. */
  async listFiltered(filters: ApplicantFilters = {}): Promise<Applicant[]> {
    const cleaned = compactApplicantFilters(filters);
    const rows = await listAllApplicantsForClientFilter();
    const matched = hasApplicantFilter(cleaned)
      ? rows.filter((applicant) => matchesApplicantFilters(applicant, cleaned))
      : rows;
    return sortApplicantsNewestFirst(matched);
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
    dropInflightApplicantsFetch();
    return normalizeApplicant(applicant);
  },

  async update(id: string, patch: Partial<ApplicantInput>): Promise<Applicant> {
    const applicant = await apiClient.put<Applicant>(`/api/v1/applicants/${encodeURIComponent(id)}`, patch);
    dropInflightApplicantsFetch();
    return normalizeApplicant(applicant);
  },

  async transition(
    id: string,
    payload: { toStatus: ApplicantStatus; reason: string },
  ): Promise<Applicant> {
    const applicant = await apiClient.post<Applicant>(`/api/v1/applicants/${encodeURIComponent(id)}/transition`, payload);
    dropInflightApplicantsFetch();
    return normalizeApplicant(applicant);
  },

  /**
   * INTEGRATION CONTRACT: POST /api/v1/applicants/:id/reset
   * Resets applicant-entered sections while preserving MOI verified first-step
   * identity and education verification fields. Server checks GradesRead
   * eligibility by NID before mutating.
   */
  async resetApplicant(id: string): Promise<Applicant> {
    const applicant = await apiClient.post<Applicant>(`/api/v1/applicants/${encodeURIComponent(id)}/reset`);
    dropInflightApplicantsFetch();
    return normalizeApplicant(applicant);
  },

  /**
   * INTEGRATION CONTRACT: DELETE /api/v1/applicants/:id
   * Permanently deletes the applicant and dependent rows under database cascade.
   */
  async deleteApplicant(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/v1/applicants/${encodeURIComponent(id)}`);
    dropInflightApplicantsFetch();
  },

  /**
   * INTEGRATION CONTRACT: POST /api/v1/applicants/:id/suspension
   * Sets or clears admin suspension. When suspended, the applicant can sign in
   * but write operations are blocked by the applicant backend.
   */
  async setApplicantSuspension(
    id: string,
    payload: { suspended: boolean; reason?: string },
  ): Promise<Applicant> {
    const applicant = await apiClient.post<Applicant>(
      `/api/v1/applicants/${encodeURIComponent(id)}/suspension`,
      payload,
    );
    dropInflightApplicantsFetch();
    return normalizeApplicant(applicant);
  },

  async getProgress(id: string): Promise<ApplicantWorkflowProgress | null> {
    // "No progress row" serializes as 204 No Content → undefined; coalesce
    // so the query resolves (TanStack treats undefined data as an error).
    const progress = await apiClient.get<ApplicantWorkflowProgress | null | undefined>(
      `/api/v1/applicants/${encodeURIComponent(id)}/workflow-progress`,
    );
    return progress ?? null;
  },

  async getWorkflowTransitions(id: string): Promise<WorkflowTransitionEvent[]> {
    return apiClient.get(`/api/v1/applicants/${encodeURIComponent(id)}/workflow-transitions`);
  },

  async getActiveWorkflowFor(id: string): Promise<DepartmentWorkflow | null> {
    const workflow = await apiClient.get<DepartmentWorkflow | null | undefined>(
      `/api/v1/applicants/${encodeURIComponent(id)}/active-workflow`,
    );
    return workflow ?? null;
  },

  async getAuditTrail(id: string): Promise<AuditEntry[]> {
    return apiClient.get('/api/v1/audit', { query: { entity: 'applicant', entityId: id } });
  },
};
