/**
 * INTEGRATION CONTRACT
 *   GET    /admin/applicants?cycleId=&status=&q=&page=&pageSize=&sortBy=&sortDir=
 *   GET    /admin/applicants/{id}
 *   PATCH  /admin/applicants/{id}                    body: ApplicantPatchDto
 *
 * Phase 3 (US1) covers list/get/update against real storage. Other methods
 * (create / transition / timeline / workflow) stay on MOCK until later phases.
 *
 * Demo bootstrap (`VITE_DEMO_MODE=true`) keeps the entire service on MOCK so
 * the role-picker shortcut still gives full coverage of the rich UI.
 */

import { apiClient } from '@/shared/api/client';
import { MOCK } from '@/shared/mock-data';
import { paginate, simulateLatency } from '@/shared/lib/mock-helpers';
import { normalizeArabic } from '@/shared/lib/arabic';
import { parseNationalId } from '@/shared/lib/national-id';
import type {
  Applicant,
  ApplicantFamily,
  ApplicantFamilyMember,
  ApplicantStatus,
  ApplicantWorkflowProgress,
  AuditDiff,
  AuditEntry,
  DepartmentKey,
  DepartmentWorkflow,
  Kpis,
  TimelineEvent,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';
import type { Pagination } from '@/shared/types/api';
import { workflowsService } from '@/features/admin/api/workflows.service';
import type { ApplicantInput } from '../schemas';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export interface ApplicantFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ApplicantStatus | 'all';
  governorate?: string | 'all';
  certType?: string | 'all';
  cycleId?: string;
}

/** Backend ApplicantListItemDto shape — narrow subset the API returns. */
interface BackendListItem {
  id: string;
  nationalId: string;
  fullName: string;
  cycleId: string;
  status: string;
  governorate: string | null;
  mobile: string | null;
  createdAt: string;
  updatedAt: string;
  demoOrigin: boolean;
}

/** Backend ApplicantDetailDto shape. */
interface BackendDetail extends BackendListItem {
  dateOfBirth: string | null;
  gender: string | null;
  email: string | null;
  createdBy: string;
  updatedBy: string | null;
  lastModifiedBy: string | null;
}

interface BackendPagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Map backend status (PascalCase) → frontend status (kebab-case). */
function backendToFrontendStatus(s: string): ApplicantStatus {
  switch (s) {
    case 'Pending': return 'pending';
    case 'UnderReview': return 'under-review';
    case 'Accepted': return 'approved';
    case 'Rejected': return 'rejected';
    case 'Withdrawn': return 'rejected';
    case 'Deferred': return 'on-hold';
    default: return 'pending';
  }
}

/** Map frontend status → backend enum name. */
function frontendToBackendStatus(s: ApplicantStatus): string {
  switch (s) {
    case 'pending': return 'Pending';
    case 'under-review': return 'UnderReview';
    case 'approved': return 'Accepted';
    case 'rejected': return 'Rejected';
    case 'on-hold': return 'Deferred';
    default: return 'Pending';
  }
}

/** Adapt backend DTO → frontend Applicant (with safe defaults for fields the
 *  backend doesn't store yet — see Phase 3 scope note). */
function backendToApplicant(b: BackendListItem | BackendDetail): Applicant {
  const detail = 'dateOfBirth' in b ? b : null;
  const nidInfo = parseNationalId(b.nationalId);
  return {
    id: b.id,
    nationalId: b.nationalId,
    name: b.fullName,
    gender: (detail?.gender as 'male' | 'female') ?? nidInfo.gender ?? 'male',
    birthDate: detail?.dateOfBirth ?? nidInfo.birthDate?.toISOString() ?? '',
    governorate: b.governorate ?? '—',
    city: '',
    certType: '—',
    certSection: '—',
    certScore: 0,
    certPercent: '0.00',
    certYear: 0,
    status: backendToFrontendStatus(b.status),
    stage: 0,
    stageLabel: '—',
    committee: '—',
    registeredAt: b.createdAt,
    paymentStatus: 'pending',
    paymentAmount: 0,
    hasDocuments: false,
    photo: null,
    results: { medical: null, fitness: null, interview: null, finalExam: null },
    familySize: 0,
    relativesCount: 0,
    investigation: 'pending',
    cycleId: b.cycleId,
    contact: { mobilePhone: b.mobile ?? '' },
  };
}

export class ApplicantTransitionError extends Error {
  public readonly code: 422 | 409;
  constructor(message: string, code: 422 | 409 = 422) {
    super(message);
    this.name = 'ApplicantTransitionError';
    this.code = code;
  }
}

let nextApplicantSerial = MOCK.applicants.length + 1;

const ACTOR_ID = 'U-001';
const ACTOR_NAME = 'العميد د. أحمد محمود الفقي';
let writeAuditCounter = 1;

const ACTION_LABELS: Record<string, string> = {
  create: 'إضافة المتقدم',
  update: 'تعديل بيانات المتقدم',
  'applicant.transition': 'تحديث حالة المتقدم',
};

function nextAuditId(prefix: string): string {
  writeAuditCounter += 1;
  return `${prefix}-${Date.now()}-${writeAuditCounter}`;
}

function pushAudit(
  applicantId: string,
  action: AuditEntry['action'],
  details: string,
  diff?: AuditDiff,
): AuditEntry {
  const entry: AuditEntry = {
    id: nextAuditId('AUD-WF'),
    userId: ACTOR_ID,
    userName: ACTOR_NAME,
    action,
    actionLabel: ACTION_LABELS[action] ?? action,
    actionColor:
      action === 'create' ? 'success' : action === 'applicant.transition' ? 'warning' : 'info',
    entity: 'applicant',
    entityId: applicantId,
    details,
    timestamp: Date.now(),
    ip: '10.0.0.1',
  };
  (MOCK.audit).unshift(entry);
  if (diff) (MOCK.auditDiffs)[entry.id] = diff;
  return entry;
}

function newApplicantId(cycleYear = new Date().getFullYear()): string {
  const serial = String(nextApplicantSerial).padStart(6, '0');
  nextApplicantSerial += 1;
  return `APP-${cycleYear}${serial}`;
}

function nidToBirth(nid: string): { birthDate: string; gender: 'male' | 'female' } | null {
  const info = parseNationalId(nid);
  if (!info.valid || !info.birthDate || !info.gender) return null;
  return { birthDate: info.birthDate.toISOString(), gender: info.gender };
}

function buildName(parts: ApplicantInput['fullName']): string {
  return [parts.first, parts.second, parts.third, parts.fourth].filter(Boolean).join(' ');
}

/** Coerce a zod-parsed loose family member (partial fields) into the domain
 *  shape, defaulting required scalars so we round-trip cleanly. */
function normalizeMember(
  m: { fullName?: string; alive?: boolean; nationalId?: string; occupation?: string; governorate?: string; education?: string; relationshipId?: string } | undefined,
): ApplicantFamilyMember | undefined {
  if (!m || !m.fullName) return undefined;
  return {
    fullName: m.fullName,
    alive: m.alive ?? true,
    nationalId: m.nationalId,
    occupation: m.occupation,
    governorate: m.governorate,
    education: m.education,
    relationshipId: m.relationshipId,
  };
}

function normalizeFamily(input: ApplicantInput['family']): ApplicantFamily {
  return {
    father: normalizeMember(input.father),
    mother: normalizeMember(input.mother),
    paternalGrandfather: normalizeMember(input.paternalGrandfather),
    paternalGrandmother: normalizeMember(input.paternalGrandmother),
    maternalGrandfather: normalizeMember(input.maternalGrandfather),
    maternalGrandmother: normalizeMember(input.maternalGrandmother),
    siblings: (input.siblings ?? []).map((s) => normalizeMember(s)).filter(Boolean) as ApplicantFamilyMember[],
    relatives: (input.relatives ?? []).map((r) => normalizeMember(r)).filter(Boolean) as ApplicantFamilyMember[],
  };
}

function deriveCertType(input: ApplicantInput): { certType: string; certSection: string } {
  if (input.education.kind === 'general') {
    return { certType: 'ثانوية عامة', certSection: input.education.branch };
  }
  if (input.education.kind === 'overseas') {
    return { certType: 'دبلوم أجنبي', certSection: input.education.country };
  }
  return { certType: input.education.specialization, certSection: input.education.faculty };
}

function inputToApplicant(input: ApplicantInput, id: string): Applicant {
  const nidInfo = nidToBirth(input.nationalId);
  const cert = deriveCertType(input);
  const totalScore =
    input.education.kind === 'higher'
      ? input.education.secondary.totalScore
      : input.education.totalScore;
  const certYear = input.education.graduationYear;
  return {
    id,
    nationalId: input.nationalId,
    name: buildName(input.fullName),
    gender: nidInfo?.gender ?? 'male',
    birthDate: nidInfo?.birthDate ?? new Date('2007-01-01').toISOString(),
    governorate: input.currentAddress.governorate,
    city: input.currentAddress.city,
    certType: cert.certType,
    certSection: cert.certSection,
    certScore: totalScore,
    certPercent: ((totalScore / 410) * 100).toFixed(2),
    certYear,
    status: 'pending',
    stage: 0,
    stageLabel: 'تسجيل أولي',
    committee: 'الأولى',
    registeredAt: new Date().toISOString(),
    paymentStatus: 'pending',
    paymentAmount: 1500,
    hasDocuments: false,
    photo: null,
    results: { medical: null, fitness: null, interview: null, finalExam: null },
    familySize: 4 + (input.family.siblings?.length ?? 0),
    relativesCount: input.family.relatives?.length ?? 0,
    investigation: 'pending',
    department: input.department,
    cycleId: input.cycleId,
    religion: input.religion,
    maritalStatus: input.maritalStatus,
    fullName: input.fullName,
    contact: input.contact,
    currentAddress: input.currentAddress,
    education: input.education,
    family: normalizeFamily(input.family),
  };
}

function applyUpdates(prev: Applicant, patch: Partial<ApplicantInput>): Applicant {
  const next: Applicant = { ...prev };
  if (patch.fullName) {
    next.fullName = patch.fullName;
    next.name = buildName(patch.fullName);
  }
  if (patch.religion) next.religion = patch.religion;
  if (patch.maritalStatus) next.maritalStatus = patch.maritalStatus;
  if (patch.contact) next.contact = { ...prev.contact, ...patch.contact };
  if (patch.currentAddress) {
    next.currentAddress = { ...prev.currentAddress, ...patch.currentAddress };
    next.governorate = patch.currentAddress.governorate;
    next.city = patch.currentAddress.city;
  }
  if (patch.department) next.department = patch.department;
  if (patch.education) {
    next.education = patch.education;
    const cert = deriveCertType(patch as ApplicantInput);
    next.certType = cert.certType;
    next.certSection = cert.certSection;
  }
  if (patch.family) next.family = { ...prev.family, ...normalizeFamily(patch.family) };
  return next;
}

/**
 * Compute a flat map of `field -> { from, to }` between two applicants.
 * Powers the audit timeline disclosure.
 */
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

/**
 * Read-or-derive workflow progress. The seed only carries progress for a
 * handful of applicants; the rest get a deterministic snapshot inferred from
 * `status` mapped to the workflow's stages, so the detail-page stepper never
 * renders empty.
 */
function deriveProgress(
  applicant: Applicant,
  workflow: DepartmentWorkflow,
): ApplicantWorkflowProgress {
  let currentIdx = 0;
  if (applicant.status === 'under-review') currentIdx = Math.min(2, workflow.stages.length - 1);
  else if (applicant.status === 'approved') currentIdx = workflow.stages.length - 1;
  else if (applicant.status === 'rejected') currentIdx = -1;
  else if (applicant.status === 'on-hold') currentIdx = Math.min(1, workflow.stages.length - 1);

  const completed = currentIdx > 0 ? workflow.stages.slice(0, currentIdx) : [];
  const current = currentIdx >= 0 ? workflow.stages[currentIdx] ?? null : null;

  return {
    applicantId: applicant.id,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    currentStageId: current?.id ?? null,
    completedStageIds: completed.map((s) => s.id),
    testResults: completed.flatMap((stage) =>
      stage.tests.map((t) => ({
        stageId: stage.id,
        testId: t.id,
        outcome: 'pass' as const,
        score: t.passCriterion.type === 'minScore' ? 78 : undefined,
        recordedAt: applicant.registeredAt,
        recordedBy: ACTOR_NAME,
      })),
    ),
  };
}

function pickDepartment(applicant: Applicant): DepartmentKey {
  if (applicant.department) return applicant.department;
  if (applicant.certType.includes('أزهرية')) return 'general_first';
  if (applicant.certType.includes('دبلوم')) return 'general_second';
  return 'general_first';
}

export const applicantService = {
  async list(filters: ApplicantFilters = {}): Promise<Pagination<Applicant>> {
    if (!isDemoMode) {
      const params = new URLSearchParams();
      params.set('page', String(filters.page ?? 1));
      params.set('pageSize', String(filters.pageSize ?? 20));
      if (filters.cycleId) params.set('cycleId', filters.cycleId);
      if (filters.status && filters.status !== 'all') {
        params.set('status', frontendToBackendStatus(filters.status));
      }
      if (filters.search) params.set('q', filters.search);
      const { data } = await apiClient.get<BackendPagedResult<BackendListItem>>(
        `/admin/applicants?${params.toString()}`,
      );
      return {
        data: data.items.map(backendToApplicant),
        total: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      };
    }

    await simulateLatency();
    const { page = 1, pageSize = 20, search = '', status = 'all', governorate = 'all', certType = 'all' } = filters;
    const needle = normalizeArabic(search);
    let items = MOCK.applicants;
    if (status !== 'all') items = items.filter((a) => a.status === status);
    if (governorate !== 'all') items = items.filter((a) => a.governorate === governorate);
    if (certType !== 'all') items = items.filter((a) => a.certType === certType);
    if (needle) {
      items = items.filter(
        (a) =>
          normalizeArabic(a.name).includes(needle) ||
          a.id.toLowerCase().includes(needle) ||
          a.nationalId.includes(needle),
      );
    }
    return paginate(items, page, pageSize);
  },

  async getById(id: string): Promise<Applicant | null> {
    if (!isDemoMode) {
      try {
        const { data } = await apiClient.get<BackendDetail>(`/admin/applicants/${id}`);
        const applicant = backendToApplicant(data);
        applicant.lastModifiedAt = data.updatedAt;
        applicant.lastModifiedBy = data.lastModifiedBy ?? undefined;
        return applicant;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) return null;
        throw err;
      }
    }
    await simulateLatency();
    return MOCK.applicants.find((a) => a.id === id) ?? null;
  },

  async getStats(): Promise<Kpis> {
    await simulateLatency();
    return MOCK.kpis;
  },

  async getTimeline(id: string): Promise<TimelineEvent[]> {
    await simulateLatency();
    const a = MOCK.applicants.find((x) => x.id === id);
    if (!a) return [];
    const baseTs = new Date(a.registeredAt).getTime();
    const day = 86_400_000;
    const events: TimelineEvent[] = [
      { ts: baseTs, type: 'registration', icon: '📝', title: 'تسجيل أولي', detail: 'تم استلام طلب التقديم على البوابة الرقمية', color: 'info' },
    ];
    if (a.paymentStatus === 'paid') {
      events.push({ ts: baseTs + 1 * day, type: 'payment', icon: '💳', title: 'سداد رسوم التقديم', detail: `تم سداد ${a.paymentAmount} جنيه`, color: 'success' });
    }
    if (a.hasDocuments) {
      events.push({ ts: baseTs + 2 * day, type: 'document', icon: '📎', title: 'استكمال المستندات', detail: 'تم رفع كافة المستندات المطلوبة', color: 'success' });
    }
    if (a.results.medical) {
      events.push({ ts: baseTs + 3 * day, type: 'medical', icon: '🩺', title: 'الكشف الطبي', detail: a.results.medical === 'pass' ? 'لائق طبياً' : 'غير لائق', color: a.results.medical === 'pass' ? 'success' : 'danger' });
    }
    if (a.results.fitness) {
      events.push({ ts: baseTs + 4 * day, type: 'fitness', icon: '🏃', title: 'اختبار اللياقة البدنية', detail: a.results.fitness === 'pass' ? 'اجتاز اختبار اللياقة' : 'لم يجتز', color: a.results.fitness === 'pass' ? 'success' : 'danger' });
    }
    if (a.investigation !== 'pending') {
      events.push({
        ts: baseTs + 5 * day,
        type: 'committee',
        icon: '🔍',
        title: 'نتيجة التحريات',
        detail: a.investigation === 'cleared' ? 'تم الإفراج عن السجل' : 'تم إيقاف الإجراءات',
        color: a.investigation === 'cleared' ? 'success' : 'danger',
      });
    }
    if (a.results.interview) {
      events.push({ ts: baseTs + 6 * day, type: 'interview', icon: '🎤', title: 'المقابلة الشخصية', detail: a.results.interview === 'pass' ? 'تم القبول' : 'لم يتم القبول', color: a.results.interview === 'pass' ? 'success' : 'danger' });
    }
    if (a.results.finalExam) {
      events.push({ ts: baseTs + 7 * day, type: 'exam', icon: '📋', title: 'الاختبار النهائي', detail: `النتيجة: ${a.results.finalExam === 'pass' ? 'ناجح' : 'راسب'}`, color: a.results.finalExam === 'pass' ? 'success' : 'danger' });
    }
    return events.sort((a, b) => b.ts - a.ts);
  },

  async getDistribution(field: 'governorate' | 'certType' | 'status'): Promise<Array<{ label: string; value: number }>> {
    await simulateLatency();
    const counts = new Map<string, number>();
    for (const a of MOCK.applicants) {
      const key = String(a[field]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  },

  /** RFP §2-1 stage 2: reject duplicate NID in the active cycle. */
  async checkNidCollision(nationalId: string, excludeId?: string): Promise<boolean> {
    await simulateLatency(60, 140);
    return MOCK.applicants.some(
      (a) => a.nationalId === nationalId && a.id !== excludeId,
    );
  },

  async create(input: ApplicantInput): Promise<Applicant> {
    await simulateLatency();
    if (await applicantService.checkNidCollision(input.nationalId)) {
      throw new ApplicantTransitionError(
        'الرقم القومي مسجّل بالفعل في الدورة الحالية. لا يمكن تكرار التقدم.',
        409,
      );
    }
    const cycleYear = Number(MOCK.activeCycleId?.match(/(\d{4})/)?.[1]) || new Date().getFullYear();
    const id = newApplicantId(cycleYear);
    const applicant = inputToApplicant(input, id);
    MOCK.applicants.unshift(applicant);

    const workflow = await workflowsService.getByDepartment(input.department);
    if (workflow) {
      const firstStage = workflow.stages[0];
      const progress: ApplicantWorkflowProgress = {
        applicantId: applicant.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        currentStageId: firstStage?.id ?? null,
        completedStageIds: [],
        testResults: [],
      };
      const idx = MOCK.applicantWorkflowProgress.findIndex(
        (p) => p.applicantId === applicant.id,
      );
      if (idx === -1) MOCK.applicantWorkflowProgress.unshift(progress);
      else MOCK.applicantWorkflowProgress[idx] = progress;
    }

    pushAudit(
      applicant.id,
      'create',
      `تم إضافة المتقدم ${applicant.name} (${id})`,
      { before: null, after: { id, name: applicant.name, status: applicant.status } },
    );

    return applicant;
  },

  async update(id: string, patch: Partial<ApplicantInput>): Promise<Applicant> {
    if (!isDemoMode) {
      // Phase 3 backend PATCH only covers a subset of editable fields.
      // Map the rich frontend patch to the narrower ApplicantPatchDto.
      const fullName =
        patch.fullName
          ? [patch.fullName.first, patch.fullName.second, patch.fullName.third, patch.fullName.fourth]
              .filter(Boolean)
              .join(' ')
          : null;
      // Status is NOT in this payload — Resolved Clarification #15 routes
      // status transitions through POST /transition (later phase).
      const backendPatch = {
        fullName,
        mobile: patch.contact?.mobilePhone ?? null,
        email: patch.contact?.email ?? null,
        governorate: patch.currentAddress?.governorate ?? null,
      };
      const { data } = await apiClient.patch<BackendDetail>(
        `/admin/applicants/${id}`,
        backendPatch,
      );
      const applicant = backendToApplicant(data);
      applicant.lastModifiedAt = data.updatedAt;
      applicant.lastModifiedBy = data.lastModifiedBy ?? undefined;
      return applicant;
    }

    await simulateLatency();
    const idx = MOCK.applicants.findIndex((a) => a.id === id);
    if (idx === -1) throw new ApplicantTransitionError('المتقدم غير موجود', 422);
    const prev = MOCK.applicants[idx];

    if (patch.nationalId && patch.nationalId !== prev.nationalId) {
      throw new ApplicantTransitionError('لا يمكن تعديل الرقم القومي بعد التسجيل.', 422);
    }
    if (prev.status === 'on-hold') {
      throw new ApplicantTransitionError(
        'هذا المتقدم موقوف · لا يمكن تعديل بياناته.',
        422,
      );
    }
    const cardPrinted = Boolean(prev.attendanceCardPrintedAt);
    if (cardPrinted && (patch.fullName || patch.education || patch.religion)) {
      throw new ApplicantTransitionError(
        'تم طباعة كارت التردد · لا يمكن تعديل البيانات الشخصية أو الدراسية.',
        422,
      );
    }

    const next = applyUpdates(prev, patch);
    MOCK.applicants[idx] = next;

    const changes = diffApplicants(prev, next);
    if (Object.keys(changes).length > 0) {
      const fieldList = Object.keys(changes).join('، ');
      pushAudit(id, 'update', `تعديل الحقول: ${fieldList}`, {
        before: prev as unknown as Record<string, unknown>,
        after: next as unknown as Record<string, unknown>,
      });
    }

    return next;
  },

  async transition(
    id: string,
    payload: { toStatus: ApplicantStatus; reason: string },
  ): Promise<Applicant> {
    await simulateLatency();
    const idx = MOCK.applicants.findIndex((a) => a.id === id);
    if (idx === -1) throw new ApplicantTransitionError('المتقدم غير موجود', 422);
    const prev = MOCK.applicants[idx];
    if (!payload.reason || payload.reason.trim().length < 3) {
      throw new ApplicantTransitionError('سبب التحديث مطلوب.', 422);
    }
    if (payload.toStatus === prev.status) {
      throw new ApplicantTransitionError('لا يوجد تغيير في الحالة.', 422);
    }

    const dept = pickDepartment(prev);
    const workflow = await workflowsService.getByDepartment(dept);
    const progress = workflow ? await applicantService.getProgress(id) : null;
    const stage = workflow && progress
      ? workflow.stages.find((s) => s.id === progress.currentStageId)
      : null;
    const universalTerminals: ApplicantStatus[] = ['rejected', 'on-hold'];
    if (
      stage &&
      !stage.allowedNextStatuses.includes(payload.toStatus) &&
      !universalTerminals.includes(payload.toStatus)
    ) {
      throw new ApplicantTransitionError(
        `الانتقال إلى "${payload.toStatus}" غير مسموح من المرحلة الحالية.`,
        422,
      );
    }

    const next: Applicant = { ...prev, status: payload.toStatus };
    MOCK.applicants[idx] = next;

    if (workflow && progress) {
      const event: WorkflowTransitionEvent = {
        id: `WTRN-${id}-${Date.now()}`,
        applicantId: id,
        ts: Date.now(),
        fromStatus: prev.status,
        toStatus: next.status,
        fromStageId: progress.currentStageId,
        toStageId: progress.currentStageId,
        actorId: ACTOR_ID,
        actorName: ACTOR_NAME,
        reason: payload.reason,
      };
      MOCK.workflowTransitions.unshift(event);
    }

    pushAudit(
      id,
      'applicant.transition',
      `${prev.status} → ${next.status} · ${payload.reason}`,
      { before: { status: prev.status }, after: { status: next.status, reason: payload.reason } },
    );

    return next;
  },

  /** Always returns a progress snapshot for a known applicant. */
  async getProgress(id: string): Promise<ApplicantWorkflowProgress | null> {
    await simulateLatency(60, 140);
    const applicant = MOCK.applicants.find((a) => a.id === id);
    if (!applicant) return null;
    const seeded = MOCK.applicantWorkflowProgress.find((p) => p.applicantId === id);
    if (seeded) return seeded;
    const workflow = await workflowsService.getByDepartment(pickDepartment(applicant));
    if (!workflow) return null;
    return deriveProgress(applicant, workflow);
  },

  /** Workflow transition events for one applicant — feeds the legacy panel. */
  async getWorkflowTransitions(id: string): Promise<WorkflowTransitionEvent[]> {
    await simulateLatency(60, 140);
    return MOCK.workflowTransitions.filter((e) => e.applicantId === id);
  },

  async getActiveWorkflowFor(id: string): Promise<DepartmentWorkflow | null> {
    await simulateLatency(60, 140);
    const applicant = MOCK.applicants.find((a) => a.id === id);
    if (!applicant) return null;
    return workflowsService.getByDepartment(pickDepartment(applicant));
  },

  async getAuditTrail(id: string): Promise<AuditEntry[]> {
    await simulateLatency(60, 140);
    return (MOCK.audit).filter(
      (e) => e.entity === 'applicant' && e.entityId === id,
    );
  },
};

/* Re-exported for the §6 unit-testable transitions module. */
export { pickDepartment };
