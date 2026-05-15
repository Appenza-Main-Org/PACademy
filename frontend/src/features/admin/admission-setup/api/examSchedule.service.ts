/**
 * Exam Schedule — per-category calendar service (mock).
 *
 * Per-cycle, per-category list of WORKING / OFF days. Pure calendar —
 * no capacity. Same calendar date CAN exist across different
 * categories; uniqueness is `(cycleId, applicantCategoryId, date)`.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/exam-schedule/cycles/:cycleId?categoryId=:id           → ExamScheduleDay[]
 *   POST   /api/admin/exam-schedule/cycles/:cycleId/bulk
 *            body: { applicantCategoryId, startDate, endDate, note }         → { created, skippedExistingDates }
 *   POST   /api/admin/exam-schedule/cycles/:cycleId/days
 *            body: { applicantCategoryId, date, kind, note }                 → ExamScheduleDay
 *   PATCH  /api/admin/exam-schedule/days/:dayId                              → ExamScheduleDay
 *   DELETE /api/admin/exam-schedule/days/:dayId                              → 204
 *   POST   /api/admin/exam-schedule/days/:dayId/toggle-off                   → ExamScheduleDay
 *   POST   /api/admin/exam-schedule/cycles/:cycleId/clear-range
 *            body: { applicantCategoryId, startDate, endDate }               → { deleted }
 *   POST   /api/admin/exam-schedule/cycles/:cycleId/copy-from-category
 *            body: { sourceCategoryId, targetCategoryId, overwrite }         → { created, skipped }
 *
 * Conflicts (mirrored in `docs/DB_CONSTRAINTS.md §12`):
 *   - 409 DUPLICATE_DATE              unique (cycleId, applicantCategoryId, date)
 *   - 409 DATE_OUT_OF_CYCLE_WINDOW    date BETWEEN cycle.openDate AND cycle.closeDate
 *   - 409 INVALID_DATE_RANGE          endDate >= startDate
 *   - 409 CATEGORY_NOT_ACTIVE         applicant_category_id must be active for this cycle
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { ConflictError } from '@/shared/lib/errors';
import { emitAudit } from '@/shared/lib/audit';
import type {
  ExamScheduleDay,
  DayKind,
} from '../types';
import { WEEKEND_DAY_INDICES } from '../types';

/* ── In-memory mutable mirror ────────────────────────────────────────── */

let days: ExamScheduleDay[] = MOCK.examScheduleDays.map((d) => ({ ...d }));

let counter = days.length + 1;
function nextId(): string {
  return `ESD-${Date.now()}-${counter++}`;
}

/* ── Date helpers ────────────────────────────────────────────────────── */

/** Returns ISO yyyy-mm-dd from a Date or a parseable string. */
function toIsoDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Inclusive range of yyyy-mm-dd strings between two dates. */
function isoDateRange(startIso: string, endIso: string): string[] {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const out: string[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    out.push(toIsoDate(cursor));
  }
  return out;
}

function isWeekendIso(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return WEEKEND_DAY_INDICES.includes(d.getUTCDay());
}

/* ── Active-category & cycle window validation ───────────────────────── */

function ensureCategoryActive(applicantCategoryId: string): void {
  const config = MOCK.applicantCategoryConfigs.find(
    (c) => c.categoryId === applicantCategoryId,
  );
  if (!config || !config.isActive) {
    throw new ConflictError(
      'CATEGORY_NOT_ACTIVE',
      { applicantCategoryId },
      'الفئة غير مفعّلة في إعدادات الدورة',
    );
  }
}

function ensureDateWithinCycle(cycleId: string, isoDate: string): void {
  const cycle = MOCK.cycles.find((c) => c.id === cycleId);
  if (!cycle) {
    /* Cycle must exist for any write; treat missing as a window error
     * (the backend will reject with a similar code). */
    throw new ConflictError(
      'DATE_OUT_OF_CYCLE_WINDOW',
      { cycleId, isoDate },
      'الدورة غير موجودة',
    );
  }
  const open = toIsoDate(cycle.openDate);
  const close = toIsoDate(cycle.closeDate);
  if (isoDate < open || isoDate > close) {
    throw new ConflictError(
      'DATE_OUT_OF_CYCLE_WINDOW',
      { cycleId, isoDate, open, close },
      'التاريخ خارج نطاق الدورة',
    );
  }
}

function ensureRangeValid(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw new ConflictError(
      'INVALID_DATE_RANGE',
      { startDate, endDate },
      'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
    );
  }
}

/* ── Audit helper ────────────────────────────────────────────────────── */

function audit(
  action: 'create' | 'update' | 'delete',
  entityId: string,
  details: string,
  before: ExamScheduleDay | null,
  after: ExamScheduleDay | null,
): void {
  emitAudit({
    action,
    module: 'cycles',
    entityType: 'ExamScheduleDay',
    entityLabel: 'يوم اختبار',
    entityId,
    details,
    before,
    after,
  });
}

/* ── Service ─────────────────────────────────────────────────────────── */

export const examScheduleService = {
  async listDays(
    cycleId: string,
    applicantCategoryId: string,
  ): Promise<ExamScheduleDay[]> {
    await simulateLatency();
    return days
      .filter(
        (d) =>
          d.cycleId === cycleId && d.applicantCategoryId === applicantCategoryId,
      )
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Aggregate snapshot for the step-status check — every day row in
   * the cycle plus the active category ids derived from step 1.
   *
   * Single-call aggregate so the launcher / wizard rail don't need to
   * fan out one query per active category to learn whether the step
   * is complete.
   */
  async aggregateForCycle(cycleId: string): Promise<{
    activeCategoryIds: string[];
    days: ExamScheduleDay[];
  }> {
    await simulateLatency();
    const activeCategoryIds = MOCK.applicantCategoryConfigs
      .filter((c) => c.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.categoryId);
    const cycleDays = days.filter((d) => d.cycleId === cycleId);
    return { activeCategoryIds, days: cycleDays };
  },

  async generateBulk(input: {
    cycleId: string;
    applicantCategoryId: string;
    startDate: string;
    endDate: string;
    note: string | null;
  }): Promise<{ created: ExamScheduleDay[]; skippedExistingDates: string[] }> {
    await simulateLatency();
    ensureRangeValid(input.startDate, input.endDate);
    ensureCategoryActive(input.applicantCategoryId);
    ensureDateWithinCycle(input.cycleId, input.startDate);
    ensureDateWithinCycle(input.cycleId, input.endDate);

    const existing = new Set(
      days
        .filter(
          (d) =>
            d.cycleId === input.cycleId &&
            d.applicantCategoryId === input.applicantCategoryId,
        )
        .map((d) => d.date),
    );

    const created: ExamScheduleDay[] = [];
    const skipped: string[] = [];
    const now = new Date().toISOString();

    for (const iso of isoDateRange(input.startDate, input.endDate)) {
      if (existing.has(iso)) {
        skipped.push(iso);
        continue;
      }
      const kind: DayKind = isWeekendIso(iso) ? 'OFF' : 'WORKING';
      const row: ExamScheduleDay = {
        id: nextId(),
        cycleId: input.cycleId,
        applicantCategoryId: input.applicantCategoryId,
        date: iso,
        kind,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      };
      days.push(row);
      created.push(row);
    }

    audit(
      'create',
      `bulk-${input.cycleId}-${input.applicantCategoryId}`,
      `تم توليد ${created.length} يوم (${skipped.length} تخطي) للفئة ${input.applicantCategoryId}`,
      null,
      null,
    );

    return { created, skippedExistingDates: skipped };
  },

  async addDay(
    cycleId: string,
    applicantCategoryId: string,
    input: { date: string; kind: DayKind; note: string | null },
  ): Promise<ExamScheduleDay> {
    await simulateLatency();
    ensureCategoryActive(applicantCategoryId);
    ensureDateWithinCycle(cycleId, input.date);

    const dup = days.find(
      (d) =>
        d.cycleId === cycleId &&
        d.applicantCategoryId === applicantCategoryId &&
        d.date === input.date,
    );
    if (dup) {
      throw new ConflictError(
        'DUPLICATE_DATE',
        { cycleId, applicantCategoryId, date: input.date },
        'يوجد يوم مسجل بالفعل في هذا التاريخ للفئة الحالية',
      );
    }

    const now = new Date().toISOString();
    const row: ExamScheduleDay = {
      id: nextId(),
      cycleId,
      applicantCategoryId,
      date: input.date,
      kind: input.kind,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    days.push(row);
    audit('create', row.id, `إضافة يوم ${row.date}`, null, row);
    return row;
  },

  async updateDay(
    dayId: string,
    patch: Partial<Pick<ExamScheduleDay, 'date' | 'kind' | 'note'>>,
  ): Promise<ExamScheduleDay> {
    await simulateLatency();
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx === -1) throw new Error('Day not found');
    const before = days[idx]!;

    if (patch.date && patch.date !== before.date) {
      ensureCategoryActive(before.applicantCategoryId);
      ensureDateWithinCycle(before.cycleId, patch.date);
      const dup = days.find(
        (d) =>
          d.id !== dayId &&
          d.cycleId === before.cycleId &&
          d.applicantCategoryId === before.applicantCategoryId &&
          d.date === patch.date,
      );
      if (dup) {
        throw new ConflictError(
          'DUPLICATE_DATE',
          { dayId, date: patch.date },
          'يوجد يوم مسجل بالفعل في هذا التاريخ للفئة الحالية',
        );
      }
    }

    const after: ExamScheduleDay = {
      ...before,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    days[idx] = after;
    audit('update', after.id, `تعديل يوم ${after.date}`, before, after);
    return after;
  },

  async deleteDay(dayId: string): Promise<void> {
    await simulateLatency();
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx === -1) return;
    const before = days[idx]!;
    days.splice(idx, 1);
    audit('delete', before.id, `حذف يوم ${before.date}`, before, null);
  },

  async toggleOff(dayId: string): Promise<ExamScheduleDay> {
    await simulateLatency();
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx === -1) throw new Error('Day not found');
    const before = days[idx]!;
    const after: ExamScheduleDay = {
      ...before,
      kind: before.kind === 'WORKING' ? 'OFF' : 'WORKING',
      updatedAt: new Date().toISOString(),
    };
    days[idx] = after;
    audit(
      'update',
      after.id,
      `تبديل حالة يوم ${after.date} إلى ${after.kind === 'OFF' ? 'عطلة' : 'يوم عمل'}`,
      before,
      after,
    );
    return after;
  },

  async clearRange(
    cycleId: string,
    applicantCategoryId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ deleted: number }> {
    await simulateLatency();
    ensureRangeValid(startDate, endDate);
    const before = days.length;
    days = days.filter((d) => {
      if (
        d.cycleId === cycleId &&
        d.applicantCategoryId === applicantCategoryId &&
        d.date >= startDate &&
        d.date <= endDate
      ) {
        return false;
      }
      return true;
    });
    const deleted = before - days.length;
    audit(
      'delete',
      `clear-${cycleId}-${applicantCategoryId}`,
      `مسح ${deleted} يوم من ${startDate} إلى ${endDate}`,
      null,
      null,
    );
    return { deleted };
  },

  async copyFromCategory(input: {
    cycleId: string;
    sourceCategoryId: string;
    targetCategoryId: string;
    overwrite: boolean;
  }): Promise<{ created: number; skipped: number }> {
    await simulateLatency();
    ensureCategoryActive(input.sourceCategoryId);
    ensureCategoryActive(input.targetCategoryId);

    const sourceRows = days.filter(
      (d) =>
        d.cycleId === input.cycleId &&
        d.applicantCategoryId === input.sourceCategoryId,
    );
    const targetByDate = new Map<string, ExamScheduleDay>();
    for (const d of days) {
      if (
        d.cycleId === input.cycleId &&
        d.applicantCategoryId === input.targetCategoryId
      ) {
        targetByDate.set(d.date, d);
      }
    }

    let created = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const src of sourceRows) {
      const existing = targetByDate.get(src.date);
      if (existing && !input.overwrite) {
        skipped++;
        continue;
      }
      if (existing && input.overwrite) {
        const replaced: ExamScheduleDay = {
          ...existing,
          kind: src.kind,
          note: src.note,
          updatedAt: now,
        };
        const idx = days.findIndex((d) => d.id === existing.id);
        days[idx] = replaced;
        created++;
        continue;
      }
      const row: ExamScheduleDay = {
        id: nextId(),
        cycleId: input.cycleId,
        applicantCategoryId: input.targetCategoryId,
        date: src.date,
        kind: src.kind,
        note: src.note,
        createdAt: now,
        updatedAt: now,
      };
      days.push(row);
      targetByDate.set(row.date, row);
      created++;
    }

    audit(
      'create',
      `copy-${input.cycleId}-${input.sourceCategoryId}-to-${input.targetCategoryId}`,
      `نسخ ${created} يوم من ${input.sourceCategoryId} إلى ${input.targetCategoryId}${skipped > 0 ? ` (${skipped} تخطي)` : ''}`,
      null,
      null,
    );
    return { created, skipped };
  },
};
