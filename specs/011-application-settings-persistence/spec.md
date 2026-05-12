# Feature Specification: Application Settings Persistence

**Feature Branch**: `011-application-settings-persistence` (to be created off `009-admission-setup-persistence` after merge)
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "Persist the admission-setup wizard's step 1 (`application_settings`) — the global three-tier hierarchy that the frontend ships on `origin/main` as `applicationSettingsService` mock — to SQL Server. Spec 009 (admission-setup persistence) explicitly excludes this step; spec 011 owns it end-to-end."

## Clarifications

### Session 2026-05-12

- Q: Is application settings cycle-scoped or global? → A: **Global master data — not cycle-scoped.** The three-tier hierarchy (category → specialization → year) is configured once and read by every cycle's eligibility check. Changing a year row affects all in-flight and future cycles that haven't already snapshotted the eligibility decision. Per-cycle overrides are out of scope for V1.
- Q: How does the wizard's per-cycle "complete" pill work for a global step? → A: **Pill state stays per-(cycle, step) in `wizard_step_statuses`** (owned by spec 009), but the underlying data is global. Marking the step complete for a cycle is the admin acknowledging that they've reviewed the global config and consider it ready for *this* cycle. Editing the global config does NOT auto-demote any other cycle's pill — that's an explicit admin action per cycle.
- Q: What's the atomicity guarantee on bulk-save? → A: **All-or-nothing per `bulkSave` call.** The frontend's "Save changes" button on the sticky bar submits one bulk-save payload (`BulkYearChange[]`). If any change in the batch violates an invariant (DUPLICATE_YEAR, OVERLAPPING_PERIOD, GENDER_REQUIRED, …), the entire batch is rolled back and the response carries the per-row error map. The admin sees inline validation hints next to the offending rows.
- Q: When a year row's gender set changes, how is the overlap rule applied? → A: **Two rows with the same `(category_specialization_id, graduation_year)` are permitted iff their gender sets are disjoint.** Likewise for overlapping date windows. The canonical representation is a side table `applicant_specialization_year_genders` keyed on `(year_id, gender_type)`. The overlap-check trigger joins through that side table.
- Q: How does soft-delete work? → A: **Three levels:** (1) Category configs can be deactivated (`is_active=false`) but not deleted — guarded by `CATEGORY_HAS_ACTIVE_YEARS`. (2) Specializations can be detached (hard-deleted from the junction; descendant years cascade-deleted). (3) Year rows soft-delete (`is_deleted=true`), preserving audit trail; deactivated years (`is_active=false`) hide from eligibility but survive in history.
- Q: Strict category↔specialization mapping enforcement? → A: **Deferred — `SPECIALIZATION_NOT_MAPPED` conflict code is reserved but not thrown in V1.** The lookup module has no SPC × CAT mapping junction today (only SPC × FAC). When (if) that mapping ships, the attach-specialization endpoint switches to a mapping-aware check; the service contract is forward-compatible.

## User Scenarios & Testing *(mandatory)*

Application Settings is the operator's single source of truth for **who** can apply to the Academy and **when**. Currently the frontend ships a fully-featured editor (the `application_settings` wizard step on `origin/main`, ~12 components, MSW-mocked) that writes only to in-memory `MOCK.applicantCategoryConfigs` etc. Nothing survives the page reload, nothing is visible to a second admin, and no cycle's eligibility engine can ever read it. Spec 011 closes that gap.

### User Story 1 — The three-tier editor persists end-to-end (Priority: P1) 🎯 MVP

A super-admin opens the wizard step 1 (`application_settings`), enables one applicant category from the lookup catalogue, attaches two specializations to it, adds three year rows under each specialization with distinct graduation years and gender sets, clicks the sticky "Save changes" bar, closes the browser, and signs back in from a different machine. They see exactly the saved state: the same category active, the same specializations attached, the same six year rows with their gender/marital/age/grade/window values intact. A second admin opening the same step sees the same data.

**Why this priority**: The editor is 100% non-functional for production today. Operators can configure the admission funnel front-to-back, close the tab, and lose everything. Until the three-tier hierarchy persists, no cycle can ever go live because the eligibility engine has no rules to read. This is the highest user-visible gap.

**Independent Test**: A super-admin configures one category → two specializations → six years with assorted gender/marital/age/grade values, refreshes, then opens the same URL on another browser as a different super-admin — the state must match byte-for-byte (modulo `updatedAt`).

**Acceptance Scenarios**:

1. **Given** an admin enables a previously-disabled category config, **When** they reload, **Then** the category appears active in the accordion with its prior specialization attachments restored.
2. **Given** an admin attaches a new specialization to an active category, **When** they reload, **Then** the specialization appears in the list with zero year rows and an empty `YearTable` placeholder.
3. **Given** an admin adds a year row (gradYear=2026, genders=[male], maxAge=22, grades=85–100, window=2026-07-01→2026-08-15, ageCalcDate=2026-09-01), **When** they reload, **Then** the row appears in the table with every field populated.
4. **Given** an admin edits an existing year row's `maxAge` from 22 to 21, **When** they click Save in the sticky bar, **Then** the bar disappears and a subsequent reload shows `maxAge=21`.
5. **Given** an admin deletes a year row, **When** they reload, **Then** the row is absent from the table and an audit entry records the deletion.
6. **Given** an admin makes 4 changes (1 create, 2 updates, 1 delete) across 3 specializations and clicks "Save changes" once, **When** the bulk-save returns success, **Then** all 4 changes are reflected on reload and exactly 4 audit entries exist with sequential timestamps within the same transaction window.

### User Story 2 — Invariants enforced with typed conflict codes (Priority: P1)

A super-admin attempts a save that violates one of the 7 invariants. The server rejects with HTTP 409 / 422 and a typed body (`{ code: 'DUPLICATE_YEAR', … }`) that the frontend maps to a specific Arabic toast + inline hint on the offending row. The admin sees what's wrong and can fix it without guessing.

**Why this priority**: The frontend mock service already throws every conflict code listed below. Backend integration MUST mirror the codes verbatim — any drift breaks the UI's typed error handling. This is non-negotiable on integration day. Without it, the admin sees generic "save failed" and has no path to recovery.

**Independent Test**: Submit a deliberately-conflicting bulk-save payload (e.g., two rows with `(year=2026, genders=[male, female])` under the same specialization). The response carries `code='DUPLICATE_YEAR'` and the offending row id in the per-row error map. Repeat for all 7 codes.

**Acceptance Scenarios**:

1. **Given** an admin tries to save two year rows with the same `(graduation_year, gender_intersection)` under one specialization, **When** the bulk-save lands, **Then** the server responds with `409 DUPLICATE_YEAR` and the second row's id in `fieldErrors`.
2. **Given** an admin tries to save two year rows with overlapping date windows AND overlapping gender sets under one specialization, **When** the bulk-save lands, **Then** the server responds with `409 OVERLAPPING_PERIOD`.
3. **Given** an admin submits a row with `applicationEndDate < applicationStartDate`, **When** the bulk-save lands, **Then** the server responds with `422 INVALID_DATE_RANGE`.
4. **Given** an admin submits a row with `maxAge=0` or `maxAge=-5`, **When** the bulk-save lands, **Then** the server responds with `422 AGE_NOT_POSITIVE`.
5. **Given** an admin submits a row with `minGrade=80, maxGrade=60`, **When** the bulk-save lands, **Then** the server responds with `422 GRADE_RANGE_INVALID`.
6. **Given** an admin submits a row with `genderTypes=[]` (empty), **When** the bulk-save lands, **Then** the server responds with `422 GENDER_REQUIRED`.
7. **Given** an admin tries to deactivate a category config while it has descendant year rows with `is_active=true`, **When** the PATCH lands, **Then** the server responds with `409 CATEGORY_HAS_ACTIVE_YEARS`.

### User Story 3 — Audit trail for every mutation (Priority: P2)

Every state-changing call on the three-tier hierarchy emits exactly one audit entry through the existing audit middleware. The audit row carries actor, timestamp, action label, entity id, and before/after snapshots. The admin's "Audit Trail" page (`/admin/audit`) lists these entries with the existing filter chrome.

**Why this priority**: Compliance + traceability. Application settings drive admission eligibility — every change is a potential dispute vector. Auditability is required for the demo deadline.

**Independent Test**: Run a 4-change bulk-save (1 create, 2 update, 1 delete), then load `/admin/audit?module=lookups&entityType=ApplicantSpecializationYear` and confirm 4 rows appear in chronological order with the expected before/after deltas.

**Acceptance Scenarios**:

1. **Given** an admin creates a year row, **When** the save commits, **Then** an audit entry with `action=create`, `entityType=ApplicantSpecializationYear`, `before=null`, `after={…}` is written.
2. **Given** an admin edits a year row's `maxAge`, **When** the save commits, **Then** the audit entry's `before` has the old value and `after` has the new value.
3. **Given** an admin deactivates a category config (`is_active=false`), **When** the save commits, **Then** an audit entry with `action=update`, `entityType=ApplicantCategoryConfig`, `before.isActive=true`, `after.isActive=false` is written.
4. **Given** an admin attaches a specialization, **When** the save commits, **Then** an audit entry with `action=create`, `entityType=ApplicantCategorySpecialization` is written.

### Edge Cases

- **Empty gender set on edit.** A row that previously had `genders=[male]` cannot be edited to `genders=[]` — caught by `GENDER_REQUIRED` at the side-table cardinality trigger.
- **Concurrent edits to the same year row.** Optimistic locking via `rowVersion`/ETag — same pattern as spec 009. A stale rowVersion returns 409 `ROW_VERSION_CONFLICT`.
- **Lookup row deletion.** If the `applicant-categories` lookup catalogue removes a row that has an active `applicant_category_configs` referencing it, the config row is *not* auto-cleaned — admin must explicitly deactivate. Spec 010 (Lookups) enforces `IN_USE` on the lookup-row delete attempt instead. (This is the contract handoff between specs 010 and 011.)
- **`updatedAt` precision under bulk save.** All rows touched by one bulk-save share the *same* `updated_at` timestamp (the transaction's start time), so the audit trail can join rows that were saved together.
- **Cross-cycle copy from spec 009 US4.** Since application settings is global, the spec 009 cross-cycle copy orchestrator does NOT clone the three-tier hierarchy. It only marks the *target cycle's* wizard step pill (`wizard_step_statuses` row for `application_settings`) as `in_progress` so the admin reviews the global config in the context of the new cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist `ApplicantCategoryConfig`, `ApplicantCategorySpecialization`, `ApplicantSpecializationYear` to SQL Server such that data survives process restarts, browser refreshes, and admin sign-outs across machines.
- **FR-002**: System MUST source the `categoryId` field of `ApplicantCategoryConfig` from the lookup catalogue's `applicant-categories` type (FK contract, not enum). Inserting a config row with an unknown `categoryId` MUST return 422.
- **FR-003**: System MUST source the `specializationId` field of `ApplicantCategorySpecialization` from the lookup catalogue's `specializations` type. Inserting with an unknown id MUST return 422.
- **FR-004**: System MUST persist each year row's gender set as 1..N rows in `applicant_specialization_year_genders` keyed on `(year_id, gender_type)`. Inserting a year with zero gender rows MUST return 422 `GENDER_REQUIRED`.
- **FR-005**: System MUST persist each year row's marital-status set as 0..N rows in `applicant_specialization_year_marital_statuses` keyed on `(year_id, marital_code)`. Empty set is the canonical "any marital status" representation.
- **FR-006**: System MUST reject two year rows under the same `category_specialization_id` with the same `graduation_year` *and* overlapping gender sets via INSTEAD-OF trigger throwing `DUPLICATE_YEAR`.
- **FR-007**: System MUST reject two year rows for the same specialization with overlapping `[application_start_date, application_end_date]` windows *and* overlapping gender sets via INSTEAD-OF trigger throwing `OVERLAPPING_PERIOD`.
- **FR-008**: System MUST enforce `application_end_date >= application_start_date` via CHECK constraint throwing `INVALID_DATE_RANGE`.
- **FR-009**: System MUST enforce `max_age IS NULL OR max_age > 0` via CHECK constraint throwing `AGE_NOT_POSITIVE`.
- **FR-010**: System MUST enforce `min_grade IS NULL OR max_grade IS NULL OR min_grade <= max_grade` via CHECK constraint throwing `GRADE_RANGE_INVALID`.
- **FR-011**: System MUST reject deactivation (`PATCH is_active=false`) of a category config when any descendant year row has `is_active=true AND is_deleted=false` via trigger throwing `CATEGORY_HAS_ACTIVE_YEARS`.
- **FR-012**: System MUST expose `POST /admin/app-settings/bulk-save` accepting `BulkYearChange[]` and committing all changes in one transaction. Any single-row failure rolls back the entire batch and returns 422 with per-row error map.
- **FR-013**: System MUST carry `rowVersion` (SQL Server `rowversion` type) on every year row + every config row + every specialization junction row, returning HTTP 409 `ROW_VERSION_CONFLICT` on stale-version saves.
- **FR-014**: System MUST emit audit entries for every mutation (create/update/delete/restore on each of the 3 tier rows), shaped as `(action, module='lookups', entityType, entityId, before, after, actor, timestamp)`.
- **FR-015**: System MUST cascade-delete descendant year rows when an `applicant_category_specializations` row is hard-deleted (the "detach specialization" admin action).
- **FR-016**: System MUST allow soft-delete of year rows (`is_deleted=true`) preserving audit trail; soft-deleted rows MUST be filtered from default reads, surfacing only via `?includeDeleted=true`.
- **FR-017**: System MUST sort `listCategoryConfigs` by `sort_order ASC, created_at ASC` for stable accordion ordering.
- **FR-018**: System MUST reserve the `SPECIALIZATION_NOT_MAPPED` conflict code for the future SPC × CAT lookup mapping. V1 attach-specialization endpoint MUST NOT throw it; the contract MUST accept the code in the response union so future enforcement is non-breaking.
- **FR-019**: System MUST require `admission-setup:read` permission for all GET endpoints and `admission-setup:write` for all mutating endpoints. (Spec 007 permission set is reused; no new policy.)
- **FR-020**: System MUST scope the three-tier hierarchy as **global** (no cycle FK). Per-cycle wizard step pill state lives in `wizard_step_statuses` (owned by spec 009); spec 011's tables have no `cycle_id` column.

### Non-Functional Requirements

- **NFR-001**: `listCategoryConfigs` MUST return within 200 ms p95 for the canonical 8-row test dataset (no caching layer required at this scale).
- **NFR-002**: `bulkSave` of 50 changes MUST complete within 1 s p95 on the dev DB.
- **NFR-003**: All 7 conflict codes MUST round-trip through the existing `apiClient` normaliser (`shared/api/errors.ts → normaliseError`) without code change to that file beyond the union extension.
- **NFR-004**: All Arabic labels in audit entries MUST come from the existing `ACTION_FALLBACK` map in `shared/lib/audit.ts` — no new audit-action keys required (the 7 conflict codes are *response* codes, not audit actions).

### Key Entities

- **`ApplicantCategoryConfig`** (parent tier — global, FK to lookup `applicant-categories`): one row per category the admin chooses to surface in the admissions funnel. Fields: `id, category_id (lookup FK), is_active, sort_order, created_at, updated_at, row_version`. No cycle scoping; no soft-delete (deactivate via `is_active=false`).
- **`ApplicantCategorySpecialization`** (junction tier — global, FK to `ApplicantCategoryConfig` + lookup `specializations`): junction joining a config row to a specialization. Fields: `id, config_id, specialization_id (lookup FK), is_active, created_at, row_version`. Hard-delete cascades to descendant years.
- **`ApplicantSpecializationYear`** (leaf tier — global): per `(category_specialization_id, graduation_year)`-with-gender-disjointedness, carrying eligibility constraints. Fields: `id, category_specialization_id, graduation_year, max_age (nullable), min_grade (nullable), max_grade (nullable), application_start_date, application_end_date, age_calc_date, is_active, is_deleted, deleted_at, deleted_by, created_at, updated_at, row_version`.
- **`ApplicantSpecializationYearGender`** (side table — gender M-of-N): rows keyed on `(year_id, gender_type)`. `gender_type` enum: `'male' | 'female'`. At least one row required per year (FR-004).
- **`ApplicantSpecializationYearMaritalStatus`** (side table — marital M-of-N): rows keyed on `(year_id, marital_code)`. `marital_code` references the marital-status reference data (post-merge: the 4-row enum in `shared/types/domain.ts` MaritalStatus union). Zero rows = "any marital status".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The bulk-save endpoint passes 100% of the per-conflict-code integration tests (7 tests, one per code, plus the happy-path bulk-save with 4 change kinds).
- **SC-002**: The Playwright E2E (super_admin → /admin/admission-setup/wizard/application-settings → 4 changes → save → refresh) completes in < 30 s on CI and asserts byte-equal state.
- **SC-003**: Application settings reads in the cycle eligibility check (driven by spec 009 + spec 011 wiring) complete in < 50 ms p95 once cached per admin session.
- **SC-004**: Zero `--no-verify` commits on the 011 branch; lint + typecheck + xUnit + Vitest pass on every commit.
- **SC-005**: The migration `011_ApplicationSettings` applies idempotently — re-running on a partially-migrated dev DB produces no errors and converges on the canonical schema.
