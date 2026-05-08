# Feature Specification: Persistent applicant intake and admin operations

**Feature Branch**: `001-persistent-applicant-admin`
**Created**: 2026-05-08
**Status**: Clarified (awaiting `/speckit.plan`)
**Input**: User description: "Replace the mock applicant and admin service with real backend integration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Applicant data survives sessions and device switches (Priority: P1)

An applicant fills part of the 11-stage intake wizard, closes the browser, and later returns — possibly on a different device — and finds their progress preserved exactly where they left off. Nothing they entered is lost or fabricated; the data they see is the data they entered.

**Why this priority**: This is the entire reason the system exists from the applicant's perspective. The current product fakes this with browser-local storage that vanishes on cache clear, dies on a different device, and shows different data to each browser. Without true persistence, every other feature in the applicant flow is theatre.

**Independent Test**: An applicant authenticates with their phone and verification code, fills Stages 3 (personal-info text fields) and 4 (education), closes the browser, opens a different browser on a different device, re-authenticates with the same phone, and is taken to Stage 5 (the first unfilled stage) with all prior text data populated and editable. (File-upload fields — photo, ID scans — are out of scope this feature; see FR-022.) The data was never visible to any other applicant or to admin staff before submission.

**Acceptance Scenarios**:

1. **Given** an applicant has saved Stage 3 personal info, **When** they return after 24 hours on a different device, **Then** all Stage 3 text fields are populated with the values they entered and the wizard resumes at the first unfilled stage.
2. **Given** an applicant is mid-edit on Stage 4 with unsaved changes, **When** their connection drops and they re-open the page, **Then** the last server-confirmed save is shown and the system clearly indicates which fields were not saved.
3. **Given** an applicant has completed Stages 1–6, **When** they sign in from a new device for the first time and pass phone verification, **Then** the system recognises them and resumes their progress without asking them to re-enter prior stages.

---

### User Story 2 — Admin staff see real applicants in real time (Priority: P1)

Admin staff (committee admin, records clerk, super admin) open the applicants list and see actual people who submitted applications, not seeded fake data. When an applicant submits a stage, that fact becomes visible to admin staff promptly. Two admin staff on different machines see the same data at the same time.

**Why this priority**: Admin operations are the staff side of the same intake flow. If applicant data isn't shared with admins, the system has no operational value — it cannot replace the manual paper process.

**Independent Test**: Applicant A submits Stage 6 (payment confirmation). Within the agreed staleness window, Admin B on a separate machine refreshes `/admin/applicants` and sees Applicant A in the list with status reflecting their progress. Admin C on a third machine sees the same list with the same applicant.

**Acceptance Scenarios**:

1. **Given** an applicant has just completed Stage 3, **When** an admin opens the applicants list within the agreed staleness window, **Then** the applicant appears in the list with the correct stage marker.
2. **Given** two admin staff are viewing the applicants list simultaneously, **When** one filters by status "في الفحص الطبي", **Then** their view changes only for them; the other admin's view is unaffected until they refresh or refilter.
3. **Given** an applicant withdraws (admin marks the application withdrawn), **When** that applicant attempts to log back in, **Then** the system shows them the withdrawn-status messaging and prevents further intake activity.

---

### User Story 3 — Admin edits propagate and are auditable (Priority: P1)

When an admin edits an applicant — changing status, adding notes, fixing a typo, suspending an account — the change is durable, visible to other admins promptly, and recorded in an audit log that captures who, what, when, and what changed. The audit log is the legal record of what actually happened in the system.

**Why this priority**: Without durable edits and audit, the system cannot be trusted by the Ministry of Interior for a process that has legal weight (admission to a state security force). Audit is a regulatory requirement, not a nice-to-have.

**Independent Test**: Admin A edits Applicant X's status from "قيد المراجعة" to "مقبول". Admin B refreshes the applicant detail page on another machine and sees the new status. Both admins open `/admin/audit` and find an entry showing Admin A's identity, timestamp, applicant ID, the field changed, the old value, and the new value.

**Acceptance Scenarios**:

1. **Given** Admin A changes an applicant's status, **When** Admin B reloads the applicant detail page, **Then** Admin B sees the new status and an indication of when and by whom it was last changed.
2. **Given** Admin A edits an applicant's national ID, **When** Admin C opens `/admin/audit`, **Then** the entry shows actor, timestamp, applicant target, field name, old value, and new value with the colour code matching the action category.
3. **Given** an admin attempts to edit an applicant they don't have permission for (RBAC denial), **When** the edit is rejected, **Then** the rejection is itself audited with reason "permission denied".

---

### User Story 4 — Admin staff sign in with their actual identity and permissions (Priority: P1)

System users (admins, committee staff, doctors, investigators, exams coordinators, biometric operators, records clerks) sign in with credentials that belong to a real person, not a role-picker demo screen. Their role and permissions follow them across sessions and devices, enforced for the duration of a configurable session timeout.

**Why this priority**: The current `/staff-login` accepts any non-empty credentials and derives the user from the role-picker — this is fine for a demo but it has zero operational value. RBAC depends on real identities.

**Independent Test**: A super-admin provisions a new "committee admin" account for a real person. That person signs in from their workstation, gets the committee-admin sidebar and permissions, and after their session expires they sign in again the next day with the same outcome.

**Acceptance Scenarios**:

1. **Given** a super-admin has just provisioned a new committee_admin user, **When** that person signs in, **Then** they land on the hub with exactly the four apps committee_admin can access (admin, committee, barcode, biometric) and no others.
2. **Given** an admin's account is deactivated by a super-admin, **When** the deactivated admin makes their next request, **Then** they are signed out and prevented from re-authenticating; in-flight edits they had not saved are discarded.
3. **Given** the configured session timeout has elapsed, **When** an admin makes their next request, **Then** they are sent to `/staff-login` to re-authenticate.

---

### User Story 5 — Admin reference data, cycles, categories, workflows, and admission rules persist (Priority: P2)

Super-admins create and edit admission cycles, applicant categories, intake workflows, admission rules, and reference data (governorates, education tracks, languages, etc.). These changes are durable, visible to all admin staff, and survive server restarts. They are part of the same audit log as applicant edits.

**Why this priority**: These are configuration objects that drive every applicant-facing decision. They have to be real, but no applicant or admin sees them change in real time the way they see applicant edits — staleness here is more forgivable.

**Independent Test**: A super-admin creates the "2027 Female" admission cycle, defines its eligibility rules, and adds three new reference-data rows for a new university faculty. A different super-admin on another machine refreshes their reference-data tab and sees all three rows; an applicant at Stage 4 sees the new faculty in their dropdown.

**Acceptance Scenarios**:

1. **Given** a super-admin creates a new admission cycle, **When** another super-admin refreshes `/admin/cycles`, **Then** the new cycle appears.
2. **Given** the active cycle has admission rules attached, **When** an applicant at Stage 4 attempts to enter values that violate a rule, **Then** the system rejects the entry with the same rule message that admins configured.
3. **Given** reference data changes (a faculty is renamed), **When** historical applicants are viewed, **Then** their record shows what they originally selected, not the renamed value (history is preserved).

---

### User Story 6 — Reports reflect the live state (Priority: P2)

The admin reports command-center (`/admin/reports`) shows aggregated KPIs — registration tempo, stage funnel, operational status, etc. — computed from the live data, with bounded staleness, so super-admins are looking at reality rather than yesterday's snapshot.

**Why this priority**: Reports inform daily operational decisions during the intake window. They have to be live to be useful, but real-time-to-the-second is overkill — a 5-minute window is acceptable.

**Independent Test**: Five new applicants register in the last hour. A super-admin opens `/admin/reports`. The "Registration Tempo" panel shows the recent surge with at most a 5-minute lag.

**Acceptance Scenarios**:

1. **Given** applicants have registered within the last 5 minutes, **When** a super-admin opens reports, **Then** the registration KPI reflects them.
2. **Given** a stage's funnel changes (10 applicants advance from medical to interview), **When** a super-admin views the stage funnel within 5 minutes, **Then** the new counts are reflected.
3. **Given** the data layer is briefly unavailable, **When** reports cannot be computed, **Then** the page renders an explicit "data unavailable, last updated at HH:MM" state — never a misleading stale-but-styled-fresh number.

---

### Edge Cases

- **Mid-flight connection drop during applicant save** — the applicant must be told clearly which fields persisted and which did not; the wizard must not silently swallow lost edits.
- **Concurrent admin edits to the same applicant** — two admins editing the same record at the same time. Resolved policy: database-level constraints (unique, check, FK) reject any write that would produce an invalid state; for the residual class of legitimate same-row edits at the application level (status, notes, profile fields), the system uses **silent last-write-wins**. Both writes remain independently audited so the prior value is recoverable from `/admin/audit`.
- **Applicant clears browser storage mid-intake** — they must be able to recover by re-authenticating with phone + verification code; no data loss for text fields. (File-upload fields are mock-only; see FR-022.)
- **Admin deactivated mid-session** — in-flight unsaved edits are discarded; saved edits remain attributed to the now-deactivated admin in audit.
- **Cycle closes while an applicant is mid-intake** — the applicant must be told their cycle has closed. Partial applications do NOT carry forward; if the applicant wishes to apply in the next cycle, they re-submit from scratch.
- **Reference data renamed after applicants selected the prior name** — the applicant's record preserves the historical value and presentation; admins see both the historical and current names if they differ.
- **Audit log volume during peak intake** — the audit table must remain queryable under load (e.g., 10k applicants × ~30 admin actions each = 300k entries within a single cycle). Indefinite retention (FR-012) means the table grows monotonically; queries MUST stay performant via indexing on actor / target / date.
- **Applicant submits the same phone number twice within a cycle** — system must recognise them as the same applicant within that cycle, not create a duplicate. National ID is the durable identifier within a cycle.
- **Identical national IDs across cycles** — cycles are isolated. The same person applying in 2026 and again in 2027 produces two independent applications; admin staff do NOT see cross-cycle history from within this feature.
- **Session timeout elapses mid-edit** — admin is sent to re-authenticate; on return they land back on the page they were editing. In-flight unsaved edits are discarded.

## Requirements *(mandatory)*

### Functional Requirements

#### Persistence and consistency

- **FR-001**: Applicant data submitted at any wizard stage MUST persist permanently in shared storage and be retrievable by that applicant on any device after authenticating with phone + verification code. (File uploads excluded — see FR-022.)
- **FR-002**: Admin edits to applicant records MUST persist permanently and be visible to other admin staff within an agreed propagation window (see SC-002).
- **FR-003**: Admin reference data, cycles, categories, workflows, and admission rules MUST persist permanently and be visible to all admin staff after the propagation window.
- **FR-004**: The system MUST preserve historical record values — when reference data is renamed or a cycle closes, applicant records that referenced the prior values MUST continue to show the values that applied at the time of submission.

#### Authentication and identity

- **FR-005**: Applicants MUST authenticate via phone number + a verification code delivered to that phone. Real SMS provider integration is OUT OF SCOPE for this feature — the system exposes a stubbed contract for "request code" and "verify code" operations; a follow-up feature wires a Ministry-approved SMS provider behind that contract. Until then, the verification code is delivered out-of-band (e.g., dev logs, test endpoint) so the auth flow is testable end-to-end.
- **FR-006**: Admin staff MUST authenticate as a real provisioned identity. Identity source for this feature is **in-system credentials only**: a super-admin provisions accounts (username + password) and the system stores them. Federation with the Ministry directory (LDAP/AD/SSO) is a follow-up feature gated behind a feature flag — this feature MUST leave a seam (an identity-provider abstraction) so federation can be added without rewriting the auth flow.
- **FR-007**: Session timeout MUST be a configurable setting expressed in minutes (the operating value is set per environment, not hardcoded). Sessions do NOT survive maintenance windows or server restarts; admins re-authenticate after any interruption that exceeds the configured timeout.

#### Authorisation

- **FR-008**: Applicants MUST be able to read and write only their own data; cross-applicant access MUST NOT be possible from the applicant surface.
- **FR-009**: Admin staff MUST see and edit only what their role permits, per the existing 11-role RBAC matrix; permission failures MUST be observable in the audit log.

#### Audit

- **FR-010**: Every write operation (create, update, delete) on applicants, system users, cycles, categories, workflows, admission rules, and reference data MUST create an audit entry capturing actor identity, UTC timestamp, target entity and ID, field-level diff (where applicable), and outcome (success / permission-denied / validation-failed).
- **FR-011**: Audit entries MUST be immutable after creation.
- **FR-012**: Audit entries MUST be retained **indefinitely**. The audit log is the legal record of system activity and is never truncated. Capacity planning MUST assume monotonic growth.
- **FR-013**: The `/admin/audit` view MUST support filtering by actor, target type, target ID, action type, and date range, on the live data.

#### List operations and reports

- **FR-014**: All admin list views (applicants, users, audit, cycles, categories, workflows, admission rules) MUST support filtering, sorting, and pagination on the live data.
- **FR-015**: The `/admin/reports` aggregations MUST be computed against the live data with bounded staleness (see SC-005).
- **FR-016**: When the live data is unavailable, the UI MUST render the four async states (idle, loading, empty, error) explicitly per Constitution Principle III; misleading "looks fresh" stale rendering is forbidden.

#### Conflict and concurrency

- **FR-017**: Concurrent writes MUST be handled in two layers:
  - **Database constraints (primary defence):** unique, check, and foreign-key constraints reject any write that would produce an invalid or duplicated state. These cover the majority of conflict classes (e.g., duplicate national ID, invalid status transitions modelled as enums, orphaned references).
  - **Application-level (residual class):** for rows where two admin staff can legitimately edit the same record at runtime (applicant status, notes, profile fields, configuration objects), the system uses **silent last-write-wins** — the second writer's save overwrites the first without a conflict prompt. Both writes are independently audited per FR-010, so the prior value is recoverable from `/admin/audit`.

#### Lifecycle

- **FR-018**: Both applicants and system users use **soft-delete**: the row is preserved with an `archived` flag, never physically removed. Soft-deleted records remain audit-traceable and retain referential integrity for historical lookups; they are excluded from active list views and from operational queries by default. Given indefinite audit retention (FR-012), no automated purge of soft-deleted rows is performed.
- **FR-019**: Cycles are **isolated**. When the same person (by national ID) applies in multiple cycles, each application is an independent record. Admin staff viewing one cycle do NOT see prior-cycle history for that person from within this feature. Cross-cycle linkage is a possible future feature, not part of this scope.

#### Migration

- **FR-020**: At rollout, the existing 240-applicant mock dataset MUST be preserved into the live system as historical data so the demo retains continuity with the current frontend. Real applicant submissions in the live system are appended to that seed. The seeded records MUST be flagged as "demo origin" in the data so they can be filtered out of operational reports if needed.

#### Out of scope (this feature)

- **FR-021**: This feature does NOT cover persistence for: committees, board sessions, investigation cases, medical commission, barcode operations, biometric verification, or exams. Those are tracked in subsequent features.
- **FR-022**: This feature does NOT cover persistent applicant-uploaded files (Stage 3 photos, national ID scans). The wizard continues to accept files in-memory; they are lost on refresh, on device-switch, and on session expiry. Persistent file storage is a separate, deferred feature. Acceptance tests for file fields are excluded from this feature's scope; tests for adjacent text fields proceed normally.

### Key Entities

- **Applicant**: A person applying for admission. Identified by national ID **within a cycle**. Owns wizard-stage data spanning Stages 1–11. Has a status that progresses through the intake workflow. Soft-deleted via an `archived` flag. Independent records per cycle (FR-019).
- **Wizard stage submission**: The applicant's data for a given stage of the wizard. Distinct submissions per stage; each stage has its own validation and audit footprint.
- **System User**: A staff member with an identity, role, and per-app permissions. The role drives which sidebar apps and admin pages they see. Soft-deleted via an `archived` flag.
- **Cycle**: An admission window (e.g., "2026 Male"). Owns its admission rules, eligibility criteria, intake dates, and the applicants that joined it. Cycles are isolated from one another (FR-019).
- **Category**: An applicant classification (officer-track, support-track, etc.) that determines which workflow and which admission rules apply.
- **Workflow**: The sequence of stages an applicant passes through, with the conditions to advance between them.
- **Admission Rule**: A constraint applicants must satisfy (age, education, physical eligibility, …). Attached to a cycle.
- **Reference Data**: Lookup tables consumed by applicant and admin forms — governorates, faculties, languages, military service status, etc.
- **Audit Entry**: An immutable record of one write attempt: actor, timestamp, target, field diff, outcome. Retained indefinitely (FR-012).
- **Identity provider seam**: An abstraction over admin authentication. In this feature, the only implementation is in-system credentials; a follow-up feature plugs federation into the same seam (FR-006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of applicant-submitted text data across the 11-stage wizard is recoverable on a different device after the applicant authenticates — verified by an end-to-end test running once per release. (File-field recovery is excluded — FR-022.)
- **SC-002**: When an applicant submits any stage, the new state is visible to admin staff within 2 seconds (p95) and within 5 seconds (p99). Verified by synthetic checks run continuously during the intake window.
- **SC-003**: 100% of admin write operations produce a corresponding audit entry visible at `/admin/audit`. A daily reconciliation job confirms zero gaps.
- **SC-004**: Admin list pages (`/admin/applicants` and similar) load at p95 ≤ 500 ms with 1,000 records and p95 ≤ 2 s with 10,000 records. Verified by load test before each release.
- **SC-005**: Reports panels at `/admin/reports` reflect data committed within the previous 5 minutes (p95). Verified by synthetic.
- **SC-006**: 99.5% applicant-facing intake uptime during the 4-week intake window of a live cycle. Maintenance windows are pre-announced and excluded.
- **SC-007**: Zero data-loss incidents over a 30-day pilot — every applicant or admin write that returned a success is later retrievable.
- **SC-008**: Audit log query performance — `/admin/audit` filtered queries return p95 ≤ 1 s with up to 1,000,000 retained entries (covers ~3 cycles of indefinite retention at projected volume).
- **SC-009**: Onboarding a new admin from "account provisioned" to "first useful action" takes ≤ 5 minutes, measured by usability testing with three real Ministry staff.

---

## Resolved clarifications

The clarifications surfaced in the initial draft were resolved during the `/speckit.clarify` pass on 2026-05-08:

| # | Topic | FR / Edge case | Resolution |
|---|---|---|---|
| 1 | Conflict policy | FR-017, edge case "concurrent admin edits" | DB constraints (unique / check / FK) prevent invalid states; for application-level same-row edits, **silent last-write-wins**. Both writes audited so prior value recoverable from `/admin/audit`. |
| 2 | SMS delivery scope | FR-005 | **Stub the contract in this feature**; real Ministry-approved SMS provider wires into the same contract in a follow-up feature. |
| 3 | Admin identity source | FR-006 | **In-system credentials only** in this feature, provisioned by super-admin. Federation with Ministry directory is a follow-up behind a feature flag — leave an identity-provider seam. |
| 4 | Session continuity | FR-007 | Session timeout is a **configurable setting in minutes**. Sessions do **not** survive maintenance / restarts; admins re-authenticate after any interruption beyond the configured timeout. |
| 5 | Audit retention | FR-012 | **Indefinite.** Audit log is never truncated. |
| 6 | Delete policy | FR-018 | **Soft-delete** for both applicants and system users. Rows preserved with `archived` flag, audit-traceable, no automated purge. |
| 7 | Cross-cycle linkage | FR-019, edge case "identical national IDs across cycles" | **Cycles are isolated.** Re-applications are independent records; admins do not see cross-cycle history from this feature. |
| 8 | Mock-data migration | FR-020 | **Preserve the existing 240-applicant seed** into the live system at rollout, flagged as "demo origin" so it can be filtered from operational reports if needed. |
| 9 | File-upload scope | FR-022 | **Stay mock** in this feature. Stage 3 photos / ID scans accepted in-memory and lost on refresh; persistent file storage is a separate, deferred feature. |
| 10 | Cycle close mid-intake | Edge case "cycle closes while applicant is mid-intake" | **Re-submit from scratch** in the next cycle. No carry-forward of partial applications. |
