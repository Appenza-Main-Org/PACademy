/**
 * Admission Cycles API Contract — Sprint 1 (KARASA_GAPS §1.2.D),
 * extended post-polish (Bucket E) with per-cycle per-category configuration
 * and the activate/close/archive lifecycle transitions.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/cycles                                       → AdmissionCycle[]
 *   GET    /api/cycles/active                                → AdmissionCycle | null
 *   GET    /api/cycles/:id                                   → AdmissionCycle
 *   POST   /api/cycles                                       → AdmissionCycle
 *   PATCH  /api/cycles/:id                                   → AdmissionCycle
 *   POST   /api/cycles/:id/clone                             → AdmissionCycle (new draft)
 *   POST   /api/cycles/:id/transition                        → { status }
 *   POST   /api/cycles/:id/activate                          → AdmissionCycle  (closes others)
 *   POST   /api/cycles/:id/close                             → AdmissionCycle
 *   POST   /api/cycles/:id/archive                           → AdmissionCycle
 *   PATCH  /api/cycles/:id/categories/:key                   → AdmissionCycle
 *     body: { isOpen, capacity, notes, genderTypes[], startDate, endDate }
 *     422  if isOpen && (!genderTypes.length || !startDate || !endDate),
 *           or dates outside cycle [openDate, closeDate], or end < start.
 *   PATCH  /api/cycles/:id/categories/:key/conditions        → AdmissionCycle
 */

import { apiClient } from '@/shared/api';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { ConflictError } from '@/shared/lib/errors';
import {
  applyRestore,
  applySoftDelete,
  DependencyBlockedError,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategoryKey,
  AuditEntry,
  CategoryCondition,
  CycleStatus,
} from '@/shared/types/domain';

const STATE: AdmissionCycle[] = MOCK.cycles.map((c) => ({ ...c }));
let ACTIVE_ID: string | null = MOCK.activeCycleId;

/* ── Backend ↔ frontend cycle mapper ─────────────────────────────────────
 * Backend `CycleListItemDto` / `CycleDetailDto` carry the canonical fields;
 * everything else on `AdmissionCycle` (fees, linkedCommitteeIds, etc.) is
 * fronted by the admission-setup wizard's still-mocked services and gets
 * defaulted/preserved here so reload doesn't wipe them. */

interface ApiCycleListItem {
  id: string;
  nameAr: string;
  year: number;
  cohort: string;
  status: string;
  openDate: string;
  closeDate: string;
  expectedCapacity: number;
  applicantCount: number;
}

interface ApiCycleDetail extends ApiCycleListItem {
  openCategories: Record<string, unknown>;
  conditionOverrides: Record<string, unknown>;
  createdAt: string;
  archivedAt: string | null;
}

interface ApiPaged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number; }

function apiToCycle(api: ApiCycleListItem | ApiCycleDetail, prev?: AdmissionCycle): AdmissionCycle {
  const detail = (api as ApiCycleDetail);
  return {
    /* Identity + canonical fields from backend (lowercase status). */
    id: api.id,
    nameAr: api.nameAr,
    year: api.year,
    cohort: api.cohort as AdmissionCycle['cohort'],
    status: api.status.toLowerCase() as CycleStatus,
    openDate: api.openDate,
    closeDate: api.closeDate,
    expectedCapacity: api.expectedCapacity,
    applicantCount: api.applicantCount,
    /* Detail-only fields (default to prior/empty when absent). */
    openCategories: (detail.openCategories as AdmissionCycle['openCategories']) ?? prev?.openCategories ?? {},
    conditionOverrides: (detail.conditionOverrides as AdmissionCycle['conditionOverrides']) ?? prev?.conditionOverrides ?? {},
    createdAt: detail.createdAt ?? prev?.createdAt ?? new Date().toISOString(),
    updatedAt: prev?.updatedAt ?? detail.createdAt ?? new Date().toISOString(),
    /* Admission-setup-wizard fields: preserve whatever the local mock has;
     * the backend doesn't track these yet. */
    ageCalcDate: prev?.ageCalcDate,
    referenceAge: prev?.referenceAge,
    fees: prev?.fees,
    linkedCategoryIds: prev?.linkedCategoryIds,
    linkedCommitteeIds: prev?.linkedCommitteeIds,
  };
}

function upsertState(cycle: AdmissionCycle): void {
  const idx = STATE.findIndex((c) => c.id === cycle.id);
  if (idx === -1) STATE.unshift(cycle); else STATE[idx] = cycle;
}

/**
 * Pre-flight check for cycle activation. Returns a list of friendly
 * Arabic issue strings for everything still missing; an empty list
 * means the cycle is ready to activate.
 *
 * Mirrors what the backend should validate at activation time so the
 * frontend can surface the same messaging without a round-trip.
 */
function collectActivationIssues(cycle: AdmissionCycle): string[] {
  const issues: string[] = [];

  /* 1. Dates */
  if (!cycle.openDate || !cycle.closeDate) {
    issues.push('تواريخ الفتح والإغلاق غير مضبوطة');
  } else if (new Date(cycle.openDate).getTime() >= new Date(cycle.closeDate).getTime()) {
    issues.push('تاريخ الإغلاق يجب أن يكون بعد تاريخ الفتح');
  }

  /* 2. Fees */
  const fee = cycle.fees?.applicationFee;
  if (!fee || fee <= 0) {
    issues.push('رسوم التقديم غير مضبوطة');
  }
  if (!cycle.fees?.fawryConfig?.merchantCode) {
    issues.push('إعدادات بوابة فوري غير مكتملة (رمز التاجر مطلوب)');
  }

  /* 3. At least one open category */
  const openCategoryCount = Object.values(cycle.openCategories ?? {}).filter(
    (c) => c?.isOpen,
  ).length;
  if (openCategoryCount === 0) {
    issues.push('لا توجد فئة قبول مفتوحة لهذه الدورة');
  }

  /* 4. At least one committee linked to the cycle */
  const linkedCommittees = MOCK.committees.filter((c) => {
    /* Best-effort match — committee model may carry linkedCycleId or be
     * shared across cycles. Treat any committee not soft-deleted as
     * eligible for the demo unless committeesService later narrows. */
    if ('deletedAt' in c && (c as { deletedAt?: string }).deletedAt) return false;
    return true;
  });
  if (linkedCommittees.length === 0) {
    issues.push('لا توجد لجان مُعدّة في النظام');
  }

  /* 5. Exam workflow — at least one open category must have a non-empty
   * required-tests list. Avoids cross-importing examPlansService here
   * (the actual exam-order plans live in that service's in-memory PLANS
   * array; this check uses the per-category required-tests roster which
   * is part of the cycle/category shape). */
  const openCategories = Object.entries(cycle.openCategories ?? {})
    .filter(([, c]) => c?.isOpen)
    .map(([key]) => MOCK.categories.find((cat) => cat.key === key))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const hasAnyExamRoster = openCategories.some(
    (cat) => (cat.requiredTests?.length ?? 0) > 0,
  );
  if (openCategoryCount > 0 && !hasAnyExamRoster) {
    issues.push('لا توجد خطة اختبارات مُعرّفة لأي فئة قبول مفتوحة');
  }

  return issues;
}

/**
 * Validates a per-category cycle configuration against the cycle's
 * [openDate, closeDate] window (the academic year for this cohort) and the
 * "open requires gender + dates" business rule. Returns an array of Arabic
 * issue strings; an empty array means the config is valid.
 *
 * Exported so the إعدادات التقديم UI can render the same messages inline
 * without duplicating the rule set.
 */
export function validateCategoryConfig(
  cycle: AdmissionCycle,
  config: AdmissionCycleCategoryConfig,
): string[] {
  const issues: string[] = [];
  const cycleStart = cycle.openDate ? new Date(cycle.openDate).getTime() : null;
  const cycleEnd = cycle.closeDate ? new Date(cycle.closeDate).getTime() : null;
  const start = config.startDate ? new Date(config.startDate).getTime() : null;
  const end = config.endDate ? new Date(config.endDate).getTime() : null;

  if (config.isOpen) {
    if (!config.genderTypes || config.genderTypes.length === 0) {
      issues.push('يجب اختيار نوع واحد على الأقل');
    }
    if (!config.startDate || !config.endDate) {
      issues.push('لا يمكن فتح الفئة بدون تحديد فترة التقديم');
    }
  }

  if (start !== null && cycleStart !== null && cycleEnd !== null) {
    if (start < cycleStart || start > cycleEnd) {
      issues.push('تاريخ البداية يجب أن يكون داخل نطاق العام الدراسي');
    }
  }
  if (end !== null && cycleStart !== null && cycleEnd !== null) {
    if (end < cycleStart || end > cycleEnd) {
      issues.push('تاريخ النهاية يجب أن يكون داخل نطاق العام الدراسي');
    }
  }
  if (start !== null && end !== null && end < start) {
    issues.push('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
  }

  return issues;
}

let cloneCounter = 1;
let auditCounter = 1;

const NORMALIZE_STATUS: Record<CycleStatus, CycleStatus> = {
  draft: 'draft',
  open: 'active',
  active: 'active',
  extended: 'active',
  closed: 'closed',
  processing: 'closed',
  finalized: 'archived',
  archived: 'archived',
};

/**
 * Returns the brief's 4-state cycle status for a cycle. The legacy
 * 5-state union (`open`/`processing`/`finalized`) is mapped onto the
 * post-polish 4-state union (`active`/`closed`/`archived`). The Gap F
 * `'extended'` token folds into `active` for surface-level UI.
 */
export function normalizeCycleStatus(status: CycleStatus): 'draft' | 'active' | 'closed' | 'archived' {
  return NORMALIZE_STATUS[status] as 'draft' | 'active' | 'closed' | 'archived';
}

function pushAudit(entity: string, entityId: string, action: 'create' | 'update' | 'delete', details: string): void {
  const entry: AuditEntry = {
    id: `AUDIT-CYC-${Date.now()}-${auditCounter++}`,
    userId: 'U-001',
    userName: 'العميد د. أحمد محمود الفقي',
    action,
    actionLabel: action === 'create' ? 'إدراج' : action === 'update' ? 'تعديل' : 'حذف',
    actionColor: action === 'create' ? 'success' : action === 'update' ? 'info' : 'danger',
    entity,
    entityId,
    details,
    timestamp: Date.now(),
    ip: '10.0.0.1',
  };
  /* MOCK.audit is exported as a regular array; pushing surfaces the entry
   * in /admin/audit on the next refetch. */
  (MOCK.audit).unshift(entry);
}

/** Arabic labels for the dependency relations a cycle has children in. */
const CYCLE_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  categories: 'فئة قبول',
  committees: 'لجنة قبول',
};

export const cyclesService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<AdmissionCycle[]> {
    const { data } = await apiClient.get<ApiPaged<ApiCycleListItem>>('/admin/cycles', {
      params: { includeArchived: opts.includeDeleted ?? false, pageSize: 200 },
    });
    const cycles = data.items.map((api) => apiToCycle(api, STATE.find((c) => c.id === api.id)));
    // Sync local STATE so the still-mocked methods (clone/toggleCategory/…) see fresh data.
    STATE.length = 0;
    STATE.push(...cycles);
    return [...cycles].sort((a, b) => b.year - a.year);
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    try {
      const { data } = await apiClient.get<ApiCycleDetail>(`/admin/cycles/${id}`);
      const cycle = apiToCycle(data, STATE.find((c) => c.id === id));
      upsertState(cycle);
      return cycle;
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        return null;
      }
      throw err;
    }
  },

  async getActive(): Promise<AdmissionCycle | null> {
    await simulateLatency(80, 200);
    if (!ACTIVE_ID) return null;
    const cycle = STATE.find((c) => c.id === ACTIVE_ID);
    if (!cycle) return null;
    /* Honour the [opensAt, closesAt] window — outside it, no cycle is active
     * for public-flow purposes. */
    const now = Date.now();
    const open = new Date(cycle.openDate).getTime();
    const close = new Date(cycle.closeDate).getTime();
    if (now < open || now > close) return null;
    return { ...cycle };
  },

  /** Internal helper: returns the active cycle ignoring the time window. */
  getActiveSync(): AdmissionCycle | null {
    if (!ACTIVE_ID) return null;
    return STATE.find((c) => c.id === ACTIVE_ID) ?? null;
  },

  async create(payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>): Promise<AdmissionCycle> {
    const body = {
      nameAr: payload.nameAr,
      year: payload.year,
      cohort: payload.cohort,
      openDate: payload.openDate,
      closeDate: payload.closeDate,
      expectedCapacity: payload.expectedCapacity,
    };
    const { data } = await apiClient.post<ApiCycleDetail>('/admin/cycles', body);
    const cycle = apiToCycle(data);
    // Carry over wizard-only fields the backend didn't echo back.
    cycle.fees = payload.fees;
    cycle.referenceAge = payload.referenceAge;
    cycle.linkedCommitteeIds = payload.linkedCommitteeIds;
    cycle.linkedCategoryIds = payload.linkedCategoryIds;
    upsertState(cycle);
    pushAudit('AdmissionCycle', cycle.id, 'create', `تم إنشاء دورة "${cycle.nameAr}"`);
    return cycle;
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    const body: Record<string, unknown> = {};
    if (patch.nameAr !== undefined) body.nameAr = patch.nameAr;
    if (patch.openDate !== undefined) body.openDate = patch.openDate;
    if (patch.closeDate !== undefined) body.closeDate = patch.closeDate;
    if (patch.expectedCapacity !== undefined) body.expectedCapacity = patch.expectedCapacity;
    const { data } = await apiClient.patch<ApiCycleDetail>(`/admin/cycles/${id}`, body);
    const prev = STATE.find((c) => c.id === id);
    // Preserve wizard-only fields from the prior local state + apply any patch passthroughs.
    const cycle = apiToCycle(data, prev);
    if (patch.fees !== undefined) cycle.fees = patch.fees;
    if (patch.referenceAge !== undefined) cycle.referenceAge = patch.referenceAge;
    if (patch.linkedCommitteeIds !== undefined) cycle.linkedCommitteeIds = patch.linkedCommitteeIds;
    if (patch.linkedCategoryIds !== undefined) cycle.linkedCategoryIds = patch.linkedCategoryIds;
    upsertState(cycle);
    pushAudit('AdmissionCycle', cycle.id, 'update', `تم تعديل بيانات دورة "${cycle.nameAr}"`);
    return cycle;
  },

  async clone(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const source = STATE.find((c) => c.id === id);
    if (!source) throw new Error('الدورة غير موجودة');
    const now = new Date().toISOString();
    const draft: AdmissionCycle = {
      ...source,
      id: `${source.id}-CLONE-${cloneCounter++}`,
      nameAr: `${source.nameAr} (نسخة)`,
      status: 'draft',
      applicantCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    STATE.unshift(draft);
    pushAudit('AdmissionCycle', draft.id, 'create', `تم نسخ دورة "${source.nameAr}" كمسودة`);
    return draft;
  },

  async transition(id: string, next: CycleStatus): Promise<AdmissionCycle> {
    // Backend canonicalises the next-status value capitalised; lowercase round-trip via apiToCycle.
    const newStatus = next.charAt(0).toUpperCase() + next.slice(1);
    const { data } = await apiClient.post<ApiCycleDetail>(`/admin/cycles/${id}/status`, { newStatus });
    const prev = STATE.find((c) => c.id === id);
    const cycle = apiToCycle(data, prev);
    upsertState(cycle);
    pushAudit('AdmissionCycle', id, 'update', `تم تغيير حالة دورة "${cycle.nameAr}" إلى ${next}`);
    return cycle;
  },

  /**
   * Activate a cycle. Enforces the single-active invariant — another
   * `'active'`/`'open'`/`'extended'` cycle is a hard reject (Gap F):
   * the caller must explicitly close it first. Also runs a pre-flight
   * setup-completeness check so admins get a friendly Arabic message
   * listing what's still missing rather than activating a half-baked
   * cycle that applicants then can't apply to.
   */
  async activate(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const conflicting = STATE.find(
      (c, i) =>
        i !== idx && (c.status === 'active' || c.status === 'open' || c.status === 'extended'),
    );
    if (conflicting) {
      throw new ConflictError(
        'ACTIVE_CYCLE_EXISTS',
        { activeCycleId: conflicting.id, activeCycleName: conflicting.nameAr },
        `لا يمكن تفعيل هذه الدورة — دورة "${conflicting.nameAr}" نشطة بالفعل. يجب إغلاقها أولاً.`,
      );
    }
    /* Pre-flight setup-completeness check. Each missing prerequisite
     * adds a friendly Arabic line; if any are present we throw a single
     * ConflictError listing all of them so the admin can fix in one pass. */
    const missing = collectActivationIssues(STATE[idx]);
    if (missing.length > 0) {
      throw new ConflictError(
        'CYCLE_ACTIVATION_INCOMPLETE',
        { issues: missing },
        `لا يمكن تفعيل هذه الدورة — الإعداد غير مكتمل:\n• ${missing.join('\n• ')}`,
      );
    }
    const before = { ...STATE[idx] };
    STATE[idx] = { ...STATE[idx], status: 'active', updatedAt: new Date().toISOString() } as AdmissionCycle;
    ACTIVE_ID = id;
    emitAudit({
      action: 'cycle_activated',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم تفعيل دورة "${STATE[idx].nameAr}"`,
      before,
      after: STATE[idx],
    });
    return STATE[idx];
  },

  async close(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx] };
    STATE[idx] = { ...STATE[idx], status: 'closed', updatedAt: new Date().toISOString() } as AdmissionCycle;
    if (ACTIVE_ID === id) ACTIVE_ID = null;
    emitAudit({
      action: 'cycle_closed',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم إغلاق دورة "${STATE[idx].nameAr}"`,
      before,
      after: STATE[idx],
    });
    return STATE[idx];
  },

  /**
   * Extend the cycle's `closeDate`. The cycle must be `active`; emits
   * `cycle_extended` audit and flips status to `'extended'`. The
   * `ageCalcDate` stays put — extension moves the application window only.
   */
  async extend(id: string, newCloseDate: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const cur = STATE[idx];
    if (cur.status !== 'active' && cur.status !== 'open' && cur.status !== 'extended') {
      throw new Error('لا يمكن تمديد دورة غير نشطة');
    }
    if (new Date(newCloseDate).getTime() <= new Date(cur.closeDate).getTime()) {
      throw new Error('تاريخ التمديد يجب أن يكون بعد تاريخ الإغلاق الحالي');
    }
    const before = { ...cur };
    STATE[idx] = {
      ...cur,
      status: 'extended',
      closeDate: newCloseDate,
      updatedAt: new Date().toISOString(),
    } as AdmissionCycle;
    emitAudit({
      action: 'cycle_extended',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم تمديد دورة "${cur.nameAr}" حتى ${new Date(newCloseDate).toISOString().slice(0, 10)}`,
      before,
      after: STATE[idx],
    });
    return STATE[idx];
  },

  async archive(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx] };
    STATE[idx] = { ...STATE[idx], status: 'archived', updatedAt: new Date().toISOString() } as AdmissionCycle;
    if (ACTIVE_ID === id) ACTIVE_ID = null;
    emitAudit({
      action: 'cycle_archived',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم أرشفة دورة "${STATE[idx].nameAr}"`,
      before,
      after: STATE[idx],
    });
    return STATE[idx];
  },

  async remove(id: string): Promise<{ ok: true }> {
    const prev = STATE.find((c) => c.id === id);
    await apiClient.delete(`/admin/cycles/${id}`);
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx !== -1) STATE.splice(idx, 1);
    pushAudit('AdmissionCycle', id, 'delete', `تم حذف مسودة دورة "${prev?.nameAr ?? id}"`);
    return { ok: true };
  },

  async toggleCategory(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    config: AdmissionCycleCategoryConfig,
  ): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === cycleId);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const cycle = STATE[idx];

    /* Per-category validation — mirrors the inline UI checks so the backend
     * (and any non-UI caller) can't bypass the rules. */
    const issues = validateCategoryConfig(cycle, config);
    if (issues.length > 0) {
      throw new Error(issues[0]);
    }

    const next: AdmissionCycle = {
      ...cycle,
      openCategories: {
        ...cycle.openCategories,
        [categoryKey]: config,
      },
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = next;
    pushAudit(
      'AdmissionCycle',
      cycleId,
      'update',
      `تم ${config.isOpen ? 'فتح' : 'إغلاق'} فئة ${categoryKey} في دورة "${next.nameAr}"`,
    );
    return next;
  },

  async updateCategoryOverride(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    overrides: Partial<CategoryCondition>,
  ): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === cycleId);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const existing = STATE[idx].conditionOverrides ?? {};
    const next: AdmissionCycle = {
      ...STATE[idx],
      conditionOverrides: {
        ...existing,
        [categoryKey]: { ...(existing[categoryKey] ?? {}), ...overrides },
      },
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = next;
    pushAudit(
      'AdmissionCycle',
      cycleId,
      'update',
      `تم تعديل شروط فئة ${categoryKey} في دورة "${next.nameAr}"`,
    );
    return next;
  },

  /**
   * Returns the dependency snapshot used by SoftDeleteDialog. A cycle is
   * blocked from deletion if any applicants reference it; categories or
   * committees opened inside it count too but are non-blocking flags.
   */
  async getDependencies(id: string): Promise<DependencyResult> {
    await simulateLatency(80, 200);
    const cycle = STATE.find((c) => c.id === id);
    if (!cycle) throw new Error('الدورة غير موجودة');
    const applicants = MOCK.applicants.filter((a) => a.cycleId === id).length;
    const categories = Object.keys(cycle.openCategories ?? {}).length;
    const committees = MOCK.committees.length; /* simple proxy until Gap H wires linkedCycleId */
    return {
      counts: { applicants, categories, committees },
      blocking: applicants > 0,
    };
  },

  /**
   * Soft-delete the cycle. Hard-rejects when applicants reference it
   * (`getDependencies({ blocking: true })`).
   */
  async softDelete(id: string, reason: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx] };
    const dep = await cyclesService.getDependencies(id);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذه الدورة', CYCLE_DEP_LABELS);
    const next = applySoftDelete(STATE[idx], { reason });
    STATE[idx] = next;
    if (ACTIVE_ID === id) ACTIVE_ID = null;
    emitAudit({
      action: 'soft_delete',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم حذف دورة "${next.nameAr}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  /** Restore a previously soft-deleted cycle. Audit-emitting. */
  async restore(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx] };
    const next = applyRestore(STATE[idx]);
    STATE[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم استعادة دورة "${next.nameAr}"`,
      before,
      after: next,
    });
    return next;
  },
};
