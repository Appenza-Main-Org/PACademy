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
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
  AuditEntry,
} from '@/shared/types/domain';

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
  (MOCK.audit as AuditEntry[]).unshift(entry);
}

export const categoriesAdminService = {
  async list(): Promise<ApplicantCategory[]> {
    await simulateLatency();
    return STATE.map((c) => ({ ...c }));
  },

  async getByKey(key: ApplicantCategoryKey): Promise<ApplicantCategory | null> {
    await simulateLatency();
    return STATE.find((c) => c.key === key) ?? null;
  },

  async update(key: ApplicantCategoryKey, patch: Partial<ApplicantCategory>): Promise<ApplicantCategory> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    /* The spec key, labelAr, and nominationOnly are immutable for spec departments. */
    const current = STATE[idx]!;
    const isSpec = SPEC_KEYS.has(key);
    const next: ApplicantCategory = isSpec
      ? {
          ...current,
          ...patch,
          key: current.key,
          labelAr: current.labelAr,
          conditions: {
            ...current.conditions,
            ...patch.conditions,
            nominationOnly: current.conditions.nominationOnly,
          },
        }
      : ({ ...current, ...patch, key: current.key } as ApplicantCategory);
    STATE[idx] = next;
    pushAudit('update', key, `تم تعديل بيانات فئة "${next.labelAr}"`);
    return next;
  },

  async create(payload: ApplicantCategory): Promise<ApplicantCategory> {
    await simulateLatency();
    if (STATE.some((c) => c.key === payload.key)) {
      throw new Error('مفتاح الفئة موجود بالفعل');
    }
    STATE.push({ ...payload });
    pushAudit('create', payload.key, `تم إنشاء فئة "${payload.labelAr}"`);
    return { ...payload };
  },

  async remove(key: ApplicantCategoryKey): Promise<{ ok: true }> {
    await simulateLatency();
    if (SPEC_KEYS.has(key)) {
      throw new Error('لا يمكن حذف فئات السبع المعتمدة من المواصفات');
    }
    const idx = STATE.findIndex((c) => c.key === key);
    if (idx === -1) throw new Error('الفئة غير موجودة');
    const [removed] = STATE.splice(idx, 1);
    pushAudit('delete', key, `تم حذف فئة "${removed!.labelAr}"`);
    return { ok: true };
  },

  isSpecCategory(key: ApplicantCategoryKey): boolean {
    return SPEC_KEYS.has(key);
  },
};
