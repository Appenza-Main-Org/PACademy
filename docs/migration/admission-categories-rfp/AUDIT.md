# Audit — Lock applicant-categories lookup to the 4 RFP categories

> **Status:** STEP 1 (audit). No code changed. Awaiting approval before Step 2.
> Date: 2026-05-12.

---

## TL;DR (5 bullets)

- The **single source of truth** for applicant-categories is now the **Lookup Management Module** at [frontend/src/features/lookups/mock/lookups.mock.ts](../../../frontend/src/features/lookups/mock/lookups.mock.ts) §9 (the seven `ApplicantCategoryRow` entries). The legacy `APPLICANT_CATEGORIES` in [frontend/src/shared/mock-data/categories.ts](../../../frontend/src/shared/mock-data/categories.ts) is **dead seed data** — `MOCK.categories` is now derived from the lookup ([frontend/src/shared/mock-data/index.ts:992](../../../frontend/src/shared/mock-data/index.ts#L992)).
- The **applicant-category key set is duplicated in two places** that must move together: the lookup seed (above) and the **string-literal union `ApplicantCategoryKey`** in [frontend/src/shared/types/domain.ts:536-543](../../../frontend/src/shared/types/domain.ts#L536-L543). 117 references across 16 files reach the legacy 7-key surface; ~half are hard-coded lists in components / mock seeds.
- The **application_settings wizard step** ([frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx)) is **not the per-category eligibility editor the brief describes**. It is a **three-tier hierarchy editor** — Category → Specialization → Year — where Year rows carry most of the brief's fields (graduation years, gender, marital status, max age, grade gate, application window, age-reference date) but **per category-specialization junction**, not per category. There is **structural divergence** from the brief's spec — see "Gap analysis" below.
- The brief's 4 categories don't map 1:1 onto the existing 7. The migration is **2 keeps (one rename) + 5 drops + 2 adds**.
- The **CategoryEditPage / CategoriesListPage** ([frontend/src/features/admin/pages/CategoriesListPage.tsx](../../../frontend/src/features/admin/pages/CategoriesListPage.tsx), `/admin/categories`) only edits `labelAr` + `description` over `MOCK.categories`; it is **not** the rich eligibility editor the guardrail warned about. Safe to leave untouched.

---

## 1. Lookup source of truth

| File | Role |
|---|---|
| [frontend/src/features/lookups/mock/lookups.mock.ts:269-480](../../../frontend/src/features/lookups/mock/lookups.mock.ts#L269) | **Authoritative seed** — 7 `ApplicantCategoryRow` rows. `metadata.submissionTypeCode` FKs into `submission-types` and decides `gradingMode` (`GRADES` vs `TAGDIR`). |
| [frontend/src/shared/types/domain.ts:536-543](../../../frontend/src/shared/types/domain.ts#L536-L543) | `ApplicantCategoryKey` — discriminated union of the 7 keys. Type-level pinning. |
| [frontend/src/shared/mock-data/categories.ts](../../../frontend/src/shared/mock-data/categories.ts) | Legacy 7-entry array. **No longer read by `MOCK.categories`** (the index file maps the lookup seed at line 992 and ignores this). The file still exports `ACTIVE_CYCLE_ID` (used by `MOCK.activeCycleId`). |
| [frontend/src/shared/mock-data/index.ts:992-1005](../../../frontend/src/shared/mock-data/index.ts#L992) | `MOCK.categories` derived view — projects `ApplicantCategoryRow → ApplicantCategory` so existing consumers using the rich shape keep working. |

### Current 7-key set (with submission-type → gradingMode)

| `code` | `name` | `genderScope` | `applicationMode` | `submissionTypeCode` | gradingMode |
|---|---|---|---|---|---|
| `officers_general` | قسم الضباط (القسم العام) | `male` | `general` | `SUB-001` | `GRADES` |
| `officers_specialized` | قسم الضباط المتخصصين | `any` | `general` | `SUB-002` | `TAGDIR` |
| `postgraduate` | الدراسات العليا | `any` | `nomination` | `SUB-002` | `TAGDIR` |
| `institute_officers_training` | معهد تدريب الضباط | `any` | `nomination` | `SUB-002` | `TAGDIR` |
| `institute_traffic` | معهد المرور | `any` | `nomination` | `SUB-002` | `TAGDIR` |
| `institute_guarding` | معهد الحراسات والتأمين | `any` | `nomination` | `SUB-002` | `TAGDIR` |
| `special_units` | الوحدات الخاصة | `any` | `nomination` | `SUB-002` | `TAGDIR` |

### RFP target 4-key set (per the brief table)

| target `code` (proposed snake_case) | `name` (verbatim) | gender rule | extra picker | grade input |
|---|---|---|---|---|
| `officers_general` *(kept)* | قسم الضباط (قسم عام) | `male` (locked) | **school-categories** multi-select (`school-categories` lookup) | `minGradePercent` (0–100) → SUB-001 `GRADES` |
| `law_bachelor` *(new)* | ليسانس حقوق | selectable (`male` / `female` / `any`) | — | تقدير (`academic-grades` lookup) → SUB-003 `TAGDIR` |
| `physical_education_bachelor` *(new)* | بكالوريوس تربية رياضية | `female` (locked) | — | تقدير → SUB-004 (**must be flipped from `GRADES` to `TAGDIR`**) |
| `specialized_officers` *(renamed from `officers_specialized`)* | الضباط المتخصصون | selectable | **faculties + specializations** multi-select | تقدير → SUB-002 `TAGDIR` |

### Mapping verdict

- **Kept as-is:** `officers_general`.
- **Renamed:** `officers_specialized` → `specialized_officers` (label changes to **الضباط المتخصصون** per the brief).
- **Dropped:** `postgraduate`, `institute_officers_training`, `institute_traffic`, `institute_guarding`, `special_units` — all 5 retired. The brief's "no others permitted" is unambiguous.
- **Added:** `law_bachelor`, `physical_education_bachelor`.

### Convention question (decide before commit 1)

The brief writes the keys as `officers-general`, `law-bachelor`, `physical-education-bachelor`, `specialized-officers` (kebab-case). The existing codebase uses **snake_case** (`officers_general`, `officers_specialized`, …) and a snake_case form is what the type system, the lookup `code`, and all 117 references currently consume. **Proposed:** keep snake_case for consistency. Flag if you'd rather flip everything to kebab-case (much larger blast radius).

---

## 2. Consumers of the legacy 7-key surface

117 references across 16 files. The high-traffic surfaces:

### Hard-coded category lists that need to shrink to the 4 keys

- [frontend/src/features/admin/components/notifications/AudienceSelector.tsx:79-90](../../../frontend/src/features/admin/components/notifications/AudienceSelector.tsx#L79) — `ChipsList` with 7 hard-coded `{value, label}` options. Replace with a read off `LOOKUPS_SEED['applicant-categories']`.
- [frontend/src/features/committees/pages/CommitteeDetailPage.tsx:658-668](../../../frontend/src/features/committees/pages/CommitteeDetailPage.tsx#L658) — `applicantTypeLabel(key)` switch over 7 keys. Trim to 4.
- [frontend/src/shared/mock-data/admissionCycles.ts:52-124](../../../frontend/src/shared/mock-data/admissionCycles.ts#L52) — `openCategories` per cycle includes all 7 keys. Trim to 4 (and update cycle capacities accordingly).
- [frontend/src/shared/mock-data/categoryCommittees.ts:38](../../../frontend/src/shared/mock-data/categoryCommittees.ts#L38) — references `officers_specialized` (will become `specialized_officers`).
- [frontend/src/shared/mock-data/index.ts:781-809](../../../frontend/src/shared/mock-data/index.ts#L781) — uses category codes as `specializationIds` on **committee** seeds (semantic miss — those are committee `specializationIds`, not applicant-category keys; safe to leave but worth flagging).
- [frontend/src/features/admin/api/reports.service.ts](../../../frontend/src/features/admin/api/reports.service.ts) — uses keys for breakdowns. Trim.
- [frontend/src/features/admin/api/categories.service.ts:39-47](../../../frontend/src/features/admin/api/categories.service.ts#L39) — `SPEC_KEYS` set of 7. Trim to 4. (Also delete-protection list — see §4 below.)
- [frontend/src/shared/mock-data/testSchedules.ts](../../../frontend/src/shared/mock-data/testSchedules.ts), [frontend/src/shared/mock-data/adminNotifications.ts](../../../frontend/src/shared/mock-data/adminNotifications.ts) — seed rows tagged by category.
- [frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx:53-56](../../../frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L53) — branch on `institute_*` / `special_units` keys to suppress the education form. All 4 conditions become dead code on the new key set (and `nomination`-only is no longer a concept since all 4 RFP categories are public/general). Delete the branch.

### Type-level pinning

- [frontend/src/shared/types/domain.ts:536-543](../../../frontend/src/shared/types/domain.ts#L536-L543) — `ApplicantCategoryKey`. Re-author from the const tuple of 4. (CLAUDE.md §9 conventions: derive the union from a `const` tuple — `APPLICANT_CATEGORY_KEYS = [...] as const; type ApplicantCategoryKey = typeof APPLICANT_CATEGORY_KEYS[number]`.)

### Wizard-step seeds + mocks

- [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts:61-69](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts#L61) — `ATTACHMENT_PLAN` map keyed by legacy 7-key set. Rewrite to 4.
- [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts:134-182](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts#L134) — `YEAR_BLUEPRINTS_PER_CATEGORY` keyed by legacy 4 keys (`officers_general`, `officers_specialized`, `postgraduate`, `institute_officers_training`). Rewrite to the new 4.

### Applicant mock generators

- [frontend/src/shared/mock-data/index.ts](../../../frontend/src/shared/mock-data/index.ts) — applicants carry `department` (string) and `certType` (string). Neither is type-pinned to `ApplicantCategoryKey`, so technically they don't need to change to typecheck — but seed data does reference dropped department labels (e.g. "معهد المرور"). Audit and rewrite to the 4-key universe.

---

## 3. application_settings wizard step — current shape

### Files

| File | Role |
|---|---|
| [frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx) | Page shell (38 lines) — composes `<CategoryAccordion />` + sticky save bar. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx) | Radix Accordion (multiple-open). One item per `ApplicantCategoryConfig`. Header: name + counts + active switch. Body: `<SpecializationList configId>`. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx) | Lists `ApplicantCategorySpecialization` rows for the category + "إضافة تخصص" button. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationRow.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationRow.tsx) | One specialization row — renders `<YearTable categorySpecializationId>` underneath. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/AttachSpecializationDialog.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/AttachSpecializationDialog.tsx) | Modal picker — attach a specialization lookup row to the category. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx) | **The actual condition editor** — 760 lines. One card per `ApplicantSpecializationYear` row: graduation years (multi), gender pills, marital-status multi, max-age, grade gate (GRADES or TAGDIR), division multi, application start/end, age-reference date. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx) | Bulk save. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/ScopeBanner.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/ScopeBanner.tsx) | **Currently unused** — `ApplicationSettingsPage` does not render it. Leftover. |
| [frontend/src/features/admin/admission-setup/components/applicationSettings/UnsavedChangesPrompt.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/UnsavedChangesPrompt.tsx) | Beforeunload guard. |
| [frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) | Mock CRUD across the three tiers. ConflictError codes already wired. |
| [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts) | Seeds three tiers — one config per lookup row, attachment plan, blueprint years. |
| [frontend/src/features/admin/admission-setup/types.ts:143-247](../../../frontend/src/features/admin/admission-setup/types.ts#L143) | `ApplicantCategoryConfig` / `ApplicantCategorySpecialization` / `ApplicantSpecializationYear` (discriminated union on `gradeKind`). |

### Current form-state shape (the leaf row)

```ts
ApplicantSpecializationYearBase {
  id, categorySpecializationId,
  graduationYears: number[],        // multi
  genderTypes: GenderType[],        // multi (binary union from Applicant.gender)
  maritalStatusCodes: string[],     // multi (MAR-NN)
  maxAge: number | null,
  divisionCodes: string[],          // multi (DIV-NN — أدبي/علمي/علوم/…)
  applicationStartDate, applicationEndDate, ageReferenceDate: ISO,
  isActive: boolean,
}
+ discriminator gradeKind: 'GRADES' (minPercentage) | 'TAGDIR' (academicGradeId)
```

---

## 4. Gap analysis — brief spec vs current wizard

### Structural divergence

The brief asks for a **per-category** editor where each category exposes a **flat condition block** + a small set of optional pickers. The current wizard is **per (category × specialization × year)**, with specialization as a first-class axis. The brief implicitly treats specialization as a sub-picker on `specialized_officers` only (and school-categories as a sub-picker on `officers_general` only).

**Three reconciliation paths:**

1. **Keep the three-tier model; adapt the labels per category.**
   - `officers_general`: under the category accordion, render a single "year card" group keyed on the category (no specialization axis). The school-categories multi-select replaces the specialization picker.
   - `specialized_officers`: keep the existing model — specialization is the second axis, and inside each specialization the year row carries the brief's fields.
   - `law_bachelor` / `physical_education_bachelor`: collapse to a single "year card" group per category (no specialization, no extra picker).
   - **Pros:** minimal churn — YearTable.tsx (760 lines) is reused; ConflictError set stays valid.
   - **Cons:** the model still doesn't match the brief's "one card per category" exactly. Behaviour for the 3 categories without a specialization axis becomes special-cased.

2. **Rebuild the application_settings step from scratch per the brief.**
   - One card per category. Inside each card, render exactly the fields per the table.
   - `specialized_officers` keeps the existing three-tier editor as a *separate* tab inside its card (so we don't lose the per-spec-per-year capability).
   - **Pros:** cleanest user experience, matches the brief verbatim.
   - **Cons:** retires ~800 lines of three-tier infrastructure (YearTable, ApplicantCategorySpecialization, ApplicantSpecializationYear, ConflictError codes, applicationSettings.service mutations). Larger blast radius. Backend integration contract (already documented in [docs/DB_CONSTRAINTS.md §11](../../DB_CONSTRAINTS.md)) needs review.

3. **Retrofit a "per-category global block" alongside the existing three-tier editor.**
   - Add a small per-category fields block at the top of each accordion item: gender (per category rule), grade gate, age range + age-ref date, marital status, graduation years, stage start/end, plus per-category extras (school-categories for `officers_general`; faculties+specializations for `specialized_officers`).
   - The three-tier editor stays as the "advanced per-year override" below the per-category block.
   - **Pros:** matches the brief on the surface; preserves backend integration plan.
   - **Cons:** dual-write story — values live in both places; conflict semantics unclear.

**Recommendation:** **Path 1.** It's the smallest defensible delta against the existing model and avoids retiring 800 lines of shipped infrastructure before backend integration. The brief's per-category fields **already exist** inside `ApplicantSpecializationYear` — they're just labeled per `categorySpecialization`, not per `category`. For the 3 RFP categories without a real "specialization" axis we synthesize a single canonical specialization (e.g. an implicit "default" specialization per category) so the existing schema keeps working, and the accordion item renders without the spec list.

**Open question:** does the user actually want the existing three-tier model retired? If yes, that's Path 2 — say so and I'll re-plan commit 2.

### Field-level deltas (assuming Path 1)

| Brief field | Current location | Delta |
|---|---|---|
| gender rule (per category, sometimes locked) | `ApplicantSpecializationYear.genderTypes: GenderType[]` (multi) | Honors the brief — but `officers_general` / `physical_education_bachelor` need a **locked** display state. **Add gender-lock metadata on the category lookup row** (`genderScope` already there — currently `'male' \| 'female' \| 'any'` on `ApplicantCategoryRow`). The form reads it and locks the toggle when ≠ `'any'`. |
| school-categories multi (`officers_general` only) | **Missing** — three-tier model has `divisionCodes` (DIV-NN) but no `school-categories` (SCH-NN). | New field on the row OR new metadata column. **Recommend** repurposing `divisionCodes` is wrong (DIV-NN is الشعبة, distinct from فئة المدرسة SCH-NN). Cleanest: add `schoolCategoryCodes: string[]` to the row, surfaced only for `officers_general`. |
| faculties + specializations multi (`specialized_officers` only) | The three-tier model already wires `specializations` lookup as the second axis. | Keep as-is for this category. |
| min % grade (`officers_general`) | `gradeKind: 'GRADES' + minPercentage` | Honors. |
| min تقدير (other 3) | `gradeKind: 'TAGDIR' + academicGradeId` (FK → `academic-grades`) | Honors. Note: lookup row for "ممتاز" is actually seeded as **"امتياز"** (`AGR-01`). Brief writes "ممتاز" — same grade, different Arabic synonym. Need to confirm: rename the lookup row to "ممتاز" or keep "امتياز" and treat the brief's term as a synonym? **Recommend** keep `امتياز` (it's the institutional standard at Egyptian universities) and flag in the report. |
| ageMin + ageMax + ageCalcDate | `maxAge` + `ageReferenceDate` | **Missing `ageMin`.** Add to the row schema. |
| maritalStatus multi | `maritalStatusCodes: string[]` | Honors. |
| graduationYears multi-add | `graduationYears: number[]` (multi-select last-5 chips) | Honors. Brief says "user can add/remove freely" — current UI is fixed last-5; trivial to relax. |
| stage start/end | `applicationStartDate`, `applicationEndDate` | Honors. |

### Validation codes that stay vs change

- Existing `AppSettingsConflict` ([types.ts:235-246](../../../frontend/src/features/admin/admission-setup/types.ts#L235)) — all 12 codes stay valid.
- New code candidates: `SCHOOL_CATEGORY_NOT_ALLOWED` (when admin picks a school-category on a non-`officers_general` category — defensive only since UI gates it).

---

## 5. Other surfaces — leave or touch?

- **`/admin/categories` (CategoriesListPage, CategoryEditPage, CategoryNewPage)** — only edits `labelAr` + `description`. Already enforces "spec category cannot be deleted" via `SPEC_KEYS`. **Action:** trim `SPEC_KEYS` to 4. Decide on the "إضافة فئة" affordance:
  - **Option A (recommended):** **hide** the "إضافة فئة" button on the list page (and 404 the `/categories/new` route) — categories are a closed RFP-defined set. CLAUDE.md §11 already terminology-locks "RFP Scope Document"; this is the same spirit.
  - **Option B:** keep "إضافة فئة" but the new admin-defined categories live as `custom_*` entries and never appear in the lookup-bound surfaces.
  - The brief says "Remove dead 'إضافة فئة' affordance if categories are now closed-set" — go with Option A.
- **`/admin/lookups/applicant-categories`** — the Lookup Management drawer at [frontend/src/features/lookups/components/LookupRowDrawer.tsx](../../../frontend/src/features/lookups/components/LookupRowDrawer.tsx) renders an editor for the row's fields (genderScope, applicationMode, submission-type FK, isOpen). **Action:** keep — admin can still flip `isOpen` / `submissionTypeCode` per cycle; just block create/delete on this lookup (already isn't user-mutable from the drawer in practice).
- **`/applicant/start` (CategorySelectionPage)** — already filters out `nominationOnly` categories. With all 4 RFP categories being public (none `nominationOnly: true`), all 4 will appear. **Confirm** that's the desired applicant-portal behaviour (or whether some of the 4 should still be hidden from the public picker — brief doesn't say).
- **`Stage4EducationPage`** — currently has a "skip education form for institute/special-units categories" branch. **Action:** delete the dead branch.

---

## 6. Proposed diff plan (Path 1)

### Commit 1 — `feat(lookups): lock applicant categories to RFP 4-category set`

Files (15):
1. **`features/lookups/mock/lookups.mock.ts`** — replace the 7 `applicantCategories` entries with 4. Update `CATEGORY_SUBMISSION_MAP`. Flip `SUB-004` gradingMode from `GRADES` to `TAGDIR` per the RFP spec.
2. **`shared/types/domain.ts`** — re-author `ApplicantCategoryKey` as a `const`-tuple → derived union (4 keys).
3. **`shared/mock-data/categories.ts`** — delete `APPLICANT_CATEGORIES` (now dead), keep only `ACTIVE_CYCLE_ID`. Or inline `ACTIVE_CYCLE_ID` in `index.ts` and delete the file entirely.
4. **`shared/mock-data/admissionCycles.ts`** — rewrite `openCategories` to the 4 keys (and reasonable capacities).
5. **`shared/mock-data/categoryCommittees.ts`** — rename `officers_specialized` → `specialized_officers`.
6. **`shared/mock-data/testSchedules.ts`** — re-key seed rows that tag legacy categories.
7. **`shared/mock-data/adminNotifications.ts`** — same.
8. **`shared/mock-data/index.ts`** — applicants' `department` / `certType` columns: re-roll the seed to use the 4-category universe (LCG seed=42 stays); update committee `specializationIds` if those use category keys (they do — line 781 etc.; flag may be a semantic miss).
9. **`features/admin/api/categories.service.ts`** — trim `SPEC_KEYS` to 4. Remove `create()` and `duplicate()` (categories are closed) **or** keep them returning a 403-equivalent. **Recommend** make them throw an Arabic-message Error since the type system already forbids `custom_*` keys (the union has 4 entries).
10. **`features/admin/pages/CategoriesListPage.tsx`** — hide "إضافة فئة" + "نسخ" actions; keep edit only.
11. **`features/admin/pages/CategoryNewPage.tsx`** — delete the file; remove the route from `routes.tsx` (or 404 it).
12. **`features/admin/components/notifications/AudienceSelector.tsx`** — switch the hard-coded options list to a `LOOKUPS_SEED['applicant-categories']` read.
13. **`features/committees/pages/CommitteeDetailPage.tsx`** — trim `applicantTypeLabel` switch to 4.
14. **`features/admin/api/reports.service.ts`** — trim category breakdowns to 4 keys.
15. **`features/applicant-portal/pages/Stage4EducationPage.tsx`** — delete the dead `nomination-only` branch.

Acceptance: `npm run typecheck` clean, `npm run build` clean. Visual smoke at `/admin/lookups/applicant-categories`, `/admin/categories`, `/applicant/start`.

### Commit 2 — `feat(admission-setup): align application_settings step with RFP per-category conditions`

Files (~7):
1. **`features/admin/admission-setup/types.ts`** — add `ageMin: number | null` to `ApplicantSpecializationYearBase`; add `schoolCategoryCodes: string[]` (used only when parent category is `officers_general`).
2. **`features/admin/admission-setup/mock/appSettings.mock.ts`** — rewrite `ATTACHMENT_PLAN` to:
   - `officers_general`: a single implicit "default" specialization (no real specs — school-categories take that slot).
   - `specialized_officers`: the existing SPC-NN attachment plan.
   - `law_bachelor`: single implicit "default" specialization.
   - `physical_education_bachelor`: single implicit "default" specialization.
   - Rewrite `YEAR_BLUEPRINTS_PER_CATEGORY` to the new 4-key universe (per the brief's grading-mode rules).
3. **`features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx`** — branch on category code:
   - `officers_general` / `law_bachelor` / `physical_education_bachelor`: render the implicit-default specialization's `YearTable` inline (no spec-list, no "إضافة تخصص").
   - `specialized_officers`: keep the existing spec-list shape.
4. **`features/admin/admission-setup/components/applicationSettings/YearTable.tsx`** — add `ageMin` field next to `maxAge`. Add `schoolCategoryCodes` multi-select (rendered only for `officers_general`). Honor `genderScope` lock — when category's `genderScope` is `'male'` or `'female'`, render the gender toggle as a read-only badge.
5. **`features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx`** — minor: hide "إضافة تخصص" for the 3 categories where the spec axis is implicit.
6. **`features/admin/admission-setup/api/applicationSettings.service.ts`** — extend `validateYearRow` with the new `ageMin` field (already covers `ageMax`). No new ConflictError needed.
7. **`features/admin/admission-setup/lib/appSettingsValidation.ts`** — validate `ageMin <= ageMax` when both set.

Acceptance: `npm run typecheck` clean. `npm run dev` and exercise `/admin/admission-setup/wizard` → step 1 for each of the 4 categories.

---

## 7. Risks / things I'm not sure about

- **Applicant seed re-roll.** Applicants have `department: string` and `certType: string` columns that today contain Arabic labels derived from the legacy 7 categories. Re-rolling them is straightforward (LCG seed=42), but **breaks comparisons against any saved snapshot** in `_legacy/` or elsewhere. Low risk — flag in REPORT.md.
- **`/admin/categories` users.** If someone has been using "إضافة فئة" to spike up demo data, retiring it loses that capability. Brief authorizes it — proceeding under that authorization.
- **`MOCK.cycles` capacity numbers.** Today's seeded cycles have 200/40/20/null/null/null/null. The new cycles probably want capacities for all 4 RFP categories — I'll pick plausible numbers (no spec from the brief) and flag.
- **Conflict between brief and existing lookup row labels** — "ممتاز" (brief) vs "امتياز" (lookup). Per Egyptian academic convention, "امتياز" is the canonical name. Recommend keep لكن with a synonym note; not changing the lookup.
- **`Stage4EducationPage` skip-branch** — used by the 4 nomination-only legacy categories. Deletion is safe per the new spec (no nomination categories), but if any partial wizard state in browser sessionStorage holds an old key, the applicant-portal flow short-circuits with "category not found." Acceptable demo-data drift.

---

**End of audit. Ready to proceed to commit 1 on approval.**
