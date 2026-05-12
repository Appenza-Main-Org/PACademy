/**
 * Admission Setup API Contract — net-new entities for steps 9, 11, 13, 15.
 *
 * Composed steps (1–8, 12, 14) reuse `cyclesService`, `categoriesService`,
 * `committeeService`, `examPlansService`, `notificationsService` directly;
 * this service only owns the four shapes defined in `../types.ts` that
 * have no admin-gaps home today.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admission-setup/cycles/:cycleId/merge-split-rules     → CommitteeMergeSplitRule[]
 *   POST   /api/admission-setup/cycles/:cycleId/merge-split-rules     → CommitteeMergeSplitRule
 *   DELETE /api/admission-setup/merge-split-rules/:id                 → { ok: true }   (soft delete)
 *
 *   GET    /api/admission-setup/cycles/:cycleId/score-thresholds      → CommitteeScoreThreshold[]
 *   PUT    /api/admission-setup/cycles/:cycleId/committees/:cid/score → CommitteeScoreThreshold
 *
 *   GET    /api/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig | null
 *   PUT    /api/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig
 *
 *   GET    /api/admission-setup/cycles/:cycleId/total-score           → TotalScoreConfig[]
 *   PUT    /api/admission-setup/cycles/:cycleId/total-score/:stream   → TotalScoreConfig
 *
 *   GET    /api/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration | null
 *   PUT    /api/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration
 *   POST   /api/admission-setup/declarations/:id/publish              → ElectronicDeclaration
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
  applySoftDelete,
  filterDeleted,
} from '@/shared/lib/soft-delete';
import { committeeService } from '@/features/committees';
import type { Committee } from '@/shared/types/domain';
import type {
  ApplicantStream,
  CommitteeMergeSplitRule,
  CommitteeScoreThreshold,
  ElectronicDeclaration,
  ExamDateConfig,
  TotalScoreComponent,
  TotalScoreConfig,
} from '../types';

/* ── In-memory state — replaced by REST persistence at integration time. ── */
const MERGE_SPLIT_RULES: CommitteeMergeSplitRule[] = [];
const EXAM_DATE_CONFIGS: ExamDateConfig[] = [];
const TOTAL_SCORE_CONFIGS: TotalScoreConfig[] = [];
const DECLARATIONS: ElectronicDeclaration[] = [];

let counter = 1;
function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${counter++}`;
}

function actorId(): string {
  /* The auth bridge in `audit.ts` already knows the actor; keep a sentinel
   * here for createdBy/updatedBy fields the audit system doesn't fill. */
  return 'system';
}

export const admissionSetupService = {
  /* ── Step 9 — committee merge / split rules ───────────────────────── */
  async listMergeSplitRules(cycleId: string): Promise<CommitteeMergeSplitRule[]> {
    await simulateLatency();
    return filterDeleted(MERGE_SPLIT_RULES.filter((r) => r.cycleId === cycleId));
  },

  async createMergeOrSplit(input: {
    cycleId: string;
    type: 'merge' | 'split';
    sourceCommitteeIds: string[];
    targetCommitteeIds: string[];
    reason?: string;
    effectiveAt: string;
  }): Promise<CommitteeMergeSplitRule> {
    await simulateLatency();
    if (input.type === 'merge') {
      if (input.sourceCommitteeIds.length < 2) {
        throw new Error('يتطلب الدمج اختيار لجنتين على الأقل من المصادر');
      }
      if (input.targetCommitteeIds.length !== 1) {
        throw new Error('يتطلب الدمج لجنة هدف واحدة فقط');
      }
    } else {
      if (input.sourceCommitteeIds.length !== 1) {
        throw new Error('يتطلب الفصل لجنة مصدر واحدة فقط');
      }
      if (input.targetCommitteeIds.length < 2) {
        throw new Error('يتطلب الفصل لجنتين هدف على الأقل');
      }
    }
    const rule: CommitteeMergeSplitRule = {
      id: id('CMS'),
      cycleId: input.cycleId,
      type: input.type,
      status: 'planned',
      sourceCommitteeIds: [...input.sourceCommitteeIds],
      targetCommitteeIds: [...input.targetCommitteeIds],
      reason: input.reason,
      effectiveAt: input.effectiveAt,
      createdAt: new Date().toISOString(),
      createdBy: actorId(),
      rowVersion: 'AAAAAAAAAAA=',
    };
    MERGE_SPLIT_RULES.unshift(rule);
    emitAudit({
      action: input.type === 'merge' ? 'create' : 'create',
      module: 'committees',
      entityType: 'CommitteeMergeSplitRule',
      entityLabel: input.type === 'merge' ? 'دمج لجان' : 'فصل لجنة',
      entityId: rule.id,
      details:
        input.type === 'merge'
          ? `تم دمج ${input.sourceCommitteeIds.length} لجان في لجنة هدف`
          : `تم فصل لجنة إلى ${input.targetCommitteeIds.length} لجان جديدة`,
      after: rule,
    });
    return rule;
  },

  async softDeleteMergeSplit(ruleId: string, reason: string): Promise<{ ok: true }> {
    await simulateLatency();
    const idx = MERGE_SPLIT_RULES.findIndex((r) => r.id === ruleId);
    if (idx === -1) throw new Error('القاعدة غير موجودة');
    const before = { ...MERGE_SPLIT_RULES[idx] };
    MERGE_SPLIT_RULES[idx] = applySoftDelete(MERGE_SPLIT_RULES[idx], { reason });
    emitAudit({
      action: 'soft_delete',
      module: 'committees',
      entityType: 'CommitteeMergeSplitRule',
      entityLabel: before.type === 'merge' ? 'دمج لجان' : 'فصل لجنة',
      entityId: ruleId,
      details: `تم حذف القاعدة — السبب: ${reason}`,
      before,
      after: MERGE_SPLIT_RULES[idx],
    });
    return { ok: true };
  },

  /* ── Step 10 — committee score thresholds ─────────────────────────── */
  async listScoreThresholds(cycleId: string): Promise<CommitteeScoreThreshold[]> {
    await simulateLatency();
    const cycleCommittees = await committeeService.list();
    return cycleCommittees
      .filter((c: Committee) => !c.linkedCycleId || c.linkedCycleId === cycleId)
      .map((c: Committee) => {
        const m = c.scoreCriteria?.magmoo3;
        return {
          cycleId,
          committeeId: c.id,
          min: m?.min ?? 0,
          max: m?.max ?? 0,
          updatedAt: new Date().toISOString(),
          updatedBy: actorId(),
          rowVersion: 'AAAAAAAAAAA=',
        } satisfies CommitteeScoreThreshold;
      });
  },

  async setCommitteeScoreThresholds(input: {
    cycleId: string;
    committeeId: string;
    min: number;
    max: number;
  }): Promise<CommitteeScoreThreshold> {
    await simulateLatency();
    if (input.min >= input.max) {
      throw new Error('الحد الأدنى يجب أن يكون أقل من الحد الأقصى');
    }
    if (input.min < 0 || input.max < 0) {
      throw new Error('الدرجات لا يمكن أن تكون سالبة');
    }
    const before = await committeeService.getById(input.committeeId);
    if (!before) throw new Error('اللجنة غير موجودة');
    const next: Committee = {
      ...before,
      scoreCriteria: {
        ...(before.scoreCriteria ?? {}),
        magmoo3: { min: input.min, max: input.max },
      },
    };
    await committeeService.update(input.committeeId, next);
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'CommitteeScoreThreshold',
      entityLabel: 'درجات قبول لجنة',
      entityId: input.committeeId,
      details: `تم ضبط درجات القبول للجنة "${before.name}" — من ${input.min} إلى ${input.max}`,
      before: before.scoreCriteria,
      after: next.scoreCriteria,
    });
    return {
      cycleId: input.cycleId,
      committeeId: input.committeeId,
      min: input.min,
      max: input.max,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId(),
      rowVersion: 'AAAAAAAAAAA=',
    };
  },

  /* ── Step 11 — exam date config ───────────────────────────────────── */
  async getExamDateConfig(cycleId: string): Promise<ExamDateConfig | null> {
    await simulateLatency();
    return EXAM_DATE_CONFIGS.find((c) => c.cycleId === cycleId) ?? null;
  },

  async setExamDateConfig(input: {
    cycleId: string;
    firstAvailableDate: string;
    bookableDays: string[];
    blackoutDates: string[];
  }): Promise<ExamDateConfig> {
    await simulateLatency();
    if (input.bookableDays.length === 0) {
      throw new Error('يجب إضافة يوم واحد على الأقل من أيام التقديم');
    }
    const firstTs = new Date(input.firstAvailableDate).getTime();
    if (Number.isNaN(firstTs)) {
      throw new Error('تاريخ أول ميعاد متاح غير صالح');
    }
    const earlyDay = input.bookableDays.find((d) => new Date(d).getTime() < firstTs);
    if (earlyDay) {
      throw new Error('جميع أيام التقديم يجب أن تكون في تاريخ أول ميعاد متاح أو بعده');
    }
    const stray = input.blackoutDates.find((d) => !input.bookableDays.includes(d));
    if (stray) {
      throw new Error('أيام الإجازة يجب أن تكون ضمن أيام التقديم المختارة');
    }
    const idx = EXAM_DATE_CONFIGS.findIndex((c) => c.cycleId === input.cycleId);
    const next: ExamDateConfig = {
      id: idx === -1 ? id('EDC') : EXAM_DATE_CONFIGS[idx].id,
      cycleId: input.cycleId,
      firstAvailableDate: input.firstAvailableDate,
      bookableDays: [...input.bookableDays].sort(),
      blackoutDates: [...input.blackoutDates].sort(),
      updatedAt: new Date().toISOString(),
      updatedBy: actorId(),
      rowVersion: 'AAAAAAAAAAA=',
    };
    const before = idx === -1 ? null : EXAM_DATE_CONFIGS[idx];
    if (idx === -1) EXAM_DATE_CONFIGS.unshift(next);
    else EXAM_DATE_CONFIGS[idx] = next;
    emitAudit({
      action: idx === -1 ? 'create' : 'update',
      module: 'cycles',
      entityType: 'ExamDateConfig',
      entityLabel: 'مواعيد الاختبارات',
      entityId: next.id,
      details: `تم ضبط ${input.bookableDays.length} يوم تقديم${input.blackoutDates.length > 0 ? ` و${input.blackoutDates.length} يوم إجازة` : ''}`,
      before,
      after: next,
    });
    return next;
  },

  /* ── Step 13 — total-score config (per applicant stream) ───────────── */
  async listTotalScoreConfigs(cycleId: string): Promise<TotalScoreConfig[]> {
    await simulateLatency();
    return TOTAL_SCORE_CONFIGS.filter((c) => c.cycleId === cycleId);
  },

  async setTotalScoreConfig(input: {
    cycleId: string;
    applicantStream: ApplicantStream;
    components: TotalScoreComponent[];
    totalScoreOutOf: number;
  }): Promise<TotalScoreConfig> {
    await simulateLatency();
    if (input.components.length === 0) {
      throw new Error('يجب إضافة اختبار واحد على الأقل');
    }
    const sum = input.components.reduce((acc, c) => acc + c.weight, 0);
    if (sum !== 100) {
      throw new Error(`مجموع الأوزان يجب أن يكون 100 — المجموع الحالي ${sum}`);
    }
    const bad = input.components.find((c) => c.weight < 0 || c.weight > 100);
    if (bad) throw new Error(`وزن الاختبار "${bad.examKey}" خارج النطاق 0–100`);
    if (input.totalScoreOutOf <= 0) {
      throw new Error('المجموع الكلي يجب أن يكون أكبر من صفر');
    }
    const idx = TOTAL_SCORE_CONFIGS.findIndex(
      (c) => c.cycleId === input.cycleId && c.applicantStream === input.applicantStream,
    );
    const next: TotalScoreConfig = {
      id: idx === -1 ? id('TSC') : TOTAL_SCORE_CONFIGS[idx].id,
      cycleId: input.cycleId,
      applicantStream: input.applicantStream,
      components: input.components.map((c) => ({ ...c })),
      totalScoreOutOf: input.totalScoreOutOf,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId(),
      rowVersion: 'AAAAAAAAAAA=',
    };
    const before = idx === -1 ? null : TOTAL_SCORE_CONFIGS[idx];
    if (idx === -1) TOTAL_SCORE_CONFIGS.unshift(next);
    else TOTAL_SCORE_CONFIGS[idx] = next;
    emitAudit({
      action: idx === -1 ? 'create' : 'update',
      module: 'cycles',
      entityType: 'TotalScoreConfig',
      entityLabel: 'وزن المجموع الكلي',
      entityId: next.id,
      details: `تم ضبط ${input.components.length} مكون لاحتساب المجموع الكلي للفئة "${input.applicantStream}"`,
      before,
      after: next,
    });
    return next;
  },

  /* ── Step 15 — electronic declaration ────────────────────────────── */
  async getDeclaration(cycleId: string): Promise<ElectronicDeclaration | null> {
    await simulateLatency();
    const cur = DECLARATIONS.filter((d) => d.cycleId === cycleId && !d.deletedAt)
      .sort((a, b) => b.version - a.version)[0];
    return cur ?? null;
  },

  async setDeclaration(input: {
    cycleId: string;
    bodyAr: string;
    effectiveFrom: string;
  }): Promise<ElectronicDeclaration> {
    await simulateLatency();
    if (!input.bodyAr.trim()) {
      throw new Error('نص الإقرار لا يمكن أن يكون فارغاً');
    }
    const previous = await admissionSetupService.getDeclaration(input.cycleId);
    const version = previous ? previous.version + 1 : 1;
    const next: ElectronicDeclaration = {
      id: id('DEC'),
      cycleId: input.cycleId,
      bodyAr: input.bodyAr,
      version,
      effectiveFrom: input.effectiveFrom,
      createdAt: new Date().toISOString(),
      createdBy: actorId(),
      rowVersion: 'AAAAAAAAAAA=',
    };
    DECLARATIONS.unshift(next);
    emitAudit({
      action: 'update',
      module: 'cycles',
      entityType: 'ElectronicDeclaration',
      entityLabel: 'الإقرار الإلكتروني',
      entityId: next.id,
      details: `تم حفظ النسخة رقم ${version} من الإقرار الإلكتروني`,
      before: previous,
      after: next,
    });
    return next;
  },

  async publishDeclaration(declarationId: string): Promise<ElectronicDeclaration> {
    await simulateLatency();
    const idx = DECLARATIONS.findIndex((d) => d.id === declarationId);
    if (idx === -1) throw new Error('الإقرار غير موجود');
    const before = { ...DECLARATIONS[idx] };
    DECLARATIONS[idx] = {
      ...DECLARATIONS[idx],
      publishedAt: new Date().toISOString(),
    };
    emitAudit({
      action: 'notification_published',
      module: 'cycles',
      entityType: 'ElectronicDeclaration',
      entityLabel: 'الإقرار الإلكتروني',
      entityId: declarationId,
      details: `تم نشر النسخة رقم ${before.version} من الإقرار الإلكتروني`,
      before,
      after: DECLARATIONS[idx],
    });
    return DECLARATIONS[idx];
  },
};
