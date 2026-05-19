/**
 * Committee instances — demo seed for transfer / conflict / past-day testing.
 *
 * Both `/admin/cycles/admission-setup/wizard/committees` (authoring) and
 * `/admin/committees-exam-config` (management) read from the same
 * `CommitteeInstance` store. The seed below populates the active cycle
 * (`CYC-2026-M`) with five days that cover every flow on the management
 * page:
 *
 *   2026-05-10 — past day. Visible thanks to commit 89da88e (the
 *                past-day filter was dropped). Both committees maxed out
 *                so admins can see how a fully-booked completed day looks.
 *
 *   2026-06-15 — busy source day. Four committees with non-zero
 *                reservations, plus one parked at 0 (filtered out of the
 *                transfer pre-flight). Use this as the "from" date when
 *                exercising نقل اليوم.
 *
 *   2026-06-16 — comfortable destination. Mirrors Day 1's CMT-12/13/05
 *                with high capacity + low reservations, so a transfer
 *                from 2026-06-15 → 2026-06-16 succeeds outright. CMT-14
 *                is intentionally absent so the same transfer also
 *                exercises the "create at destination" branch.
 *
 *   2026-06-17 — tight destination. CMT-12 and CMT-13 don't have enough
 *                free seats, so transferring 2026-06-15 → 2026-06-17
 *                surfaces the capacity-override dialog with two conflicts.
 *                CMT-14's free seats exactly fit the incoming 20.
 *
 *   2026-06-20 — separate-category day. Two law_bachelor committees so
 *                the categoryKey breakdown is visible in the day group.
 *
 * Admins can still add, edit, and remove rows from the wizard — this is
 * an in-memory seed, not a fixture lock.
 */

import type { CommitteeInstance } from '@/shared/types/domain';

const CYCLE = 'CYC-2026-M';
const CREATED = '2026-04-15T09:00:00.000Z';
const UPDATED = '2026-05-15T10:00:00.000Z';
const REFRESHED = '2026-05-19T07:30:00.000Z';

export const COMMITTEE_INSTANCES_SEED: readonly CommitteeInstance[] = [
  /* ── 2026-05-10 — past day (maxed-out completed exam day) ─────────── */
  {
    id: 'CIN-0001',
    definitionCode: 'CMT-12',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-05-10',
    capacity: 50,
    reserved: 50,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0002',
    definitionCode: 'CMT-13',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-05-10',
    capacity: 50,
    reserved: 48,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  /* ── 2026-06-15 — busy source day for transfer testing ─────────────── */
  {
    id: 'CIN-0003',
    definitionCode: 'CMT-12',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-15',
    capacity: 50,
    reserved: 38,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0004',
    definitionCode: 'CMT-13',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-15',
    capacity: 50,
    reserved: 42,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0005',
    definitionCode: 'CMT-14',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-15',
    capacity: 50,
    reserved: 20,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0006',
    definitionCode: 'CMT-15',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-15',
    capacity: 50,
    reserved: 0,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0007',
    definitionCode: 'CMT-05',
    cycleId: CYCLE,
    categoryKey: 'specialized_officers',
    date: '2026-06-15',
    capacity: 40,
    reserved: 25,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  /* ── 2026-06-16 — comfortable destination (transfer succeeds) ──────── */
  {
    id: 'CIN-0008',
    definitionCode: 'CMT-12',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-16',
    capacity: 80,
    reserved: 10,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0009',
    definitionCode: 'CMT-13',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-16',
    capacity: 80,
    reserved: 15,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0010',
    definitionCode: 'CMT-05',
    cycleId: CYCLE,
    categoryKey: 'specialized_officers',
    date: '2026-06-16',
    capacity: 50,
    reserved: 20,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  /* ── 2026-06-17 — tight destination (conflicts on CMT-12/13) ───────── */
  {
    id: 'CIN-0011',
    definitionCode: 'CMT-12',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-17',
    capacity: 50,
    reserved: 20,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0012',
    definitionCode: 'CMT-13',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-17',
    capacity: 50,
    reserved: 12,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0013',
    definitionCode: 'CMT-14',
    cycleId: CYCLE,
    categoryKey: 'officers_general',
    date: '2026-06-17',
    capacity: 50,
    reserved: 30,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  /* ── 2026-06-20 — separate-category day (law_bachelor) ─────────────── */
  {
    id: 'CIN-0014',
    definitionCode: 'CMT-10',
    cycleId: CYCLE,
    categoryKey: 'law_bachelor',
    date: '2026-06-20',
    capacity: 40,
    reserved: 18,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'CIN-0015',
    definitionCode: 'CMT-11',
    cycleId: CYCLE,
    categoryKey: 'law_bachelor',
    date: '2026-06-20',
    capacity: 40,
    reserved: 22,
    reservedRefreshedAt: REFRESHED,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
];
