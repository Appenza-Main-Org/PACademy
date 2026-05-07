/**
 * Audit emission helpers — Gap E (admin-gaps).
 *
 * Every mutation in admin services should run through `withAudit()` (or call
 * `emitAudit()` directly when the snapshot is not bound to a callable). The
 * helper computes a deterministic id, stamps the actor from the auth store,
 * and unshifts the entry into `MOCK.audit` so `/admin/audit` picks it up on
 * the next refetch.
 *
 * INTEGRATION CONTRACT:
 *   POST /api/audit  — append-only.
 *   Real backend rejects update/delete on audit rows; the same rule is
 *   reflected in `auditService` (no `update*` / `softDelete*` methods exist).
 */

import { MOCK } from '@/shared/mock-data';
import type { AuditAction, AuditColor, AuditEntry, AuditModule } from '@/shared/types/domain';
import { AUDIT_ACTIONS } from '@/shared/mock-data/dictionaries';

/**
 * Auth actor — feature-side bridge. The auth feature registers a provider
 * via `setAuditActorProvider(...)` at bootstrap so this shared helper does
 * not need to import `@/features/auth` (Clean Arch rule).
 */
export interface AuditActor {
  id: string;
  name: string;
  role?: string;
}

let actorProvider: () => AuditActor | null = () => null;

export function setAuditActorProvider(fn: () => AuditActor | null): void {
  actorProvider = fn;
}

export interface AuditDescriptor<TBefore = unknown, TAfter = unknown> {
  action: AuditAction;
  module: AuditModule;
  /** Typed entity name (`cycle`, `category`, …). */
  entityType: string;
  /** Arabic entity label rendered in the audit UI. */
  entityLabel: string;
  entityId: string;
  details: string;
  /** Pre-mutation snapshot. Optional — many actions only have an `after`. */
  before?: TBefore;
  /** Post-mutation snapshot. */
  after?: TAfter;
  /** Optional override for the actor (defaults to the registered auth provider). */
  actor?: AuditActor;
  /** Optional device metadata (UA hint, station id, …). */
  deviceMeta?: string;
}

let counter = 1;

/* Default action label/color falls back to the AUDIT_ACTIONS dictionary
 * (legacy 6 actions) and a sensible default for the new Gap E actions. */
const ACTION_FALLBACK: Record<AuditAction, { label: string; color: AuditColor }> = {
  create: { label: 'إدراج', color: 'success' },
  update: { label: 'تعديل', color: 'info' },
  delete: { label: 'حذف', color: 'danger' },
  view: { label: 'استعلام', color: 'neutral' },
  login: { label: 'تسجيل دخول', color: 'neutral' },
  export: { label: 'تصدير', color: 'warning' },
  'workflow.create': { label: 'إنشاء سير العمل', color: 'success' },
  'workflow.update': { label: 'تعديل سير العمل', color: 'info' },
  'workflow.publish': { label: 'نشر سير العمل', color: 'success' },
  'workflow.reorder': { label: 'إعادة ترتيب المراحل', color: 'info' },
  'workflow.delete': { label: 'حذف سير العمل', color: 'danger' },
  'applicant.transition': { label: 'تحديث حالة المتقدم', color: 'warning' },
  soft_delete: { label: 'حذف ناعم', color: 'warning' },
  restore: { label: 'استعادة', color: 'success' },
  login_success: { label: 'دخول ناجح', color: 'success' },
  login_failed: { label: 'محاولة دخول فاشلة', color: 'danger' },
  account_locked: { label: 'إيقاف الحساب', color: 'danger' },
  account_unlocked: { label: 'إعادة تفعيل الحساب', color: 'success' },
  otp_sent: { label: 'إرسال رمز التحقق', color: 'info' },
  otp_verified: { label: 'تحقق من الرمز', color: 'success' },
  otp_failed: { label: 'فشل التحقق من الرمز', color: 'danger' },
  cycle_activated: { label: 'تفعيل دورة', color: 'success' },
  cycle_closed: { label: 'إغلاق دورة', color: 'warning' },
  cycle_extended: { label: 'تمديد دورة', color: 'info' },
  cycle_archived: { label: 'أرشفة دورة', color: 'neutral' },
  category_rules_changed: { label: 'تعديل شروط فئة', color: 'info' },
  category_rules_changed_with_override: { label: 'تعديل شروط فئة (تجاوز)', color: 'warning' },
  notification_published: { label: 'نشر إشعار', color: 'success' },
  notification_unpublished: { label: 'سحب إشعار', color: 'warning' },
  payment_status_changed: { label: 'تحديث حالة الدفع', color: 'info' },
  payment_refunded: { label: 'إعادة مقابل مالي', color: 'warning' },
};

function resolveActionLabel(action: AuditAction): { label: string; color: AuditColor } {
  /* Prefer the dictionary so dictionaries.ts stays the single source of truth
   * for the legacy 6 actions; fall back to ACTION_FALLBACK for new ones. */
  const dict = AUDIT_ACTIONS.find((a) => a.action === action);
  if (dict) return { label: dict.label, color: dict.color };
  return ACTION_FALLBACK[action];
}

/**
 * Synchronously appends an audit row. Returns the appended entry.
 * Use directly when no callable mutation is involved (e.g. login events).
 */
export function emitAudit(descriptor: AuditDescriptor): AuditEntry {
  const actor = descriptor.actor ?? deriveActor();
  const ts = Date.now();
  const labels = resolveActionLabel(descriptor.action);
  const entry: AuditEntry = {
    id: `AUD-X-${ts}-${counter++}`,
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: descriptor.action,
    actionLabel: labels.label,
    actionColor: labels.color,
    module: descriptor.module,
    entity: descriptor.entityLabel,
    entityType: descriptor.entityType,
    entityId: descriptor.entityId,
    details: descriptor.details,
    before: descriptor.before,
    after: descriptor.after,
    timestamp: ts,
    at: new Date(ts).toISOString(),
    ip: '10.0.0.1',
    deviceMeta: descriptor.deviceMeta,
  };
  (MOCK.audit as AuditEntry[]).unshift(entry);
  return entry;
}

/**
 * Wraps a mutation callable so its result is captured as the audit `after`.
 * The descriptor's `before` is captured eagerly (caller passes the snapshot);
 * the callable's return value is stored as `after`. Throws are re-thrown
 * unmodified — failed mutations don't emit. Use `emitAudit` for failure
 * cases that must still log (e.g. `login_failed`).
 */
export async function withAudit<TResult>(
  mutationFn: () => Promise<TResult> | TResult,
  descriptor: Omit<AuditDescriptor, 'after'> & { afterFrom?: (r: TResult) => unknown },
): Promise<TResult> {
  const result = await mutationFn();
  emitAudit({
    ...descriptor,
    after: descriptor.afterFrom ? descriptor.afterFrom(result) : result,
  });
  return result;
}

function deriveActor(): AuditActor {
  const provided = actorProvider();
  if (provided) return provided;
  return { id: 'system', name: 'النظام', role: 'system' };
}
