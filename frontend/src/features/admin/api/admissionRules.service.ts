/**
 * Admission Rules — real API integration (spec 004 US4).
 *
 * INTEGRATION CONTRACT (backend: AdminAdmissionRulesController):
 *   GET    /admin/admission-rules?cycleId=…             → AdmissionRuleListItemDto[]
 *   GET    /admin/admission-rules/:id                    → AdmissionRuleDetailDto
 *   GET    /admin/admission-rules/current?cycleId=…      → AdmissionRuleDetailDto
 *   POST   /admin/admission-rules                        → AdmissionRuleDetailDto (new version)
 *   PATCH/DELETE — return 405 ADMISSION_RULES_IMMUTABLE
 *
 * Backend stores the rule body as a single JSON column (`Rules`). The
 * frontend's rich `AdmissionRule` shape (age / height-by-gender / BMI /
 * eyesight / marital / certificates / fees / max-applications) is
 * serialised into that column verbatim; metadata (cycle, version,
 * effectiveAt, changedById) lives on the row.
 */

import { apiClient } from '@/shared/api/client';
import type { AdmissionRule } from '@/shared/types/domain';

interface AdmissionRuleListItemDto {
  id: string;
  name: string;
  cycleId: string | null;
  version: number;
  effectiveAt: string;
  changedById: string;
  isActive: boolean;
  createdAt: string;
}

interface AdmissionRuleDetailDto extends AdmissionRuleListItemDto {
  description: string | null;
  rules: unknown;
  updatedAt: string;
  demoOrigin: boolean;
}

interface RuleBody {
  age: AdmissionRule['age'];
  height: AdmissionRule['height'];
  bmi: AdmissionRule['bmi'];
  eyesight: AdmissionRule['eyesight'];
  maritalStatus: AdmissionRule['maritalStatus'];
  noCriminalRecord: boolean;
  acceptedCertificates: AdmissionRule['acceptedCertificates'];
  minPercentByCertType: Record<string, number>;
  applicationFee: Record<string, number>;
  maxApplicationsPerYear: number;
  changedBy?: { userId: string; name: string };
}

const DEFAULT_BODY: RuleBody = {
  age: { minYears: 17, maxYears: 22 },
  height: { male: { min: 170, max: 195 }, female: { min: 162, max: 185 } },
  bmi: { min: 19, max: 28 },
  eyesight: { minRightEye: '6/9', minLeftEye: '6/9', correctionAllowed: false },
  maritalStatus: ['single'],
  noCriminalRecord: true,
  acceptedCertificates: ['ثانوية عامة'],
  minPercentByCertType: { 'ثانوية عامة': 75 },
  applicationFee: { 'ثانوية عامة': 1500 },
  maxApplicationsPerYear: 1,
};

function asBody(raw: unknown): RuleBody {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BODY };
  const r = raw as Partial<RuleBody>;
  return {
    age: r.age ?? DEFAULT_BODY.age,
    height: r.height ?? DEFAULT_BODY.height,
    bmi: r.bmi ?? DEFAULT_BODY.bmi,
    eyesight: r.eyesight ?? DEFAULT_BODY.eyesight,
    maritalStatus: r.maritalStatus ?? DEFAULT_BODY.maritalStatus,
    noCriminalRecord: r.noCriminalRecord ?? true,
    acceptedCertificates: r.acceptedCertificates ?? DEFAULT_BODY.acceptedCertificates,
    minPercentByCertType: r.minPercentByCertType ?? DEFAULT_BODY.minPercentByCertType,
    applicationFee: r.applicationFee ?? DEFAULT_BODY.applicationFee,
    maxApplicationsPerYear: r.maxApplicationsPerYear ?? 1,
    changedBy: r.changedBy,
  };
}

function detailToRule(dto: AdmissionRuleDetailDto): AdmissionRule {
  const body = asBody(dto.rules);
  return {
    id: dto.id,
    cycleId: dto.cycleId ?? '',
    version: dto.version,
    effectiveAt: dto.effectiveAt,
    changedBy: body.changedBy ?? { userId: dto.changedById, name: 'مدير النظام' },
    age: body.age,
    height: body.height,
    bmi: body.bmi,
    eyesight: body.eyesight,
    maritalStatus: body.maritalStatus,
    noCriminalRecord: body.noCriminalRecord,
    acceptedCertificates: body.acceptedCertificates,
    minPercentByCertType: body.minPercentByCertType,
    applicationFee: body.applicationFee,
    maxApplicationsPerYear: body.maxApplicationsPerYear,
  };
}

/** List endpoint returns lightweight rows; the editor needs full bodies for
 *  the version-history list to render usefully. We hydrate by fetching each
 *  detail in parallel — bounded by `version` count per cycle (small). */
async function fetchDetails(ids: string[]): Promise<AdmissionRule[]> {
  return Promise.all(
    ids.map(async (id) => {
      const { data } = await apiClient.get<AdmissionRuleDetailDto>(
        `/admin/admission-rules/${id}`,
      );
      return detailToRule(data);
    }),
  );
}

export const admissionRulesService = {
  async listForCycle(cycleId: string): Promise<AdmissionRule[]> {
    const { data } = await apiClient.get<AdmissionRuleListItemDto[]>(
      '/admin/admission-rules',
      { params: { cycleId } },
    );
    const sorted = [...data].sort((a, b) => b.version - a.version);
    return fetchDetails(sorted.map((r) => r.id));
  },

  async getCurrent(cycleId: string): Promise<AdmissionRule | null> {
    try {
      const { data } = await apiClient.get<AdmissionRuleDetailDto>(
        '/admin/admission-rules/current',
        { params: { cycleId } },
      );
      return detailToRule(data);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  },

  async save(
    payload: Omit<AdmissionRule, 'id' | 'version' | 'effectiveAt'> & { effectiveAt?: string },
  ): Promise<AdmissionRule> {
    const body: RuleBody = {
      age: payload.age,
      height: payload.height,
      bmi: payload.bmi,
      eyesight: payload.eyesight,
      maritalStatus: payload.maritalStatus,
      noCriminalRecord: payload.noCriminalRecord,
      acceptedCertificates: payload.acceptedCertificates,
      minPercentByCertType: payload.minPercentByCertType,
      applicationFee: payload.applicationFee,
      maxApplicationsPerYear: payload.maxApplicationsPerYear,
      changedBy: payload.changedBy,
    };
    const { data } = await apiClient.post<AdmissionRuleDetailDto>('/admin/admission-rules', {
      name: `قواعد القبول — دورة ${payload.cycleId}`,
      description: null,
      cycleId: payload.cycleId,
      rules: body,
      effectiveAt: payload.effectiveAt ?? null,
    });
    return detailToRule(data);
  },
};
