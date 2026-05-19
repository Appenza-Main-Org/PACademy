/**
 * Committee Instances — cycle-bound, dated, capacity-bearing committee
 * assignments.
 *
 * Domain shape: each `CommitteeInstance` pairs a `CommitteeDefinition`
 * (the lookup row at `/admin/lookups/committees`) with a cycle, a
 * category, a date, and a seat count. Both the admission-setup wizard
 * step `/admin/cycles/admission-setup/wizard/committees` and the new
 * `/admin/committees-exam-config` management page operate on this same record set.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/committee-instances?cycleId=&categoryKey=    → CommitteeInstance[]
 *   POST   /api/committee-instances                          → CommitteeInstance[]
 *            body: Array<{ cycleId, categoryKey, definitionCode, date, capacity }>
 *   PATCH  /api/committee-instances/:id                      → CommitteeInstance
 *            body: Partial<{ date, capacity }>
 *   DELETE /api/committee-instances/:id                      → 204
 *
 * Invariants enforced at the service layer:
 *   - Capacity ∈ [1, 999] integer.
 *   - (cycleId, definitionCode, date) is unique; a colliding add throws
 *     `ConflictError('COMMITTEE_INSTANCE_DUPLICATE')` and the wizard
 *     instead merges by accumulating capacity through `update`.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { ConflictError } from '@/shared/lib/errors';
import type {
  ApplicantCategoryKey,
  CommitteeInstance,
} from '@/shared/types/domain';

export interface CommitteeInstanceListFilters {
  cycleId?: string;
  categoryKey?: ApplicantCategoryKey;
  definitionCode?: string;
}

export interface CommitteeInstanceAddInput {
  cycleId: string;
  categoryKey: ApplicantCategoryKey;
  definitionCode: string;
  date: string;
  capacity: number;
}

export type CommitteeInstancePatch = Partial<Pick<CommitteeInstance, 'date' | 'capacity'>>;

function assertCapacity(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 999) {
    throw new ConflictError(
      'CAPACITY_NOT_POSITIVE',
      { capacity: value },
      'السعة يجب أن تكون عدداً صحيحاً بين 1 و 999',
    );
  }
}

let serial = MOCK.committeeInstances.length + 1;
function nextId(): string {
  const id = `CIN-${String(serial).padStart(4, '0')}`;
  serial += 1;
  return id;
}

function matchesFilters(row: CommitteeInstance, filters: CommitteeInstanceListFilters): boolean {
  if (filters.cycleId && row.cycleId !== filters.cycleId) return false;
  if (filters.categoryKey && row.categoryKey !== filters.categoryKey) return false;
  if (filters.definitionCode && row.definitionCode !== filters.definitionCode) return false;
  return true;
}

export const committeeInstanceService = {
  async list(filters: CommitteeInstanceListFilters = {}): Promise<CommitteeInstance[]> {
    await simulateLatency(80, 160);
    return MOCK.committeeInstances
      .filter((r) => matchesFilters(r, filters))
      .slice()
      .sort((a, b) => {
        if (a.cycleId !== b.cycleId) return a.cycleId.localeCompare(b.cycleId);
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.definitionCode.localeCompare(b.definitionCode);
      });
  },

  async addMany(input: ReadonlyArray<CommitteeInstanceAddInput>): Promise<CommitteeInstance[]> {
    await simulateLatency();
    const now = new Date().toISOString();
    const created: CommitteeInstance[] = [];
    for (const i of input) {
      assertCapacity(i.capacity);
      const duplicate = MOCK.committeeInstances.find(
        (r) =>
          r.cycleId === i.cycleId &&
          r.definitionCode === i.definitionCode &&
          r.date === i.date,
      );
      if (duplicate) {
        throw new ConflictError(
          'COMMITTEE_INSTANCE_DUPLICATE',
          {
            cycleId: i.cycleId,
            definitionCode: i.definitionCode,
            date: i.date,
          },
          'هذا الموعد لهذه اللجنة في هذه الدورة موجود بالفعل.',
        );
      }
      const row: CommitteeInstance = {
        id: nextId(),
        definitionCode: i.definitionCode,
        cycleId: i.cycleId,
        categoryKey: i.categoryKey,
        date: i.date,
        capacity: i.capacity,
        /* New instances start with no reservations — applicants schedule
         * onto them after creation, then the management page's «تحديث»
         * button pulls the live count in. */
        reserved: 0,
        reservedRefreshedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      MOCK.committeeInstances.push(row);
      created.push(row);
    }
    const distinctCats = Array.from(new Set(input.map((i) => i.categoryKey)));
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'CommitteeInstance',
      entityLabel: 'موعد لجنة',
      entityId: `multi:${distinctCats.join(',')}`,
      details: `إضافة ${created.length} موعد لجنة عبر ${distinctCats.length} فئة`,
      after: created,
    });
    return created;
  },

  async update(id: string, patch: CommitteeInstancePatch): Promise<CommitteeInstance> {
    await simulateLatency();
    const idx = MOCK.committeeInstances.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('الموعد غير موجود');
    const before = { ...MOCK.committeeInstances[idx]! };
    if (patch.capacity !== undefined) assertCapacity(patch.capacity);
    const next: CommitteeInstance = {
      ...before,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.date !== undefined && patch.date !== before.date) {
      const collision = MOCK.committeeInstances.find(
        (r) =>
          r.id !== id &&
          r.cycleId === next.cycleId &&
          r.definitionCode === next.definitionCode &&
          r.date === next.date,
      );
      if (collision) {
        throw new ConflictError(
          'COMMITTEE_INSTANCE_DUPLICATE',
          {
            cycleId: next.cycleId,
            definitionCode: next.definitionCode,
            date: next.date,
          },
          'يوجد موعد آخر لهذه اللجنة في نفس التاريخ.',
        );
      }
    }
    MOCK.committeeInstances[idx] = next;
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'CommitteeInstance',
      entityLabel: 'موعد لجنة',
      entityId: id,
      details: `تحديث موعد لجنة ${next.definitionCode} (${next.date}) — السعة ${next.capacity}`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Pull fresh reserved-seat counts for every instance scoped to the
   * filter and stamp `reservedRefreshedAt = now` on each. Surfaces the
   * touched rows so the caller can update its local cache without a
   * round-trip.
   *
   * The mock implementation leaves `reserved` unchanged — real backend
   * will reconcile from the scheduling table; for the demo the timestamp
   * stamp alone is enough to verify the «آخر تحديث» column moves on
   * every refresh.
   *
   * INTEGRATION CONTRACT:
   *   POST /api/committee-instances/refresh-reserved
   *     body: { cycleId? } → CommitteeInstance[]
   */
  async refreshReservedCounts(
    filters: CommitteeInstanceListFilters = {},
  ): Promise<CommitteeInstance[]> {
    await simulateLatency();
    const now = new Date().toISOString();
    const touched: CommitteeInstance[] = [];
    for (let i = 0; i < MOCK.committeeInstances.length; i += 1) {
      const r = MOCK.committeeInstances[i]!;
      if (!matchesFilters(r, filters)) continue;
      const next: CommitteeInstance = { ...r, reservedRefreshedAt: now };
      MOCK.committeeInstances[i] = next;
      touched.push(next);
    }
    return touched;
  },

  async remove(id: string): Promise<void> {
    await simulateLatency();
    const idx = MOCK.committeeInstances.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const [removed] = MOCK.committeeInstances.splice(idx, 1);
    if (!removed) return;
    emitAudit({
      action: 'delete',
      module: 'committees',
      entityType: 'CommitteeInstance',
      entityLabel: 'موعد لجنة',
      entityId: removed.id,
      details: `حذف موعد لجنة ${removed.definitionCode} (${removed.date})`,
      before: removed,
    });
  },

  /**
   * Remove every instance for a (cycle × date) tuple in one call.
   *
   * Returns the list of removed rows so the caller can surface a
   * summary toast. The dialog-level «reserved > 0» confirmation is the
   * UI's responsibility; this method does not enforce it — admins with
   * authority over the cycle can force-delete a day with reservations
   * after the explicit confirmation step.
   *
   * INTEGRATION CONTRACT:
   *   DELETE /api/committee-instances?cycleId=&date=
   */
  async removeDay(input: { cycleId: string; date: string }): Promise<CommitteeInstance[]> {
    await simulateLatency();
    const removed: CommitteeInstance[] = [];
    /* Iterate back-to-front so splice indices stay valid. */
    for (let i = MOCK.committeeInstances.length - 1; i >= 0; i -= 1) {
      const r = MOCK.committeeInstances[i]!;
      if (r.cycleId === input.cycleId && r.date === input.date) {
        MOCK.committeeInstances.splice(i, 1);
        removed.push(r);
      }
    }
    if (removed.length > 0) {
      emitAudit({
        action: 'delete',
        module: 'committees',
        entityType: 'CommitteeInstance',
        entityLabel: 'مواعيد لجان',
        entityId: `${input.cycleId}:${input.date}`,
        details: `حذف ${removed.length} موعد لجنة في ${input.date}`,
        before: removed,
      });
    }
    return removed;
  },

  /**
   * Move every instance for a (cycle × fromDate) tuple to `toDate`.
   *
   * When a target collision exists (same cycle + definition + toDate
   * already there) the rows merge: capacity is summed (clamped to 999),
   * reserved is summed, and the source row is dropped. Merging avoids
   * the COMMITTEE_INSTANCE_DUPLICATE conflict and matches the wizard's
   * idempotent-merge behaviour on add.
   *
   * Returns `{ moved, merged }` — `moved` rows changed date in place,
   * `merged` rows collapsed into pre-existing targets.
   *
   * INTEGRATION CONTRACT:
   *   POST /api/committee-instances/transfer-day
   *     body: { cycleId, fromDate, toDate } → { moved: [], merged: [] }
   */
  async transferDay(input: {
    cycleId: string;
    fromDate: string;
    toDate: string;
  }): Promise<{ moved: CommitteeInstance[]; merged: CommitteeInstance[] }> {
    await simulateLatency();
    if (input.fromDate === input.toDate) {
      return { moved: [], merged: [] };
    }
    const now = new Date().toISOString();
    const moved: CommitteeInstance[] = [];
    const merged: CommitteeInstance[] = [];
    const sourceIndices: number[] = [];
    for (let i = 0; i < MOCK.committeeInstances.length; i += 1) {
      const r = MOCK.committeeInstances[i]!;
      if (r.cycleId === input.cycleId && r.date === input.fromDate) {
        sourceIndices.push(i);
      }
    }
    /* Process source rows in reverse so the splice() at merge time
     * doesn't invalidate the earlier indices in the list. */
    for (let k = sourceIndices.length - 1; k >= 0; k -= 1) {
      const idx = sourceIndices[k]!;
      const source = MOCK.committeeInstances[idx]!;
      const targetIdx = MOCK.committeeInstances.findIndex(
        (x) =>
          x.cycleId === input.cycleId &&
          x.definitionCode === source.definitionCode &&
          x.date === input.toDate,
      );
      if (targetIdx !== -1) {
        const target = MOCK.committeeInstances[targetIdx]!;
        const mergedTarget: CommitteeInstance = {
          ...target,
          capacity: Math.min(999, target.capacity + source.capacity),
          reserved: target.reserved + source.reserved,
          updatedAt: now,
        };
        MOCK.committeeInstances[targetIdx] = mergedTarget;
        MOCK.committeeInstances.splice(idx, 1);
        merged.push(source);
      } else {
        const nextRow: CommitteeInstance = {
          ...source,
          date: input.toDate,
          updatedAt: now,
        };
        MOCK.committeeInstances[idx] = nextRow;
        moved.push(source);
      }
    }
    if (moved.length > 0 || merged.length > 0) {
      emitAudit({
        action: 'update',
        module: 'committees',
        entityType: 'CommitteeInstance',
        entityLabel: 'مواعيد لجان',
        entityId: `${input.cycleId}:${input.fromDate}→${input.toDate}`,
        details: `نقل ${moved.length + merged.length} موعد من ${input.fromDate} إلى ${input.toDate} (دمج ${merged.length})`,
      });
    }
    return { moved, merged };
  },
};
