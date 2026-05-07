/**
 * Single source of truth for applicant status transitions.
 *
 * Both the §4 status-update dialog dropdown and the mock service's transition
 * endpoint route through `getAllowedTransitions()` so the UI never offers a
 * choice the backend would 422.
 *
 * Inputs:
 *   applicant — the row being mutated.
 *   progress  — workflow progress for the applicant (or null if untracked).
 *   workflow  — the active department workflow (or null if undecided).
 *   user      — the actor; gates the universal terminals + role-scoped paths.
 *
 * Output: an array of `{ status, reasonRequired, gateMessage? }`. A non-null
 *   `gateMessage` means the option should render but be disabled with the
 *   message as a helper line (e.g. "all required tests must pass first").
 */

import type {
  Applicant,
  ApplicantStatus,
  ApplicantWorkflowProgress,
  DepartmentWorkflow,
  WorkflowStage,
} from '@/shared/types/domain';
import type { AuthUser } from '@/features/auth/types';
import { hasPermission } from '@/features/auth/rbac';

export interface AllowedTransition {
  status: ApplicantStatus;
  reasonRequired: boolean;
  gateMessage?: string;
}

/* ── Universal terminal statuses available to specific roles ─────────────── */
const TERMINAL_OPTIONS: Array<{
  status: ApplicantStatus;
  permission: string;
  /** Roles for whom this terminal is also available even without the named perm. */
  roles?: AuthUser['role'][];
}> = [
  { status: 'on-hold', permission: '*', roles: ['super_admin'] },
  { status: 'rejected', permission: '*', roles: ['super_admin', 'board_admin'] },
];

export function getAllowedTransitions(
  applicant: Applicant,
  progress: ApplicantWorkflowProgress | null,
  workflow: DepartmentWorkflow | null,
  user: AuthUser,
): AllowedTransition[] {
  if (!user) return [];

  /* records_clerk has no transition rights anywhere. */
  if (user.role === 'records_clerk') return [];

  const out: AllowedTransition[] = [];
  const seen = new Set<ApplicantStatus>([applicant.status]);

  /* ── Workflow-driven options (per current stage) ──────────────────────── */
  const currentStage: WorkflowStage | null = progress && workflow
    ? workflow.stages.find((s) => s.id === progress.currentStageId) ?? null
    : null;

  if (currentStage) {
    /* committee_admin is constrained to stages owned by the committee app. */
    const allowedByRole = isStageAllowedForRole(currentStage, user);
    if (allowedByRole) {
      const allTestsPassed = areRequiredTestsPassed(currentStage, progress!);
      for (const next of currentStage.allowedNextStatuses) {
        if (seen.has(next)) continue;
        seen.add(next);
        out.push({
          status: next,
          reasonRequired: true,
          gateMessage: allTestsPassed
            ? undefined
            : 'يجب إنهاء الاختبارات الإلزامية للمرحلة الحالية أولاً',
        });
      }
    }
  } else if (workflow) {
    /* No active stage — fall back to the workflow's first stage's allowed
     * set, so admins can still resume an applicant who fell out of the loop. */
    const first = workflow.stages[0];
    if (first) {
      for (const next of first.allowedNextStatuses) {
        if (seen.has(next)) continue;
        seen.add(next);
        out.push({ status: next, reasonRequired: true });
      }
    }
  }

  /* ── Universal terminals (super_admin + board_admin) ──────────────────── */
  for (const term of TERMINAL_OPTIONS) {
    if (seen.has(term.status)) continue;
    const ok = (term.roles ?? []).includes(user.role) || hasPermission(user.permissions, term.permission);
    if (!ok) continue;
    seen.add(term.status);
    out.push({ status: term.status, reasonRequired: true });
  }

  return out;
}

/**
 * The next-stage convenience action: surface the *first* `allowedNextStatuses`
 * entry that is not gated. Returns null when no clean next step exists.
 */
export function getNextStageSuggestion(
  applicant: Applicant,
  progress: ApplicantWorkflowProgress | null,
  workflow: DepartmentWorkflow | null,
  user: AuthUser,
): AllowedTransition | null {
  const all = getAllowedTransitions(applicant, progress, workflow, user);
  /* Skip terminal/universal options; pick the first workflow-driven, ungated. */
  const ungated = all.find(
    (t) => !t.gateMessage && t.status !== 'rejected' && t.status !== 'on-hold',
  );
  return ungated ?? null;
}

function areRequiredTestsPassed(
  stage: WorkflowStage,
  progress: ApplicantWorkflowProgress,
): boolean {
  const requiredTestIds = stage.tests.filter((t) => t.required).map((t) => t.id);
  if (requiredTestIds.length === 0) return true;
  return requiredTestIds.every((id) =>
    progress.testResults.some(
      (r) => r.stageId === stage.id && r.testId === id && r.outcome === 'pass',
    ),
  );
}

function isStageAllowedForRole(stage: WorkflowStage, user: AuthUser): boolean {
  if (user.role === 'super_admin') return true;
  if (user.role === 'committee_admin') {
    /* committee_admin can transition stages whose tests are owned by their
     * committee, identified here as stages with at least one committee or
     * barcode/biometric-owned test. */
    return stage.tests.some(
      (t) => t.ownerApp === 'committee' || t.ownerApp === 'barcode' || t.ownerApp === 'biometric',
    );
  }
  if (user.role === 'medical_admin') return stage.tests.some((t) => t.ownerApp === 'medical');
  if (user.role === 'board_admin') return stage.tests.some((t) => t.ownerApp === 'board');
  if (user.role === 'exams_admin') return stage.tests.some((t) => t.ownerApp === 'exams');
  /* Other roles: deny by default. */
  return false;
}
