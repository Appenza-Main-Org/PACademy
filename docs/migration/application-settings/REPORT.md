# Application Settings — Migration Report

> Rebuild of the admission-setup Step 1 (`application_settings`) as a
> three-tier dynamic editor: **category → specialization → year**.
> Built strictly on the existing lookup catalogue — no new lookups,
> lookup types, enum values, or seed rows were introduced anywhere.

---

## 1. Inventory snapshot (from Step 0)

See [INVENTORY.md](INVENTORY.md) for the unmodified Gate-1 audit. Key
findings that shaped the build:

- The prior wizard step (88 lines + the 368-line `CategoriesPanel`) was
  **cycle-scoped**, not flat-hardcoded. It iterated `MOCK.categories`
  (7-row enum) and mutated `cycle.openCategories[key]`.
- The prompt's `lookupService.listMappings('categorySpecializations')`
  surface does not exist. The lookup module ships `lookupsService`
  (plural, `listLookup<K>(key)`) with one cross-lookup junction
  (`specialization-faculty-map`, SPC × FAC) — no SPC × CAT mapping.
- Two parallel "applicant categories" sources exist in the codebase:
  `MOCK.categories` (legacy 7-row enum used by applicant flow,
  eligibility, admission rules) and `MOCK.lookups['applicant-categories']`
  (8 lookup rows used by the lookup module). They are not reconciled;
  reconciliation is out of scope for this task.
- No exported canonical `GenderType` exists. `'male' | 'female'` is
  inlined at 15+ sites.

---

## 2. Lookups-only compliance

Per the prompt's "single most important rule" — confirmation that no
new lookups, types, enum values, or seed rows were introduced:

| Compliance line | Status |
|---|---|
| Lookup keys read | `applicant-categories` (CAT-NN), `specializations` (SPC-NN) — both via `LOOKUPS_SEED` |
| Lookup mappings read | **none** (the prompt's `categorySpecializations` mapping does not exist in `MOCK.lookupMappings`; see §6) |
| Gender source imported | `Applicant['gender']` from [frontend/src/shared/types/domain.ts:165](../../../frontend/src/shared/types/domain.ts#L165), aliased as `GenderType` in [frontend/src/features/admin/admission-setup/types.ts:28](../../../frontend/src/features/admin/admission-setup/types.ts#L28) |
| New lookups added | **0** |
| New lookup types added | **0** |
| New enum values added to existing lookups | **0** |
| New seed rows added to `MOCK.lookups` | **0** |
| New canonical gender union declared | **0** (the alias derives existing values, declares nothing new) |
| Files in `frontend/src/features/lookups/` touched by this task | **0** |
| Files in `frontend/src/shared/mock-data/` touched | 1 — `index.ts`, additive only (3 new keys: `applicantCategoryConfigs`, `applicantCategorySpecializations`, `applicantSpecializationYears`). `MOCK.lookups` untouched. |

The `SPECIALIZATION_NOT_MAPPED` conflict code is **reserved but not
thrown in V1**. The day the backend ships a `category_specializations`
lookup junction (already PK'd in [docs/DB_CONSTRAINTS.md §10.7](../../DB_CONSTRAINTS.md)),
`applicationSettingsService.attachSpecialization` switches to a
mapping-aware check and the `AttachSpecializationDialog` EmptyState
fires for real.

---

## 3. Decision log

1. **Gender source: `Applicant['gender']` aliased.**
   The codebase has no exported `GenderType` union. Per the prompt's
   stop-and-ask rule, I surfaced this at Gate 1 with three options. The
   chosen option (1) imports `Applicant` from `@/shared/types/domain`
   and exports `type GenderType = Applicant['gender']` — derives the
   already-shipped inline shape (`'male' | 'female'`), introduces no
   new declaration, and is the closest analogue to "reusing the
   existing source" without inventing.
2. **Categories from lookup module.**
   `applicantCategoryConfigs.categoryId` is a FK to
   `MOCK.lookups['applicant-categories'][i].code`. The eight CAT-NN
   rows are surfaced as-is (first three active, rest inactive,
   `sortOrder` 10/20/…/80). The 7-row legacy `MOCK.categories` enum
   used elsewhere in the project is **not** touched.
3. **Strict mapping dropped for V1, conflict code retained.**
   The lookup catalogue has no SPC × CAT junction. Building one would
   require adding a new lookup mapping table — which the prompt forbids.
   For V1 `getEligibleSpecializations(configId)` returns every active
   `specializations` row not already attached. `SPECIALIZATION_NOT_MAPPED`
   stays in the conflict union + DB_CONSTRAINTS section so the
   forward-compatible path is wired.
4. **Global master-data scope.**
   The three new tables (configs / specs junction / years) live at
   `MOCK.applicantCategoryConfigs` etc., outside any `cycle`. The
   ScopeBanner makes this explicit. The legacy `cycle.openCategories`
   data path still exists in the project but is no longer surfaced
   from this wizard step. The cycle-scoped `CategoriesPanel` and
   `useToggleCycleCategory` mutation are untouched and continue to be
   importable from the cycles section — they were just unwired from
   `application_settings`.
5. **Components stay in-feature.**
   Eight new components under
   `features/admin/admission-setup/components/applicationSettings/`.
   None promoted to `shared/` — each one has a single consumer and
   fails the 3+ threshold from [CLAUDE.md §2.5](../../../CLAUDE.md#L155).
6. **`useBlocker` swapped for `beforeunload`.**
   `useBlocker` requires a data router (`createBrowserRouter` +
   `RouterProvider`). The app uses `BrowserRouter` + `useRoutes`.
   Migrating the routing root was out of scope. The
   `UnsavedChangesPrompt` therefore only guards browser-level loss
   (Cmd+R / tab close / external link). In-app wizard navigation
   (السابق / التالي) discards local edits silently — flagged as a
   follow-up.
7. **Reorder via drag-drop deferred.**
   `sortOrder` is in the data model but the accordion does not yet
   expose drag handles. Commented as a TODO in `CategoryAccordion.tsx`.

---

## 4. Files created

| Path | Lines |
|---|---|
| [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts) | 147 |
| [frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) | 391 |
| [frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts) | 248 |
| [frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts](../../../frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts) | 125 |
| [frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts](../../../frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts) | 242 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/ScopeBanner.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/ScopeBanner.tsx) | 49 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx) | 137 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx) | 63 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationRow.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationRow.tsx) | 97 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/AttachSpecializationDialog.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/AttachSpecializationDialog.tsx) | 123 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx) | 337 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx) | 106 |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/UnsavedChangesPrompt.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/UnsavedChangesPrompt.tsx) | 36 |
| [frontend/src/features/dev/AppSettingsReviewPage.tsx](../../../frontend/src/features/dev/AppSettingsReviewPage.tsx) | 29 |
| Total new TS/TSX | **2 130** |
| [docs/migration/application-settings/INVENTORY.md](INVENTORY.md) | (Gate-1 audit) |
| [docs/migration/application-settings/REPORT.md](REPORT.md) | (this file) |

---

## 5. Files modified

| Path | Nature of change |
|---|---|
| [frontend/src/features/admin/admission-setup/types.ts](../../../frontend/src/features/admin/admission-setup/types.ts) | Append: `GenderType` alias, three new interfaces (`ApplicantCategoryConfig`, `ApplicantCategorySpecialization`, `ApplicantSpecializationYear`), `AppSettingsConflict` union. |
| [frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx) | Rewrite body: `<ScopeBanner /> + <CategoryAccordion /> + <StickyBulkSaveBar /> + <UnsavedChangesPrompt />`. Wizard chrome (vertical stepper, sticky footer, breadcrumb) is unchanged — `AdmissionSetupWizardPage` is untouched. |
| [frontend/src/shared/lib/errors.ts](../../../frontend/src/shared/lib/errors.ts) | Append 5 new codes to `ConflictCode` (`INVALID_DATE_RANGE` already existed and is reused): `DUPLICATE_YEAR`, `OVERLAPPING_PERIOD`, `CAPACITY_NOT_POSITIVE`, `SPECIALIZATION_NOT_MAPPED`, `CATEGORY_HAS_ACTIVE_YEARS`. |
| [frontend/src/shared/mock-data/index.ts](../../../frontend/src/shared/mock-data/index.ts) | Additive: import the three new seeds and expose them on `MOCK` (`applicantCategoryConfigs`, `applicantCategorySpecializations`, `applicantSpecializationYears`). Lookup MOCK untouched. |
| [frontend/src/features/dev/index.ts](../../../frontend/src/features/dev/index.ts) | Re-export `AppSettingsReviewPage`. |
| [frontend/src/routes.tsx](../../../frontend/src/routes.tsx) | Add `/_dev/app-settings` route (DEV-only). |
| [docs/DB_CONSTRAINTS.md](../../DB_CONSTRAINTS.md) | Append §11 (Application Settings — invariants) with SQL Server expressions for the 6 conflict codes. |

Other-step page files, `routes.tsx`'s non-dev entries, `App.tsx`,
lookup module sources — all untouched.

---

## 6. Validation rules → function mapping

Single-source-of-truth file:
[appSettingsValidation.ts](../../../frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts).

| Function | Returns | Fires on | Conflict code |
|---|---|---|---|
| `validateCapacity(capacity)` | `'CAPACITY_NOT_POSITIVE' \| null` | `capacity > 0` AND integer | `CAPACITY_NOT_POSITIVE` |
| `validateDateRange(start, end, academic)` | `'INVALID_DATE_RANGE' \| null` | `end >= start AND academic >= end` | `INVALID_DATE_RANGE` |
| `validateNoDuplicateYear(year, gender, siblings, excludeId)` | `'DUPLICATE_YEAR' \| null` | unique `(year, gender)` within sibling years | `DUPLICATE_YEAR` |
| `validateNoOverlap(candidate, siblings, excludeId)` | `'OVERLAPPING_PERIOD' \| null` | no overlapping `[appStart, appEnd]` for same gender | `OVERLAPPING_PERIOD` |
| `validateYearRow(row, siblings, excludeId)` | first failing code or `null` | composes the four above in order | (any of the four) |

The service calls `validateYearRow` before `createYear` / `updateYear`.
The bulk save endpoint validates every change against the
hypothetical post-state of its slice before any persistence. The
`<YearTable />` form calls `validateYearRow` inline on every keystroke
via the draft store derivation, so errors render as terra-500 chips
under the offending field (`aria-invalid="true"` on the field, role
`alert` on the chip).

`SPECIALIZATION_NOT_MAPPED` and `CATEGORY_HAS_ACTIVE_YEARS` are
non-row-level — the first is thrown only when the lookup mapping
ships (V1: never fires), the second is thrown by
`toggleCategoryActive` when an active category with active descendant
years is requested to deactivate.

---

## 7. Conflict codes appended to `DB_CONSTRAINTS.md`

New §11 in [docs/DB_CONSTRAINTS.md](../../DB_CONSTRAINTS.md). One
subsection per code with the SQL Server expression:

| § | Code | SQL Server expression |
|---|---|---|
| 11.1 | `DUPLICATE_YEAR` | `UNIQUE INDEX ON (category_specialization_id, graduation_year, gender_type)` filtered partial. |
| 11.2 | `OVERLAPPING_PERIOD` | INSTEAD-OF trigger on INSERT/UPDATE testing range overlap per `(category_specialization_id, gender_type)`. |
| 11.3 | `CAPACITY_NOT_POSITIVE` | `CHECK (capacity > 0)`. |
| 11.4 | `INVALID_DATE_RANGE` | `CHECK (application_end_date >= application_start_date AND academic_year_start_date >= application_end_date)`. |
| 11.5 | `SPECIALIZATION_NOT_MAPPED` | API-layer enforcement against `lookup_mappings.category_specializations` (already PK'd in §10.7). |
| 11.6 | `CATEGORY_HAS_ACTIVE_YEARS` | Trigger on UPDATE of `applicant_category_configs` rejecting `is_active = 0` when any descendant `applicant_specialization_years.is_active = 1`. |

---

## 8. Before / after screenshots

All at `docs/migration/application-settings/`.

| File | Content |
|---|---|
| [before.png](before.png) | The legacy wizard step — cycle-scoped `<CategoriesPanel>` table, 7 hardcoded `MOCK.categories` rows. Captured by reverting the step file to `HEAD` and navigating to `/admin/admission-setup/wizard/application_settings`. |
| [after-collapsed.png](after-collapsed.png) | New three-tier editor, all categories collapsed. Eight CAT-NN rows from the `applicant-categories` lookup, with active counts and Switch on each header. |
| [after-expanded.png](after-expanded.png) | CAT-01 open, SPC-01 open, the three year rows visible (2026/female, 2025/male, 2024/male). Captured from the DEV review page. |
| [after-validation-error.png](after-validation-error.png) | DUPLICATE_YEAR error in flight — row 1's year changed to 2025 and gender flipped to male, colliding with row 2's existing `(2025, male)`. Both rows show the "مكررة" chip with `aria-invalid="true"` on the year and gender fields. |
| [after-bulk-save.png](after-bulk-save.png) | Sticky bulk-save bar showing one pending edit, with "إلغاء التغييرات" and "حفظ التغييرات" actions. Crop only — see `after-validation-error.png` for the full surface. |
| [after-empty-mappings.png](after-empty-mappings.png) | CAT-05 (تربية رياضية) expanded — zero specializations attached. Renders the dashed-border EmptyState prompt with the "إضافة تخصص" button. |

---

## 9. Open questions for the human

1. **Reconcile `MOCK.categories` vs `MOCK.lookups['applicant-categories']`?**
   The two parallel category sources still exist. The new editor uses
   the lookup module's 8 CAT-NN rows; the rest of the project
   (applicant portal, eligibility, admission rules) still uses the
   7-row legacy enum. A future task should consolidate to one source.
2. **Backfill the SPC × CAT lookup mapping?**
   The `category_specializations` table is already PK'd in
   `DB_CONSTRAINTS §10.7`. Backend has the schema. The frontend
   lookup module doesn't surface it. Once backfilled, the
   `getEligibleSpecializations` service call becomes mapping-aware and
   the EmptyState branch starts firing under real conditions.
3. **Wizard navigation guard for the new editor.**
   `UnsavedChangesPrompt` is `beforeunload`-only because `useBlocker`
   requires a data router. Two paths forward:
   (a) migrate `App.tsx` to `createBrowserRouter` + `RouterProvider`
   (broad blast radius — touches every test, every dynamic redirect),
   or (b) plumb a "dirty" callback into `AdmissionSetupWizardPage`'s
   prev/next handlers so they consult the draft store before
   navigating. Option (b) couples the wizard chrome to a single step's
   draft store; option (a) is a separate refactor.
4. **`MOCK.categories` parity for the existing `cycle.openCategories`
   per-cycle toggle.**
   The legacy `CategoriesPanel` still exists and is exported from the
   cycles feature. Should it be deleted, or left as a viewer of
   cycle-attached category state once the cycle wizard is rewritten?
5. **Capacity numbers vary between page loads.**
   The mock uses `rng()` for capacities only. Different module-load
   ordering shifts the LCG state, so capacities differ between fresh
   reloads (e.g. one capacity was 226, then 462 after HMR). Years,
   genders, and dates are deterministic.

---

## 10. Verification checklist

- ✅ Accordion open/close in multi mode (verified at `/_dev/app-settings`).
- ✅ Attach dialog opens, lists eligible specializations from the
     `specializations` lookup excluding already-attached ones.
- ✅ Empty-mappings EmptyState renders for CAT-05 (zero attached specs)
     with a deep link to the Lookups page.
- ✅ Dirty rail (2 px gold-400 inline-start border) appears on edited
     rows; sticky bulk-save bar appears with edit counters.
- ⚠️ `useBlocker` route guard — replaced with `beforeunload`-only V1.
     In-app wizard navigation does not prompt. Documented in §3 and
     §9.
- ✅ Validation: DUPLICATE_YEAR fires inline with terra chip +
     `aria-invalid` when row 1 is changed to `(2025, male)` matching
     row 2. CAPACITY_NOT_POSITIVE, INVALID_DATE_RANGE, OVERLAPPING_PERIOD
     all wired in the same code path (`validateYearRow`).
- ✅ Bulk save: `useBulkSave` payload flattens every slice's draft
     rows; service validates atomically and persists only on full pass.
- ✅ Other wizard steps untouched — only `application_settings`
     renderer changed. `AdmissionSetupWizardPage` is unchanged.
- ✅ No new lookups / lookup types / enum values / seed rows in
     `MOCK.lookups`. Lookup module sources are 100% untouched by this
     task (other modifications visible in `git status` are from a
     separate in-flight task on `features/lookups/`).
- ✅ `npm --prefix frontend run typecheck` — 0 errors.
- ✅ `npm --prefix frontend run build` — 0 errors.
