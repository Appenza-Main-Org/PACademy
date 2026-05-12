# Phase 1 — Data Model: Admission-Setup Wizard Persistence

> **⚠ Amendment 001 active (2026-05-12)** — `wizard_step_statuses.step_key` now accepts 13 values, not 15. See [`AMENDMENT-001-wizard-step-count.md`](AMENDMENT-001-wizard-step-count.md).

**Branch**: `009-admission-setup-persistence` | **Date**: 2026-05-11 (amended 2026-05-12)

This document specifies the persisted shape of every entity touched by
spec 009 — five new wizard-owned entities, two existing entities
graduating from mock to backend (Committee, NotificationTemplate), and
one cycle-scoped relationship (CycleExam) that replaces the frontend's
in-memory exam-plan store. All entities carry `rowversion` for
optimistic locking per FR-012.

Type style mirrors the existing modular-monolith domain layer: sealed
C# classes with private setters, factory `Create` methods enforcing
invariants, and `RowVersion` as the EF-managed concurrency token.

---

## Modules summary

| Module        | New tables                                       | Existing tables touched           |
|---------------|--------------------------------------------------|------------------------------------|
| Admissions    | 7 new + extensions on `cycles` / `categories`    | `cycles`, `categories`             |
| Committees    | 4 (new module)                                   | —                                  |
| Notifications | 2 (new module)                                   | —                                  |

---

## Admissions module — new tables

### `committee_merge_split_rules`

Step 9. Planned merge/split operations against committees in a cycle.

| Column                  | Type            | Notes                                                |
|-------------------------|-----------------|------------------------------------------------------|
| `id`                    | uniqueidentifier | PK                                                  |
| `cycle_id`              | uniqueidentifier | FK → `cycles.id`                                    |
| `type`                  | nvarchar(8)      | `merge` or `split`                                  |
| `source_committee_ids`  | nvarchar(max)    | JSON array of committee ids                         |
| `target_committee_ids`  | nvarchar(max)    | JSON array of committee ids                         |
| `reason`                | nvarchar(500)    | nullable                                            |
| `effective_at`          | date             | informational only — Apply is manual                |
| `status`                | nvarchar(16)     | `planned` / `applied` / `cancelled` (default planned) |
| `applied_at`            | datetimeoffset   | nullable; set when status flips to `applied`        |
| `applied_by`            | uniqueidentifier | nullable; FK → `system_users.id`                    |
| `created_at`            | datetimeoffset   | not null                                            |
| `created_by`            | uniqueidentifier | FK → `system_users.id`                              |
| `deleted_at`            | datetimeoffset   | nullable — soft delete                              |
| `deleted_by`            | uniqueidentifier | nullable                                            |
| `delete_reason`         | nvarchar(500)    | nullable                                            |
| `row_version`           | rowversion       | optimistic-locking token                            |

**Invariants** (enforced in `Create` / `UpdateShape`):
- `type = merge` → `len(source_committee_ids) ≥ 2` ∧ `len(target_committee_ids) = 1`
- `type = split` → `len(source_committee_ids) = 1` ∧ `len(target_committee_ids) ≥ 2`
- `status = applied` → row is immutable except for soft-delete fields

**Indexes**: `IX_merge_split_rules_cycle_status (cycle_id, status)`,
`IX_merge_split_rules_deleted (deleted_at)`.

---

### `committee_score_thresholds`

Step 10. Inclusive min/max acceptance scores per (cycle, committee).

| Column          | Type            | Notes                                              |
|-----------------|-----------------|----------------------------------------------------|
| `cycle_id`      | uniqueidentifier | PK part 1; FK → `cycles.id`                       |
| `committee_id`  | uniqueidentifier | PK part 2; FK → `committees.id` (Committees module via Public API) |
| `min_score`     | int              | inclusive lower bound                              |
| `max_score`     | int              | inclusive upper bound                              |
| `updated_at`    | datetimeoffset   | not null                                           |
| `updated_by`    | uniqueidentifier | FK → `system_users.id`                             |
| `row_version`   | rowversion       | optimistic-locking token                           |

**Invariants**: `min_score ≤ max_score`; both within cycle's allowed
score range (validated server-side via Cycle's `max_score` field).

**No soft delete** — score thresholds are upserted, not archived. To
"remove" a threshold the admin sets it back to default (cycle-wide min/max).

**Indexes**: PK is composite (`cycle_id`, `committee_id`).

---

### `exam_date_configs`

Step 11. Cycle-wide admission-exam scheduling envelope.

| Column                | Type            | Notes                                              |
|-----------------------|-----------------|----------------------------------------------------|
| `id`                  | uniqueidentifier | PK                                                |
| `cycle_id`            | uniqueidentifier | FK → `cycles.id`; **UNIQUE** (one per cycle)      |
| `first_available_date`| date             | not null                                          |
| `bookable_days`       | nvarchar(max)    | JSON array of ISO dates                           |
| `blackout_dates`      | nvarchar(max)    | JSON array of ISO dates (subset of bookable_days) |
| `updated_at`          | datetimeoffset   | not null                                          |
| `updated_by`          | uniqueidentifier | FK → `system_users.id`                            |
| `row_version`         | rowversion       | optimistic-locking token                          |

**Invariants** (FR-020):
- Every date in `bookable_days` ≥ `first_available_date`.
- `blackout_dates` ⊆ `bookable_days`.

**Indexes**: UNIQUE (`cycle_id`).

---

### `total_score_configs`

Step 13. Per-applicant-stream component weights.

| Column                | Type            | Notes                                              |
|-----------------------|-----------------|----------------------------------------------------|
| `id`                  | uniqueidentifier | PK                                                |
| `cycle_id`            | uniqueidentifier | FK → `cycles.id`                                  |
| `applicant_stream`    | nvarchar(32)     | `general` / `special` / `law` / `sports_female`   |
| `components`          | nvarchar(max)    | JSON array `{ exam_key, weight, min_passing? }`   |
| `total_score_out_of`  | int              | denominator for final total                       |
| `updated_at`          | datetimeoffset   | not null                                          |
| `updated_by`          | uniqueidentifier | FK → `system_users.id`                            |
| `row_version`         | rowversion       | optimistic-locking token                          |

**Invariants** (FR-017):
- `sum(components[*].weight) = 100` per row.
- Each `components[*].exam_key` must exist in `cycle_exams` for the
  same `cycle_id`.

**Indexes**: UNIQUE (`cycle_id`, `applicant_stream`).

---

### `electronic_declarations`

Step 15. Versioned Arabic declaration text shown at print-card stage.

| Column          | Type             | Notes                                              |
|-----------------|------------------|----------------------------------------------------|
| `id`            | uniqueidentifier | PK                                                |
| `cycle_id`      | uniqueidentifier | FK → `cycles.id`                                  |
| `body_ar`       | nvarchar(max)    | required Arabic body text                         |
| `version`       | int              | auto-incremented per cycle (1, 2, 3, …)           |
| `effective_from`| date             | not null                                          |
| `published_at`  | datetimeoffset   | nullable; set when admin publishes                |
| `created_at`    | datetimeoffset   | not null                                          |
| `created_by`    | uniqueidentifier | FK → `system_users.id`                            |
| `deleted_at`    | datetimeoffset   | nullable                                          |
| `deleted_by`    | uniqueidentifier | nullable                                          |
| `delete_reason` | nvarchar(500)    | nullable                                          |
| `row_version`   | rowversion       | optimistic-locking token                          |

**Invariants** (FR-016):
- Only one row per cycle has `published_at ≠ null` at any given time.
  Publishing version N unsets `published_at` on the previously
  published version atomically.
- `version` is unique per cycle.

**Indexes**: `IX_declarations_cycle_published (cycle_id, published_at)`,
UNIQUE (`cycle_id`, `version`).

---

### `wizard_step_statuses`

Per-(cycle, step) completion status pill state (FR-014).

| Column          | Type             | Notes                                                |
|-----------------|------------------|------------------------------------------------------|
| `cycle_id`      | uniqueidentifier | PK part 1                                            |
| `step_key`      | nvarchar(48)     | PK part 2; one of 13 AdmissionSetupStepKey values (see `frontend/src/features/admin/admission-setup/types.ts`) |
| `status`        | nvarchar(16)     | `not_started` / `in_progress` / `complete`           |
| `completed_at`  | datetimeoffset   | nullable                                             |
| `completed_by`  | uniqueidentifier | nullable                                             |
| `row_version`   | rowversion       | optimistic-locking token                             |

**Behavior**:
- Default row is **lazily created** on the first save touching the step
  (middleware hook) with `status = in_progress`.
- The complete transition is admin-driven via dedicated endpoint.
- Editing any field of a `complete` step demotes status back to
  `in_progress` in the same transaction (middleware hook).

**Indexes**: PK is composite (`cycle_id`, `step_key`).

---

### `cycle_exams`

Step 7. Replaces the frontend MOCK exam plan — per-cycle exam plan
entries with order, optional/required flag, and per-category fee.

| Column            | Type             | Notes                                              |
|-------------------|------------------|----------------------------------------------------|
| `id`              | uniqueidentifier | PK                                                |
| `cycle_id`        | uniqueidentifier | FK → `cycles.id`                                  |
| `exam_type_key`   | nvarchar(64)     | FK → `exam_types.key` (ReferenceData module)      |
| `category_id`     | uniqueidentifier | nullable; FK → `categories.id` (when per-category) |
| `order`           | int              | sort order within the cycle's plan                 |
| `is_required`     | bit              | optional/required flag                             |
| `fee_egp`         | decimal(10,2)    | nullable; per-exam fee in EGP                      |
| `row_version`     | rowversion       | optimistic-locking token                           |

**Indexes**: `IX_cycle_exams_cycle_order (cycle_id, order)`,
UNIQUE (`cycle_id`, `category_id`, `exam_type_key`) — the same exam
type can't appear twice in the same category's plan.

---

## Admissions module — extensions to existing tables

### `cycles` — add `row_version`

| Column          | Type             | Notes                                              |
|-----------------|------------------|----------------------------------------------------|
| `row_version`   | rowversion       | NEW — optimistic-locking token                     |

Existing migrations don't carry `rowversion`; spec 009 adds it via
`ALTER TABLE cycles ADD row_version rowversion NOT NULL`. SQL Server
auto-populates existing rows.

### `categories` — add `row_version`

Same pattern as `cycles`.

### `admission_rules` — add `row_version`

Same pattern.

---

## Committees module (NEW)

### `committees`

| Column                  | Type             | Notes                                              |
|-------------------------|------------------|----------------------------------------------------|
| `id`                    | uniqueidentifier | PK                                                |
| `cycle_id`              | uniqueidentifier | FK → `cycles.id` (via Admissions Public API)      |
| `key`                   | nvarchar(64)     | stable key used by cross-cycle copy                |
| `name_ar`               | nvarchar(200)    | required                                          |
| `name_en`               | nvarchar(200)    | nullable                                          |
| `chair_user_id`         | uniqueidentifier | nullable; FK → `system_users.id`                  |
| `daily_capacity`        | int              | default capacity per day                          |
| `status`                | nvarchar(16)     | `active` / `paused` / `archived`                  |
| `created_at`            | datetimeoffset   | not null                                          |
| `created_by`            | uniqueidentifier | FK → `system_users.id`                            |
| `deleted_at`            | datetimeoffset   | nullable                                          |
| `deleted_by`            | uniqueidentifier | nullable                                          |
| `delete_reason`         | nvarchar(500)    | nullable                                          |
| `row_version`           | rowversion       | optimistic-locking token                          |

**Indexes**: UNIQUE (`cycle_id`, `key`), `IX_committees_status`.

### `committee_members`

| Column           | Type             | Notes                                              |
|------------------|------------------|----------------------------------------------------|
| `committee_id`   | uniqueidentifier | PK part 1; FK → `committees.id`                   |
| `user_id`        | uniqueidentifier | PK part 2; FK → `system_users.id`                 |
| `role`           | nvarchar(32)     | `chair` / `member` / `secretary`                  |
| `added_at`       | datetimeoffset   | not null                                          |
| `row_version`    | rowversion       | optimistic-locking token                          |

### `committee_date_bindings`

Step 12. Per-date, per-committee capacity override.

| Column           | Type             | Notes                                              |
|------------------|------------------|----------------------------------------------------|
| `committee_id`   | uniqueidentifier | PK part 1                                          |
| `bound_date`     | date             | PK part 2                                          |
| `capacity`       | int              | overrides the committee's `daily_capacity` for this date |
| `row_version`    | rowversion       | optimistic-locking token                          |

### `committee_specializations`

Existing mock concept made persistent — which specializations a
committee handles.

| Column                | Type             | Notes                                              |
|-----------------------|------------------|----------------------------------------------------|
| `committee_id`        | uniqueidentifier | PK part 1                                          |
| `specialization_key`  | nvarchar(64)     | PK part 2 — FK to ReferenceData specialization     |

---

## Notifications module (NEW)

### `notification_templates`

| Column             | Type             | Notes                                              |
|--------------------|------------------|----------------------------------------------------|
| `id`               | uniqueidentifier | PK                                                |
| `cycle_id`         | uniqueidentifier | nullable; FK → `cycles.id` (global templates have null) |
| `trigger_event`    | nvarchar(64)     | enum: `application_received`, `payment_succeeded`, etc. |
| `subject_ar`       | nvarchar(200)    | required                                          |
| `body_ar`          | nvarchar(max)    | required                                          |
| `channel`          | nvarchar(16)     | `sms` / `email` / `in_app`                        |
| `is_published`     | bit              | false until admin publishes                       |
| `published_at`     | datetimeoffset   | nullable                                          |
| `created_at`       | datetimeoffset   | not null                                          |
| `created_by`       | uniqueidentifier | FK → `system_users.id`                            |
| `deleted_at`       | datetimeoffset   | nullable                                          |
| `deleted_by`       | uniqueidentifier | nullable                                          |
| `delete_reason`    | nvarchar(500)    | nullable                                          |
| `row_version`      | rowversion       | optimistic-locking token                          |

**Indexes**: `IX_templates_cycle_event (cycle_id, trigger_event)`.

### `notification_deliveries`

Audit trail of which template fired for which applicant. Deferred to a
later spec **if** the spec 009 work doesn't strictly require it. (The
wizard's "publish" doesn't need delivery rows; only the
notification-execution feature does.)

---

## Relationships

```text
                          cycles (existing)
                          /       |       \
              categories     admission_rules   total_score_configs
              (existing)     (existing)        (NEW, step 13)
                                                       |
                          electronic_declarations  cycle_exams
                          (NEW, step 15)           (NEW, step 7)
                                                       |
   committees           exam_date_configs        wizard_step_statuses
   (NEW module)         (NEW, step 11)           (NEW, per step pill)
       |                       |
   committee_score_thresholds  committee_merge_split_rules
   (NEW, step 10)              (NEW, step 9)

   committees -< committee_members (NEW)
   committees -< committee_date_bindings (NEW, step 12)
   committees -< committee_specializations (NEW)

   cycles -< notification_templates (NEW module, step 14)
```

---

## Audit-trail integration

Every mutation on these tables emits one entry through the existing
audit middleware:

| Entity                       | Actions emitted                                                    |
|------------------------------|--------------------------------------------------------------------|
| CommitteeMergeSplitRule      | `create` `update` `soft_delete` `restore` `merge_rule_applied` `merge_rule_cancelled` |
| CommitteeScoreThreshold      | `create` `update` (upsert)                                         |
| ExamDateConfig               | `create` `update`                                                  |
| TotalScoreConfig             | `create` `update`                                                  |
| ElectronicDeclaration        | `create` `update` `notification_published` `notification_unpublished` |
| WizardStepStatus             | `wizard_step_completed` `wizard_step_reopened`                     |
| CycleExam                    | `create` `update` `soft_delete` `restore`                          |
| Committee                    | `create` `update` `soft_delete` `restore`                          |
| CommitteeMember              | `create` `soft_delete`                                             |
| CommitteeDateBinding         | `create` `update` `soft_delete`                                    |
| NotificationTemplate         | `create` `update` `notification_published` `notification_unpublished` `soft_delete` `restore` |
| Cross-cycle copy             | `cycle_cloned` (one summary entry per copy)                        |

Three new `AuditAction` values must be added to `domain.ts`:
`merge_rule_applied`, `merge_rule_cancelled`, `wizard_step_completed`,
`wizard_step_reopened`, `cycle_cloned`. (Audit module accepts unknown
actions but the action label lookup needs explicit entries.)

---

## Test surface

| Suite                                  | Coverage                                                    |
|----------------------------------------|-------------------------------------------------------------|
| Domain unit tests (xUnit)              | Invariants on every entity (weight sums, threshold ranges, merge-rule shape) |
| Application use-case tests             | Each use case: happy path + permission deny + concurrency 409 |
| Integration tests (Testcontainers)     | Full HTTP roundtrips per endpoint; atomic Apply transaction; atomic Clone transaction |
| Architecture tests (NetArchTest)       | Committees / Notifications modules respect FR-M02            |
| Frontend service tests (Vitest + MSW)  | Each migrated service returns parsed entities, propagates 409 to UI |
| Frontend component tests (Testing Library + jest-axe) | New drawers: MergeSplitApplyDrawer, CopyFromCycleDrawer |
| Playwright E2E                         | One happy-path per priority band (P1, P2, P3, P4)            |
