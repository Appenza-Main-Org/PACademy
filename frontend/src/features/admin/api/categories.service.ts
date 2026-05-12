/**
 * Admin Categories API Contract — Bucket D.
 *
 * Admin-side CRUD over MOCK.categories. Spec departments
 * (officers_general / officers_specialized / postgraduate /
 * institute_officers_training / institute_traffic /
 * institute_guarding / special_units) cannot be deleted; their `key`
 * is immutable. Admin can edit other fields.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/categories                          → ApplicantCategory[]
 *   POST   /api/admin/categories                          → ApplicantCategory  (custom departments only)
 *   PATCH  /api/admin/categories/:key                     → ApplicantCategory
 *   DELETE /api/admin/categories/:key                     → { ok: true }       (non-spec only)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
  applyRestore,
  applySoftDelete,
  DependencyBlockedError,
  filterDeleted,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type {
  Applicant,
  ApplicantCategory,
  ApplicantCategoryKey,
  AuditEntry,
  CategoryConditions,
} from '@/shared/types/domain';

const CATEGORY_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
};

const SPEC_KEYS: ReadonlySet<ApplicantCategoryKey> = new Set<ApplicantCategoryKey>([
  'officers_general',
  'officers_specialized',
  'postgraduate',
  'institute_officers_training',
  'institute_traffic',
  'institute_guarding',
  'special_units',
]);

const STATE: ApplicantCategory[] = MOCK.categories.map((c) => ({ ...c }));
let auditCounter = 1;

function pushAudit(action: 'create' | 'update' | 'delete', categoryKey: string, details: string): void {
  const entry: AuditEntry = {
    id: `AUDIT-CAT-${Date.now()}-${auditCounter++}`,
    userId: 'U-001',
    userName: 'العميد د. أحمد محمود الفقي',
    action,
    actionLabel: action === 'create' ? 'إدراج' : action === 'update' ? 'تعديل' : 'حذف',
    actionColor: action === 'create' ? 'success' : action === 'update' ? 'info' : 'danger',
    entity: 'ApplicantCategory',
    entityId: categoryKey,
    details,
    timestamp: Date.now(),
    ip: '10.0.0.1',
  };
  (MOCK.audit).unshift(entry);
}

export const categoriesAdminService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<ApplicantCategory[]> {
    await simulateLatency();
    return filterDeleted(STATE, opts.includeDeleted).map((c) => ({ ...c }));
  },

  async getByKey(key: ApplicantCategoryKey): Promise<ApplicantCategory | null> {
    await simulateLatency();
    return STATE.find((c) => c.key === key) ?? null;
  },

  async update(key: ApplicantCategoryKey, patch: Partial<ApplicantCategory>): Promise<ApplicantCategory> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    /* Only the storage `key` is immutable; every other field — including
     * spec-category labels — is editable from the admin form. */
    const current = STATE[idx];
    const next: ApplicantCategory = { ...current, ...patch, key: current.key };
    STATE[idx] = next;
    pushAudit('update', key, `تم تعديل بيانات فئة "${next.labelAr}"`);
    return next;
  },

  async create(input: { labelAr: string; description?: string }): Promise<ApplicantCategory> {
    await simulateLatency();
    const labelAr = input.labelAr.trim();
    if (!labelAr) throw new Error('اسم الفئة مطلوب');
    let candidate = `custom_${Date.now()}`;
    while (
      SPEC_KEYS.has(candidate as ApplicantCategoryKey) ||
      STATE.some((c) => c.key === candidate)
    ) {
      candidate = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    const payload: ApplicantCategory = {
      key: candidate as ApplicantCategoryKey,
      labelAr,
      labelEn: '',
      description: (input.description ?? '').trim(),
      isOpen: false,
      conditions: {
        ageMin: null,
        ageMax: null,
        minScorePercent: null,
        requiredQualification: 'any',
        gender: 'any',
        minHeightCm: null,
        medicalRequired: false,
        maritalStatus: 'any',
        conductCheck: false,
        egyptianNationalityRequired: false,
        employerApprovalRequired: false,
        nominationOnly: false,
        freeText: [],
      },
      requiredTests: [],
      procedures: [],
    };
    STATE.push({ ...payload });
    pushAudit('create', payload.key, `تم إنشاء فئة "${payload.labelAr}"`);
    return { ...payload };
  },

  /**
   * Clone an existing category. Used by the categories list "نسخ" action;
   * spec keys can be cloned but the resulting copy is always a custom
   * (non-spec) category. Picks the first free `${sourceKey}_copy[_N]` slot.
   */
  async duplicate(source: ApplicantCategory): Promise<ApplicantCategory> {
    await simulateLatency();
    const baseKey = source.key as string;
    let candidate = `${baseKey}_copy`;
    let i = 1;
    while (
      SPEC_KEYS.has(candidate as ApplicantCategoryKey) ||
      STATE.some((c) => c.key === candidate)
    ) {
      i += 1;
      candidate = `${baseKey}_copy_${i}`;
    }
    const next: ApplicantCategory = {
      ...source,
      key: candidate as ApplicantCategoryKey,
      labelAr: `${source.labelAr} (نسخة)`,
      isOpen: false,
    };
    STATE.push({ ...next });
    pushAudit('create', next.key, `تم نسخ فئة "${source.labelAr}"`);
    return { ...next };
  },

  async remove(key: ApplicantCategoryKey): Promise<{ ok: true }> {
    await simulateLatency();
    if (SPEC_KEYS.has(key)) {
      throw new Error('لا يمكن حذف فئات السبع المعتمدة من المواصفات');
    }
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    const [removed] = STATE.splice(idx, 1);
    pushAudit('delete', key, `تم حذف فئة "${removed.labelAr}"`);
    return { ok: true };
  },

  isSpecCategory(key: ApplicantCategoryKey): boolean {
    return SPEC_KEYS.has(key);
  },

  /**
   * Dependency snapshot for soft delete. Returns the count of applicants
   * whose certType maps to this category — non-zero blocks the action.
   */
  async getDependencies(key: ApplicantCategoryKey): Promise<DependencyResult> {
    await simulateLatency(80, 200);
    const cat = STATE.find((c) => c.key === key);
    if (!cat) throw new Error('الفئة غير موجودة');
    /* TIER 2 dataset uses cycleId/department mapping; approximate via
     * the labelAr being a substring of certType to keep the demo realistic. */
    const applicants = MOCK.applicants.filter(
      (a) => a.certType?.includes(cat.labelAr) || a.department === (key as unknown as string),
    ).length;
    return {
      counts: { applicants },
      blocking: applicants > 0,
    };
  },

  /**
   * Soft-delete a category. Spec keys are protected even from soft delete
   * (matches the existing `remove()` policy). Applicants referencing the
   * category block the operation.
   */
  async softDelete(key: ApplicantCategoryKey, reason: string): Promise<ApplicantCategory> {
    await simulateLatency();
    if (SPEC_KEYS.has(key)) {
      throw new Error('لا يمكن حذف فئات السبع المعتمدة من المواصفات');
    }
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    const before = { ...STATE[idx] };
    const dep = await categoriesAdminService.getDependencies(key);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذه الفئة', CATEGORY_DEP_LABELS);
    const next = applySoftDelete(STATE[idx], { reason });
    STATE[idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'categories',
      entityType: 'ApplicantCategory',
      entityLabel: 'فئة قبول',
      entityId: key,
      details: `تم حذف فئة "${next.labelAr}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Preview-rule-change impact — Gap G (admin-gaps).
   *
   * Returns the applicants whose existing data conflicts with the proposed
   * new conditions. v1 scope (per spec): gender, age range, education type
   * only. Each conflict carries `failingRule` so the override drawer can
   * group them. Future expansions: marital status, required exams, score
   * threshold (commented in code as the matrix grows).
   *
   * The matcher uses the existing seeded applicants; production wires this
   * to a backend rule-engine endpoint per the INTEGRATION CONTRACT below.
   */
  async previewRuleChangeImpact(
    key: ApplicantCategoryKey,
    newConditions: CategoryConditions,
  ): Promise<{ impactedApplicants: Applicant[]; conflicts: { applicantId: string; failingRule: string }[] }> {
    await simulateLatency(150, 300);
    const conflicts: { applicantId: string; failingRule: string }[] = [];
    const impacted: Applicant[] = [];
    const today = new Date(newConditions.ageCalcDate ?? Date.now());
    /* Map applicants whose certType label matches the category key as a
     * coarse "in this category" heuristic for the demo. */
    const cat = STATE.find((c) => c.key === key);
    const inCategory = MOCK.applicants.filter(
      (a) =>
        cat &&
        (a.certType?.includes(cat.labelAr) || a.department === (key as unknown as string)),
    );

    for (const ap of inCategory) {
      let pushed = false;
      const pushOnce = (rule: string): void => {
        conflicts.push({ applicantId: ap.id, failingRule: rule });
        if (!pushed) {
          impacted.push(ap);
          pushed = true;
        }
      };
      /* Gender. */
      if (newConditions.gender !== 'any' && ap.gender !== newConditions.gender) {
        pushOnce('gender_mismatch');
      }
      /* Age range. */
      const birth = new Date(ap.birthDate);
      const ageYears = today.getFullYear() - birth.getFullYear();
      if (newConditions.minAge !== null && ageYears < (newConditions.minAge ?? -Infinity)) {
        pushOnce('age_below_min');
      }
      if (newConditions.maxAge !== null && ageYears > (newConditions.maxAge ?? Infinity)) {
        pushOnce('age_above_max');
      }
      /* Education type — simplified: applicant carries `certType`; the
       * proposed list is a set of education-type *labels* that match
       * substrings of certType. Future expansion will map applicant to
       * their educationType lookup id directly. */
      if (newConditions.educationTypes.length > 0) {
        const matchesAny = newConditions.educationTypes.some((et) =>
          ap.certType?.toLowerCase().includes(et.toLowerCase()),
        );
        if (!matchesAny) pushOnce('education_type_mismatch');
      }
    }
    return { impactedApplicants: impacted, conflicts };
  },

  /**
   * Save expanded conditions with optional override. When `override` is
   * true, audit emits `category_rules_changed_with_override`; otherwise it
   * emits `category_rules_changed`. Both carry old/new conditions.
   */
  async updateExpandedConditions(
    key: ApplicantCategoryKey,
    newConditions: CategoryConditions,
    options: { override?: boolean; impactedApplicantIds?: string[] } = {},
  ): Promise<ApplicantCategory> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    const before = { ...STATE[idx] };
    const next: ApplicantCategory = {
      ...before,
      expandedConditions: { ...newConditions },
    };
    STATE[idx] = next;
    emitAudit({
      action: options.override ? 'category_rules_changed_with_override' : 'category_rules_changed',
      module: 'categories',
      entityType: 'ApplicantCategory',
      entityLabel: 'فئة قبول',
      entityId: key,
      details: options.override
        ? `تعديل شروط فئة "${next.labelAr}" مع تجاوز ${options.impactedApplicantIds?.length ?? 0} متقدم متأثر`
        : `تعديل شروط فئة "${next.labelAr}"`,
      before: { expandedConditions: before.expandedConditions },
      after: { expandedConditions: next.expandedConditions },
    });
    return next;
  },

  /** Restore a previously soft-deleted category. */
  async restore(key: ApplicantCategoryKey): Promise<ApplicantCategory> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    const before = { ...STATE[idx] };
    const next = applyRestore(STATE[idx]);
    STATE[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'categories',
      entityType: 'ApplicantCategory',
      entityLabel: 'فئة قبول',
      entityId: key,
      details: `تم استعادة فئة "${next.labelAr}"`,
      before,
      after: next,
    });
    return next;
  },
};
