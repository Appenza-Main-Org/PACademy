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
 *   POST   /api/cycles/:id/activate?swap=1                   → AdmissionCycle  (atomic close-old + activate-new)
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

/* Backend `GET /admin/cycles` returns CycleListItemDto[] inside a PagedResult.
 * CycleListItemDto carries id, nameAr, year, cohort, status, openDate, closeDate,
 * expectedCapacity, applicantCount — a strict subset of frontend AdmissionCycle.
 * Optional rich fields (openCategories, fees, conditionOverrides, …) default to
 * empty here; the wizard's per-step services own those shapes anyway. */
interface BackendCycleListItem {
  id: string;
  nameAr: string;
  year: number;
  cohort: 'male' | 'female';
  status: AdmissionCycle['status'];
  openDate: string;
  closeDate: string;
  expectedCapacity: number;
  applicantCount: number;
}
interface BackendPagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const cyclesService = {
  /**
   * Lists cycles from the real backend (spec 005 modular monolith,
   * /admin/cycles endpoint). The response items are flat — wizard pages
   * that consume `openCategories` / `fees` / `conditionOverrides` get
   * `undefined` and fall back to the per-step services.
   */
  async list(_opts: { includeDeleted?: boolean } = {}): Promise<AdmissionCycle[]> {
    const r = await apiClient.get<BackendPagedResult<BackendCycleListItem>>(
      '/admin/cycles',
      { params: { pageSize: 100 } },
    );
    return r.data.items
      .map<AdmissionCycle>((c) => ({
        id: c.id,
        nameAr: c.nameAr,
        year: c.year,
        cohort: c.cohort,
        status: c.status,
        openDate: c.openDate,
        closeDate: c.closeDate,
        expectedCapacity: c.expectedCapacity,
        applicantCount: c.applicantCount,
      }))
      .sort((a, b) => b.year - a.year);
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    /* Real backend GET /admin/cycles/{id} — returns CycleDetailDto. Fields
     * not on the DTO (fees, linkedCommitteeIds, etc.) come back undefined.
     * Returns null on 404 instead of throwing — preserves the mock contract. */
    try {
      const r = await apiClient.get<AdmissionCycle>(`/admin/cycles/${id}`);
      return r.data;
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
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

  async create(
    payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>,
    _options: { demoteCurrentActive?: boolean } = {},
  ): Promise<AdmissionCycle> {
    /* Real backend POST /admin/cycles. Body matches CreateCycleRequest:
     * { nameAr, year, cohort, openDate, closeDate, expectedCapacity }.
     * Backend always creates in Draft status; activation is a separate
     * call via POST /admin/cycles/{id}/status. The single-active invariant
     * is enforced on the backend during that transition, so the
     * demoteCurrentActive option is now meaningless on create — kept on
     * the signature for backwards compatibility with existing callers. */
    const r = await apiClient.post<AdmissionCycle>('/admin/cycles', {
      nameAr: payload.nameAr,
      year: payload.year,
      cohort: payload.cohort,
      openDate: payload.openDate,
      closeDate: payload.closeDate,
      expectedCapacity: payload.expectedCapacity,
    });
    return r.data;
  },

  /**
   * Change the status of an existing cycle from the simplified edit flow.
   * Mirrors the single-active invariant enforced in `create()`: switching
   * a cycle to `'active'` while another active cycle exists rejects with
   * `ConflictError('ACTIVE_CYCLE_EXISTS')` unless the caller opts into
   * `demoteCurrentActive: true`. Side-effect: keeps `ACTIVE_ID` in sync.
   */
  async updateStatus(
    id: string,
    next: CycleStatus,
    options: { demoteCurrentActive?: boolean } = {},
  ): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx] };

    if (next === 'active') {
      const conflictIdx = STATE.findIndex(
        (c, i) =>
          i !== idx &&
          (c.status === 'active' || c.status === 'open' || c.status === 'extended'),
      );
      if (conflictIdx !== -1) {
        const conflicting = STATE[conflictIdx];
        if (!options.demoteCurrentActive) {
          throw new ConflictError(
            'ACTIVE_CYCLE_EXISTS',
            { activeCycleId: conflicting.id, activeCycleName: conflicting.nameAr },
            `يوجد دورة نشطة حالياً "${conflicting.nameAr}". أغلقها أو حوّلها إلى مسودة قبل تفعيل دورة جديدة.`,
          );
        }
        const beforeDemote = { ...conflicting };
        const demoted: AdmissionCycle = {
          ...conflicting,
          status: 'draft',
          updatedAt: new Date().toISOString(),
        };
        STATE[conflictIdx] = demoted;
        if (ACTIVE_ID === beforeDemote.id) ACTIVE_ID = null;
        pushAudit(
          'AdmissionCycle',
          beforeDemote.id,
          'update',
          `تم تحويل دورة "${beforeDemote.nameAr}" إلى مسودة عند تفعيل دورة أخرى`,
        );
      }
    }

    const updated: AdmissionCycle = {
      ...before,
      status: next,
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = updated;
    if (next === 'active') ACTIVE_ID = updated.id;
    else if (ACTIVE_ID === updated.id) ACTIVE_ID = null;
    pushAudit(
      'AdmissionCycle',
      updated.id,
      'update',
      `تم تغيير حالة دورة "${updated.nameAr}" إلى ${next}`,
    );
    return updated;
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    /* Real backend PATCH /admin/cycles/{id} — accepts a subset of fields:
     * nameAr, openDate, closeDate, expectedCapacity, openCategories,
     * conditionOverrides. Other fields on the frontend AdmissionCycle (status,
     * cohort, year, …) are immutable post-create or have dedicated endpoints
     * (e.g. POST /admin/cycles/{id}/status for status transitions).
     *
     * If the id is a real GUID, hit the backend. Otherwise fall back to mock
     * so legacy cycle ids (e.g., CYC-2026-M from older sessionStorage state)
     * still patch the in-memory STATE without throwing. */
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      const body: Record<string, unknown> = {};
      if (patch.nameAr !== undefined) body.nameAr = patch.nameAr;
      if (patch.openDate !== undefined) body.openDate = patch.openDate;
      if (patch.closeDate !== undefined) body.closeDate = patch.closeDate;
      if (patch.expectedCapacity !== undefined) body.expectedCapacity = patch.expectedCapacity;
      if (patch.openCategories !== undefined) body.openCategories = patch.openCategories;
      if (patch.conditionOverrides !== undefined) body.conditionOverrides = patch.conditionOverrides;
      const r = await apiClient.patch<AdmissionCycle>(`/admin/cycles/${id}`, body);
      return r.data;
    }

    /* Legacy mock fallback */
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const updated: AdmissionCycle = {
      ...STATE[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    } as AdmissionCycle;
    STATE[idx] = updated;
    pushAudit('AdmissionCycle', updated.id, 'update', `تم تعديل بيانات دورة "${updated.nameAr}"`);
    return updated;
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
    /* Real backend POST /admin/cycles/{id}/status. Backend enforces
     * single-active + state-machine transitions; ACTIVE_CYCLE_EXISTS / 422
     * surface via apiClient interceptor. */
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      const r = await apiClient.post<AdmissionCycle>(
        `/admin/cycles/${id}/status`, { newStatus: next },
      );
      return r.data;
    }
    /* Legacy mock fallback */
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    STATE[idx] = { ...STATE[idx], status: next, updatedAt: new Date().toISOString() } as AdmissionCycle;
    pushAudit('AdmissionCycle', id, 'update', `تم تغيير حالة دورة "${STATE[idx].nameAr}" إلى ${next}`);
    return STATE[idx];
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
    /* Real backend handles single-active invariant + state machine validation.
     * Throws ConflictError('ACTIVE_CYCLE_EXISTS') / typed 422 on failure. */
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      const r = await apiClient.post<AdmissionCycle>(
        `/admin/cycles/${id}/status`, { newStatus: 'active' },
      );
      return r.data;
    }
    /* Legacy mock fallback — keeps the friendly pre-flight messages for
     * non-GUID cycle ids that still flow through the mock state. */
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

  /**
   * Atomic swap — closes whatever active cycle currently exists and
   * activates the target in one call. Lets the UI offer a single
   * confirmation when an admin tries to activate a new cycle while
   * another one is still active, instead of forcing them to navigate
   * to the old cycle, close it, then come back.
   *
   * Pre-flight checks for the target run BEFORE the close, so a
   * half-baked target doesn't tear the existing active cycle down.
   * Audit emits both `cycle_closed` (for the swapped-out cycle) and
   * `cycle_activated` (for the target) so the trail is complete.
   *
   * Real backend should expose this as POST /api/cycles/:id/activate
   * with a `swapWith` query param OR a transactional endpoint —
   * mirror the same shape so the frontend doesn't change.
   */
  async swapActive(targetId: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const targetIdx = STATE.findIndex((c) => c.id === targetId);
    if (targetIdx === -1) throw new Error('الدورة غير موجودة');

    const missing = collectActivationIssues(STATE[targetIdx]);
    if (missing.length > 0) {
      throw new ConflictError(
        'CYCLE_ACTIVATION_INCOMPLETE',
        { issues: missing },
        `لا يمكن تفعيل هذه الدورة — الإعداد غير مكتمل:\n• ${missing.join('\n• ')}`,
      );
    }

    /* Close every other cycle that's currently in an active-ish state. */
    const now = new Date().toISOString();
    for (let i = 0; i < STATE.length; i += 1) {
      if (i === targetIdx) continue;
      const c = STATE[i];
      if (c.status === 'active' || c.status === 'open' || c.status === 'extended') {
        const beforeClose = { ...c };
        STATE[i] = { ...c, status: 'closed', updatedAt: now } as AdmissionCycle;
        if (ACTIVE_ID === c.id) ACTIVE_ID = null;
        emitAudit({
          action: 'cycle_closed',
          module: 'cycles',
          entityType: 'AdmissionCycle',
          entityLabel: 'دورة قبول',
          entityId: c.id,
          details: `تم إغلاق دورة "${c.nameAr}" تلقائياً عند تفعيل دورة أخرى`,
          before: beforeClose,
          after: STATE[i],
        });
      }
    }

    const beforeActivate = { ...STATE[targetIdx] };
    STATE[targetIdx] = {
      ...STATE[targetIdx],
      status: 'active',
      updatedAt: now,
    } as AdmissionCycle;
    ACTIVE_ID = targetId;
    emitAudit({
      action: 'cycle_activated',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: targetId,
      details: `تم تفعيل دورة "${STATE[targetIdx].nameAr}"`,
      before: beforeActivate,
      after: STATE[targetIdx],
    });
    return STATE[targetIdx];
  },

  async close(id: string): Promise<AdmissionCycle> {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      const r = await apiClient.post<AdmissionCycle>(
        `/admin/cycles/${id}/status`, { newStatus: 'closed' },
      );
      return r.data;
    }
    /* Legacy mock fallback */
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
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      const r = await apiClient.post<AdmissionCycle>(
        `/admin/cycles/${id}/status`, { newStatus: 'archived' },
      );
      return r.data;
    }
    /* Legacy mock fallback */
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
    /* Real backend DELETE /admin/cycles/{id}. Backend enforces "only Draft
     * cycles can be deleted" + the soft-delete strategy (sets Archived=1
     * for non-draft, hard-delete for draft) per AdminCyclesController.
     * Errors:
     *   - 404 if id not found
     *   - 409 if cycle has applicants / is not Draft
     * Both bubble up via the apiClient interceptor as typed ApiError. */
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id)) {
      await apiClient.delete(`/admin/cycles/${id}`);
      return { ok: true };
    }

    /* Legacy mock fallback for any CYC-* ids that survive in non-flipped paths. */
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    if (STATE[idx].status !== 'draft') throw new Error('لا يمكن حذف دورة غير مسودة');
    const [removed] = STATE.splice(idx, 1);
    pushAudit('AdmissionCycle', id, 'delete', `تم حذف مسودة دورة "${removed.nameAr}"`);
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
