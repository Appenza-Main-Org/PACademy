/**
 * Admin Categories API Contract.
 *
 * Admin-side read + edit over MOCK.categories. Per RFP §2.1 the platform
 * supports a closed set of 4 applicant categories (officers_general,
 * law_bachelor, physical_education_bachelor, specialized_officers); admins
 * cannot create, duplicate, or delete categories. Only `labelAr` /
 * `description` / `expandedConditions` are editable.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/categories                          → ApplicantCategory[]
 *   PATCH  /api/admin/categories/:key                     → ApplicantCategory
 *
 * (POST / DELETE are intentionally absent — the category set is locked.)
 */

import { apiClient } from '@/shared/api';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
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
import { APPLICANT_CATEGORY_KEYS } from '@/shared/types/domain';

const SPEC_KEYS: ReadonlySet<ApplicantCategoryKey> = new Set<ApplicantCategoryKey>(
  APPLICANT_CATEGORY_KEYS,
);

const STATE: ApplicantCategory[] = MOCK.categories.map((c) => ({ ...c }));
let auditCounter = 1;

/* Backend `GET /admin/categories` returns CategoryListItemDto[]; GET by-key
 * returns CategoryDetailDto. Both carry NameAr/NameEn (frontend uses labelAr/
 * labelEn) and a base64 `rowVersion`. CategoryDetailDto also carries the
 * Conditions / RequiredTests / Procedures JSON blobs. The frontend
 * ApplicantCategory has runtime-only fields (isOpen, conditions simple form)
 * the backend doesn't carry — we merge the backend response onto the MOCK
 * base so those defaults come through. */
interface BackendCategoryListItem {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  isSpec: boolean;
  rowVersion: string;
}
interface BackendCategoryDetail extends BackendCategoryListItem {
  description: string | null;
  conditions: unknown;
  requiredTests: unknown;
  procedures: unknown;
  createdAt: string;
  updatedAt: string;
  demoOrigin: boolean;
}

function mockBaseFor(key: string): ApplicantCategory | undefined {
  return STATE.find((c) => c.key === key);
}

function mergeBackendList(items: BackendCategoryListItem[]): ApplicantCategory[] {
  return items.map((b) => {
    const base = mockBaseFor(b.key);
    if (!base) {
      /* Backend has a key the frontend mock doesn't seed — defensive
       * shaping so consumers don't blow up on a missing record. */
      return {
        key: b.key as ApplicantCategoryKey,
        labelAr: b.nameAr,
        labelEn: b.nameEn ?? '',
        description: '',
        isOpen: false,
        conditions: { gender: 'any', minAge: null, maxAge: null } as never,
        requiredTests: [],
        procedures: [],
        rowVersion: b.rowVersion,
      } as unknown as ApplicantCategory;
    }
    return {
      ...base,
      labelAr: b.nameAr,
      labelEn: b.nameEn ?? base.labelEn,
      rowVersion: b.rowVersion,
    };
  });
}

function mergeBackendDetail(b: BackendCategoryDetail): ApplicantCategory {
  const base = mockBaseFor(b.key);
  const fallback: ApplicantCategory = (base ?? {
    key: b.key as ApplicantCategoryKey,
    labelAr: b.nameAr,
    labelEn: b.nameEn ?? '',
    description: b.description ?? '',
    isOpen: false,
    conditions: { gender: 'any', minAge: null, maxAge: null } as never,
    requiredTests: [],
    procedures: [],
  } as unknown as ApplicantCategory);
  return {
    ...fallback,
    labelAr: b.nameAr,
    labelEn: b.nameEn ?? fallback.labelEn,
    description: b.description ?? fallback.description,
    /* The backend Conditions blob is parsed opportunistically: if it has a
     * `gender` field we treat it as the Gap G expandedConditions; otherwise
     * keep MOCK's value. RequiredTests + Procedures fall back to MOCK on a
     * non-array. */
    expandedConditions:
      b.conditions && typeof b.conditions === 'object' && 'gender' in (b.conditions as object)
        ? (b.conditions as CategoryConditions)
        : fallback.expandedConditions,
    requiredTests: Array.isArray(b.requiredTests)
      ? (b.requiredTests as ApplicantCategory['requiredTests'])
      : fallback.requiredTests,
    procedures: Array.isArray(b.procedures)
      ? (b.procedures as ApplicantCategory['procedures'])
      : fallback.procedures,
    rowVersion: b.rowVersion,
  };
}

function pushAudit(categoryKey: string, details: string): void {
  const entry: AuditEntry = {
    id: `AUDIT-CAT-${Date.now()}-${auditCounter++}`,
    userId: 'U-001',
    userName: 'العميد د. أحمد محمود الفقي',
    action: 'update',
    actionLabel: 'تعديل',
    actionColor: 'info',
    entity: 'ApplicantCategory',
    entityId: categoryKey,
    details,
    timestamp: Date.now(),
    ip: '10.0.0.1',
  };
  (MOCK.audit as AuditEntry[]).unshift(entry);
}

const CLOSED_SET_MESSAGE = 'فئات المتقدمين مغلقة حسب كراسة الشروط ولا يمكن إنشاء أو حذف فئات';

export const categoriesAdminService = {
  /**
   * Real backend GET /admin/categories. Returns the locked 4-category set as
   * seeded by DemoDataSeeder, merged with the frontend MOCK base so runtime-
   * only fields (isOpen, conditions simple form) survive. Falls back to MOCK
   * on network error — keeps the demo resilient while the backend is offline.
   */
  async list(opts: { includeDeleted?: boolean } = {}): Promise<ApplicantCategory[]> {
    try {
      const r = await apiClient.get<BackendCategoryListItem[]>('/admin/categories');
      return mergeBackendList(r.data);
    } catch {
      await simulateLatency();
      return filterDeleted(STATE, opts.includeDeleted).map((c) => ({ ...c }));
    }
  },

  async getByKey(key: ApplicantCategoryKey): Promise<ApplicantCategory | null> {
    try {
      const r = await apiClient.get<BackendCategoryDetail>(`/admin/categories/by-key/${key}`);
      return mergeBackendDetail(r.data);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
      /* Other errors — fall back to MOCK so the demo keeps rendering. */
      return STATE.find((c) => c.key === key) ?? null;
    }
  },

  async update(key: ApplicantCategoryKey, patch: Partial<ApplicantCategory>): Promise<ApplicantCategory> {
    /* Real backend PATCH /admin/categories/by-key/{key}. The backend accepts
     * NameAr / NameEn / Description / Conditions / RequiredTests / Procedures
     * / SortOrder / IsActive / RowVersion. Frontend-only fields (isOpen,
     * conditions simple form) are ignored on the wire and preserved by the
     * mapper from the MOCK base. */
    const body: Record<string, unknown> = {};
    if (patch.labelAr !== undefined) body.nameAr = patch.labelAr;
    if (patch.labelEn !== undefined) body.nameEn = patch.labelEn;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.expandedConditions !== undefined) body.conditions = patch.expandedConditions;
    if (patch.requiredTests !== undefined) body.requiredTests = patch.requiredTests;
    if (patch.procedures !== undefined) body.procedures = patch.procedures;
    if (patch.rowVersion !== undefined) body.rowVersion = patch.rowVersion;

    try {
      const r = await apiClient.patch<BackendCategoryDetail>(
        `/admin/categories/by-key/${key}`, body,
      );
      const merged = mergeBackendDetail(r.data);
      /* Keep the local STATE in sync so any consumer that still reads from
       * MOCK during the same session sees the latest values. */
      const idx = STATE.findIndex((c) => c.key === key);
      if (idx !== -1) STATE[idx] = merged;
      pushAudit(key, `تم تعديل بيانات فئة "${merged.labelAr}"`);
      return merged;
    } catch {
      /* Legacy mock fallback — write to MOCK so the UI updates even if the
       * backend is offline. */
      await simulateLatency();
      const idx = STATE.findIndex((c) => c.key === key);
      if (idx === -1) throw new Error('الفئة غير موجودة');
      const current = STATE[idx]!;
      const next: ApplicantCategory = { ...current, ...patch, key: current.key };
      STATE[idx] = next;
      pushAudit(key, `تم تعديل بيانات فئة "${next.labelAr}"`);
      return next;
    }
  },

  /**
   * Per RFP §2.1 every category in the system is one of the 4
   * authoritative RFP categories. Kept so existing call sites that use
   * the check to gate delete/clone affordances continue to read `true`
   * and hide those buttons.
   */
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
   * Per RFP §2.1 the 4-category set is locked — soft-delete always rejects.
   * Kept so existing query hooks (`useCategorySoftDelete`) and the
   * shared list-action plumbing stay wired without conditional logic.
   */
  async softDelete(_key: ApplicantCategoryKey, _reason: string): Promise<ApplicantCategory> {
    await simulateLatency();
    throw new Error(CLOSED_SET_MESSAGE);
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
    const before = { ...STATE[idx]! };
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

  /**
   * Per RFP §2.1 the 4-category set is locked — restore always rejects
   * (nothing is ever soft-deleted). Kept so existing query hooks stay wired.
   */
  async restore(_key: ApplicantCategoryKey): Promise<ApplicantCategory> {
    await simulateLatency();
    throw new Error(CLOSED_SET_MESSAGE);
  },
};
