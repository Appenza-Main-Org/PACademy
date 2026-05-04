/**
 * INTEGRATION CONTRACT
 * GET    /api/v1/admin/workflows
 * GET    /api/v1/admin/workflows/{id}
 * POST   /api/v1/admin/workflows                    body: DepartmentWorkflow (no id/version)
 * PUT    /api/v1/admin/workflows/{id}               body: DepartmentWorkflow (bumps version)
 * DELETE /api/v1/admin/workflows/{id}
 * POST   /api/v1/admin/workflows/{id}/reorder       body: { stageIds: string[] }
 * POST   /api/v1/admin/workflows/{id}/apply         body: { scope: 'new' | 'all' }
 * Auth: super_admin or admin with `workflows:write`.
 * Audit: every mutation emits an AuditEntry (workflow.create / workflow.update /
 *        workflow.publish / workflow.reorder / workflow.delete).
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type {
  ApplicantWorkflowProgress,
  AuditAction,
  AuditEntry,
  DepartmentKey,
  DepartmentWorkflow,
  WorkflowStage,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';

/**
 * Live mutable state. We mutate MOCK.workflows in place so the cross-feature
 * applicant service (which reads MOCK.workflows for the transition validator)
 * always sees the latest definitions, without violating the
 * `shared/ → never features/` rule.
 */
const STATE: DepartmentWorkflow[] = MOCK.workflows;

let auditCounter = 1;

const ACTION_LABELS: Record<string, string> = {
  'workflow.create': 'إنشاء سير عمل',
  'workflow.update': 'تعديل سير عمل',
  'workflow.publish': 'نشر سير عمل',
  'workflow.reorder': 'إعادة ترتيب المراحل',
  'workflow.delete': 'حذف سير عمل',
  'applicant.transition': 'انتقال مرحلة المتقدم',
};

function pushAudit(
  entity: string,
  entityId: string,
  action: AuditAction,
  details: string,
): void {
  const entry: AuditEntry = {
    id: `AUDIT-WF-${Date.now()}-${auditCounter++}`,
    userId: 'U-001',
    userName: 'العميد د. أحمد محمود الفقي',
    action,
    actionLabel: ACTION_LABELS[action] ?? action,
    actionColor: action.endsWith('.delete') ? 'danger' : action.endsWith('.publish') ? 'warning' : 'info',
    entity,
    entityId,
    details,
    timestamp: Date.now(),
    ip: '10.0.0.1',
  };
  (MOCK.audit as AuditEntry[]).unshift(entry);
}

let stageCounter = 1000;
let testCounter = 1000;

function genStageId(): string {
  return `WSTG-NEW-${stageCounter++}`;
}

function genTestId(): string {
  return `WTST-NEW-${testCounter++}`;
}

/**
 * Re-key a stage list so every stage has the right `order` (1-based) after
 * insertion / deletion / drag-drop.
 */
export function rekeyStages(stages: WorkflowStage[]): WorkflowStage[] {
  return stages.map((s, i) => ({ ...s, order: i + 1 }));
}

export const workflowsService = {
  async list(): Promise<DepartmentWorkflow[]> {
    await simulateLatency();
    return [...STATE];
  },

  async getById(id: string): Promise<DepartmentWorkflow | null> {
    await simulateLatency();
    return STATE.find((wf) => wf.id === id) ?? null;
  },

  async getByDepartment(department: DepartmentKey): Promise<DepartmentWorkflow | null> {
    await simulateLatency();
    return STATE.find((wf) => wf.department === department && wf.isActive) ?? null;
  },

  async create(
    payload: Omit<DepartmentWorkflow, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'updatedBy'>,
  ): Promise<DepartmentWorkflow> {
    await simulateLatency();
    const now = new Date().toISOString();
    const wf: DepartmentWorkflow = {
      ...payload,
      id: `WF-NEW-${Date.now()}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: 'العميد د. أحمد محمود الفقي',
      stages: rekeyStages(
        payload.stages.map((s) => ({
          ...s,
          id: s.id || genStageId(),
          tests: s.tests.map((t) => ({ ...t, id: t.id || genTestId() })),
        })),
      ),
    };
    STATE.unshift(wf);
    pushAudit('DepartmentWorkflow', wf.id, 'workflow.create', `تم إنشاء "${wf.name}"`);
    return wf;
  },

  async save(id: string, payload: Partial<DepartmentWorkflow>): Promise<DepartmentWorkflow> {
    await simulateLatency();
    const idx = STATE.findIndex((wf) => wf.id === id);
    if (idx === -1) throw new Error('سير العمل غير موجود');
    const next: DepartmentWorkflow = {
      ...STATE[idx]!,
      ...payload,
      stages: payload.stages
        ? rekeyStages(
            payload.stages.map((s) => ({
              ...s,
              id: s.id || genStageId(),
              tests: s.tests.map((t) => ({ ...t, id: t.id || genTestId() })),
            })),
          )
        : STATE[idx]!.stages,
      version: STATE[idx]!.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'العميد د. أحمد محمود الفقي',
    };
    STATE[idx] = next;
    pushAudit('DepartmentWorkflow', id, 'workflow.update', `تم تعديل "${next.name}" (إصدار ${next.version})`);
    return next;
  },

  async reorderStages(id: string, stageIds: string[]): Promise<DepartmentWorkflow> {
    await simulateLatency();
    const idx = STATE.findIndex((wf) => wf.id === id);
    if (idx === -1) throw new Error('سير العمل غير موجود');
    const original = STATE[idx]!;
    const byId = new Map(original.stages.map((s) => [s.id, s] as const));
    const reordered = stageIds
      .map((sid) => byId.get(sid))
      .filter((s): s is WorkflowStage => Boolean(s));
    if (reordered.length !== original.stages.length) {
      throw new Error('قائمة المراحل غير متطابقة');
    }
    const next: DepartmentWorkflow = {
      ...original,
      stages: rekeyStages(reordered),
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = next;
    pushAudit('DepartmentWorkflow', id, 'workflow.reorder', `تم إعادة ترتيب مراحل "${next.name}"`);
    return next;
  },

  async apply(
    id: string,
    scope: 'new' | 'all',
  ): Promise<{ id: string; scope: 'new' | 'all'; affected: number }> {
    await simulateLatency();
    const wf = STATE.find((w) => w.id === id);
    if (!wf) throw new Error('سير العمل غير موجود');
    /* Mark as active and (in real backend) re-anchor existing applicants if
     * scope === 'all'. The mock counts applicants with a progress row tied
     * to this workflow; in production, the apply endpoint would migrate
     * `currentStageId` per the version bump rules. */
    const idx = STATE.findIndex((w) => w.id === id);
    STATE[idx] = { ...wf, isActive: true, updatedAt: new Date().toISOString() };
    const affected =
      scope === 'all'
        ? MOCK.applicantWorkflowProgress.filter((p) => p.workflowId === id).length
        : 0;
    pushAudit(
      'DepartmentWorkflow',
      id,
      'workflow.publish',
      scope === 'all'
        ? `نُشر "${wf.name}" — مع تطبيق على ${affected} متقدم حالي`
        : `نُشر "${wf.name}" — للمتقدمين الجدد فقط`,
    );
    return { id, scope, affected };
  },

  async remove(id: string): Promise<{ ok: true }> {
    await simulateLatency();
    const idx = STATE.findIndex((wf) => wf.id === id);
    if (idx === -1) throw new Error('سير العمل غير موجود');
    const [removed] = STATE.splice(idx, 1);
    pushAudit('DepartmentWorkflow', id, 'workflow.delete', `تم حذف "${removed!.name}"`);
    return { ok: true };
  },

  /* ── Cross-feature progress + transition state ──────────────────────────
   * Consumed by features/applicants/api/applicant.service.ts. Shared via
   * MOCK so both services stay in sync without circular imports. */
  getProgressState(): ApplicantWorkflowProgress[] {
    return MOCK.applicantWorkflowProgress as ApplicantWorkflowProgress[];
  },
  setProgressState(applicantId: string, next: ApplicantWorkflowProgress): void {
    const arr = MOCK.applicantWorkflowProgress as ApplicantWorkflowProgress[];
    const i = arr.findIndex((p) => p.applicantId === applicantId);
    if (i === -1) arr.push(next);
    else arr[i] = next;
  },
  getTransitionState(): WorkflowTransitionEvent[] {
    return MOCK.workflowTransitions as WorkflowTransitionEvent[];
  },
  appendTransition(event: WorkflowTransitionEvent): void {
    (MOCK.workflowTransitions as WorkflowTransitionEvent[]).unshift(event);
  },
};
