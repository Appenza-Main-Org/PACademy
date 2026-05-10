/**
 * Validation rules for the workflow editor.
 *
 * Errors block save. Warnings allow save.
 */

import type { ApplicantStatus, WorkflowStage } from '@/shared/types/domain';

export type ValidationKind = 'error' | 'warning';

export interface ValidationFinding {
  kind: ValidationKind;
  stageId?: string;
  message: string;
}

/* Statuses that don't progress forward — workflow ends ("approved" / "rejected")
 * or pauses until manually released ("on-hold"). All three are always-reachable
 * from any stage and don't need a downstream stage to "host" them. */
const TERMINAL_STATUSES: ApplicantStatus[] = ['approved', 'rejected', 'on-hold'];

export function validateStages(stages: WorkflowStage[]): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (stages.length === 0) {
    findings.push({ kind: 'error', message: 'يجب إضافة مرحلة واحدة على الأقل.' });
    return findings;
  }

  /* (1) Each stage has at least one required test (warning only). */
  for (const s of stages) {
    if (!s.tests.some((t) => t.required)) {
      findings.push({
        kind: 'warning',
        stageId: s.id,
        message: `المرحلة "${s.name}" لا تحتوي على اختبار إلزامي.`,
      });
    }
  }

  /* (2) Duplicate statusOnEnter — error. */
  const statusToStage = new Map<ApplicantStatus, WorkflowStage>();
  for (const s of stages) {
    const existing = statusToStage.get(s.statusOnEnter);
    if (existing) {
      findings.push({
        kind: 'error',
        stageId: s.id,
        message: `الحالة "${s.statusOnEnter}" مكررة بين المرحلتين "${existing.name}" و "${s.name}".`,
      });
    } else {
      statusToStage.set(s.statusOnEnter, s);
    }
  }

  /* (3) allowedNextStatuses must point either to a terminal status or to a
   *     status that exists on a later stage. */
  const reachableSet = new Set<ApplicantStatus>(TERMINAL_STATUSES);
  /* Forward pass — every later stage's statusOnEnter is reachable. */
  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    const laterStatuses = new Set<ApplicantStatus>([
      ...TERMINAL_STATUSES,
      ...stages.slice(i + 1).map((s) => s.statusOnEnter),
      stage.statusOnEnter,
    ]);
    for (const next of stage.allowedNextStatuses) {
      if (!laterStatuses.has(next)) {
        findings.push({
          kind: 'error',
          stageId: stage.id,
          message: `الحالة المسموح بها "${next}" لا تنتمي لأي مرحلة لاحقة.`,
        });
      }
      reachableSet.add(next);
    }
  }

  /* (4) Cyclic transitions detection — DFS over a graph where each stage's
   *     statusOnEnter has edges to allowedNextStatuses, and each next status
   *     resolves back to whichever stage carries that statusOnEnter. */
  const stageByStatus = new Map<ApplicantStatus, WorkflowStage>();
  for (const s of stages) stageByStatus.set(s.statusOnEnter, s);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (stage: WorkflowStage): boolean => {
    if (visiting.has(stage.id)) return true;
    if (visited.has(stage.id)) return false;
    visiting.add(stage.id);
    stack.push(stage.id);
    for (const nextStatus of stage.allowedNextStatuses) {
      if (TERMINAL_STATUSES.includes(nextStatus)) continue;
      const target = stageByStatus.get(nextStatus);
      if (target && target.id !== stage.id && dfs(target)) return true;
    }
    visiting.delete(stage.id);
    stack.pop();
    visited.add(stage.id);
    return false;
  };

  for (const s of stages) {
    if (!visited.has(s.id) && dfs(s)) {
      findings.push({
        kind: 'error',
        stageId: s.id,
        message: `تم اكتشاف حلقة في مراحل سير العمل ابتداءً من "${s.name}".`,
      });
      break;
    }
  }

  return findings;
}

export function hasErrors(findings: ValidationFinding[]): boolean {
  return findings.some((f) => f.kind === 'error');
}
