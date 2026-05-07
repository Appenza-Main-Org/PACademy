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
 *   PATCH  /api/cycles/:id/categories/:key/conditions        → AdmissionCycle
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { ConflictError } from '@/shared/lib/errors';
import {
  applyRestore,
  applySoftDelete,
  DependencyBlockedError,
  filterDeleted,
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
  (MOCK.audit as AuditEntry[]).unshift(entry);
}

/** Arabic labels for the dependency relations a cycle has children in. */
const CYCLE_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  categories: 'فئة قبول',
  committees: 'لجنة قبول',
};

export const cyclesService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<AdmissionCycle[]> {
    await simulateLatency();
    const visible = filterDeleted(STATE, opts.includeDeleted);
    return [...visible].sort((a, b) => b.year - a.year);
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    await simulateLatency();
    return STATE.find((c) => c.id === id) ?? null;
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
    await simulateLatency();
    const now = new Date().toISOString();
    const cycle: AdmissionCycle = {
      ...payload,
      id: `CYC-${payload.year}-${payload.cohort.toUpperCase().slice(0, 1)}-${cloneCounter++}`,
      applicantCount: 0,
      createdAt: payload.createdAt ?? now,
      updatedAt: now,
    };
    STATE.unshift(cycle);
    pushAudit('AdmissionCycle', cycle.id, 'create', `تم إنشاء دورة "${cycle.nameAr}"`);
    return cycle;
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const updated: AdmissionCycle = {
      ...STATE[idx]!,
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
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    STATE[idx] = { ...STATE[idx]!, status: next, updatedAt: new Date().toISOString() } as AdmissionCycle;
    pushAudit('AdmissionCycle', id, 'update', `تم تغيير حالة دورة "${STATE[idx]!.nameAr}" إلى ${next}`);
    return STATE[idx]!;
  },

  /**
   * Activate a cycle. Enforces the single-active invariant — another
   * `'active'`/`'open'`/`'extended'` cycle is a hard reject (Gap F):
   * the caller must explicitly close it first.
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
    const before = { ...STATE[idx]! };
    STATE[idx] = { ...STATE[idx]!, status: 'active', updatedAt: new Date().toISOString() } as AdmissionCycle;
    ACTIVE_ID = id;
    emitAudit({
      action: 'cycle_activated',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم تفعيل دورة "${STATE[idx]!.nameAr}"`,
      before,
      after: STATE[idx]!,
    });
    return STATE[idx]!;
  },

  async close(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx]! };
    STATE[idx] = { ...STATE[idx]!, status: 'closed', updatedAt: new Date().toISOString() } as AdmissionCycle;
    if (ACTIVE_ID === id) ACTIVE_ID = null;
    emitAudit({
      action: 'cycle_closed',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم إغلاق دورة "${STATE[idx]!.nameAr}"`,
      before,
      after: STATE[idx]!,
    });
    return STATE[idx]!;
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
    const cur = STATE[idx]!;
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
      after: STATE[idx]!,
    });
    return STATE[idx]!;
  },

  async archive(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    const before = { ...STATE[idx]! };
    STATE[idx] = { ...STATE[idx]!, status: 'archived', updatedAt: new Date().toISOString() } as AdmissionCycle;
    if (ACTIVE_ID === id) ACTIVE_ID = null;
    emitAudit({
      action: 'cycle_archived',
      module: 'cycles',
      entityType: 'AdmissionCycle',
      entityLabel: 'دورة قبول',
      entityId: id,
      details: `تم أرشفة دورة "${STATE[idx]!.nameAr}"`,
      before,
      after: STATE[idx]!,
    });
    return STATE[idx]!;
  },

  async remove(id: string): Promise<{ ok: true }> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    if (STATE[idx]!.status !== 'draft') throw new Error('لا يمكن حذف دورة غير مسودة');
    const [removed] = STATE.splice(idx, 1);
    pushAudit('AdmissionCycle', id, 'delete', `تم حذف مسودة دورة "${removed!.nameAr}"`);
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
    const next: AdmissionCycle = {
      ...STATE[idx]!,
      openCategories: {
        ...STATE[idx]!.openCategories,
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
    const existing = STATE[idx]!.conditionOverrides ?? {};
    const next: AdmissionCycle = {
      ...STATE[idx]!,
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
    const before = { ...STATE[idx]! };
    const dep = await cyclesService.getDependencies(id);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذه الدورة', CYCLE_DEP_LABELS);
    const next = applySoftDelete(STATE[idx]!, { reason });
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
    const before = { ...STATE[idx]! };
    const next = applyRestore(STATE[idx]!);
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
