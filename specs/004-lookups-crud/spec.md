# Feature Specification: Admin Lookups CRUD

**Feature Branch**: `004-lookups-crud`
**Created**: 2026-05-09
**Last Clarified**: 2026-05-09
**Status**: Draft (clarified)
**Input**: User description: "All lookups CRUD operations as Phase 4 so super-admin can manage them"

> Continues the Phase 4 backend-integration push that spec 003 started. Spec 003 gave super-admin the ability to provision **operators**; this spec gives super-admin the ability to provision **the configuration data those operators consume**: reference dictionaries, admission cycles, applicant categories, admission rules, and workflows. Today every one of these surfaces renders mock data on the frontend while the backend has the entities but no CRUD endpoints. After this spec, the entire admin configuration surface is real.

## Clarifications resolved on 2026-05-09

| Q | Decision | Drives |
|---|---|---|
| Cycle uniqueness key | Single `Active` per `(year, cohort)` pair — 2026-male and 2026-female can run concurrently; two 2026-male cycles cannot. Drives a unique partial index `WHERE Status = Active`. | FR-Y02 |
| Workflow scope | One `Published` workflow per `(CategoryKey, CycleId)` pair — different cycles can ship different process workflows for the same category. Auto-archive of the prior Published is scoped to the same cycle. | FR-W02 |
| Mid-cycle category edits | Apply to **all** applicants (in-flight + new). Super-admin MUST acknowledge a risk-confirmation modal showing the count of affected in-flight applicants and the specific fields changing; the audit entry records the confirmation flag + affected count. | FR-K03 |
| Reference row rename propagation | Cosmetic — FK-based; all consumers see the updated `nameAr` everywhere. The old value is preserved only in the audit log's before/after diff. | FR-L05 |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Manage reference data dictionaries (Priority: P1) 🎯 MVP

A super-admin opens `/admin/reference-data/<tab>` (governorates, specializations, ranks, colleges, qualifications, nationalities, relationships, case-types) and can add a row, edit an existing row, archive a row, or reorder rows. Other apps that consume that dictionary (applicant wizard's governorate dropdown, investigation case-type picker, etc.) reflect the change without an API redeploy.

**Why this priority**: Reference dictionaries are the lowest-complexity, highest-blast-radius lookup. Today only one of the eight (governorates) is seeded into the backend; the other seven live exclusively in frontend mock files. Every other admin surface that needs a "pick a college" or "pick a case type" dropdown is currently demo-only. P1 because it unblocks every consuming feature.

**Independent Test**: Sign in as super_admin → open `/admin/reference-data/case-types` → add row "قضية تموين" → confirm it appears in the list, persists across reload, and shows up in the investigations create-case picker.

**Acceptance Scenarios**:

1. **Given** super_admin is on `/admin/reference-data/governorates`, **When** they GET the list, **Then** the response paginates 27 governorates with `X-Total-Count` + `X-Page-Count` headers and each row carries `id, category, key, nameAr, nameEn?, sortOrder, isActive`.
2. **Given** super_admin, **When** they POST a new row to a tab they have permission for, **Then** the response is 201 with the created DTO and an audit entry records `action=create, target=referenceDataEntry/{id}`.
3. **Given** super_admin, **When** they POST a row whose `(category, key)` pair already exists, **Then** the response is 422 with `code: REFERENCE_KEY_TAKEN`.
4. **Given** super_admin, **When** they POST a row to a tab whose category isn't in the eight allowed categories, **Then** the response is 400 with a category-validation error.
5. **Given** super_admin, **When** they archive a row that is referenced by an applicant or admission rule, **Then** the response is 422 with `code: REFERENCE_IN_USE` and the archive does not happen.
6. **Given** a non-super-admin authenticated user, **When** they POST/PATCH/DELETE any reference-data endpoint, **Then** the response is 403 with a permission-denied audit entry.
7. **Given** any authenticated user (not just super_admin), **When** they GET reference data, **Then** the response is 200 — read access is broader than write access because every consuming app needs the dictionaries.

---

### User Story 2 — Manage admission cycles (Priority: P1)

A super-admin opens `/admin/cycles` and can create a new cycle (year + cohort + open/close window + capacity), edit a draft cycle, transition a cycle through `Draft → Active → Closed → Archived`, and configure which categories are open within each cycle.

**Why this priority**: Cycles drive every applicant cohort. Without backend cycles, the public `/applicant/start` gate has nothing real to read; without status transitions, an admin can't open or close registration windows. P1 because applicant onboarding cannot ship without it.

**Independent Test**: Sign in as super_admin → POST a new cycle for 2026-male, set status `Active` → verify `GET /cycles?status=Active` returns it → verify the public `/applicant/start` page lists it as a selectable cycle.

**Acceptance Scenarios**:

1. **Given** super_admin, **When** they POST `/admin/cycles` with `{nameAr, cohort, year, openDate, closeDate, expectedCapacity}`, **Then** the response is 201 with the new cycle in `Draft` status and an audit entry.
2. **Given** super_admin and an existing draft cycle, **When** they PATCH it to `Active`, **Then** the transition is allowed only if `openDate ≤ now ≤ closeDate` AND no other Active cycle for the same `(year, cohort)` exists; otherwise 422 with `code: INVALID_CYCLE_TRANSITION` or `OVERLAPPING_ACTIVE_CYCLE`.
3. **Given** super_admin and an Active cycle, **When** they PATCH `Closed`, **Then** the response is 200 and any subsequent applicant submission for that cycle returns 422 `CYCLE_CLOSED`.
4. **Given** super_admin, **When** they PATCH a cycle's `openCategories` map, **Then** the response is 200 and the public picker reflects only the categories where `isOpen=true`.
5. **Given** super_admin, **When** they attempt to delete a cycle that has applicants, **Then** the response is 422 with `code: CYCLE_HAS_APPLICANTS`; cycles can be Archived but not hard-deleted once attached to applicants.
6. **Given** any authenticated user, **When** they GET `/cycles` (without the `/admin/` prefix), **Then** they see only Active + Closed cycles relevant to their role; super_admin's `/admin/cycles` shows all statuses.

---

### User Story 3 — Manage applicant categories (Priority: P1)

A super-admin opens `/admin/categories` and can edit the seven RFP-defined categories (officers_general, officers_specialized, postgraduate, institute_officers_training, institute_traffic, institute_guarding, special_units): their conditions (age range, score, qualification, gender, height, marital status, etc.), required tests, and procedures. Cycle-level overrides on conditions remain on the cycle (US2), not the category.

**Why this priority**: Categories define eligibility. Without backend categories, the eligibility check at `/applicant/eligibility` is computed against frontend mock conditions, so a real applicant can't be rejected for a real reason. P1 because eligibility gating is a Ministry-mandated control.

**Independent Test**: Sign in as super_admin → PATCH category `officers_general.conditions.minScorePercent = 85` → verify a synthetic applicant with 84% is rejected at `/applicant/eligibility` with reason `score_below_min`.

**Acceptance Scenarios**:

1. **Given** super_admin, **When** they GET `/admin/categories`, **Then** the response is 200 with all seven category rows and their full condition + required-test definitions.
2. **Given** super_admin, **When** they PATCH a category's condition fields with the correct `confirmedAffectedCount`, **Then** the response is 200 with the updated DTO and an audit entry records `{ confirmed: true, affectedApplicantCount: N, fieldsChanged: [...] }` plus the before/after JSON diff.
2a. **Given** super_admin, **When** they PATCH a category condition with a stale `confirmedAffectedCount` (because new applicants registered after the modal opened), **Then** the response is 422 with `code: STALE_AFFECTED_COUNT` so the SPA can re-fetch and re-confirm.
3. **Given** super_admin, **When** they POST a new category whose key isn't one of the seven RFP-defined keys, **Then** the response is 422 with `code: INVALID_CATEGORY_KEY`. The seven category keys are immutable; super_admin can't invent new ones.
4. **Given** super_admin, **When** they PATCH a category's `requiredTests` array, **Then** the order is preserved and any consuming workflow validates against the new sequence.
5. **Given** any authenticated user, **When** they GET `/categories`, **Then** they see all open categories — same shape as the public picker reads.

---

### User Story 4 — Manage admission rules (versioned) (Priority: P2)

A super-admin opens `/admin/admission-rules` and can publish a new version of admission rules for a specific cycle (age range, height by gender, BMI range, eyesight, marital status, accepted certificates, min percent by cert type, application fee by cert type, max applications per year). New versions are append-only — old versions remain queryable for audit and for applicants whose application was started under the old version.

**Why this priority**: Admission rules change yearly per Ministry directive. Versioning protects applicants in flight and keeps the audit trail clean. P2 because the rules can be seeded for the current cycle from a config file at first; live editing is needed before the second cycle, not the first.

**Independent Test**: Sign in as super_admin → POST a new admission rule v2 for cycle 2026-M → verify `GET /admin/admission-rules?cycleId=...` returns both v1 and v2 → verify the eligibility check uses v2 for applicants started after v2's `effectiveAt` and v1 for applicants already in flight.

**Acceptance Scenarios**:

1. **Given** super_admin and an existing v1 rule for cycle X, **When** they POST a new rule for cycle X, **Then** the response is 201, the new row carries `version=2, effectiveAt={now}, changedBy={super_admin}`, and v1 is **not** modified.
2. **Given** super_admin, **When** they attempt to PATCH or DELETE an existing admission rule version, **Then** the response is 405 with `code: ADMISSION_RULES_IMMUTABLE`. The only way to "change" a rule is to POST a new version.
3. **Given** an applicant whose `currentVersion` snapshot was v1, **When** the eligibility check runs after v2 is published, **Then** the check uses v1 (locked at applicant-creation time) — the v2 publish does not retroactively reject in-flight applicants.
4. **Given** super_admin, **When** they POST a rule with overlapping height ranges per gender or invalid BMI bounds, **Then** the response is 400 with field-specific validation errors.
5. **Given** super_admin, **When** they GET `/admin/admission-rules?cycleId=X`, **Then** the response includes all versions ordered by `effectiveAt DESC` for the audit trail.

---

### User Story 5 — Manage workflows (Priority: P2)

A super-admin opens `/admin/workflows` and can create, edit, publish, reorder, and archive workflows that define the stage sequence for a category (e.g. "officers_general goes through aptitude → posture → medical → physical → interview → final"). The stage definitions reference reference-data and category lookups.

**Why this priority**: Workflows orchestrate the applicant journey across the 11-stage wizard and the staff apps (medical, exams, interview boards). They are configurable per category, but the seven RFP categories ship with reasonable defaults. P2 because the defaults work for the demo cohort; live workflow editing is a second-sprint deliverable.

**Independent Test**: Sign in as super_admin → publish a new workflow for officers_general with a new "drug screening" stage inserted between medical and physical → verify applicants in that category now see the new stage in their portal.

**Acceptance Scenarios**:

1. **Given** super_admin, **When** they POST a workflow draft `{name, categoryKey, stages: [{kind, order, passingCriteria}]}`, **Then** the response is 201 in `Draft` status and the workflow is not yet visible to applicants.
2. **Given** super_admin and a draft workflow, **When** they POST `/admin/workflows/{id}/publish`, **Then** the response is 200 with status `Published`, an audit entry records `action=workflow.publish`, and any prior `Published` workflow scoped to the same `(categoryKey, cycleId)` is auto-transitioned to `Archived` in the same transaction (only one `Published` workflow per `(categoryKey, cycleId)` at a time). Other cycles' workflows for the same category are untouched.
3. **Given** super_admin and a published workflow, **When** they PATCH stage ordering, **Then** the response is 200 only if no applicants are mid-workflow against the previous order; otherwise 422 with `code: WORKFLOW_IN_USE`.
4. **Given** super_admin, **When** they POST a workflow that references a stage `kind` not in the canonical RequiredTestKind list, **Then** the response is 400 with field-specific validation.
5. **Given** super_admin, **When** they archive a workflow, **Then** the response is 200, the row is soft-deleted (`Archived=true, ArchivedAt={now}`), but applicants already mid-workflow continue against the archived definition until they complete.

---

## Functional Requirements *(mandatory)*

### Cross-cutting (FR-X)

- **FR-X01** — All `/admin/*` write endpoints (POST/PATCH/DELETE) require `Role:super_admin`. Read endpoints under `/admin/*` also require `Role:super_admin` since they expose draft/archived rows. Public read endpoints (without the `/admin/` prefix) are accessible to any authenticated user.
- **FR-X02** — Every successful mutation MUST write an audit entry with `action`, `targetType`, `targetId`, `targetLabel`, `outcome=Success`, and a JSON before/after diff for PATCH operations.
- **FR-X03** — Soft-delete is the default. Hard-delete is allowed only for entities never referenced by another aggregate (e.g. a brand-new draft cycle with no applicants). Soft-deleted rows MUST remain queryable via `?includeArchived=true` for audit. Reference-data rows with FK references return `REFERENCE_IN_USE` instead.
- **FR-X04** — All list endpoints support `page`, `pageSize` (max 200), `sortBy`, `sortDir`, and entity-specific filters. Response carries `X-Total-Count` + `X-Page-Count` headers.
- **FR-X05** — All endpoints respect the existing CSRF double-submit token (`X-CSRF-Token` header matches `csrf-token` cookie on mutating requests).
- **FR-X06** — All Arabic error messages MUST match the project voice; English error codes (`REFERENCE_IN_USE`, `INVALID_CYCLE_TRANSITION`, etc.) are stable identifiers for frontend mapping.

### Reference data (FR-L) — User Story 1

- **FR-L01** — Eight reference categories MUST exist: `governorate`, `specialization`, `rank`, `college`, `qualification`, `nationality`, `relationship`, `case-type`. The category name is enum-style — super_admin cannot invent a new category.
- **FR-L02** — Every reference row carries `(category, key)` as a unique pair within active rows. Archived rows do not block the same key reuse.
- **FR-L03** — Each reference row carries `nameAr` (required), `nameEn` (optional), `metadata` (optional JSON), `sortOrder` (integer for display ordering), `isActive` (boolean), and `archived` (soft-delete).
- **FR-L04** — Adding/editing/archiving a reference row MUST invalidate the consuming app's cached dictionary within one minute.
- **FR-L05** — A reference row with FK references (e.g. a governorate referenced by 240 applicants) MUST NOT be hard-deleted; archive returns `REFERENCE_IN_USE`. Editing the `nameAr` is allowed and propagates to all consumers.
- **FR-L06** — Bulk operations (CSV import) are out of scope for this spec; single-row CRUD only.
- **FR-L07** — All eight categories MUST be seeded with the existing frontend mock data when the backend boots in demo mode (today only `governorate` is seeded).
- **FR-L08** — Read access (`GET /reference-data?category=...`) MUST be granted to any authenticated user, since every consuming app needs the dictionaries.

### Cycles (FR-Y) — User Story 2

- **FR-Y01** — Cycle status enum: `Draft`, `Active`, `Closed`, `Archived`. Transitions: `Draft → Active`, `Active → Closed`, `Closed → Archived`. No transition skipping; no reverse transitions.
- **FR-Y02** — At most ONE cycle can be `Active` per `(year, cohort)` pair. Transitioning a second cycle to `Active` returns `OVERLAPPING_ACTIVE_CYCLE`.
- **FR-Y03** — `Active` transition is allowed only when `openDate ≤ now ≤ closeDate`.
- **FR-Y04** — `openCategories` is a per-cycle JSON map keyed by the seven RFP category keys, valued as `{isOpen, capacity?, notes}`. Missing keys are treated as `isOpen=false`.
- **FR-Y05** — `conditionOverrides` is a per-cycle JSON map keyed by category key, valued as a partial `CategoryCondition` (only the fields to override). Eligibility checks merge `category.conditions` with `cycle.conditionOverrides[categoryKey]`, with the override winning.
- **FR-Y06** — Hard-delete is allowed only for `Draft` cycles with zero applicants. Otherwise the cycle goes through `Archived`.
- **FR-Y07** — Public read endpoint (`GET /cycles`) returns `Active` + `Closed` cycles to authenticated users; `Draft` and `Archived` cycles are super-admin only.

### Categories (FR-K) — User Story 3

- **FR-K01** — The seven category keys are immutable: `officers_general, officers_specialized, postgraduate, institute_officers_training, institute_traffic, institute_guarding, special_units`. Super_admin can edit but not invent.
- **FR-K02** — Each category has a `CategoryCondition` block (age range, score, qualification, gender, height, marital status, conduct check, nationality, employer approval, nomination-only, free-text criteria) and a `RequiredTest[]` array.
- **FR-K03** — Editing a category condition applies to **all** applicants — both in-flight and new (clarified 2026-05-09). Before save, the SPA MUST surface a risk-confirmation modal that displays:
  - The count of in-flight applicants currently in this category for any active cycle.
  - The specific condition fields changing (e.g., `minScorePercent: 80 → 85`).
  - An explicit confirmation checkbox: "أتعهد بمراجعة الأثر على المتقدمين الحاليين قبل الحفظ".
  The PATCH request MUST carry a `confirmedAffectedCount` field; the server validates it matches the current in-flight count and rejects with 422 `code: STALE_AFFECTED_COUNT` if it doesn't (prevents stale-modal save races). The audit entry records `{ confirmed: true, affectedApplicantCount: N, fieldsChanged: [...] }` in addition to the before/after JSON diff.
- **FR-K04** — Categories cannot be hard-deleted. They can be marked `isOpen=false` per-cycle (see FR-Y04) but the row itself is permanent.
- **FR-K05** — `RequiredTest.kind` MUST come from the canonical `RequiredTestKind` enum (today: aptitude, posture, medical, physical, psychological, interview, drug, security_review, tactical_training, security_training, specialized_courses).
- **FR-K06** — Public read endpoint (`GET /categories`) is open to all authenticated users.

### Admission rules (FR-R) — User Story 4

- **FR-R01** — Admission rules are versioned per cycle. POST creates a new version; PATCH and DELETE on existing versions are forbidden (`ADMISSION_RULES_IMMUTABLE`).
- **FR-R02** — Each version carries `cycleId, version, effectiveAt, changedBy, age, height (per gender), bmi, eyesight, maritalStatus[], noCriminalRecord, acceptedCertificates[], minPercentByCertType, applicationFee, maxApplicationsPerYear`.
- **FR-R03** — Eligibility checks lock the version at applicant-creation time. Republishing v2 does not retroactively reject in-flight applicants.
- **FR-R04** — Validation: age range must satisfy `min ≤ max`, BMI must satisfy `min ≤ max`, height ranges per gender must satisfy `min ≤ max`, application fees must be non-negative, max applications must be ≥ 1.
- **FR-R05** — Public read endpoint returns the current effective version for the active cycle; the `?version=N` query parameter is super-admin only and used for audit trails.

### Workflows (FR-W) — User Story 5

- **FR-W01** — A workflow is a `(name, categoryKey, cycleId, stages[])` tuple with a status: `Draft`, `Published`, `Archived`.
- **FR-W02** — At most ONE workflow can be `Published` per `(categoryKey, cycleId)` pair (clarified 2026-05-09). Publishing a new one auto-archives the prior `Published` workflow scoped to the same `(categoryKey, cycleId)`. Different cycles can ship different `Published` workflows for the same category — workflow change year-over-year is the common case.
- **FR-W03** — Stage `kind` MUST come from the `RequiredTestKind` enum (FR-K05).
- **FR-W04** — Stage `order` is a 1-based integer; stages MUST form a contiguous sequence with no gaps.
- **FR-W05** — Reordering or removing stages of a `Published` workflow that has applicants mid-stream returns `WORKFLOW_IN_USE`. Super_admin must publish a new workflow version to change ordering once applicants are flowing.
- **FR-W06** — Archiving a `Published` workflow is allowed; applicants mid-workflow continue against the archived definition.
- **FR-W07** — Hard-delete is allowed only for `Draft` workflows with no applicants; otherwise soft-delete via `Archived`.
- **FR-W08** — Public read endpoint returns the `Published` workflow for the requested `categoryKey`; `Draft` and `Archived` workflows are super-admin only.

---

## Success Criteria *(mandatory)*

- **SC-L01** — All eight reference-data tabs display real backend data and persist edits across reloads. The frontend `MOCK + simulateLatency()` path in `referenceData.service.ts` is removed.
- **SC-L02** — A super-admin can add a row, edit it, and archive it from the SPA in under 30 seconds round-trip on a developer machine.
- **SC-Y01** — `Cycle.Status` transitions are atomic — concurrent attempts to activate two cycles for the same `(year, cohort)` resolve to exactly one Active cycle, no deadlocks, no duplicates.
- **SC-Y02** — The public `/applicant/start` page loads its cycle list from the backend within 1s p95.
- **SC-K01** — Editing a category condition flows through to the eligibility check on the next applicant evaluation with no API redeploy.
- **SC-R01** — Admission rule versioning is provably immutable — a property test with 1000 random PATCH/DELETE attempts on existing versions returns 405 every time.
- **SC-W01** — Publishing a new workflow auto-archives the prior published one in a single transaction, verified by a 32-way concurrency test.
- **SC-X01** — Every `/admin/*` write endpoint refuses non-super-admin requests with 403 + permission-denied audit entry. Verified across all 5 user stories' negative paths.
- **SC-X02** — All success paths emit audit entries; coverage check passes 100% on `PACademy.Application.Admin.{ReferenceData,Cycles,Categories,AdmissionRules,Workflows}.*`.

---

## Out of Scope

- Bulk import/export (CSV, Excel) for any lookup. Single-row CRUD only.
- Multi-language editing beyond `nameAr` + `nameEn`.
- Frontend rich-text editor for `freeText` category conditions; plain textarea is sufficient.
- Automated migration from a frozen snapshot of the frontend mock data — super_admin re-enters the seven non-governorate dictionaries from the seeder.
- Cross-cycle category condition inheritance — each cycle's `conditionOverrides` is independent.
- Workflow visual editor — the existing `/admin/workflows/:id` page already has a stage-list editor; this spec wires the backend, it does not redesign the UI.
- Soft-delete restore UX. Archived rows remain in the DB and can be restored via direct PATCH; no dedicated restore button.

---

## Dependencies on Prior Specs

- **Spec 003 — Admin Auth + RBAC + User Provisioning** MUST be complete (auth + `Role:super_admin` policy + audit infrastructure). Branch `003-admin-auth-rbac` carries the foundational changes; spec 004 begins after spec 003 merges to `dev`.
- **Spec 002 — Backend Foundation** entities (`Cycle`, `Category`, `Workflow`, `AdmissionRule`, `ReferenceDataEntry`) already exist in `PACademy.Domain.*`. This spec wires endpoints to existing entities and adds DTOs, validators, and use cases — no new domain types except as needed for versioning (admission rules) or for the per-cycle override map (cycles).
