# Research Notes — Lookup Management Module

**Branch**: `010-lookup-management-module` | **Date**: 2026-05-12

This document records the design decisions and trade-offs behind spec 010. Each section captures **what** was decided, **why**, and **what was rejected**.

---

## 1. Single table with discriminator vs. 17 typed tables

**Decision**: Single `lookup_items` table with `lookup_type_code` discriminator column + JSON `extras` for type-specific fields.

**Reasoning**:
- The 17 row shapes share ~80% of their columns (code, nameAr, nameEn, isActive, sortOrder, parent, soft-delete, audit). Splitting into 17 tables would duplicate every common column, every common trigger, and every common index.
- Type-specific fields (3–7 per type) go into a JSON `extras` column. SQL Server supports `JSON_VALUE()` indexing for the rare cross-cutting query.
- Cross-cutting features (search, audit, bulk import) work uniformly against one table.
- `docs/DB_CONSTRAINTS.md §10` already specifies this shape — the preamble names `lookup_items` (singular) keyed by `lookup_type_code`.
- The frontend's TypeScript discriminated union (`LookupRow<K>` over `LookupRowMap`) provides full type safety despite the unified backend table. C# domain mappers per type code mirror this on the backend.

**Rejected**:
- **17 separate tables**: Multiplies migrations, triggers, indexes, and use cases by 17. Worth it only if per-type queries had drastically different access patterns — they don't (all are "list rows of type X, edit row, soft-delete row").
- **Sparse columns** (one nullable column per type-specific field across all rows): ~50 nullable columns on `lookup_items`. Hard to read, hard to evolve.
- **EAV (entity-attribute-value) sub-table**: Maximum flexibility but loses type safety and makes per-row reads costly (multiple joins). Wrong fit for a known closed set of 17–31 type codes.

## 2. Type registry as a closed-extension table

**Decision**: `lookup_item_types` table seeded at migration time. New type codes require a new migration; no API to register types.

**Reasoning**:
- A new lookup type isn't just a row — it requires:
  1. A new `LookupKey` in the frontend's discriminated union
  2. A new TS interface for the row shape
  3. A new C# `LookupItemExtras` POCO for the backend
  4. New UI components (form drawer, validation, registration in `LOOKUP_META`)
  5. A new column registry entry for bulk import/export
- All five touchpoints must ship atomically — an API endpoint that adds a row to `lookup_item_types` would lead to ghost types that can't be edited via the UI.
- Closed-extension is intentional friction that ensures consistency.

**Rejected**:
- **Open extension via API**: Convenience for adding "simple" types, but lookup types are never truly simple — every consumer site that reads a type code needs UI awareness. The savings aren't real.
- **No type registry at all** (just `lookup_type_code` as free text on `lookup_items`): Risk of typos creating ghost types that won't ever be readable correctly.

## 3. `extras` as JSON vs. typed extension tables

**Decision**: JSON `extras` column on `lookup_items`. Schema enforcement at the application layer (`ExtrasSerializer`), not the DB.

**Reasoning**:
- The 17 types have wildly different extra-field counts (0–8). A typed-extension-table approach would mean 12 sibling tables joined to `lookup_items` (5 types have empty extras and need no extension table). Adds joins to every read.
- JSON is queryable in SQL Server via `JSON_VALUE()`, indexable via computed columns if hot paths emerge.
- Schema drift between frontend and backend is the main risk; `ExtrasSerializer` rejects malformed payloads with `422 INVALID_EXTRAS_SHAPE`, surfacing drift immediately at integration time.
- Round-trip tests assert every type's full extras preserved exactly.

**Rejected**:
- **Per-type extension tables** (e.g., `relationship_extras (lookup_item_id, branch, gender, degree)`): More joins, more migrations, less flexibility for V2 fields.
- **JSON Schema validation at DB layer** (CHECK constraint with `OPENJSON` parse): SQL Server `OPENJSON` works but schema-aware validation is verbose. Pushed to application layer for clarity.

## 4. Mappings as separate tables, not part of `lookup_items`

**Decision**: 4 separate mapping tables (`category_specializations`, `category_committees`, `category_tests`, `period_categories`), each with composite PK `(category_id, target_id)`.

**Reasoning**:
- The 4 mappings have different FK target type codes, different admin UIs (matrix vs. list), and potentially different audit semantics.
- Composite PK enforces `DUPLICATE_MAPPING` at the DB layer.
- INSTEAD OF INSERT trigger per mapping validates `UNKNOWN_TARGET` (target row must be live and of the right type).
- Same shape across all 4 makes the generic use case parameterizable.

**Rejected**:
- **Single generic `lookup_mappings (mapping_key, category_id, target_id)` table**: Cleaner code but loses the per-mapping FK and trigger specificity. Cross-mapping queries (rare) would still need filter on `mapping_key`. Net: marginal gain.
- **Mappings as JSON on `lookup_items`**: Loses referential integrity, breaks audit semantics. Wrong fit.

## 5. Soft-delete with filtered unique index

**Decision**: Soft-delete via `deleted_at IS NOT NULL` tombstone. Filtered unique index `WHERE deleted_at IS NULL` allows code reuse after deletion.

**Reasoning**:
- Hard-delete loses audit history. Required by FR-018 (audit emissions).
- Reusing a code after its previous row was soft-deleted is a common operator workflow ("oh, I shouldn't have deleted that — let me recreate it"). Filtered unique index permits this without an extra `restore` endpoint dance.
- The `?includeDeleted=true` query param surfaces tombstones for super-admin recovery.

**Rejected**:
- **Hard-delete**: Loses history. Audit is append-only but doesn't capture the row's state at delete time (only the action).
- **Soft-delete with unique on `(type_code, code, deleted_at)`**: Allows multiple soft-deleted rows with the same code, but a new row creation would conflict with the existing tombstone unless we filter on `IS NULL`. Filtered unique is cleaner.

## 6. Hierarchical lookups via self-FK `parent_id`

**Decision**: `lookup_items.parent_id` self-FK. Cycle detection via AFTER UPDATE trigger using recursive CTE.

**Reasoning**:
- The 2 hierarchical types (relationships, jobs) have shallow trees (≤ 6 levels). Recursive CTE walks ancestors in ≤ 6 hops.
- Self-FK preserves typed FK enforcement at the DB layer (vs. a string `parent_code`).
- Cycle detection on insert is unnecessary (a new row can't have ancestors it created itself); only UPDATE needs the check.

**Rejected**:
- **Materialized path** (`parent_path nvarchar(max)` like `001/005/012`): Faster ancestor queries but more complex to maintain on parent reassignment. Worth it for deep trees; not for 6-level trees.
- **Closure table** (separate `lookup_item_ancestors (item_id, ancestor_id, depth)`): Best for arbitrary-depth trees but overkill at this scale.

## 7. Specialization → Faculty as direct FK, not junction

**Decision**: `specializations.faculty_code` is a top-level column on `lookup_items` (only meaningful when `lookup_type_code = 'SPECIALIZATIONS'`). FK enforced via INSTEAD OF INSERT/UPDATE trigger filtering on `FACULTIES` type.

**Reasoning**:
- The frontend on `origin/main` collapsed the prior `specialization-faculty-map` junction into a direct FK (`refactor(admin/lookups): collapse specialization-faculty-map junction into direct facultyCode FK`). The decision was driven by "we only ever needed a single faculty per specialization."
- A junction table would allow multi-faculty specs, but the rule "one faculty per spec" is firm.
- Top-level column gives faster reads (no join for the common "list specs with their faculty" query).

**Rejected**:
- **Junction table `specialization_faculties (spec_id, faculty_id)`**: Allows many-to-many but adds a join everywhere. Rejected for the stated reason.
- **FK in `extras` JSON**: Loses FK enforcement at the DB layer; only application-layer validation. Less safe.

## 8. Code generation policy

**Decision**: Server generates codes when `code` is omitted from `POST`. Format: `<codePrefix>-<padded sequential int>`. Stored in `lookup_item_types.code_prefix` + `.padding`.

**Reasoning**:
- Admin doesn't always know the next code. UI auto-fills via the server.
- Padding ensures sortable codes (`GOV-01`, `GOV-02`, ..., `GOV-99`).
- `code_prefix` is UNIQUE on `lookup_item_types` to prevent collision (`REL-005` vs. `RES-005` — different types, different prefixes).
- Admin can still supply a custom `code` (e.g., to match an external system's ID); server validates uniqueness.

**Rejected**:
- **Always server-generated**: Loses admin flexibility for cases where they want to align codes with external taxonomies.
- **UUID codes** (e.g., `gov-a1b2c3d4`): Operator-unfriendly; the existing `GOV-01` style is established.
- **No code at all** (use `id` everywhere): The `code` is the operator-facing identifier — UUIDs are too long.

## 9. Bulk import as a single transaction, first-error rollback

**Decision**: `POST /import` opens one transaction. First failure rolls back the entire batch. Per-row error map returned in the 422 response.

**Reasoning**:
- Excel imports of 100–1,000 rows are common. Partial success creates ambiguous state (some rows committed, some not — which ones?).
- The frontend's `ImportDialog` renders the error map in a preview table. The admin fixes the offending rows in Excel and re-imports.
- Same atomicity pattern as spec 011's bulk-save.

**Rejected**:
- **Per-row independent transactions**: Faster (no global lock) but creates the "half-imported" state. UX nightmare.
- **Continue-on-error with summary report**: The frontend has no good UI for "180/200 rows imported, 20 failed — here's a list." The all-or-nothing rule is simpler.

## 10. Data migration safety — separate cleanup migration with soak period

**Decision**: `010_LookupCatalogue` creates new tables + migrates data from `reference_data_entries` IN ONE MIGRATION. A SEPARATE follow-up migration `010b_DropReferenceDataLegacy` drops the legacy table — applied only after 1+ weeks of staging soak.

**Reasoning**:
- If the data migration has a bug (wrong type-code mapping, missed rows), reverting requires the legacy table to be present.
- Staging the cleanup separately allows operator to compare row counts, eyeball-spot-check critical data, before committing to deletion.
- EF Core migrations are forward-only by design; this two-stage approach is the equivalent of a "deprecation window."

**Rejected**:
- **Drop the legacy table in the same migration**: One migration is simpler but provides no rollback path.
- **Keep the legacy table forever**: Dead code accumulates; clear cutoff is healthier.

## 11. Closed extension of conflict codes via `ConflictMessages.cs` registry

**Decision**: `Lookups.Application/ConflictMessages.cs` static dictionary maps `(ConflictCode → (Ar, En) labels)`. `SqlConflictCodeMiddleware` reads from this dictionary; use cases reference it for non-trigger-thrown errors.

**Reasoning**:
- Adding a new conflict code requires: (1) entry in the dictionary, (2) entry in the `ConflictCode` TS union, (3) entry in the `SqlConflictCodeMiddleware` mapping. Three touchpoints, all in version control.
- Centralizing the Arabic message text avoids drift between trigger SQL (which throws a code, not a message) and middleware (which produces the user-facing message).
- Trigger SQL uses `THROW` with the code as a numeric reference (e.g., `THROW 51200, 'CIRCULAR_HIERARCHY', 1`); middleware decodes.

**Rejected**:
- **Hard-coded messages in each use case**: 7+ conflict codes × N use cases = many duplications.
- **Messages in the database**: Locale-aware but admin-side translation is rare; YAGNI.

## 12. Permission model — new `lookups:read|write` policies

**Decision**: Two new policies — `lookups:read` and `lookups:write`. `super_admin` gets both via `*`. `committee_admin` gets `lookups:read` only.

**Reasoning**:
- Lookup management is platform-wide; per-cycle data (spec 009, 011) is the committee admin's domain.
- A separate write permission keeps the catalogue tight — only super-admin can edit faculties, governorates, etc.
- Reads need to be broad — every form picker reads lookups; restricting reads breaks the applicant portal too.

**Rejected**:
- **Reuse `admission-setup:write`**: Wrong scope — admission-setup is per-cycle; lookups are global.
- **Single `lookups:*` policy**: Less granular; would force `committee_admin` to either edit lookups or not see them at all.
