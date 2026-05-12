# 009 Amendment 001 — Wizard step count reduction (15 → 13)

**Date**: 2026-05-12
**Trigger**: Merge of `origin/main` into branch `009-admission-setup-persistence` (commit `bacec7e`)
**Status**: ACTIVE — supersedes the corresponding sections of spec.md, plan.md, data-model.md, contracts/, quickstart.md, tasks.md.

---

## 1. What changed on `main`

Three commits on `origin/main` reshaped the admission-setup wizard between when spec 009 was authored (2026-05-11) and today:

| Commit | Effect |
|---|---|
| `6f2cb61` | Scaffold `application_settings` step types + invariants |
| `30c3b2b` | Application Settings service, queries, store, components |
| `1927267` | Application Settings page, bulk-save bar, unsaved-changes prompt |
| `42c0c02` | Reshape year row — drop capacity, add age/grade/multi-gender/marital |

Net effect on the wizard step set:

- ❌ `cycle_metadata` — **removed from the wizard.** Cycle name / year / dates now live in the **Cycles section** (`/admin/cycles/:id`), not inside the admission-setup wizard. Admins enter the wizard with a pre-configured cycle already selected.
- ❌ `marital_status_rules` — **removed as a standalone step.** The marital-status constraint is now a per-year multi-select on the `application_settings` step's leaf row (`ApplicantSpecializationYear.maritalStatusCodes[]`).
- ➕ `application_settings` — **new shape.** A three-tier hierarchy (`ApplicantCategoryConfig` → `ApplicantCategorySpecialization` → `ApplicantSpecializationYear`) that replaces the previous step-1 cycle-metadata form *and* absorbs the dropped marital-status rules. Carries new per-year fields: `genderTypes[]`, `maritalStatusCodes[]`, `maxAge`, `minGrade`/`maxGrade`, `applicationStartDate`/`applicationEndDate`, `ageCalcDate`.

## 2. Canonical step list (13 keys)

Source of truth: [`frontend/src/features/admin/admission-setup/config.ts`](../../frontend/src/features/admin/admission-setup/config.ts) — `ADMISSION_SETUP_STEPS` array.

| Order | Step key | Persistence owner |
|---:|---|---|
| 1 | `application_settings` | **spec 011 (new)** — *not* spec 009 |
| 2 | `application_status` | spec 009 (existing — reuses `cycles.status` lifecycle) |
| 3 | `age_rules` | spec 009 (existing — reuses Categories module) |
| 4 | `fees` | spec 009 (existing — reuses Categories module) |
| 5 | `exams` | spec 009 (`cycle_exams` table — US2) |
| 6 | `committees` | spec 009 (Committees module — US2) |
| 7 | `committee_merge_split` | spec 009 (`committee_merge_split_rules` — US1) |
| 8 | `score_thresholds` | spec 009 (`committee_score_thresholds` — US1) |
| 9 | `exam_dates` | spec 009 (`exam_date_configs` — US1) |
| 10 | `date_committee_binding` | spec 009 (Committees module — US2) |
| 11 | `total_score` | spec 009 (`total_score_configs` — US1) |
| 12 | `notifications` | spec 009 (Notifications module — US2) |
| 13 | `electronic_declaration` | spec 009 (`electronic_declarations` — US1) |

> Note: main's `types.ts` JSDoc says "14 step keys" but the actual union has 13 entries. The discrepancy is a typo on main; this amendment treats 13 as canonical.

## 3. Section-by-section corrections

### `spec.md`

| Line(s) | Before | After |
|---:|---|---|
| 6 (Input field) | "Wire all 15 admission-setup wizard pages to the database" | "Wire all 13 admission-setup wizard pages to the database (step 1 — `application_settings` — is owned by spec 011 and is **excluded** from spec 009's scope)" |
| 13 (Clarification §) | "The clone covers all 15 steps' data" | "The clone covers all 13 steps' data" |
| 24-25 | "its 15 steps are backed by three different storage strategies — partial backend persistence (steps 1–6), in-memory mocks for the existing service layers (steps 7, 8, 12, 14), and brand-new in-memory shapes that don't exist on the backend at all (steps 9, 10, 11, 13, 15)" | "its 13 steps are backed by two storage strategies on this branch — in-memory mocks for the existing service layers (steps 2, 3, 4, 5, 6, 10, 12) and brand-new in-memory shapes that don't exist on the backend at all (steps 7, 8, 9, 11, 13). Step 1 (`application_settings`) is owned by spec 011." |
| 195 (US4 Story) | "all 15 steps populate with the prior cycle's data" | "all 13 steps populate with the prior cycle's data (step 1 `application_settings` is **global master data per spec 011**; the cross-cycle copy does NOT clone it — it only marks the target cycle's step-1 pill as `in_progress` so the admin reviews the global config in the context of the new cycle)" |

### `plan.md`

| Line | Before | After |
|---:|---|---|
| 8 | "The admission-setup wizard's 15 steps must read from and write to the database" | "The admission-setup wizard's 13 steps must read from and write to the database. Step 1 (`application_settings`) is owned by spec 011 and is **out of scope** for spec 009." |

### `data-model.md`

| Line | Before | After |
|---:|---|---|
| 171 | `step_key` "one of 15 AdmissionSetupStepKey values" | "one of 13 AdmissionSetupStepKey values (the union defined in `frontend/src/features/admin/admission-setup/types.ts`)" |

### `contracts/admission-setup-api.md`

**§6 Wizard Step Status** — endpoint signature unchanged, but the row count returned by `GET /admin/admission-setup/cycles/{cycleId}/step-statuses` is now **13 rows**, not 15. The auto-lazy-create middleware (Phase 2 Foundational, T012) creates rows for the 13 canonical keys only. Any pre-existing rows with key `cycle_metadata` or `marital_status_rules` from earlier dev databases should be migrated to `application_settings` or dropped via the 009 migration (see §6 below).

### `quickstart.md`

| Line | Before | After |
|---:|---|---|
| 110 | "Navigate to `/admin/admission-setup/wizard/cycle_metadata`" | "Navigate to `/admin/admission-setup/wizard/application-settings`. (Note: `cycle_metadata` no longer exists; cycle name/year/dates are now edited at `/admin/cycles/:id`.)" |

### `tasks.md`

| Task | Effect |
|---|---|
| T009 (WizardStepStatus entity) | StepKey column accepts only 13 canonical values; reject `cycle_metadata` and `marital_status_rules` at the domain layer with `ArgumentException("Unknown step key")` |
| T012 / T013 (WizardStatusInterceptor) | Interceptor's static dictionary already maps only the wizard-owned entities (CommitteeMergeSplitRule → "committee_merge_split", etc.); no change needed since `cycle_metadata` and `marital_status_rules` never had entity mappings |
| T014 (`009_AdmissionSetupEntities` migration) | Migration body unchanged — the 5 wizard entities + `wizard_step_statuses` + rowversion ALTERs. Include a one-shot `DELETE FROM wizard_step_statuses WHERE step_key IN ('cycle_metadata', 'marital_status_rules')` cleanup for dev DBs (idempotent, see §6 below) |
| T047 (Wizard-status use cases) | "returns 15-row map" → "returns 13-row map"; reject unknown step keys with 422 |
| T053 (AdminWizardStatusController) | Endpoint validates the `stepKey` route param against the 13-key enum; returns 404 for unknown keys |
| T060a (`useWizardWritePermission` hook) | Wraps mutating controls across the 13 wizard step pages, not 15 |
| US4 (P4) — cross-cycle clone | Source-cycle row enumeration is 13 step keys; the orchestrator skips `application_settings` (spec 011 owns its clone path) |
| Test counts on US4 | "all 15 steps populate" → "all 13 steps populate" everywhere |

## 4. Out-of-scope handoff to spec 011 (Application Settings Persistence)

The following entities are **not** owned by spec 009 — they belong to spec 011:

- `applicant_category_configs` (per category × cycle)
- `applicant_category_specializations` (per attached specialization)
- `applicant_specialization_years` (leaf rows with capacity + window dates)
- 8 conflict codes per `docs/DB_CONSTRAINTS.md §11`:
  `DUPLICATE_YEAR`, `OVERLAPPING_PERIOD`, `INVALID_DATE_RANGE`, `AGE_NOT_POSITIVE`, `GRADE_RANGE_INVALID`, `GENDER_REQUIRED`, `SPECIALIZATION_NOT_MAPPED`, `CATEGORY_HAS_ACTIVE_YEARS`

Spec 009 references `application_settings` as a step in the wizard's status map and clone orchestrator only — it does **not** define the entity, contract, or migration. Spec 011 covers all of that.

## 5. What stays unchanged

- All 5 P1 entity shapes (CommitteeMergeSplitRule, CommitteeScoreThreshold, ExamDateConfig, TotalScoreConfig, ElectronicDeclaration) — **unchanged**.
- All P2 module additions (Committees, Notifications, CycleExam) — **unchanged**.
- Optimistic locking via `rowversion` on every table — **unchanged**.
- Audit action set (`merge_rule_applied`, `merge_rule_cancelled`, `wizard_step_completed`, `wizard_step_reopened`, `cycle_cloned`) — **unchanged**.
- `WizardStatusInterceptor` auto-promote/auto-demote semantics — **unchanged** (its entity-to-step-key map already excludes the dropped steps).
- Permission policies (`admission-setup:read|write|apply|clone`) — **unchanged**.

## 6. Migration cleanup for dev databases

For any dev/staging database that was seeded against the pre-amendment 15-key spec, include this idempotent cleanup in the `009_AdmissionSetupEntities` migration's `Up()` method (after the table creates and before the data seeds):

```sql
-- Drop wizard_step_statuses rows for keys no longer in the canonical 13
-- (idempotent — runs at most once per environment per migration apply)
IF OBJECT_ID('dbo.wizard_step_statuses') IS NOT NULL
BEGIN
    DELETE FROM dbo.wizard_step_statuses
    WHERE step_key IN ('cycle_metadata', 'marital_status_rules');
END
```

No production deployment has run yet, so there is no migration-history compatibility burden. The DELETE is a defensive guard for shared dev/staging DBs only.

## 7. Verification checklist

After this amendment is applied (the spec doc edits below), confirm:

- [ ] `npm --prefix frontend run typecheck` passes (no references to `cycle_metadata` or `marital_status_rules` step keys outside of comments)
- [ ] `dotnet build` passes for the backend
- [ ] `GET /admin/admission-setup/cycles/{id}/step-statuses` returns exactly 13 rows
- [ ] Database `wizard_step_statuses` table has 0 rows with `step_key IN ('cycle_metadata', 'marital_status_rules')` after migration runs
- [ ] Spec 011 (new) is authored and references spec 009 as the wizard host

## 8. Open follow-ups (do not auto-execute)

- Author **spec 010 (Lookup Management Module)** — the 18 typed lookups + 4 mapping tables that replaced the legacy `reference_data_entries` system on `origin/main`. Several spec 009 entities reference lookup codes (`SpecializationRow`, `applicant-categories`, `committees` as a lookup) — spec 010 owns those tables' shape; spec 009 only references them via lookup codes.
- Author **spec 011 (Application Settings Persistence)** — the three-tier hierarchy described in §4 above.
- Decide whether the `WizardStatusInterceptor`'s entity map should add an entry for spec 011's `ApplicantCategoryConfig` so saves to the application-settings step auto-promote the step pill. Recommended yes — but the wiring lives in spec 011, not 009.
