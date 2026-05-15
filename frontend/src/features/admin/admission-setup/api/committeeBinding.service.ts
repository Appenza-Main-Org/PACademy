/**
 * Committee × Day Binding service — per-(cycle × category × committee ×
 * day) row carrying capacity + mode-branched eligibility.
 *
 * The cycle-level roster (committee↔category binding) is managed by the
 * roster sub-tab via `admissionSetupService.setCommitteeBindings(...)`.
 * This service owns the per-day grid that sits on top of that roster.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/committee-bindings/cycles/:cycleId
 *          ?categoryId=:id&committeeId=:id&dayId=:id&onlyActive=:bool   → CommitteeDayBinding[]
 *   POST   /api/admin/committee-bindings                                 → CommitteeDayBinding
 *          body: { cycleId, applicantCategoryId, committeeId,
 *                  examScheduleDayId, capacity, eligibility, isActive,
 *                  note }
 *   PATCH  /api/admin/committee-bindings/:id                             → CommitteeDayBinding
 *          body: Partial<{capacity, eligibility, isActive, note}>
 *   DELETE /api/admin/committee-bindings/:id                             → 204
 *   POST   /api/admin/committee-bindings/:id/toggle-active               → CommitteeDayBinding
 *   POST   /api/admin/committee-bindings/bulk-eligibility                → { updated }
 *          body: { cycleId, applicantCategoryId, targets,
 *                  eligibility, capacity?, overwrite }
 *   POST   /api/admin/committee-bindings/copy-row                        → { created, skipped }
 *          body: { cycleId, applicantCategoryId, sourceCommitteeId,
 *                  targetCommitteeId, overwrite }
 *   POST   /api/admin/committee-bindings/copy-column                     → { created, skipped }
 *          body: { cycleId, applicantCategoryId, sourceDayId,
 *                  targetDayId, overwrite }
 *
 * Conflicts (mirrored in `docs/DB_CONSTRAINTS.md §13`):
 *   - 409 DUPLICATE_BINDING          unique (cycleId, committeeId, dayId)
 *   - 409 CAPACITY_NOT_POSITIVE      capacity > 0
 *   - 409 GRADE_RANGE_INVERTED       min ≤ max (GRADES) or band-floor ≤ (TAGDIR)
 *   - 409 PERCENTAGE_OUT_OF_RANGE    0 ≤ min,max ≤ 100 for GRADES
 *   - 409 TAGDIR_GRADE_NOT_FOUND     both ids resolve to academic-grades rows
 *   - 409 MODE_MISMATCH              eligibility.gradeKind ≠ category gradingMode
 *   - 409 DAY_NOT_WORKING            day must be kind === 'WORKING'
 *   - 409 COMMITTEE_WRONG_CATEGORY   committee in cycle's roster for category
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { ConflictError } from '@/shared/lib/errors';
import { emitAudit } from '@/shared/lib/audit';
import { readPercentageRange } from '@/features/lookups';
import { resolveCategoryGradingMode } from '../lib/resolveGradingMode';
import { COMMITTEE_DAY_BINDINGS_SEED } from '../mock/committeeBindings.mock';
import type {
  BindingConflict,
  BindingEligibility,
  CommitteeDayBinding,
} from '../types';

/* ── In-memory mutable mirror ────────────────────────────────────────── */

let bindings: CommitteeDayBinding[] = COMMITTEE_DAY_BINDINGS_SEED.map((b) => ({
  ...b,
}));

let counter = bindings.length + 1;
function nextId(): string {
  return `CDB-${Date.now()}-${counter++}`;
}

function now(): string {
  return new Date().toISOString();
}

/* ── Validation ──────────────────────────────────────────────────────── */

function throwConflict(
  code: BindingConflict,
  payload: Record<string, unknown>,
  message: string,
): never {
  throw new ConflictError(code, payload, message);
}

function ensurePositiveCapacity(capacity: number): void {
  if (!Number.isFinite(capacity) || !Number.isInteger(capacity) || capacity <= 0) {
    throwConflict(
      'CAPACITY_NOT_POSITIVE',
      { capacity },
      'السعة يجب أن تكون أكبر من صفر',
    );
  }
}

function ensureCommitteeInRoster(input: {
  cycleId: string;
  applicantCategoryId: string;
  committeeId: string;
}): void {
  const inRoster = MOCK.categoryCommittees.some(
    (r) =>
      r.cycleId === input.cycleId &&
      r.categoryId === input.applicantCategoryId &&
      r.committeeId === input.committeeId,
  );
  if (!inRoster) {
    throwConflict(
      'COMMITTEE_WRONG_CATEGORY',
      input,
      'اللجنة تنتمي إلى فئة أخرى',
    );
  }
}

function ensureDayWorking(input: {
  cycleId: string;
  applicantCategoryId: string;
  examScheduleDayId: string;
}): void {
  const day = MOCK.examScheduleDays.find((d) => d.id === input.examScheduleDayId);
  if (
    !day ||
    day.cycleId !== input.cycleId ||
    day.applicantCategoryId !== input.applicantCategoryId ||
    day.kind !== 'WORKING'
  ) {
    throwConflict(
      'DAY_NOT_WORKING',
      input,
      'لا يمكن الربط بيوم عطلة',
    );
  }
}

function ensureEligibilityValid(input: {
  applicantCategoryId: string;
  eligibility: BindingEligibility;
}): void {
  const mode = resolveCategoryGradingMode(input.applicantCategoryId, {
    categoryLookup: MOCK.lookups['applicant-categories'],
    submissionTypeLookup: MOCK.lookups['submission-types'],
  });
  if (mode !== null && mode !== input.eligibility.gradeKind) {
    throwConflict(
      'MODE_MISMATCH',
      { expected: mode, got: input.eligibility.gradeKind },
      'نمط الأهلية لا يطابق نوع تقديم الفئة',
    );
  }

  if (input.eligibility.gradeKind === 'GRADES') {
    const { minPercentage, maxPercentage } = input.eligibility;
    if (
      !Number.isFinite(minPercentage) ||
      !Number.isFinite(maxPercentage) ||
      minPercentage < 0 ||
      minPercentage > 100 ||
      maxPercentage < 0 ||
      maxPercentage > 100
    ) {
      throwConflict(
        'PERCENTAGE_OUT_OF_RANGE',
        { minPercentage, maxPercentage },
        'الدرجة المئوية يجب أن تكون بين 0 و 100',
      );
    }
    if (minPercentage > maxPercentage) {
      throwConflict(
        'GRADE_RANGE_INVERTED',
        { minPercentage, maxPercentage },
        'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
      );
    }
    return;
  }

  /* TAGDIR */
  const { minAcademicGradeId, maxAcademicGradeId } = input.eligibility;
  const grades = MOCK.lookups['academic-grades'];
  const minRow = grades.find((g) => g.code === minAcademicGradeId);
  const maxRow = grades.find((g) => g.code === maxAcademicGradeId);
  if (!minRow || !maxRow) {
    throwConflict(
      'TAGDIR_GRADE_NOT_FOUND',
      { minAcademicGradeId, maxAcademicGradeId },
      'التقدير المختار غير موجود',
    );
  }
  const minRange = readPercentageRange(minRow);
  const maxRange = readPercentageRange(maxRow);
  if (!minRange || !maxRange) {
    throwConflict(
      'TAGDIR_GRADE_NOT_FOUND',
      { minAcademicGradeId, maxAcademicGradeId },
      'التقدير المختار غير موجود',
    );
  }
  /* Floor-of-band comparator — AcademicGradeRow has no sort_order. */
  if (minRange.min > maxRange.min) {
    throwConflict(
      'GRADE_RANGE_INVERTED',
      { minAcademicGradeId, maxAcademicGradeId },
      'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
    );
  }
}

function ensureUnique(input: {
  cycleId: string;
  committeeId: string;
  examScheduleDayId: string;
  excludeId?: string;
}): void {
  const clash = bindings.find(
    (b) =>
      b.cycleId === input.cycleId &&
      b.committeeId === input.committeeId &&
      b.examScheduleDayId === input.examScheduleDayId &&
      b.id !== input.excludeId,
  );
  if (clash) {
    throwConflict(
      'DUPLICATE_BINDING',
      { existingId: clash.id },
      'اللجنة مربوطة بالفعل بهذا اليوم',
    );
  }
}

function audit(
  action: 'create' | 'update' | 'delete',
  entityId: string,
  details: string,
  before: CommitteeDayBinding | null,
  after: CommitteeDayBinding | null,
): void {
  emitAudit({
    action,
    module: 'cycles',
    entityType: 'CommitteeDayBinding',
    entityLabel: 'ربط لجنة بيوم اختبار',
    entityId,
    details,
    before,
    after,
  });
}

/* ── Public service ──────────────────────────────────────────────────── */

export interface BindingListFilters {
  cycleId: string;
  applicantCategoryId?: string;
  committeeId?: string;
  examScheduleDayId?: string;
  onlyActive?: boolean;
}

export interface CreateBindingInput {
  cycleId: string;
  applicantCategoryId: string;
  committeeId: string;
  examScheduleDayId: string;
  capacity: number;
  eligibility: BindingEligibility;
  isActive?: boolean;
  note?: string | null;
}

export type UpdateBindingPatch = Partial<{
  capacity: number;
  eligibility: BindingEligibility;
  isActive: boolean;
  note: string | null;
}>;

export interface BulkEligibilityInput {
  cycleId: string;
  applicantCategoryId: string;
  /** Per-target cell address — `examScheduleDayId` may be `'*'` (all
   *  days) and `committeeId` may be `'*'` (all committees). */
  targets: Array<{ committeeId: string; examScheduleDayId: string }>;
  eligibility: BindingEligibility;
  /** Optional uniform capacity to apply alongside the eligibility. */
  capacity?: number;
  /** When `true`, existing bindings are overwritten; when `false`, only
   *  empty cells are written. */
  overwrite: boolean;
}

export interface CopyAxisInput {
  cycleId: string;
  applicantCategoryId: string;
  sourceCommitteeId?: string;
  targetCommitteeId?: string;
  sourceDayId?: string;
  targetDayId?: string;
  overwrite: boolean;
}

export const committeeBindingService = {
  async list(filters: BindingListFilters): Promise<CommitteeDayBinding[]> {
    await simulateLatency();
    return bindings
      .filter((b) => {
        if (b.cycleId !== filters.cycleId) return false;
        if (
          filters.applicantCategoryId &&
          b.applicantCategoryId !== filters.applicantCategoryId
        )
          return false;
        if (filters.committeeId && b.committeeId !== filters.committeeId)
          return false;
        if (
          filters.examScheduleDayId &&
          b.examScheduleDayId !== filters.examScheduleDayId
        )
          return false;
        if (filters.onlyActive && !b.isActive) return false;
        return true;
      })
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  async create(input: CreateBindingInput): Promise<CommitteeDayBinding> {
    await simulateLatency();
    ensureCommitteeInRoster(input);
    ensureDayWorking(input);
    ensurePositiveCapacity(input.capacity);
    ensureEligibilityValid(input);
    ensureUnique(input);

    const row: CommitteeDayBinding = {
      id: nextId(),
      cycleId: input.cycleId,
      applicantCategoryId: input.applicantCategoryId,
      committeeId: input.committeeId,
      examScheduleDayId: input.examScheduleDayId,
      capacity: input.capacity,
      eligibility: input.eligibility,
      isActive: input.isActive ?? true,
      note: input.note ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    bindings = [...bindings, row];
    audit('create', row.id, 'إضافة ربط لجنة بيوم اختبار', null, row);
    return { ...row };
  },

  async update(
    id: string,
    patch: UpdateBindingPatch,
  ): Promise<CommitteeDayBinding> {
    await simulateLatency();
    const idx = bindings.findIndex((b) => b.id === id);
    if (idx < 0) {
      throw new Error('Binding not found');
    }
    const current = bindings[idx]!;
    const next: CommitteeDayBinding = {
      ...current,
      ...patch,
      updatedAt: now(),
    };
    if (patch.capacity !== undefined) ensurePositiveCapacity(next.capacity);
    if (patch.eligibility) {
      ensureEligibilityValid({
        applicantCategoryId: next.applicantCategoryId,
        eligibility: next.eligibility,
      });
    }
    bindings = bindings.map((b, i) => (i === idx ? next : b));
    audit('update', next.id, 'تحديث ربط لجنة بيوم اختبار', current, next);
    return { ...next };
  },

  async delete(id: string): Promise<void> {
    await simulateLatency();
    const target = bindings.find((b) => b.id === id);
    if (!target) return;
    bindings = bindings.filter((b) => b.id !== id);
    audit('delete', target.id, 'حذف ربط لجنة بيوم اختبار', target, null);
  },

  async toggleActive(id: string): Promise<CommitteeDayBinding> {
    await simulateLatency();
    const idx = bindings.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error('Binding not found');
    const current = bindings[idx]!;
    const next: CommitteeDayBinding = {
      ...current,
      isActive: !current.isActive,
      updatedAt: now(),
    };
    bindings = bindings.map((b, i) => (i === idx ? next : b));
    audit(
      'update',
      next.id,
      next.isActive ? 'تفعيل ربط' : 'تعطيل ربط',
      current,
      next,
    );
    return { ...next };
  },

  /**
   * Apply a uniform eligibility (and optional capacity) over a target
   * selection of (committee × day) cells. Targets use `'*'` as the
   * "all" sentinel on either axis. When `overwrite` is false, only
   * empty cells are filled.
   */
  async bulkSetEligibility(
    input: BulkEligibilityInput,
  ): Promise<{ updated: number; created: number; skipped: number }> {
    await simulateLatency();
    ensureEligibilityValid(input);
    if (input.capacity !== undefined) ensurePositiveCapacity(input.capacity);

    /* Expand `'*'` wildcards into the concrete (committee × workingDay)
     * grid for this category. Source of truth:
     *   - committees → cycle's CategoryCommittees roster for category
     *   - days       → ExamScheduleDays kind === 'WORKING' for (cycle, category)
     */
    const rosterCommitteeIds = MOCK.categoryCommittees
      .filter(
        (r) =>
          r.cycleId === input.cycleId &&
          r.categoryId === input.applicantCategoryId,
      )
      .map((r) => r.committeeId);
    const workingDayIds = MOCK.examScheduleDays
      .filter(
        (d) =>
          d.cycleId === input.cycleId &&
          d.applicantCategoryId === input.applicantCategoryId &&
          d.kind === 'WORKING',
      )
      .map((d) => d.id);

    type Cell = { committeeId: string; examScheduleDayId: string };
    const expanded: Cell[] = [];
    for (const t of input.targets) {
      const cIds =
        t.committeeId === '*' ? rosterCommitteeIds : [t.committeeId];
      const dIds = t.examScheduleDayId === '*' ? workingDayIds : [t.examScheduleDayId];
      for (const committeeId of cIds) {
        for (const examScheduleDayId of dIds) {
          expanded.push({ committeeId, examScheduleDayId });
        }
      }
    }

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const cell of expanded) {
      const existing = bindings.find(
        (b) =>
          b.cycleId === input.cycleId &&
          b.committeeId === cell.committeeId &&
          b.examScheduleDayId === cell.examScheduleDayId,
      );
      if (existing) {
        if (!input.overwrite) {
          skipped += 1;
          continue;
        }
        const next: CommitteeDayBinding = {
          ...existing,
          eligibility: input.eligibility,
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          updatedAt: now(),
        };
        bindings = bindings.map((b) => (b.id === existing.id ? next : b));
        audit('update', next.id, 'تحديث جماعي لأهلية الربط', existing, next);
        updated += 1;
      } else {
        try {
          /* eslint-disable-next-line no-await-in-loop */
          await this.create({
            cycleId: input.cycleId,
            applicantCategoryId: input.applicantCategoryId,
            committeeId: cell.committeeId,
            examScheduleDayId: cell.examScheduleDayId,
            capacity: input.capacity ?? 1,
            eligibility: input.eligibility,
            isActive: true,
            note: null,
          });
          created += 1;
        } catch {
          skipped += 1;
        }
      }
    }

    return { updated, created, skipped };
  },

  /**
   * Copy every binding from one committee row into another, for the same
   * (cycle, category). Skips cells that don't exist on the source.
   */
  async copyRow(
    input: CopyAxisInput & {
      sourceCommitteeId: string;
      targetCommitteeId: string;
    },
  ): Promise<{ created: number; updated: number; skipped: number }> {
    await simulateLatency();
    if (input.sourceCommitteeId === input.targetCommitteeId) {
      return { created: 0, updated: 0, skipped: 0 };
    }
    const sourceRows = bindings.filter(
      (b) =>
        b.cycleId === input.cycleId &&
        b.applicantCategoryId === input.applicantCategoryId &&
        b.committeeId === input.sourceCommitteeId,
    );
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const src of sourceRows) {
      const existing = bindings.find(
        (b) =>
          b.cycleId === input.cycleId &&
          b.committeeId === input.targetCommitteeId &&
          b.examScheduleDayId === src.examScheduleDayId,
      );
      if (existing) {
        if (!input.overwrite) {
          skipped += 1;
          continue;
        }
        const next: CommitteeDayBinding = {
          ...existing,
          capacity: src.capacity,
          eligibility: src.eligibility,
          updatedAt: now(),
        };
        bindings = bindings.map((b) => (b.id === existing.id ? next : b));
        audit('update', next.id, 'نسخ ربط من لجنة أخرى', existing, next);
        updated += 1;
      } else {
        try {
          /* eslint-disable-next-line no-await-in-loop */
          await this.create({
            cycleId: src.cycleId,
            applicantCategoryId: src.applicantCategoryId,
            committeeId: input.targetCommitteeId,
            examScheduleDayId: src.examScheduleDayId,
            capacity: src.capacity,
            eligibility: src.eligibility,
            isActive: src.isActive,
            note: src.note,
          });
          created += 1;
        } catch {
          skipped += 1;
        }
      }
    }

    return { created, updated, skipped };
  },

  /**
   * Copy every binding from one day column into another, for the same
   * (cycle, category). Skips cells that don't exist on the source day.
   */
  async copyColumn(
    input: CopyAxisInput & {
      sourceDayId: string;
      targetDayId: string;
    },
  ): Promise<{ created: number; updated: number; skipped: number }> {
    await simulateLatency();
    if (input.sourceDayId === input.targetDayId) {
      return { created: 0, updated: 0, skipped: 0 };
    }
    const sourceRows = bindings.filter(
      (b) =>
        b.cycleId === input.cycleId &&
        b.applicantCategoryId === input.applicantCategoryId &&
        b.examScheduleDayId === input.sourceDayId,
    );
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const src of sourceRows) {
      const existing = bindings.find(
        (b) =>
          b.cycleId === input.cycleId &&
          b.committeeId === src.committeeId &&
          b.examScheduleDayId === input.targetDayId,
      );
      if (existing) {
        if (!input.overwrite) {
          skipped += 1;
          continue;
        }
        const next: CommitteeDayBinding = {
          ...existing,
          capacity: src.capacity,
          eligibility: src.eligibility,
          updatedAt: now(),
        };
        bindings = bindings.map((b) => (b.id === existing.id ? next : b));
        audit('update', next.id, 'نسخ ربط من يوم آخر', existing, next);
        updated += 1;
      } else {
        try {
          /* eslint-disable-next-line no-await-in-loop */
          await this.create({
            cycleId: src.cycleId,
            applicantCategoryId: src.applicantCategoryId,
            committeeId: src.committeeId,
            examScheduleDayId: input.targetDayId,
            capacity: src.capacity,
            eligibility: src.eligibility,
            isActive: src.isActive,
            note: src.note,
          });
          created += 1;
        } catch {
          skipped += 1;
        }
      }
    }

    return { created, updated, skipped };
  },
};
