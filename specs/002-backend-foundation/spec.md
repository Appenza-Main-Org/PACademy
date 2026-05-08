# Feature Specification: Backend foundation — durable admin-app data, identity, audit

**Feature Branch**: `002-backend-foundation`
**Created**: 2026-05-08
**Status**: Clarified (awaiting `/speckit.plan`)
**Input**: User description: "phase 2"

## Background

The admin app surface (`/admin/*`) is currently feature-complete in the SPA, but every read and write goes against an in-memory mock dataset that lives in the browser. Two admins on two machines see two different "realities", a refresh wipes any edit, and the role-picker on `/staff-login` accepts any non-empty credentials. This feature replaces that browser-local theatre with the platform's persistence + identity + audit foundation, so the admin app can be operated by real Ministry staff.

The applicant portal (Stage 1–11 wizard, SMS verification, cross-device recovery) is **explicitly out of scope** here — it depends on the same foundation but ships as a separate feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin edits persist across refresh, restart, and across admins (Priority: P1) 🎯 MVP

An admin opens an applicant detail page, updates the status from "قيد المراجعة" to "مقبول", and clicks save. They refresh the page — the new status is still there. A second admin on a different machine refreshes their applicants list within the agreed propagation window — they see the new status too. The API server is restarted overnight; the change is still there in the morning. Today none of this is true: the edit lives in a mutable JS array in browser memory and is gone the moment the tab is closed.

**Why this priority**: Without durable shared storage, the admin app cannot replace the manual paper process — it has zero operational value. Every other story in this spec depends on this one being true.

**Independent Test**: Admin A edits applicant X's status. Admin B on a separate browser context refreshes `/admin/applicants/X` within the propagation window and sees the new value. Restart the API process; the value is still readable.

**Acceptance Scenarios**:

1. **Given** admin A has saved a status change, **When** admin B refreshes the applicant detail page within the propagation window, **Then** admin B sees the new status with an indicator of when and by whom it was last changed.
2. **Given** any admin has saved a configuration change (cycle, category, workflow, admission rule, or reference-data row), **When** the platform is restarted, **Then** the change is still readable on the next request.
3. **Given** two admins are viewing the same list, **When** one of them filters by status, **Then** their view changes only for them; the other admin's list is unaffected until they refresh or refilter.

---

### User Story 2 — Admin staff sign in with real provisioned identities (Priority: P1)

A super-admin provisions a new committee-admin account for a real person (username, email, full name, unit, role). That person signs in from their workstation with the provisioned credentials. They land on the hub showing exactly the apps their role can access (committee admin sees admin, committee, barcode, biometric — and nothing else). Their session lasts for a configurable timeout and is enforced server-side; closing the browser does not preserve the session past timeout. When the super-admin deactivates the account, the deactivated admin's next request is rejected.

**Why this priority**: The current `/staff-login` accepts any non-empty credentials and derives the user from the role-picker. RBAC has no meaning until identities are real. Audit (US3) is also meaningless without real actors.

**Independent Test**: Super-admin provisions a committee_admin account; that user signs in, lands on hub with only the four committee_admin apps visible, and their `/admin/audit` writes carry their identity. Super-admin deactivates the account; the deactivated user's next API call is rejected.

**Acceptance Scenarios**:

1. **Given** a super-admin has just provisioned a new system user, **When** that user signs in with the provisioned credentials, **Then** they land on the hub with only the apps their role permits visible and accessible.
2. **Given** a system user's account is deactivated, **When** the deactivated user makes their next request, **Then** they are signed out and prevented from re-authenticating; in-flight unsaved edits are discarded.
3. **Given** the configured session timeout has elapsed, **When** an admin makes their next request, **Then** they are sent to `/staff-login` to re-authenticate; on return they land back on the page they were viewing.
4. **Given** an admin attempts to access an app their role cannot reach (e.g. records_clerk navigating to `/board`), **When** the route loads, **Then** they are redirected to their hub with an explanatory message.

---

### User Story 3 — Every admin write is captured in an immutable audit log (Priority: P1)

Every create / update / delete on an applicant, system user, cycle, category, workflow, admission rule, or reference-data row produces an audit entry that captures the actor's identity, the UTC timestamp, the target entity and its identifier, the field-level diff (where applicable), and the outcome (success / permission-denied / validation-failed). Audit entries cannot be edited or deleted after they're written. The `/admin/audit` page filters by actor / target type / target ID / action / date range against the live log. Audit retention is indefinite.

**Why this priority**: The Ministry of Interior treats admission decisions as legal acts; audit is a regulatory requirement, not a polish item. Without it, the platform cannot be trusted as a system of record.

**Independent Test**: Admin A flips applicant X's status. Admin B opens `/admin/audit` and finds an entry showing admin A's identity, UTC timestamp, applicant X as target, the field name, old value, new value, and outcome=success. An attempt to UPDATE or DELETE the entry directly is rejected.

**Acceptance Scenarios**:

1. **Given** any admin write succeeds, **When** an admin opens `/admin/audit`, **Then** the entry shows actor, timestamp, target, field diff, and outcome=success.
2. **Given** an admin attempts a write their role does not permit, **When** the rejection fires, **Then** an audit entry with outcome=permission-denied is recorded with the same actor / target / timestamp shape.
3. **Given** an admin attempts a write that fails validation, **When** the rejection fires, **Then** an audit entry with outcome=validation-failed is recorded.
4. **Given** an audit entry exists, **When** anyone (including a database administrator) attempts to UPDATE or DELETE it, **Then** the operation is rejected at the storage layer.
5. **Given** the audit table holds a year's worth of entries, **When** an admin filters `/admin/audit` by actor + date range, **Then** the filtered query completes within the staleness budget defined in SC-005.

---

### User Story 4 — Admin reference data, cycles, categories, workflows, and admission rules are durable (Priority: P2)

A super-admin creates the "2027 Female" admission cycle, defines its admission rules (age band, height range, BMI band, eyesight minimum, accepted certificates, fee schedule, max applications per year), and adds three new reference-data rows (e.g. a renamed faculty in the colleges tab). A different super-admin on another machine refreshes their reference-data view within the propagation window — the new rows appear. The renamed faculty does not retroactively rewrite the records of historical applicants who selected the prior name.

**Why this priority**: These are configuration objects that drive every applicant-facing decision. Staleness here is more forgivable than for applicant edits, but they must be real and they must preserve history.

**Independent Test**: Super-admin creates a cycle + adds a reference-data row. A second super-admin sees both within the propagation window. A historical applicant record that referenced the prior reference-data value continues to display the prior value.

**Acceptance Scenarios**:

1. **Given** a super-admin creates a new admission cycle, **When** another super-admin refreshes `/admin/cycles`, **Then** the new cycle appears within the propagation window.
2. **Given** the active cycle has admission rules attached, **When** the admin who set them refreshes the page, **Then** the same values come back unchanged.
3. **Given** a reference-data row is renamed, **When** a historical applicant record referencing the prior value is viewed, **Then** the record still shows the value that applied at the time of submission.

---

### User Story 5 — The 240-applicant demo dataset is migrated into durable storage (Priority: P2)

When the platform first comes up against real storage, the existing 240-applicant demo dataset that today lives in `frontend/src/shared/mock-data/` is migrated into the durable store as historical records, so the demo storyline survives the cutover. Each migrated row is flagged as "demo origin" so a future feature can filter the demo data out of operational reports.

**Why this priority**: Demo continuity matters for the 2026-05-29 Ministry demo. Losing the storyline by starting from an empty database is unacceptable.

**Independent Test**: After bringing up the platform fresh against the migration, `/admin/applicants` lists 240 demo applicants with the same names, statuses, stages, and registration timestamps the legacy mock showed. The demo flag is queryable.

**Acceptance Scenarios**:

1. **Given** a fresh platform with the migration applied, **When** an admin opens `/admin/applicants`, **Then** the 240 demo applicants appear with the same shape the legacy mock showed.
2. **Given** the same fresh platform, **When** an admin opens `/admin/users`, **Then** the seeded system users (one per RBAC role) are listed and the super-admin can sign in with their seeded credentials.
3. **Given** a future feature filters operational reports by demo-origin, **When** the filter is applied, **Then** the 240 seeded applicants are excluded and only real applicant submissions remain.

---

### User Story 6 — Reports panels reflect live data within the staleness budget (Priority: P2)

The admin reports command center (`/admin/reports`) shows aggregated KPIs (registration tempo, stage funnel, operational status, etc.). When new admin or seed data lands, the panels reflect it within an agreed staleness window. When the live aggregations cannot be computed (e.g. data layer briefly unavailable), the page renders an explicit "data unavailable, last updated at HH:MM" state instead of a misleading stale-but-fresh-looking number.

**Why this priority**: Reports inform daily operational decisions during the intake window. They must be live to be useful, but real-time-to-the-second is overkill — a 5-minute window is acceptable.

**Independent Test**: Five new applicants are inserted via admin actions. A super-admin opens `/admin/reports`. The "Registration Tempo" panel shows the new entries within the staleness budget. Simulate the data layer being unavailable; the panel renders the "data unavailable" state with the timestamp of the last successful refresh.

**Acceptance Scenarios**:

1. **Given** new admin writes have landed within the staleness budget, **When** a super-admin opens `/admin/reports`, **Then** the panels reflect the new state.
2. **Given** the data layer is briefly unavailable, **When** reports cannot be computed, **Then** the page renders the four async states explicitly per the visual constitution — never a misleading stale-but-styled-fresh number.

---

### User Story 7 — Admin staff perform bulk operations (Priority: P2)

A super-admin needs to seed 27 governorates, 80+ colleges, and a few hundred qualifications into reference data without creating each row by hand. They upload an Excel (.xlsx) file with the rows to import. The platform processes the file row-by-row, commits the valid rows, and returns a downloadable error report listing every invalid row with its row number and reason. The admin fixes the bad rows in their spreadsheet and re-uploads only those. Audit captures one summary entry for the whole import (file name, row count, success count, failure count) plus a per-row child diff, so forensics are still possible without flooding the primary audit list. The same shape applies to bulk-update and bulk-archive operations across all admin-managed resources.

**Why this priority**: Single-row CRUD is enough for daily operations, but onboarding (one-time seed of governorates / colleges / qualifications), end-of-cycle housekeeping (archive thousands of stale draft applicants), and Ministry-style data corrections (batch update statuses for a whole cohort) become impractical without it. P2 because the platform is operational without bulk for the May 29 demo — bulk is the durability of operations after demo day.

**Independent Test**: Super-admin uploads a 500-row .xlsx of governorates where 480 are valid and 20 have errors (e.g. duplicate names, missing required fields). The platform commits the 480, returns a downloadable error report listing the 20 with row numbers and reasons, and `/admin/reference-data/governorates` shows exactly 480 new rows. `/admin/audit` shows one batch-summary entry with row counts plus 480 per-row child diffs.

**Acceptance Scenarios**:

1. **Given** an Excel file with all valid rows, **When** an admin uploads it, **Then** every row is committed and one batch-summary audit entry plus per-row child diffs are recorded; outcome=success.
2. **Given** an Excel file with mixed valid + invalid rows, **When** an admin uploads it, **Then** valid rows commit, invalid rows are returned in a downloadable error report (row number + reason), and audit captures both the committed rows (per-row children) and the rejected rows (per-row children with outcome=validation-failed).
3. **Given** a bulk request exceeds 100,000 rows, **When** the upload is submitted, **Then** the request is rejected with an explicit "max batch size 100,000" message before any rows are processed.
4. **Given** a bulk-archive operation, **When** it touches a reference-data row that historical applicants referenced, **Then** the row is soft-deleted (FR-015) and historical applicant records continue to display the original value.
5. **Given** an admin attempts a bulk operation their role does not permit, **When** the request is rejected, **Then** a single permission-denied audit entry is recorded — no per-row children are created (the operation never reached row processing).

---

### Edge Cases

- **Concurrent admin edits to the same record** — two admins edit the same applicant or configuration row at the same time. Resolved policy: storage-level constraints (uniqueness, valid references, valid enum values) reject any write that would produce an invalid state. For the residual class of legitimate same-row edits at the application level (status changes, notes, profile fields, configuration objects), the system uses **silent last-write-wins**. Both writes remain independently audited per US3 so the prior value is recoverable from the audit log.
- **Admin deactivated mid-session** — see US2 acceptance scenario 2. In-flight unsaved edits are discarded; saved edits remain attributed to the now-deactivated admin in audit.
- **Reference data renamed after applicants selected the prior name** — see US4 acceptance scenario 3.
- **Audit log volume during peak intake** — must remain queryable under load (e.g., 10k applicants × ~30 admin actions each = 300k entries within a single cycle). Indefinite retention means the table grows monotonically; queries MUST stay performant via indexing on actor / target / date.
- **Identical national IDs across cycles** — when the same person applies in two cycles, each application is an independent record. Admin staff viewing one cycle do NOT see prior-cycle history for that person from within this feature.
- **Reports panel queried while a refresh is mid-flight** — last successful snapshot is returned with its `last_refreshed_at` timestamp; never a partial snapshot.

## Requirements *(mandatory)*

### Functional Requirements

#### Persistence and consistency

- **FR-001**: Admin writes (applicant edits, system-user changes, cycles, categories, workflows, admission rules, reference data) MUST persist permanently in shared storage and be visible to other admin staff within an agreed propagation window (see SC-002).
- **FR-002**: The platform MUST preserve historical record values — when reference data is renamed or a cycle closes, applicant records that referenced the prior values MUST continue to show the values that applied at the time of submission.

#### Authentication and identity

- **FR-003**: System users MUST authenticate as a real provisioned identity. Identity source for this feature is **in-system credentials only**: a super-admin provisions accounts (with the System User fields enumerated under Key Entities) and the platform stores them. **The login credential is the user's `nationalId` (14-digit Egyptian National ID) plus a password.** Federation with the Ministry directory (LDAP/AD/SSO) is a follow-up feature gated behind a feature flag — this feature MUST leave a seam (an identity-provider abstraction) so federation can be added without rewriting the auth flow. Two-factor authentication via an external Ministry-approved API is also a follow-up feature; the auth flow MUST leave a seam so 2FA can be added without rewriting login (the second factor would gate the cookie-issue step after `nationalId` + password verifies).
- **FR-004**: Session timeout MUST be a configurable setting expressed in minutes (the operating value is set per environment, not hardcoded). Sessions do NOT survive maintenance windows or platform restarts; admins re-authenticate after any interruption that exceeds the configured timeout.
- **FR-005**: Account deactivation MUST take effect immediately — the deactivated admin's next request after the deactivation completes MUST be rejected, regardless of whether their session has otherwise expired.
- **FR-005a**: The platform MUST enforce a floor of **at least one active super-admin** at all times. Any deactivation (or self-deactivation) that would leave zero active super-admin accounts MUST be rejected with outcome=permission-denied and an audit entry recording the attempt.

#### Authorisation

- **FR-006**: Admin staff MUST see and edit only what their role permits, per the existing 11-role RBAC matrix; permission failures MUST be observable in the audit log.

#### Audit

- **FR-007**: Every write attempt (create, update, delete) on applicants, system users, cycles, categories, workflows, admission rules, and reference data MUST create an audit entry capturing actor identity, UTC timestamp, target entity and ID, field-level diff (where applicable), and outcome (success / permission-denied / validation-failed). Bulk operations (FR-024) emit one **batch-summary audit entry** plus a **per-row child** for each affected row (linked to the batch), so per-row forensics remain available without flooding the primary audit_entries table with redundant actor / timestamp metadata.
- **FR-008**: Audit entries MUST be immutable after creation. UPDATE and DELETE against the audit table MUST be rejected at the storage layer.
- **FR-009**: Audit entries MUST be retained **indefinitely**. The audit log is the legal record of platform activity and is never truncated. Capacity planning MUST assume monotonic growth.
- **FR-010**: The `/admin/audit` view MUST support filtering by actor, target type, target ID, action type, and date range, on the live data.

#### List operations and reports

- **FR-011**: All admin list views (applicants, users, audit, cycles, categories, workflows, admission rules, reference data) MUST support filtering, sorting, and pagination on the live data.
- **FR-012**: The `/admin/reports` aggregations MUST be computed against the live data with bounded staleness (see SC-005).
- **FR-013**: When live data is unavailable, the UI MUST render the four async states (idle, loading, empty, error) explicitly per the visual constitution; misleading "looks fresh" stale rendering is forbidden.

#### Conflict and concurrency

- **FR-014**: Concurrent writes MUST be handled in two layers:
  - **Storage-level constraints (primary defence)**: uniqueness, valid references, and valid enum values reject any write that would produce an invalid or duplicated state. These cover the majority of conflict classes (e.g., duplicate national ID within a cycle, illegal status transitions, orphaned references).
  - **Application-level (residual class)**: for rows where two admins can legitimately edit the same record at runtime (applicant status, notes, profile fields, configuration objects), the platform uses **silent last-write-wins** — the second writer's save overwrites the first without a conflict prompt. Both writes are independently audited per FR-007, so the prior value is recoverable from `/admin/audit`.

#### Lifecycle

- **FR-015**: All admin-managed records — applicants, system users, **and reference-data rows** (governorates, colleges, qualifications, etc.) — use **soft-delete**: the row is preserved with an `archived` flag, never physically removed. Soft-deleted records remain audit-traceable and retain referential integrity for historical lookups; they are excluded from active list views and from operational queries by default. Historical applicant records that referenced a now-archived reference-data row continue to display the original value (FR-002). Given indefinite audit retention (FR-009), no automated purge of soft-deleted rows is performed.
- **FR-016**: Cycles are **isolated**. When the same person (by national ID) applies in multiple cycles, each application is an independent record. Admin staff viewing one cycle do NOT see prior-cycle history for that person from within this feature.

#### Migration

- **FR-017**: At rollout, the existing demo dataset (240 applicants, the 3 active cycles, the 7 applicant categories, department workflows, the cycle's admission rules, and the reference-data dictionaries) MUST be preserved into the live store as historical records so the demo retains continuity with the current frontend. Real admin writes are appended to this seed. The seeded records MUST be flagged as "demo origin" so a future feature can filter them out of operational reports if needed. The **demo-origin flag is a permanent provenance marker** — it persists through subsequent admin edits to the row. Once a row is flagged demo-origin, it stays flagged.
- **FR-018**: At rollout, one system-user account per of the 11 RBAC roles MUST be seeded with development-only credentials so the demo storyline of "log in as super-admin / committee_admin / …" continues to work. Each seeded user carries the full System User field set (FR-029) populated with deterministic synthetic values — a valid 14-digit `nationalId`, a unique `officerCode`, an Arabic `fullName` matching the role label, a unique Egyptian-format `mobile`, a unique `email`, `isActive = true`, an `issueDate` in the recent past, and a unique `cardFactoryNumber`.

#### System user identity (FR-029, FR-030)

- **FR-029**: Every System User record MUST carry the following fields, all required: `nationalId`, `officerCode`, `fullName`, `mobile`, `email`, `isActive`, `issueDate`, `cardFactoryNumber`. The platform MUST enforce uniqueness on `nationalId`, `officerCode`, `email`, `mobile`, and `cardFactoryNumber` across active (non-archived) rows. `fullName` and `issueDate` are not unique. Soft-deleted (archived) rows do NOT contribute to the active-uniqueness check, so a re-provisioned officer can reuse a freed identifier.
- **FR-030**: Field-format validation on System User writes MUST enforce: `nationalId` is exactly 14 digits and parses as a valid Egyptian National ID (century digit + valid date-of-birth + valid gender digit); `mobile` matches the Egyptian mobile format (11 digits, prefix 010 / 011 / 012 / 015); `email` matches a standard email shape; `issueDate` is not in the future. `officerCode` and `cardFactoryNumber` accept alphanumeric values up to 32 characters; stricter Ministry-issued formats can be tightened later without a schema migration.

#### Bulk operations

- **FR-024**: The platform MUST support bulk operations across all admin-managed resources (applicants, system users, cycles, categories, workflows, admission rules, reference data). Operations: **bulk import** (create many rows from an uploaded file), **batch update** (change a field on many existing rows), **batch archive** (soft-delete many rows).
- **FR-025**: Bulk import MUST accept Excel (.xlsx) files. The expected column shape per resource type is documented in the import dialog and validated on upload. (CSV / JSON ingestion are out of scope for this feature; covered by FR-019/021 follow-ups if requested.)
- **FR-026**: Bulk operations MUST use **per-row partial-success** policy — valid rows commit, invalid rows are collected into a downloadable error report (row number + reason) returned in the same response. The committed rows are visible immediately in active list views (FR-011); the rejected rows are not. Admins fix the bad rows and re-upload them.
- **FR-027**: A single bulk operation MUST NOT exceed **100,000 rows**. Requests exceeding the cap MUST be rejected with an explicit error before any row is processed; admins split larger imports client-side. The platform processes within the cap synchronously — no background-job infrastructure is required at this volume.
- **FR-028**: Bulk operations MUST emit one **batch-summary audit entry** (file name where applicable, target resource type, row counts: total / committed / rejected, actor, UTC timestamp, batch outcome) plus a **per-row child diff** for each affected row, linked to the batch summary. Per-row children carry the same field-level diff shape as single-row writes (FR-007). Both the summary and the children are immutable (FR-008). The platform MUST use a high-throughput insert path for both the resource rows and their audit children so the audit volume scales linearly with import size without becoming the bottleneck.

#### Out of scope (this feature)

- **FR-019**: This feature does NOT cover the applicant portal (Stage 1–11 wizard, SMS verification, cross-device recovery). The applicant portal depends on the foundation laid here but ships as a separate feature.
- **FR-020**: This feature does NOT cover persistent applicant-uploaded files (Stage 3 photos, national ID scans). Persistent file storage is a separate, deferred feature.
- **FR-021**: This feature does NOT cover backend persistence for committees, board sessions, investigation cases, medical commission, barcode operations, biometric verification, or exams. Each of those is a subsequent feature that builds on this foundation.
- **FR-022**: This feature does NOT cover real SMS provider integration (no applicant portal in scope, so no SMS dispatch needed).
- **FR-023**: This feature does NOT cover federation with the Ministry directory (LDAP/AD/SSO). The identity-provider seam (FR-003) is the integration point for that follow-up.
- **FR-031**: This feature does NOT cover two-factor authentication via the external Ministry-approved 2FA API. The auth flow leaves a seam (FR-003) so 2FA can be added later as a second-factor gate before the cookie is issued — without rewriting the `nationalId` + password verification path.

### Key Entities

- **Applicant**: A person whose record is administered through `/admin/applicants/*`. Identified by national ID **within a cycle**. Owns status, stage marker, and the per-stage data captured by the (out-of-scope) applicant portal. Soft-deleted via an `archived` flag (FR-015). Independent records per cycle (FR-016).
- **System User** *(also referred to as "Admin" in user-facing copy when the role is admin-tier)*: A staff member with a Ministry-of-Interior officer identity. Required fields: `nationalId` (14-digit Egyptian ID, also the login credential — see FR-003), `officerCode` (Ministry-internal officer identifier), `fullName`, `mobile`, `email`, `isActive`, `issueDate` (date the officer's identity card was issued), `cardFactoryNumber` (serial number on the officer's identity card). Plus role + per-app permissions (the role drives which sidebar apps and admin pages they see) and the soft-delete `archived` flag (FR-015). Uniqueness: `nationalId`, `officerCode`, `email`, `mobile`, and `cardFactoryNumber` are each unique across active rows; `fullName` and `issueDate` are not.
- **Cycle**: An admission window (e.g., "2026 Male"). Owns its admission rules, eligibility criteria, intake dates, and the applicants that joined it.
- **Category**: An applicant classification (officer-track, support-track, etc.) that determines which workflow and which admission rules apply.
- **Workflow**: The sequence of stages an applicant passes through, with the conditions to advance between them.
- **Admission Rule**: A constraint applicants must satisfy (age, education, physical eligibility, …). Attached to a cycle.
- **Reference Data**: Lookup tables consumed by applicant and admin forms — governorates, faculties, languages, military service status, etc.
- **Audit Entry**: An immutable record of one write attempt: actor, timestamp, target, field diff, outcome. Retained indefinitely (FR-009). For bulk operations, the audit entry is a **batch-summary entry** (FR-028) carrying counts and the batch outcome.
- **Audit Per-Row Child**: An immutable per-row diff written under a bulk operation's batch-summary parent. Holds the same field-level shape as a single-row audit entry. Linked to its parent by a foreign key. Subject to the same immutability and retention rules as primary audit entries.
- **Bulk Operation Result**: The response body of a bulk request — total rows, committed count, rejected count, and a downloadable error report (per-row reasons) for the rejected subset. Not persisted; reproducible by re-querying audit.
- **Identity provider seam**: An abstraction over admin authentication. In this feature, the only implementation is in-system credentials; a follow-up feature plugs federation into the same seam (FR-003).
- **Report snapshot**: The materialised state of an aggregate KPI panel (registration tempo, stage funnel, operational status), refreshed within the staleness budget (FR-012).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of admin write operations produce a corresponding audit entry visible at `/admin/audit`. A daily reconciliation job confirms zero gaps.
- **SC-002**: When an admin saves a change, the new state is visible to other admin staff within 2 seconds (p95) and within 5 seconds (p99). Verified by synthetic checks run continuously during the intake window.
- **SC-003**: Admin list pages (`/admin/applicants` and similar) load at p95 ≤ 500 ms with 1,000 records and p95 ≤ 2 s with 10,000 records. Verified by load test before each release.
- **SC-004**: Audit log query performance — `/admin/audit` filtered queries return p95 ≤ 1 s with up to 1,000,000 retained entries (covers ~3 cycles of indefinite retention at projected volume).
- **SC-005**: Reports panels at `/admin/reports` reflect data committed within the previous 5 minutes (p95). Verified by synthetic.
- **SC-006**: 99.5% admin-app uptime during the 4-week intake window of a live cycle. Maintenance windows are pre-announced and excluded.
- **SC-007**: Zero data-loss incidents over a 30-day pilot — every admin write that returned a success is later retrievable.
- **SC-008**: Onboarding a new admin from "account provisioned" to "first useful action" takes ≤ 5 minutes, measured by usability testing with three real Ministry staff.
- **SC-009**: After the demo migration runs against a fresh store, `/admin/applicants` lists exactly 240 applicants and `/admin/users` lists exactly 11 system-user accounts (one per RBAC role); both checks pass deterministically across machines.
- **SC-010**: A bulk import of 100,000 valid reference-data rows commits within 60 seconds (p95) on the production-class deploy. A 100,000-row import with 5% invalid rows returns the per-row error report within the same budget.
- **SC-011**: 100% of bulk operations produce both a batch-summary audit entry and per-row children — no orphaned summaries, no orphaned children. Verified by the same daily reconciliation job referenced in SC-001.

---

## Resolved clarifications

The clarifications surfaced during the `/speckit.clarify` pass on 2026-05-08:

| # | Topic | FR / story affected | Resolution |
|---|---|---|---|
| 1 | Reference-data delete policy | FR-015 | Soft-delete (matching applicants + system users). Historical applicant records that referenced an archived row continue to display the original value (FR-002). |
| 2 | Super-admin self-deactivation | FR-005a | **Block** — at least one active super-admin must remain. Any deactivation that would leave zero active super-admins is rejected with outcome=permission-denied and audited. |
| 3 | Demo-origin flag persistence | FR-017 | **Permanent provenance marker.** Once flagged, stays flagged through subsequent admin edits. |
| 4 | Bulk operations scope | US7, FR-024–FR-028 | **In scope across all admin-managed resources.** Bulk import, batch update, batch archive. |
| 5 | Bulk import file format | FR-025 | **Excel (.xlsx) only** for this feature. CSV / JSON deferred. |
| 6 | Bulk validation policy | FR-026 | **Per-row partial-success.** Valid rows commit; invalid rows returned in a downloadable error report (row number + reason). |
| 7 | Bulk audit granularity | FR-028 | **One batch-summary audit entry plus per-row child diffs** linked to the summary. Both immutable; retained indefinitely. |
| 8 | Bulk batch size limit | FR-027 | **100,000 rows max** per request, processed synchronously. Oversize requests rejected before any row is processed. (Raised from initial 10k after stakeholder noted production files routinely exceed 60k rows.) |
| 9 | Bulk insert throughput | FR-028, plan §10 | High-throughput native insert path required (e.g., SQL-server-side bulk-copy) for both resource rows and audit children. Chunked `SaveChangesAsync` rejected at this volume — would not meet SC-010. |
| 10 | Audit shape at 100k+ scale | FR-028 | **Keep per-row children in the primary audit table.** SqlBulkCopy handles the throughput; existing composite indexes on `(target_type, target_id, occurred_at)` and `(actor_id, occurred_at)` stay performant. Sidecar table option rejected to preserve a single audit query path. |
| 11 | System User fields | Key Entities, FR-029 | Every System User carries `nationalId`, `officerCode`, `fullName`, `mobile`, `email`, `isActive`, `issueDate`, `cardFactoryNumber`. All required. Unique: `nationalId`, `officerCode`, `email`, `mobile`, `cardFactoryNumber` across active rows. |
| 12 | Login credential | FR-003 | **`nationalId` + password.** Email and officerCode become profile / contact attributes, not login fields. |
| 13 | Two-factor authentication | FR-003, FR-031 | **Out of scope this feature.** External Ministry-approved 2FA API is a follow-up; auth flow leaves a seam so 2FA gates the cookie-issue step without rewriting password verification. |
| 14 | System User input validation | FR-030 | `nationalId` 14-digit Egyptian format; `mobile` 11-digit Egyptian (010/011/012/015); `email` standard format; `issueDate` not in the future; `officerCode` + `cardFactoryNumber` alphanumeric ≤ 32 chars (loose initial format; tightenable without schema migration). |

### Phase 3 (US1) clarifications — 2026-05-08 retrospective

Surfaced during Phase 3 implementation; lock these in before Phase 4.

| # | Topic | FR / story affected | Resolution |
|---|---|---|---|
| 15 | Status changes via PATCH | US1, FR-014 | **Reject status in PATCH body.** PATCH `/admin/applicants/{id}` accepts only profile fields (`fullName`, `mobile`, `email`, `governorate`). Status transitions go through a dedicated `POST /admin/applicants/{id}/transition` endpoint (later phase) that requires a `reason` and validates against the workflow stage's allowed next-statuses. Matches the legacy demo's MOCK semantics and RFP §6 lifecycle. |
| 16 | Edit guards on terminal states | US1 | **Domain invariant.** Any PATCH on an applicant whose `status == Deferred` (`موقوف` / on-hold) is rejected by the domain with HTTP 422 + `code: APPLICANT_LOCKED`. Mirrors the legacy MOCK guard so the backend remains authoritative if the UI is bypassed. (Post-attendance-card-print guard deferred — that field is not yet part of the backend domain.) |
| 17 | Status vocabulary canon | US1 | **Backend canonical: PascalCase enum** (`Pending`, `UnderReview`, `Accepted`, `Rejected`, `Withdrawn`, `Deferred`). Frontend translates on the boundary in `applicant.service.ts`. Workflow-runtime values (e.g., `under_medical_review`, `passed_physical`, `awaiting_board_decision`) move to the backend enum in Phase 4+ as those features land. |
| 18 | Demo-origin DB enforcement | FR-017 | **Application-layer invariant only** (no DB trigger for now). Use cases never touch `demo_origin`; the contract is held by code review + tests. Reconsider if a regression ever occurs. |
| 19 | DomainConflictException HTTP mapping | T022 / Phase 3 | **422 Unprocessable Entity** (refines T022's original `→ 409`). 422 fits the "request well-formed but semantically can't be processed" case (e.g., locked applicant). 409 stays reserved for true concurrency conflicts if/when ETag/version checks are added (currently silent last-write-wins per FR-014, so 409 is unused). |

Carried forward (without change) from spec 001's clarification pass:

| Topic | Resolution |
|---|---|
| Conflict policy | DB constraints + silent last-write-wins; both writes audited (FR-014) |
| Admin identity source | In-system credentials; federation behind a flag in a follow-up (FR-003) |
| Session timeout | Configurable per environment in minutes; sessions don't survive restart (FR-004) |
| Audit retention | Indefinite (FR-009) |
| Audit immutability | Storage-layer enforced; UPDATE / DELETE rejected (FR-008) |
| Cycle isolation | Independent records per cycle; no cross-cycle history (FR-016) |
| Demo migration | 240 applicants + 11 RBAC users + cycles/categories/workflows/rules/ref-data preserved with permanent demo-origin flag (FR-017, FR-018) |
