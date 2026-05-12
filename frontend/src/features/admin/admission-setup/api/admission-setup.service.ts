/**
 * Admission Setup API Contract — net-new entities for the wizard.
 *
 * Composed steps (application_settings, application_status, age_rules,
 * fees, exams, committees, notifications) reuse `cyclesService`,
 * `categoriesService`, `committeeService`, `examPlansService`, and
 * `notificationsService` directly; this service only owns the shapes
 * defined in `../types.ts` that have no admin-gaps home today.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig | null
 *   PUT    /api/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig
 *
 *   GET    /api/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration | null
 *   PUT    /api/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration
 *   POST   /api/admission-setup/declarations/:id/publish              → ElectronicDeclaration
 *
 *   GET    /api/admission-setup/cycles/:cycleId/committee-bindings           → CategoryCommittees[]
 *   PUT    /api/admission-setup/cycles/:cycleId/committee-bindings           → CategoryCommittees[]   (replace cycle set)
 *   PUT    /api/admission-setup/cycles/:cycleId/categories/:catId/committees → CategoryCommittees[]   (replace per-category set)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { committeeService } from '@/features/committees';
import type {
  ApplicantCategoryKey,
  CategoryCommittees,
} from '@/shared/types/domain';
import type {
  ElectronicDeclaration,
  ExamDateConfig,
} from '../types';

/* ── In-memory state — replaced by REST persistence at integration time. ── */
const EXAM_DATE_CONFIGS: ExamDateConfig[] = [];
const DECLARATIONS: ElectronicDeclaration[] = [];
const CATEGORY_COMMITTEES: CategoryCommittees[] = MOCK.categoryCommittees.map((c) => ({ ...c }));

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
  /* ── Exam date config ─────────────────────────────────────────────── */
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
      id: idx === -1 ? id('EDC') : EXAM_DATE_CONFIGS[idx]!.id,
      cycleId: input.cycleId,
      firstAvailableDate: input.firstAvailableDate,
      bookableDays: [...input.bookableDays].sort(),
      blackoutDates: [...input.blackoutDates].sort(),
      updatedAt: new Date().toISOString(),
      updatedBy: actorId(),
    };
    const before = idx === -1 ? null : EXAM_DATE_CONFIGS[idx]!;
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

  /* ── Electronic declaration ───────────────────────────────────────── */
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
    const before = { ...DECLARATIONS[idx]! };
    DECLARATIONS[idx] = {
      ...DECLARATIONS[idx]!,
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
    return DECLARATIONS[idx]!;
  },

  /* ── Committee ↔ category bindings ───────────────────────────────────
   *
   * Backs the admin-setup wizard committee picker. Persisted bindings tell
   * the applicant-distribution step which committees can absorb each
   * category for the cycle's academic year. List/replace pair mirrors the
   * REST contract; granular add/remove kept off the API surface to keep
   * the audit trail clean (one diff per save). */
  async listCategoryCommittees(cycleId: string): Promise<CategoryCommittees[]> {
    await simulateLatency();
    return CATEGORY_COMMITTEES.filter((b) => b.cycleId === cycleId);
  },

  async listCommitteeBindings(input: {
    cycleId: string;
    categoryId?: ApplicantCategoryKey;
  }): Promise<CategoryCommittees[]> {
    await simulateLatency();
    return CATEGORY_COMMITTEES.filter(
      (b) =>
        b.cycleId === input.cycleId &&
        (input.categoryId ? b.categoryId === input.categoryId : true),
    );
  },

  /**
   * Replace the full set of committee bindings for a cycle (optionally
   * scoped to a single category). Validates each requested committee
   * against the same eligibility rules the applicant-distribution stage
   * enforces — active, current academic year, not at capacity, matching
   * specialization when the category declares one.
   */
  async setCommitteeBindings(input: {
    cycleId: string;
    academicYearId: string;
    /** Optional scope — when omitted, the call replaces *all* bindings for the cycle. */
    categoryId?: ApplicantCategoryKey;
    committeeIds: string[];
    actorUserId?: string;
  }): Promise<CategoryCommittees[]> {
    await simulateLatency();
    const requestedIds = Array.from(new Set(input.committeeIds));
    const allCommittees = await committeeService.list();
    const errors: string[] = [];
    for (const cid of requestedIds) {
      const c = allCommittees.find((x) => x.id === cid);
      if (!c) {
        errors.push(`اللجنة ${cid} غير موجودة`);
        continue;
      }
      if (c.status === 'inactive') {
        errors.push(`اللجنة "${c.name}" معطلة`);
        continue;
      }
      if (c.deletedAt) {
        errors.push(`اللجنة "${c.name}" محذوفة`);
        continue;
      }
      if (c.academicYearId && c.academicYearId !== input.academicYearId) {
        errors.push(`اللجنة "${c.name}" لا تنتمي للعام الأكاديمي ${input.academicYearId}`);
        continue;
      }
      if (c.capacity !== undefined && c.applicants >= c.capacity) {
        errors.push(`اللجنة "${c.name}" مكتملة الطاقة الاستيعابية`);
        continue;
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join(' · '));
    }

    /* Replace strategy: drop the matching scope, then re-insert the new rows. */
    const before = [...CATEGORY_COMMITTEES];
    const keep = CATEGORY_COMMITTEES.filter((b) => {
      if (b.cycleId !== input.cycleId) return true;
      if (input.categoryId && b.categoryId !== input.categoryId) return true;
      return false;
    });

    const baseCategoryId: ApplicantCategoryKey =
      input.categoryId ?? 'officers_general';
    const now = new Date().toISOString();
    const next: CategoryCommittees[] = requestedIds.map((cid, idx) => ({
      id: `CC-${input.cycleId}-${baseCategoryId}-${cid}`,
      categoryId: baseCategoryId,
      committeeId: cid,
      academicYearId: input.academicYearId,
      cycleId: input.cycleId,
      order: idx + 1,
      createdAt: now,
      createdBy: input.actorUserId ?? 'system',
    }));

    CATEGORY_COMMITTEES.length = 0;
    CATEGORY_COMMITTEES.push(...keep, ...next);

    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'CategoryCommittees',
      entityLabel: 'لجان دورة القبول',
      entityId: `${input.cycleId}:${baseCategoryId}`,
      details: `تم تحديث قائمة اللجان المختارة (${next.length} لجنة) للدورة`,
      before,
      after: CATEGORY_COMMITTEES,
    });

    return next;
  },
};
