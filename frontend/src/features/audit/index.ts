/**
 * Audit feature — public API barrel.
 *
 * `audit.service`/`audit.queries` are deep-imported by sibling features
 * (admin pages, applicants emit chains) for historical reasons; new
 * consumers should reach for the symbols re-exported here.
 */

export { auditService } from './api/audit.service';
export type { AuditFilters } from './api/audit.service';
export {
  auditKeys,
  useAuditActions,
  useAuditDiff,
  useAuditEntityTypes,
  useAuditEntry,
  useAuditLog,
  useAuditModules,
  useAuditRoles,
  useAuditUsers,
} from './api/audit.queries';
export { AuditDiffDrawer } from './components/AuditDiffDrawer';
export type { AuditDiffDrawerProps } from './components/AuditDiffDrawer';
export { AUDIT_FIELD_LABELS, fieldLabel } from './components/fieldLabels';
