/**
 * Committee instances seed — intentionally empty.
 *
 * Both `/admin/cycles/admission-setup/wizard/committees` (authoring) and
 * `/admin/committees-exam-config` (management) read from the same
 * `CommitteeInstance` store. Per product direction, admins author every
 * (committee × date × capacity) row from the wizard themselves; we no
 * longer ship default seed rows that would clutter the management page
 * before any admission cycle has been configured.
 *
 * Once an admin adds rows in the wizard, they automatically surface on
 * the management page — no separate sync step.
 */

import type { CommitteeInstance } from '@/shared/types/domain';

export const COMMITTEE_INSTANCES_SEED: readonly CommitteeInstance[] = [];
