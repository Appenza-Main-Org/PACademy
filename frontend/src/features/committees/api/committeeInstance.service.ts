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

/** FNV-1a 32-bit hash. Deterministic across reloads — same (committee,
 *  date) pair always produces the same dummy reservation count. */
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mock-only: synthesize a plausible reservation count for a freshly
 *  authored committee instance so the demo on
 *  `/admin/committees-exam-config` doesn't look empty the moment an
 *  admin steps out of the wizard. Backend integration should drop this
 *  helper entirely and keep `reserved: 0` at creation — real reservation
 *  counts come from the scheduling system via the «تحديث» button.
 *
 *  Range: ~45%–95% of capacity, clamped to [1, capacity]. Deterministic
 *  in `(definitionCode, date)` so the same row keeps the same dummy
 *  number across reloads (and across the in-memory store's lifetime). */
function demoReservations(
  definitionCode: string,
  date: string,
  capacity: number,
): number {
  const h = hash32(`${definitionCode}|${date}`);
  /* Fill ratio in [0.45, 0.95) — five-thousand-step bucket keeps the
   * spread visually varied without ever hitting exactly 0 or capacity. */
  const ratio = 0.45 + (h % 5000) / 10000;
  const reserved = Math.round(capacity * ratio);
  return Math.max(1, Math.min(capacity, reserved));
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
        /* Demo only: seed a deterministic dummy reservation count so the
         * management page surfaces realistic numbers right after wizard
         * authoring. The real backend will keep this at 0 — applicants
         * schedule onto instances after creation. See `demoReservations`
         * for the integration contract. */
        reserved: demoReservations(i.definitionCode, i.date, i.capacity),
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
    /* Invariant: reserved ≤ capacity. Editing capacity below the
     * existing reservation count would silently leave the row over-
     * subscribed, so we clamp `reserved` down. The clamp is silent
     * because the affected UI («المحجوز») doesn't expose capacity at
     * this seam — admins shouldn't have to see a transient over-
     * allocation that the system already enforces away. */
    if (next.reserved > next.capacity) {
      next.reserved = next.capacity;
    }
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
   * Transfer **reservations** from every (committee × category) row on
   * `fromDate` to the matching row on `toDate`. Committee instances on
   * the source day stay in place with their capacity intact — only the
   * `reserved` count moves. After a successful transfer, every source
   * row that had `reserved > 0` is zeroed out and the destination row
   * absorbs the count.
   *
   * Per-row rules:
   *   - Source rows with `reserved === 0` are skipped (nothing to move).
   *   - If a matching destination row exists, the transfer adds
   *     `source.reserved` to `destination.reserved`, but only if the
   *     destination has enough free seats
   *     (`destination.capacity - destination.reserved >= source.reserved`).
   *     When this check fails, the call throws
   *     `ConflictError('RESERVATIONS_OVER_DESTINATION_CAPACITY')` with a
   *     payload listing every blocking row + the minimum capacity each
   *     destination needs to accept the transfer. The UI surfaces a
   *     capacity-bump popup and re-submits with `capacityOverrides`.
   *   - If no matching destination row exists, the service clones the
   *     source row onto `toDate` carrying its capacity + reservation
   *     forward — this is the "same config" branch.
   *
   * `capacityOverrides` lets the caller pre-bump destination capacities
   * (keyed by destination instance id) before the transfer runs. Each
   * override is validated against the [1, 999] envelope. The override
   * is committed atomically with the transfer — if any row still fails
   * after the bump, the whole transaction rolls back conceptually (the
   * service throws before mutating any rows).
   *
   * INTEGRATION CONTRACT:
   *   POST /api/committee-instances/transfer-day
   *     body: { cycleId, fromDate, toDate, capacityOverrides? }
   *     → { transferred: number; createdAtDestination: number;
   *         bumped: number; totalReservationsMoved: number }
   *     409 ConflictError(RESERVATIONS_OVER_DESTINATION_CAPACITY,
   *         { conflicts: ReservationTransferConflict[] })
   */
  async transferDay(input: {
    cycleId: string;
    fromDate: string;
    toDate: string;
    capacityOverrides?: Record<string, number>;
  }): Promise<{
    transferred: number;
    createdAtDestination: number;
    bumped: number;
    totalReservationsMoved: number;
  }> {
    await simulateLatency();
    if (input.fromDate === input.toDate) {
      return {
        transferred: 0,
        createdAtDestination: 0,
        bumped: 0,
        totalReservationsMoved: 0,
      };
    }
    const overrides = input.capacityOverrides ?? {};

    /* Validate every override against the capacity envelope before
     * touching state — a bad override fails the whole call. */
    for (const [, capacity] of Object.entries(overrides)) {
      assertCapacity(capacity);
    }

    /* Pre-flight check — gather every conflict before mutating so the UI
     * gets a complete list and the operation is all-or-nothing. */
    const sourceRows = MOCK.committeeInstances.filter(
      (r) =>
        r.cycleId === input.cycleId &&
        r.date === input.fromDate &&
        r.reserved > 0,
    );

    interface PlannedTransfer {
      sourceIndex: number;
      destinationIndex: number | null;
      destinationId: string | null;
      reservedToMove: number;
      /** Final destination capacity after applying any override. */
      destinationCapacity: number;
      destinationReserved: number;
    }
    const plan: PlannedTransfer[] = [];
    const conflicts: ReservationTransferConflict[] = [];

    for (const source of sourceRows) {
      const sourceIndex = MOCK.committeeInstances.findIndex((r) => r.id === source.id);
      const destinationIndex = MOCK.committeeInstances.findIndex(
        (x) =>
          x.cycleId === input.cycleId &&
          x.definitionCode === source.definitionCode &&
          x.date === input.toDate,
      );
      if (destinationIndex === -1) {
        plan.push({
          sourceIndex,
          destinationIndex: null,
          destinationId: null,
          reservedToMove: source.reserved,
          destinationCapacity: source.capacity,
          destinationReserved: 0,
        });
        continue;
      }
      const destination = MOCK.committeeInstances[destinationIndex]!;
      const overriddenCapacity = overrides[destination.id] ?? destination.capacity;
      const freeSeats = overriddenCapacity - destination.reserved;
      if (freeSeats < source.reserved) {
        conflicts.push({
          committeeName: source.definitionCode,
          categoryKey: source.categoryKey,
          sourceInstanceId: source.id,
          destinationInstanceId: destination.id,
          sourceReserved: source.reserved,
          destinationCapacity: overriddenCapacity,
          destinationReserved: destination.reserved,
          freeSeats: Math.max(0, freeSeats),
          requiredCapacity: destination.reserved + source.reserved,
        });
        continue;
      }
      plan.push({
        sourceIndex,
        destinationIndex,
        destinationId: destination.id,
        reservedToMove: source.reserved,
        destinationCapacity: overriddenCapacity,
        destinationReserved: destination.reserved,
      });
    }

    if (conflicts.length > 0) {
      throw new ConflictError(
        'RESERVATIONS_OVER_DESTINATION_CAPACITY',
        { conflicts },
        'بعض لجان اليوم المستهدف ليس بها سعة كافية لاستيعاب الحجوزات. زِد السعة لهذه اللجان أو اختر يوماً آخر.',
      );
    }

    /* Apply overrides first (so destinations carry the new capacity by
     * the time we reconcile reserved counts), then execute the plan. */
    const now = new Date().toISOString();
    let bumped = 0;
    for (const [destinationId, capacity] of Object.entries(overrides)) {
      const idx = MOCK.committeeInstances.findIndex((r) => r.id === destinationId);
      if (idx === -1) continue;
      const before = MOCK.committeeInstances[idx]!;
      if (before.capacity === capacity) continue;
      MOCK.committeeInstances[idx] = { ...before, capacity, updatedAt: now };
      bumped += 1;
    }

    let transferred = 0;
    let createdAtDestination = 0;
    let totalReservationsMoved = 0;

    for (const p of plan) {
      const source = MOCK.committeeInstances[p.sourceIndex]!;
      if (p.destinationIndex !== null && p.destinationId !== null) {
        /* Re-resolve indices because overrides may have shuffled the
         * underlying objects (immutable updates above). */
        const destinationIdx = MOCK.committeeInstances.findIndex((r) => r.id === p.destinationId);
        if (destinationIdx === -1) continue;
        const destination = MOCK.committeeInstances[destinationIdx]!;
        MOCK.committeeInstances[destinationIdx] = {
          ...destination,
          reserved: destination.reserved + p.reservedToMove,
          updatedAt: now,
        };
        transferred += 1;
      } else {
        const clone: CommitteeInstance = {
          ...source,
          id: nextId(),
          date: input.toDate,
          createdAt: now,
          updatedAt: now,
        };
        MOCK.committeeInstances.push(clone);
        createdAtDestination += 1;
      }
      /* Zero source reservation regardless of destination shape. */
      const sourceIdxNow = MOCK.committeeInstances.findIndex((r) => r.id === source.id);
      if (sourceIdxNow !== -1) {
        MOCK.committeeInstances[sourceIdxNow] = {
          ...MOCK.committeeInstances[sourceIdxNow]!,
          reserved: 0,
          updatedAt: now,
        };
      }
      totalReservationsMoved += p.reservedToMove;
    }

    if (totalReservationsMoved > 0 || bumped > 0) {
      emitAudit({
        action: 'update',
        module: 'committees',
        entityType: 'CommitteeInstance',
        entityLabel: 'مواعيد لجان',
        entityId: `${input.cycleId}:${input.fromDate}→${input.toDate}`,
        details: `نقل ${totalReservationsMoved} حجز من ${input.fromDate} إلى ${input.toDate} (${createdAtDestination} لجنة جديدة، ${bumped} زيادة سعة)`,
      });
    }

    return {
      transferred,
      createdAtDestination,
      bumped,
      totalReservationsMoved,
    };
  },
};

/**
 * Per-row conflict surfaced when the destination day can't absorb the
 * incoming reservation count. Lives on the ConflictError payload so the
 * UI can render a capacity-bump popup that lets the admin fix every
 * blocking row inline before re-submitting the transfer.
 */
export interface ReservationTransferConflict {
  /** Lookups['committees'].code for the committee that conflicts.
   *  The UI joins this against the lookup to surface the Arabic name. */
  committeeName: string;
  categoryKey: ApplicantCategoryKey;
  sourceInstanceId: string;
  destinationInstanceId: string;
  sourceReserved: number;
  destinationCapacity: number;
  destinationReserved: number;
  freeSeats: number;
  /** Minimum new capacity needed at the destination to accept the
   *  full incoming reservation. */
  requiredCapacity: number;
}
