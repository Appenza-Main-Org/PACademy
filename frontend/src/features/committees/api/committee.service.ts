/**
 * Committees API — Sprint 3 (RFP Scope Document §3).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/committees                              → Committee[]
 *   GET    /api/committees/:id                          → Committee
 *   POST   /api/committees                              → Committee
 *   PATCH  /api/committees/:id                          → Committee
 *   GET    /api/committees/:id/applicants?date=         → Applicant[] (today's queue)
 *   POST   /api/committees/:id/results                  → CommitteeResult (preliminary)
 *   POST   /api/committees/:id/results/approve          → { approved, failed }
 *   POST   /api/committees/results/:resultId/reject     → CommitteeResult (reason logged)
 *   POST   /api/committees/:id/results/bulk-upload      → { imported, errors }
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { ConflictError } from '@/shared/lib/errors';
import { deriveCommitteeGender } from '@/shared/lib/committee-gender';
import {
  applyRestore,
  applySoftDelete,
  DependencyBlockedError,
  filterDeleted,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type {
  Applicant,
  Committee,
  CommitteeGradeType,
  CommitteeResult,
  CommitteeRules,
  CommitteeStatus,
  CommitteeType,
  ExamScheduleEntry,
} from '@/shared/types/domain';

const COMMITTEE_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  results: 'نتيجة لجنة',
};

/* In-memory daily attendance counter — keyed by `${committeeId}:${YYYY-MM-DD}`.
 * Gap H capacity check decrements remaining slots before scheduling. */
const DAILY_COUNT = new Map<string, number>();
const dayKey = (committeeId: string, dateIso: string): string =>
  `${committeeId}:${dateIso.slice(0, 10)}`;

const COMMITTEES_STATE: Committee[] = [...MOCK.committees];
const RESULTS_STATE: CommitteeResult[] = [...MOCK.committeeResults];

let cId = COMMITTEES_STATE.length + 1;
let rId = RESULTS_STATE.length + 1;

export interface CommitteePayload {
  name: string;
  head: string;
  type: CommitteeType;
  members: number;
  capacityPerSession: number;
  cycleId: string;
  /** Required — every new committee declares its category. */
  categoryKey: string;
  /** Required — total seats (1..999). */
  capacity: number;
  /** Required — discriminates `gradeMin`/`gradeMax` interpretation. */
  gradeType: CommitteeGradeType;
  /** Inclusive lower bound. score: %, tier: GRADE_TIERS index. */
  gradeMin: number;
  /** Inclusive upper bound. Same units as `gradeMin`. */
  gradeMax: number;
  /* ── Admin module enhancements ──────────────────────────────── */
  headUserId?: string;
  academicYearId?: string;
  status?: CommitteeStatus;
  specializationIds?: string[];
  officerIds?: string[];
  rules?: CommitteeRules;
}

export const committeeService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<Committee[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/committees', { query: opts });
    }
    await simulateLatency();
    return [...filterDeleted(COMMITTEES_STATE, opts.includeDeleted)];
  },

  async getById(id: string): Promise<Committee | null> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/${encodeURIComponent(id)}`);
    }
    await simulateLatency();
    return COMMITTEES_STATE.find((c) => c.id === id) ?? null;
  },

  async create(payload: CommitteePayload): Promise<Committee> {
    if (isBackendEnabled()) {
      return apiClient.post('/api/committees', payload);
    }
    await simulateLatency();
    /* For the specialized_officers track, gender is always derived from
     * the committee name (see deriveCommitteeGender). The service ignores
     * any client-supplied value so a tampered payload can't fork the
     * convention applied to the seed. Other categories are untouched. */
    const derivedGender =
      payload.categoryKey === 'specialized_officers'
        ? deriveCommitteeGender(payload.name)
        : undefined;
    const next: Committee = {
      id: `C-${String(cId++).padStart(2, '0')}`,
      name: payload.name,
      head: payload.head,
      members: payload.members,
      applicants: 0,
      completed: 0,
      categoryKey: payload.categoryKey,
      capacity: payload.capacity,
      gradeType: payload.gradeType,
      gradeMin: payload.gradeMin,
      gradeMax: payload.gradeMax,
      headUserId: payload.headUserId,
      capacityPerDay: payload.capacityPerSession,
      academicYearId: payload.academicYearId,
      status: payload.status ?? 'active',
      createdAt: new Date().toISOString(),
      specializationIds: payload.specializationIds,
      officerIds: payload.officerIds,
      rules: payload.rules,
      linkedCycleId: payload.cycleId,
      ...(derivedGender ? { gender: derivedGender } : {}),
    };
    COMMITTEES_STATE.unshift(next);
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: next.id,
      details: `إنشاء لجنة "${next.name}"`,
      after: next,
    });
    return next;
  },

  /**
   * List committees eligible to receive a given applicant id based on
   * each committee's CommitteeRules. The check evaluates the applicant's
   * score percent, name first-letter, gender, and applicant type against
   * the rule bag. Committees with `applicants >= capacity` or
   * `status === 'inactive'` are filtered out.
   */
  async listAssignableFor(applicantId: string): Promise<Committee[]> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/assignable/${encodeURIComponent(applicantId)}`);
    }
    await simulateLatency();
    const a = MOCK.applicants.find((x) => x.id === applicantId);
    if (!a) return [];
    return COMMITTEES_STATE.filter((c) => filterDeleted([c], false).length > 0)
      .filter((c) => committeeAcceptsApplicant(c, a));
  },

  async getApplicants(committeeName: string): Promise<Applicant[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/committees/applicants', { query: { committeeName } });
    }
    await simulateLatency();
    return MOCK.applicants.filter((a) => a.committee === committeeName).slice(0, 50);
  },

  async getDailyQueue(committeeId: string): Promise<Applicant[]> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/${encodeURIComponent(committeeId)}/queue`);
    }
    await simulateLatency();
    const c = COMMITTEES_STATE.find((x) => x.id === committeeId);
    if (!c) return [];
    return MOCK.applicants.filter((a) => a.committee === c.name).slice(0, 18);
  },

  async listResults(committeeId: string): Promise<CommitteeResult[]> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/${encodeURIComponent(committeeId)}/results`);
    }
    await simulateLatency();
    return RESULTS_STATE.filter((r) => r.committeeId === committeeId);
  },

  async enterResult(committeeId: string, payload: {
    applicantId: string;
    applicantName: string;
    enteredBy: string;
    scores: Record<string, number>;
    passFail: 'pass' | 'fail';
    notes?: string;
  }): Promise<CommitteeResult> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(committeeId)}/results`, payload);
    }
    await simulateLatency();
    const result: CommitteeResult = {
      id: `RES-C-${String(rId++).padStart(5, '0')}`,
      committeeId,
      applicantId: payload.applicantId,
      applicantName: payload.applicantName,
      enteredBy: payload.enteredBy,
      enteredAt: Date.now(),
      phase: 'preliminary',
      scores: payload.scores,
      passFail: payload.passFail,
      notes: payload.notes,
    };
    RESULTS_STATE.unshift(result);
    return result;
  },

  async approveResults(_committeeId: string, resultIds: ReadonlyArray<string>): Promise<{ approved: number; failed: number }> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(_committeeId)}/results/approve`, {
        resultIds,
      });
    }
    await simulateLatency(400, 800);
    let approved = 0;
    for (const id of resultIds) {
      const r = RESULTS_STATE.find((x) => x.id === id);
      if (r && r.phase === 'preliminary') {
        r.phase = 'final';
        r.approvedBy = 'العقيد محمد إبراهيم حسن';
        r.approvedAt = Date.now();
        approved += 1;
      }
    }
    return { approved, failed: resultIds.length - approved };
  },

  async rejectResult(resultId: string, reason: string): Promise<CommitteeResult | null> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/results/${encodeURIComponent(resultId)}/reject`, { reason });
    }
    await simulateLatency();
    const r = RESULTS_STATE.find((x) => x.id === resultId);
    if (!r) return null;
    r.phase = 'rejected';
    r.rejectionReason = reason;
    return r;
  },

  async bulkUploadResults(_committeeId: string, rows: ReadonlyArray<Record<string, unknown>>): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(_committeeId)}/results/bulk-upload`, {
        rows,
      });
    }
    await simulateLatency(600, 1200);
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    rows.forEach((row, i) => {
      if (!row.applicantId || !row.passFail) {
        errors.push({ row: i + 1, message: 'بيانات ناقصة (الرقم القومي أو النتيجة)' });
        return;
      }
      imported += 1;
    });
    return { imported, errors };
  },

  /**
   * Update committee config.
   *
   * INTEGRATION CONTRACT:
   *   PATCH /api/committees/:id  → Committee
   *     body: Partial<Committee>  // capacity, gradeType, gradeMin,
   *                               // gradeMax, status, …
   *
   * Validates capacity (1..999) and the gradeMin ≤ gradeMax invariant
   * against the post-patch shape. Throws
   * `ConflictError('COMMITTEE_AT_CAPACITY')` when the requested
   * capacity is below the count of already-assigned applicants — i.e.
   * `patch.capacity < assignedApplicants.length`. Successful patches
   * emit a typed audit row with before/after.
   */
  async update(id: string, patch: Partial<Committee>): Promise<Committee> {
    if (isBackendEnabled()) {
      return apiClient.patch(`/api/committees/${encodeURIComponent(id)}`, patch);
    }
    await simulateLatency();
    const idx = COMMITTEES_STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('اللجنة غير موجودة');
    const before = { ...COMMITTEES_STATE[idx]! };
    const next: Committee = { ...before, ...patch, id: before.id };

    /* Range invariant — gradeMin ≤ gradeMax post-patch. */
    if (next.gradeMin > next.gradeMax) {
      throw new ConflictError(
        'GRADE_RANGE_INVERTED',
        { gradeMin: next.gradeMin, gradeMax: next.gradeMax },
        'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
      );
    }

    /* Capacity envelope — must not drop below the assigned roster. */
    if (patch.capacity !== undefined) {
      if (!Number.isInteger(patch.capacity) || patch.capacity < 1 || patch.capacity > 999) {
        throw new ConflictError(
          'CAPACITY_NOT_POSITIVE',
          { capacity: patch.capacity },
          'السعة يجب أن تكون عدداً صحيحاً بين 1 و 999',
        );
      }
      const assigned = MOCK.applicants.filter((a) => a.committee === before.name).length;
      if (patch.capacity < assigned) {
        throw new ConflictError(
          'COMMITTEE_AT_CAPACITY',
          { capacity: patch.capacity, assigned },
          `لا يمكن خفض السعة دون عدد المتقدمين المسنّدين (${assigned}).`,
        );
      }
    }

    COMMITTEES_STATE[idx] = next;
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: id,
      details: `تعديل بيانات "${next.name}"`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Schedule an applicant slot on a given day for a committee. Gap H
   * capacity check rejects with `ConflictError('COMMITTEE_AT_CAPACITY')`
   * when the day's count would exceed `capacityPerDay`.
   *
   * INTEGRATION CONTRACT:
   *   POST /api/committees/:id/schedule { applicantId, dateIso }
   */
  async scheduleSlot(
    committeeId: string,
    input: { applicantId: string; dateIso: string },
  ): Promise<{ ok: true; remainingForDay: number }> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(committeeId)}/schedule`, input);
    }
    await simulateLatency();
    const c = COMMITTEES_STATE.find((x) => x.id === committeeId);
    if (!c) throw new Error('اللجنة غير موجودة');
    const k = dayKey(committeeId, input.dateIso);
    const current = DAILY_COUNT.get(k) ?? 0;
    const cap = c.capacityPerDay;
    if (cap !== undefined && current >= cap) {
      throw new ConflictError(
        'COMMITTEE_AT_CAPACITY',
        { committeeId, dateIso: input.dateIso, capacityPerDay: cap, current },
        `لا يمكن جدولة هذا الموعد — الطاقة اليومية للجنة "${c.name}" مكتملة (${cap}/${cap}).`,
      );
    }
    DAILY_COUNT.set(k, current + 1);
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'CommitteeSlot',
      entityLabel: 'موعد لجنة',
      entityId: `${committeeId}:${input.dateIso}:${input.applicantId}`,
      details: `جدولة موعد للجنة "${c.name}" بتاريخ ${input.dateIso.slice(0, 10)}`,
      after: { committeeId, applicantId: input.applicantId, dateIso: input.dateIso },
    });
    return { ok: true, remainingForDay: (cap ?? Infinity) - (current + 1) };
  },

  /** Reset a day counter (testing / demo helper). */
  resetDailyCounters(): void {
    DAILY_COUNT.clear();
  },

  /**
   * Soft-delete a committee. Mirrors the admin-side `categories.softDelete`
   * pattern (Gap D). Blocks if any applicants are still scheduled to this
   * committee or any in-progress results reference it; super-admins can
   * re-list deleted rows via `list({ includeDeleted: true })` and restore.
   *
   * INTEGRATION CONTRACT:
   *   DELETE /api/committees/:id        body: { reason }
   *   POST   /api/committees/:id/restore
   */
  async softDelete(id: string, reason: string): Promise<Committee> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(id)}/soft-delete`, { reason });
    }
    await simulateLatency();
    const idx = COMMITTEES_STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('اللجنة غير موجودة');
    const before = { ...COMMITTEES_STATE[idx]! };
    const dep = await committeeService.getDependencies(id);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذه اللجنة', COMMITTEE_DEP_LABELS);
    const next = applySoftDelete(COMMITTEES_STATE[idx]!, { reason });
    COMMITTEES_STATE[idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: id,
      details: `تم حذف "${next.name}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  async restore(id: string): Promise<Committee> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(id)}/restore`);
    }
    await simulateLatency();
    const idx = COMMITTEES_STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('اللجنة غير موجودة');
    const before = { ...COMMITTEES_STATE[idx]! };
    const next = applyRestore(COMMITTEES_STATE[idx]!);
    COMMITTEES_STATE[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: id,
      details: `تم استعادة "${next.name}"`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Returns the dependency snapshot used by SoftDeleteDialog. Counts
   * applicants assigned to the committee (blocking) and results entered
   * for it (also blocking — deleting would orphan grade records).
   */
  async getDependencies(id: string): Promise<DependencyResult> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/${encodeURIComponent(id)}/dependencies`);
    }
    await simulateLatency(80, 200);
    const c = COMMITTEES_STATE.find((x) => x.id === id);
    if (!c) throw new Error('اللجنة غير موجودة');
    const applicants = MOCK.applicants.filter((a) => a.committee === c.name).length;
    const results = RESULTS_STATE.filter((r) => r.committeeId === id).length;
    const counts: Record<string, number> = {};
    if (applicants > 0) counts.applicants = applicants;
    if (results > 0) counts.results = results;
    return {
      counts,
      blocking: applicants > 0 || results > 0,
    };
  },

  /**
   * List system users eligible for committee assignment — `committee_admin`
   * or `committee_user` role only. Surfaced by the admin officer-multi-select.
   */
  async getEligibleOfficers(): Promise<{ id: string; name: string; role: string }[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/committees/eligible-officers');
    }
    await simulateLatency(80, 160);
    return MOCK.users
      .filter((u) => u.role === 'committee_admin' || u.role === 'committee_user')
      .map((u) => ({ id: u.id, name: u.name, role: u.role }));
  },

  /**
   * List active "specializations" backing the committee form select.
   *
   * Source: the applicant-category catalogue managed at /admin/categories
   * (not the reference-data specializations dictionary). The committee's
   * `specializationIds` field stores the category `key` (string), so admins
   * can extend the catalogue from the categories admin page without a
   * code change.
   *
   * The returned `id` is the category `key` so existing consumers
   * (`specializationIds.includes(id)`) keep working.
   */
  async listSpecializations(): Promise<{ id: string; nameAr: string; code: string; active: boolean }[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/committees/specializations');
    }
    await simulateLatency(60, 140);
    return MOCK.categories
      .filter((c) => !c.deletedAt)
      .map((c) => ({
        id: c.key,
        nameAr: c.labelAr,
        code: c.labelEn || c.key,
        active: c.isOpen,
      }));
  },

  /**
   * List active education types — backs the "نوع المتقدم" select on the
   * committee create / edit form. Sourced from the platform-wide lookup
   * matrix (`/admin/reference-data/educationTypes`) so admins can manage
   * the list in one place.
   *
   * INTEGRATION CONTRACT:
   *   GET /api/lookups/educationTypes?active=true
   */
  async listEducationTypes(): Promise<{ id: string; key: string; labelAr: string; isActive: boolean }[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/lookups/educationTypes', { query: { active: true } });
    }
    await simulateLatency(60, 140);
    return MOCK.lookups['school-categories']
      .filter((l) => l.isActive)
      .map((l) => ({ id: l.code, key: l.code, labelAr: l.name, isActive: l.isActive }));
  },

  /**
   * List applicants assigned to a given committee. Falls back to the
   * legacy `applicant.committee === c.name` join when the committee
   * has no explicit assignment table (the mock data ships with this
   * structure).
   *
   * INTEGRATION CONTRACT:
   *   GET /api/committees/:id/applicants
   */
  async getAssignedApplicants(committeeId: string): Promise<Applicant[]> {
    if (isBackendEnabled()) {
      return apiClient.get(`/api/committees/${encodeURIComponent(committeeId)}/applicants`);
    }
    await simulateLatency();
    const c = COMMITTEES_STATE.find((x) => x.id === committeeId);
    if (!c) return [];
    return MOCK.applicants.filter((a) => a.committee === c.name);
  },

  /**
   * Toggle committee status (active ↔ inactive). Surfaces a typed audit
   * entry that the activity log can pick up.
   */
  async setStatus(id: string, status: CommitteeStatus): Promise<Committee> {
    if (isBackendEnabled()) {
      return apiClient.post(`/api/committees/${encodeURIComponent(id)}/status`, { status });
    }
    await simulateLatency();
    const idx = COMMITTEES_STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('اللجنة غير موجودة');
    const before = { ...COMMITTEES_STATE[idx]! };
    const next: Committee = { ...before, status };
    COMMITTEES_STATE[idx] = next;
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'Committee',
      entityLabel: 'لجنة قبول',
      entityId: id,
      details: `${status === 'active' ? 'تفعيل' : 'تعطيل'} "${next.name}"`,
      before,
      after: next,
    });
    return next;
  },

  /* ── Exam-date schedule (per-(committee × date) seat capacity) ─────
   *
   * INTEGRATION CONTRACT:
   *   GET    /committees/schedule?category=<key>     → ExamScheduleEntry[]
   *   POST   /committees/schedule/batch              → ExamScheduleEntry[]
   *            body: { categoryKey, date, capacity }
   *            One row created per Committee whose categoryKey matches.
   *   PATCH  /committees/schedule/:id                → ExamScheduleEntry
   *            body: Partial<{ capacity, date }>
   *   DELETE /committees/schedule/:id                → 204
   */

  async listSchedule(categoryKey: string): Promise<ExamScheduleEntry[]> {
    if (isBackendEnabled()) {
      return apiClient.get('/api/committees/schedule', { query: { category: categoryKey } });
    }
    await simulateLatency(80, 160);
    /* Resolve via committee membership so the page can filter by tab
     * without storing categoryKey twice. */
    const committeeIds = new Set(
      COMMITTEES_STATE.filter((c) => c.categoryKey === categoryKey).map((c) => c.id),
    );
    return MOCK.examSchedule
      .filter((e) => committeeIds.has(e.committeeId))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Insert one schedule entry per element of `entries`. Unlike
   * `addScheduleBatch` (which fans out to every committee in a category),
   * this method lets the caller pick exact `(committeeId, date)` rows —
   * used by the admission-setup wizard to merge-on-add: rows that already
   * exist accumulate capacity via `updateScheduleEntry`, only the missing
   * ones come through here.
   *
   * INTEGRATION CONTRACT:
   *   POST /committees/schedule  → ExamScheduleEntry[]
   *     body: Array<{ committeeId, date, capacity }>
   */
  async addScheduleEntries(
    entries: ReadonlyArray<{
      categoryKey: string;
      committeeId: string;
      date: string;
      capacity: number;
    }>,
  ): Promise<ExamScheduleEntry[]> {
    if (isBackendEnabled()) {
      return apiClient.post('/api/committees/schedule', entries);
    }
    await simulateLatency();
    const now = Date.now();
    const created: ExamScheduleEntry[] = entries.map((e, idx) => {
      if (!Number.isInteger(e.capacity) || e.capacity < 1) {
        throw new ConflictError(
          'CAPACITY_NOT_POSITIVE',
          { capacity: e.capacity },
          'السعة يجب أن تكون عدداً صحيحاً 1 أو أكثر',
        );
      }
      return {
        id: `ESE-${now}-${idx}`,
        committeeId: e.committeeId,
        date: e.date,
        capacity: e.capacity,
      };
    });
    MOCK.examSchedule.push(...created);
    const distinctCats = Array.from(new Set(entries.map((e) => e.categoryKey)));
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'ExamScheduleEntry',
      entityLabel: 'مواعيد اختبار',
      entityId: `multi:${distinctCats.join(',')}`,
      details: `إضافة ${created.length} موعد عبر ${distinctCats.length} فئة`,
      after: created,
    });
    return created;
  },

  async addScheduleBatch(input: {
    categoryKey: string;
    date: string;
    capacity: number;
  }): Promise<ExamScheduleEntry[]> {
    if (isBackendEnabled()) {
      return apiClient.post('/api/committees/schedule/batch', input);
    }
    await simulateLatency();
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 999) {
      throw new ConflictError(
        'CAPACITY_NOT_POSITIVE',
        { capacity: input.capacity },
        'السعة يجب أن تكون عدداً صحيحاً بين 1 و 999',
      );
    }
    const matchingCommittees = COMMITTEES_STATE.filter(
      (c) => c.categoryKey === input.categoryKey && !c.deletedAt,
    );
    const now = Date.now();
    const created: ExamScheduleEntry[] = matchingCommittees.map((c, idx) => ({
      id: `ESE-${now}-${idx}`,
      committeeId: c.id,
      date: input.date,
      capacity: input.capacity,
    }));
    MOCK.examSchedule.push(...created);
    emitAudit({
      action: 'create',
      module: 'committees',
      entityType: 'ExamScheduleEntry',
      entityLabel: 'مواعيد اختبار',
      entityId: `${input.categoryKey}:${input.date}`,
      details: `إضافة موعد ${input.date} لـ ${created.length} لجنة (${input.categoryKey})`,
      after: created,
    });
    return created;
  },

  async updateScheduleEntry(
    id: string,
    patch: Partial<Pick<ExamScheduleEntry, 'capacity' | 'date'>>,
  ): Promise<ExamScheduleEntry> {
    if (isBackendEnabled()) {
      return apiClient.patch(`/api/committees/schedule/${encodeURIComponent(id)}`, patch);
    }
    await simulateLatency();
    const idx = MOCK.examSchedule.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('الموعد غير موجود');
    const before = { ...MOCK.examSchedule[idx]! };
    if (patch.capacity !== undefined) {
      if (
        !Number.isInteger(patch.capacity) ||
        patch.capacity < 1 ||
        patch.capacity > 999
      ) {
        throw new ConflictError(
          'CAPACITY_NOT_POSITIVE',
          { capacity: patch.capacity },
          'السعة يجب أن تكون عدداً صحيحاً بين 1 و 999',
        );
      }
    }
    const next: ExamScheduleEntry = { ...before, ...patch };
    MOCK.examSchedule[idx] = next;
    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'ExamScheduleEntry',
      entityLabel: 'موعد اختبار',
      entityId: next.id,
      details: `تحديث موعد ${next.date} للجنة ${next.committeeId}`,
      before,
      after: next,
    });
    return next;
  },

  async removeScheduleEntry(id: string): Promise<void> {
    if (isBackendEnabled()) {
      await apiClient.delete(`/api/committees/schedule/${encodeURIComponent(id)}`);
      return;
    }
    await simulateLatency();
    const idx = MOCK.examSchedule.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const [removed] = MOCK.examSchedule.splice(idx, 1);
    if (!removed) return;
    emitAudit({
      action: 'delete',
      module: 'committees',
      entityType: 'ExamScheduleEntry',
      entityLabel: 'موعد اختبار',
      entityId: removed.id,
      details: `حذف موعد ${removed.date} للجنة ${removed.committeeId}`,
      before: removed,
    });
  },
};

/**
 * Determines whether a committee accepts a given applicant per its
 * CommitteeRules and current capacity. Pure helper exposed for the
 * assignment preview UI on the detail page.
 */
export function committeeAcceptsApplicant(c: Committee, a: Applicant): boolean {
  if (c.status === 'inactive') return false;
  if (c.deletedAt) return false;
  if (c.capacity !== undefined && c.applicants >= c.capacity) return false;
  const rules = c.rules;
  if (!rules) return true;
  const scorePct = Number(a.certPercent);
  if (rules.gradeFrom != null && scorePct < rules.gradeFrom) return false;
  if (rules.gradeTo != null && scorePct > rules.gradeTo) return false;
  if (rules.gender && rules.gender !== 'any' && rules.gender !== a.gender) return false;
  const firstLetter = a.name.trim().charAt(0);
  if (rules.alphabetFrom && firstLetter < rules.alphabetFrom) return false;
  if (rules.alphabetTo && firstLetter > rules.alphabetTo) return false;
  return true;
}
