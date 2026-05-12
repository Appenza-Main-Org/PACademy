# Research Notes — Application Settings Persistence

**Branch**: `011-application-settings-persistence` | **Date**: 2026-05-12

This document records the design decisions and trade-offs behind spec 011. Each section captures **what** was decided, **why**, and **what was rejected**.

---

## 1. Module choice — new `Lookups` vs. extend `ReferenceData`

**Decision**: New `Lookups` module.

**Reasoning**:
- Spec 010 (lookup-management backend, not yet authored) will own 18 typed lookup tables + 4 mapping tables. That data lives in `Lookups`.
- Spec 011's tables are conceptually adjacent: they consume the lookup catalogue (categories, specializations) and add admission-setup-specific configuration on top. Co-locating them avoids future churn.
- The legacy `ReferenceData` module is named after the *old* domain term that `origin/main` has retired (the public-facing rename to "lookups" is documented in `docs/migration/lookups/REPORT.md`). Mirroring the new term in the module name keeps the codebase coherent.
- Module creation is cheap under spec 005's FR-M02 — 4 csproj files + one DI registration.

**Rejected**:
- Extending `ReferenceData` — would lock spec 011 to legacy naming and force a rename when spec 010 ships.
- Putting spec 011's tables in `Admissions` — the tables are global (no `cycle_id`) and the eligibility data is consumed by multiple flows, not just admissions. Boundary fit is wrong.

## 2. Global scope (no `cycle_id`)

**Decision**: All 5 spec-011 tables are global. No `cycle_id` foreign key.

**Reasoning**:
- The frontend on `origin/main` explicitly designs application settings as global master data (see [`docs/migration/application-settings/REPORT.md` §1](../../docs/migration/application-settings/REPORT.md)).
- Per-cycle eligibility rules would multiply the row count 10× for every active cycle and complicate the year-row overlap invariants.
- Cycle-specific deviations (e.g., "this cycle accepts an extra applicant category") are rare and can be implemented later via a `cycle_application_settings_override` table joined at read time. Out of scope for V1.
- The wizard step pill (`wizard_step_statuses` row for `application_settings`) stays per-cycle — that's an *acknowledgement* artifact, not the data itself.

**Rejected**:
- Cycle-scoped tables — would make the spec ~3× larger and is not what the frontend implements.
- Optional `cycle_id NULL` column — adds complexity without a clear use case in V1.

## 3. Gender as a side table, not an enum column

**Decision**: Gender is M-of-N via `applicant_specialization_year_genders` keyed `(year_id, gender_type)`.

**Reasoning**:
- The frontend models gender as `genderTypes: GenderType[]` on the year row.
- The `DUPLICATE_YEAR` and `OVERLAPPING_PERIOD` invariants require checking gender-set *intersection* between rows — that join is much cleaner against a normalized side table than against a single comma-separated column.
- Side-table cardinality enforcement (`GENDER_REQUIRED` — at least one row per year) is a single trigger.

**Rejected**:
- Bitmask column (`gender_mask TINYINT` with `1=male, 2=female, 3=both`) — saves one table but makes the overlap join an `AND (a.mask & b.mask <> 0)` check that's harder to reason about and explain in tests.
- Comma-separated string column — terrible for query semantics, breaks indexing.

## 4. Marital status as a side table with literal Arabic codes

**Decision**: `applicant_specialization_year_marital_statuses` side table with `marital_code` storing Arabic literals (`'أعزب'`, `'متزوج'`, `'مطلق'`, `'أرمل'`).

**Reasoning**:
- The frontend's `MaritalStatus` union is the Arabic literal: `'أعزب' | 'متزوج' | 'مطلق' | 'أرمل'`. Storing the literal directly avoids translation drift.
- The 4-row enum is stable and unlikely to grow.
- Introducing a `marital_statuses` lookup type just for referential integrity is overkill given the 4-row stability.

**Open**:
- If spec 010 introduces marital-status lookups (the existing `MARITAL_STATUSES` lookup type from main's mock data), this side table's `marital_code` becomes a FK to the lookup table's `code` column. Migration would be straightforward and is tracked in data-model.md §"Open questions".

**Rejected**:
- Storing English/code-style values (`'single'`, `'married'`, …) — diverges from the frontend's existing storage.
- Bitmask — same readability arguments as gender.

## 5. Soft-delete strategy split across tiers

**Decision**:
- Tier 1 (`applicant_category_configs`): **deactivate, don't delete** — `is_active=false`.
- Tier 2 (`applicant_category_specializations`): **hard delete** (CASCADE to descendants).
- Tier 3 (`applicant_specialization_years`): **soft delete** (`is_deleted=true`) + separate `is_active` flag.

**Reasoning**:
- Config rows are rarely deleted in practice (the lookup catalogue defines the universe of possible categories; the admin chooses which to surface). Deactivation suffices and keeps the row available for audit.
- Specialization attachments are admin-managed and frequently removed; hard-delete with CASCADE is the simplest UX. Audit captures the deletion event before the row vanishes.
- Year rows are the most likely to be edited; soft-delete preserves the history of *what was tried*, which is the highest-value audit data.

**Rejected**:
- Universal soft-delete on all 3 tiers — more complex, no admin-facing benefit.
- Universal hard-delete — loses audit value at tier 3.

## 6. Atomic bulk-save via single transaction, no batch-error accumulation in V1

**Decision**: `POST /bulk-save` opens one transaction. First failure rolls back the entire batch and returns 422 with the first error.

**Reasoning**:
- The frontend's `StickyBulkSaveBar` already implements optimistic UI — the admin sees their changes locally before submitting. Rolling back the whole batch on any failure is the cleanest UX (admin fixes the one bad row, re-saves).
- Accumulating multiple errors per batch (admin sees "rows 3, 7, 12 all failed") would require running each change in a savepoint, catching the error, accumulating, then rolling back. Doable but adds complexity for a low-frequency case.
- Most bulk-saves are 1–5 changes (typical admin session). Multi-error UX is overkill.

**Future enhancement**: If admin feedback reveals that multi-error accumulation matters, add a `?fail-fast=false` query param that runs each change in a savepoint. Out of scope for V1.

## 7. DB triggers vs. application-layer invariant enforcement

**Decision**: Both. Triggers are the source of truth; application layer mirrors for defense-in-depth and clearer error messages.

**Reasoning**:
- Triggers catch every path (direct DB writes, EF Core, raw SQL) — they're the only way to guarantee invariants at the data layer.
- But triggers throw cryptic `SqlException` messages; the application layer catches them via `SqlConflictCodeMiddleware` and converts to typed `ConflictErrorResult` with Arabic messages.
- Domain entities (in `Lookups.Domain`) also validate `application_end >= application_start`, `max_age > 0`, etc. — this catches the bug at the C# call site (clearer stack trace) and avoids the round-trip to SQL Server for the obvious cases.

**Rejected**:
- Application-only enforcement — loses the data-layer safety net.
- DB-only enforcement — UX feedback (Arabic error message, stack trace clarity) suffers.

## 8. `SPECIALIZATION_NOT_MAPPED` reserved but inactive in V1

**Decision**: Frontend already throws this code conditionally. Backend accepts it in the response union but does NOT throw it in V1.

**Reasoning**:
- The lookup module on `origin/main` has only one cross-lookup junction (`specialization-faculty-map`, SPC × FAC) — not the SPC × CAT mapping that would gate this check.
- Spec 010 (lookup-management backend, not yet shipped) MAY introduce SPC × CAT. When it does, the attach-specialization endpoint switches to a mapping-aware check.
- Keeping the code in the union now means the day-of-integration is a one-line activation (the validation, not the API contract or frontend code).

**Rejected**:
- Removing the code entirely — would force a coordinated frontend+backend change when the mapping ships. Cost of preserving it is one type definition.

## 9. Audit module reuse — no new actions

**Decision**: Use the existing `AuditAction` values (`create`, `update`, `delete`, `soft_delete`, `restore`).

**Reasoning**:
- All 4 mutations spec 011 emits map cleanly to existing actions:
  - Year create → `create`
  - Year edit → `update`
  - Year delete → `soft_delete`
  - Year restore (if implemented) → `restore`
  - Specialization attach → `create`
  - Specialization detach → `delete`
  - Config toggle isActive → `update`
- No new audit semantic warrants a new action key.

**Rejected**:
- Action-per-table (`application_settings.year.created`, …) — overly granular; the existing `entityType` field already discriminates.

## 10. Permission model — reuse spec 007's `admission-setup:read|write`

**Decision**: No new permission policy. Reuse `admission-setup:read` for GETs, `admission-setup:write` for mutations.

**Reasoning**:
- Spec 007 already provisions these permissions for `super_admin` (via `*`) and `committee_admin` (explicit).
- Application settings is part of the admission setup workflow conceptually; the operator who edits the wizard is the same person who edits step 1.
- Adding `lookups:write` or similar would force an additional role binding without semantic value.

**Rejected**:
- New `app-settings:write` policy — granularity not justified.
- Tying to `lookups:*` policy — too broad (lookups module owns 18 lookup tables; not all of them should be writable by the same admin level).

## 11. Constraint name → conflict-code mapping in middleware

**Decision**: `SqlConflictCodeMiddleware` maintains a static `Dictionary<string, string>` mapping SQL Server constraint/trigger error indicators to conflict codes:

```csharp
static readonly Dictionary<int, string> TriggerErrorMap = new()
{
    [51100] = "OVERLAPPING_PERIOD",
    [51110] = "CATEGORY_HAS_ACTIVE_YEARS",
    [51120] = "DUPLICATE_YEAR",
    [51125] = "GENDER_REQUIRED",
};

static readonly Dictionary<string, string> CheckConstraintMap = new()
{
    ["CK_AppSpecYear_DateOrder"]  = "INVALID_DATE_RANGE",
    ["CK_AppSpecYear_MaxAge"]     = "AGE_NOT_POSITIVE",
    ["CK_AppSpecYear_GradeRange"] = "GRADE_RANGE_INVALID",
};
```

Triggers throw with custom error numbers (51100, 51110, 51120, 51125). CHECK violations come through as SQL Server error 547 with the constraint name embedded in `SqlException.Message` — the middleware parses the constraint name and looks it up.

**Reasoning**:
- Decouples the trigger SQL from the C# response shape. A new trigger only needs a one-line addition to the map.
- Centralizes the Arabic-message localization in one middleware (the messages are produced in code, not in SQL).

**Rejected**:
- Sentinel rows in a meta table (`sql_error_messages`) — overkill for 7 codes.
- Hard-coding `ConflictErrorResult` instantiation in every use case — duplicates the error-shape logic and couples each use case to every conflict code.
