# Report — Applicant categories locked to RFP 4-category set

> Companion to [AUDIT.md](AUDIT.md). Final state after the two commits below.
> Date: 2026-05-12.

---

## Decisions taken (out of the 4 open questions in AUDIT.md §7)

1. **Key encoding:** `snake_case` (matches the rest of the codebase; kebab in the brief was presentational).
2. **Wizard architecture:** **Path 1** — keep the three-tier model, synthesize an implicit "default" `ApplicantCategorySpecialization` junction for the 3 single-axis categories so the existing `YearTable` / validation / service infrastructure stays reusable. Only `specialized_officers` exposes the real `<SpecializationList />`.
3. **"إضافة فئة" affordance:** hidden. The category set is locked. The `/admin/categories/new` route now redirects to `/admin/categories`.
4. **Applicant-portal `/applicant/start`:** all 4 RFP categories appear (none are `nominationOnly: true`).

Two follow-ups noted in the audit were also acted on inside commit 1:

- **`SUB-004` (`تربية رياضية إناث`) gradingMode flipped from `GRADES` → `TAGDIR`** to match the RFP spec for `physical_education_bachelor`.
- **"ممتاز" / "امتياز" naming mismatch** — kept the academic-grades lookup row as **`امتياز`** (`AGR-01`) per Egyptian institutional convention.

---

## Commits

### Commit 1 — `138e2fc feat(lookups): lock applicant categories to RFP 4-category set`

18 files changed, 502 insertions(+), 823 deletions(-).

**Lookup + types**
- [frontend/src/features/lookups/mock/lookups.mock.ts](../../../frontend/src/features/lookups/mock/lookups.mock.ts) — the 7-entry `applicantCategories` seed replaced with 4 (`officers_general`, `law_bachelor`, `physical_education_bachelor`, `specialized_officers`). `CATEGORY_SUBMISSION_MAP` rewritten. `SUB-004` gradingMode flipped to `TAGDIR`.
- [frontend/src/shared/types/domain.ts](../../../frontend/src/shared/types/domain.ts) — `ApplicantCategoryKey` re-authored as a derived union over the `APPLICANT_CATEGORY_KEYS` const tuple.

**Admin surfaces**
- [frontend/src/features/admin/api/categories.service.ts](../../../frontend/src/features/admin/api/categories.service.ts) — `SPEC_KEYS` now derives from `APPLICANT_CATEGORY_KEYS`. `create()` / `duplicate()` / `remove()` removed; `softDelete()` / `restore()` reject with `CLOSED_SET_MESSAGE` (kept so existing query hooks stay wired).
- [frontend/src/features/admin/api/categories.queries.ts](../../../frontend/src/features/admin/api/categories.queries.ts) — `useCreateCategoryMutation` / `useRemoveCategoryMutation` retired.
- [frontend/src/features/admin/pages/CategoriesListPage.tsx](../../../frontend/src/features/admin/pages/CategoriesListPage.tsx) — re-authored. Drops the "إضافة فئة" button, the "نسخ" / "حذف" / "استعادة" actions, the `SoftDeleteDialog`, and the "إظهار المحذوف" toggle. Edit-only.
- [frontend/src/features/admin/pages/CategoryNewPage.tsx](../../../frontend/src/features/admin/pages/CategoryNewPage.tsx) — **deleted**.
- [frontend/src/config/routes.ts](../../../frontend/src/config/routes.ts) + [frontend/src/routes.tsx](../../../frontend/src/routes.tsx) — `ROUTES.admin.categoryNew` retired. `/admin/categories/new` redirects to `/admin/categories`.
- [frontend/src/features/admin/index.ts](../../../frontend/src/features/admin/index.ts) — `CategoryNewPage` export retired.

**Consumers re-keyed**
- [frontend/src/features/admin/components/notifications/AudienceSelector.tsx](../../../frontend/src/features/admin/components/notifications/AudienceSelector.tsx) — hard-coded category chip list replaced with `useLookup('applicant-categories')`.
- [frontend/src/features/committees/pages/CommitteeDetailPage.tsx](../../../frontend/src/features/committees/pages/CommitteeDetailPage.tsx) — `applicantTypeLabel()` trimmed from 7 cases to 4.
- [frontend/src/features/admin/api/reports.service.ts](../../../frontend/src/features/admin/api/reports.service.ts) — `FALLBACK_CATEGORIES` trimmed.
- [frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx](../../../frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx) — the 4-branch `requiresSportFields` legacy check collapsed to a single `physical_education_bachelor` check.

**Mock seeds**
- [frontend/src/shared/mock-data/admissionCycles.ts](../../../frontend/src/shared/mock-data/admissionCycles.ts) — `openCategories` rewritten for all three cycle entries (2025-M, 2025-F, 2026-M).
- [frontend/src/shared/mock-data/categoryCommittees.ts](../../../frontend/src/shared/mock-data/categoryCommittees.ts) — `officers_specialized` → `specialized_officers`.
- [frontend/src/shared/mock-data/index.ts](../../../frontend/src/shared/mock-data/index.ts) — committee seed `specializationIds` re-keyed to the 4-category universe.
- [frontend/src/shared/mock-data/categories.ts](../../../frontend/src/shared/mock-data/categories.ts) — **deleted** (`MOCK.categories` is now derived from the lookup; `ACTIVE_CYCLE_ID` was already inlined in `index.ts`).
- [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts) — `ATTACHMENT_PLAN` + `YEAR_BLUEPRINTS_PER_CATEGORY` rewritten to the new 4-key universe (preparing for commit 2's implicit-default junction).

---

### Commit 2 — `cd0a36c feat(admission-setup): align application_settings step with RFP per-category conditions`

9 files changed, 348 insertions(+), 60 deletions(-).

**Types + validation**
- [frontend/src/features/admin/admission-setup/types.ts](../../../frontend/src/features/admin/admission-setup/types.ts):
  - `ApplicantSpecializationYearBase` gained `ageMin: number | null` and `schoolCategoryCodes: string[]`.
  - `AppSettingsConflict` gained `'AGE_RANGE_INVALID'`.
- [frontend/src/shared/lib/errors.ts](../../../frontend/src/shared/lib/errors.ts) — `ConflictCode` mirrors the new code.
- [frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts](../../../frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts) — `validateAgeRange()` runs after `validateAge()`, enforcing `ageMin > 0` and `ageMin ≤ maxAge` when both set.

**Mock seed — implicit-default junctions**
- [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts):
  - New exported constant `IMPLICIT_DEFAULT_SPEC_CODE = '__default__'` — the sentinel FK on the implicit-default `ApplicantCategorySpecialization` for single-axis categories.
  - `ATTACHMENT_PLAN` now seeds `[IMPLICIT_DEFAULT_SPEC_CODE]` for `officers_general` / `law_bachelor` / `physical_education_bachelor`, and the real `['SPC-01', 'SPC-04', 'SPC-12']` for `specialized_officers`.
  - `YEAR_BLUEPRINTS_PER_CATEGORY` rewritten per-category: `officers_general` blueprints carry `schoolCategoryCodes: ['SCH-01', …]`; the other three leave the array empty.
  - `ACTIVE_CONFIG_LIMIT` dropped — all 4 configs ship `isActive: true`.
- [frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts](../../../frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts) — `addRow()` default row includes `ageMin: null` and `schoolCategoryCodes: []`.

**Service + queries**
- [frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts):
  - `CategoryConfigJoined` gained `categoryCode`, `genderScope`, `singleAxis`, `implicitSpecId`. `specializationCount` now excludes the implicit-default junction.
  - `listSpecializationsForConfig()` filters out the implicit-default junction so the SpecializationList never renders it.
  - New `getParentCategoryForSpec()` returns `{ code, genderScope } | null` for the YearTable's gender-lock branch.
- [frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts):
  - `appSettingsKeys.parentCategory()` key factory.
  - `useParentCategoryForSpec()` hook.
  - `CONFLICT_MESSAGES_AR` gained `'AGE_RANGE_INVALID'`.

**UI**
- [frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx) — body branches on `config.singleAxis`: `<YearTable categorySpecializationId={config.implicitSpecId} />` inline for single-axis, `<SpecializationList />` for `specialized_officers`. Counts badge tightened for single-axis (drops the "N تخصص" bit).
- [frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx):
  - New `LockedGenderBadge` rendered in place of `GenderToggle` when the parent category's `genderScope` is `'male'` or `'female'`.
  - Year card gender field auto-pins to the locked value on mount (via a `useEffect` patch).
  - "إضافة سنة" seeds the new row's `genderTypes` from the parent lock (when locked).
  - "السن الأقصى" field replaced with a paired "نطاق السن" input (`ageMin` … `ageMax`).
  - New "فئة المدرسة" multi-select rendered **only** when the parent is `officers_general`; the existing "الشعبة" multi-select is now gated to `officers_general` too (matches RFP §2.1 — division فقط ينطبق على الثانوية track).
  - `ageError` matches both `'AGE_NOT_POSITIVE'` and the new `'AGE_RANGE_INVALID'`.

---

## Before / after — the lookup seed

### Before (7 categories, mixed `general` + `nomination`)

| code | label | genderScope | applicationMode | submissionType (gradingMode) |
|---|---|---|---|---|
| `officers_general` | قسم الضباط (القسم العام) | male | general | SUB-001 (GRADES) |
| `officers_specialized` | قسم الضباط المتخصصين | any | general | SUB-002 (TAGDIR) |
| `postgraduate` | الدراسات العليا | any | nomination | SUB-002 (TAGDIR) |
| `institute_officers_training` | معهد تدريب الضباط | any | nomination | SUB-002 (TAGDIR) |
| `institute_traffic` | معهد المرور | any | nomination | SUB-002 (TAGDIR) |
| `institute_guarding` | معهد الحراسات والتأمين | any | nomination | SUB-002 (TAGDIR) |
| `special_units` | الوحدات الخاصة | any | nomination | SUB-002 (TAGDIR) |

### After (4 categories, all `general`)

| code | label | genderScope | applicationMode | submissionType (gradingMode) |
|---|---|---|---|---|
| `officers_general` | قسم الضباط (قسم عام) | **male (locked)** | general | SUB-001 (GRADES) |
| `law_bachelor` | ليسانس حقوق | any | general | SUB-003 (TAGDIR) |
| `physical_education_bachelor` | بكالوريوس تربية رياضية | **female (locked)** | general | SUB-004 (TAGDIR — flipped from GRADES) |
| `specialized_officers` | الضباط المتخصصون | any | general | SUB-002 (TAGDIR) |

---

## Wizard step — per-category field matrix (after)

| Category | Gender control | Extra picker | Grade gate | Shared fields |
|---|---|---|---|---|
| `officers_general` | locked: **ذكور فقط** badge | فئة المدرسة (multi) + الشعبة (multi) | min % grade (`minPercentage`, 0–100) | نطاق السن (ageMin–maxAge) · الحالة الاجتماعية · سنة التخرج (multi) · تاريخ احتساب السن · فترة التقديم (start/end) |
| `law_bachelor` | toggle ذكور / إناث (multi) | — | تقدير (`academicGradeId` → academic-grades lookup) | (same shared block) |
| `physical_education_bachelor` | locked: **إناث فقط** badge | — | تقدير | (same shared block) |
| `specialized_officers` | toggle ذكور / إناث (multi) | الكليات والتخصصات (multi — via the existing SpecializationList tier) | تقدير | (same shared block per-junction) |

All fields are rendered using the existing Radix-based shared compositions (`MultiSelect`, `Combobox`, `DatePicker`, `Input`) per CLAUDE.md §2.5. No new shared component was promoted.

---

## Where to look in the UI (manual smoke checklist)

Start the dev server (`npm --prefix frontend run dev`) and walk through:

1. **`/admin/lookups/applicant-categories`** — the lookup grid shows exactly 4 rows. `officers_general`'s genderScope is `'male'`; `physical_education_bachelor`'s is `'female'`.
2. **`/admin/categories`** — list shows 4 rows with edit-only actions. No "إضافة فئة" button. Direct navigation to `/admin/categories/new` redirects back to the list.
3. **`/admin/admission-setup/wizard` → step 1 (إعدادات التقديم)** — the accordion shows 4 rows. Expand:
   - **`قسم الضباط (قسم عام)`** — year cards render inline (no SpecializationList). Gender shows the locked **"ذكور فقط"** badge. The "فئة المدرسة" multi-select is visible. The grade input is a numeric `%`.
   - **`ليسانس حقوق`** — year cards render inline. Gender toggle is editable. No school-category / no الشعبة picker. The grade input is a تقدير combobox.
   - **`بكالوريوس تربية رياضية`** — year cards render inline. Gender shows the locked **"إناث فقط"** badge. تقدير combobox.
   - **`الضباط المتخصصون`** — SpecializationList renders with 3 attached specializations (`SPC-01`, `SPC-04`, `SPC-12`). Each spec's year table behaves like the existing wizard (gender toggle, تقدير combobox).
4. **`/applicant/start`** — pre-wizard category picker shows the 4 categories. `physical_education_bachelor` is closed on cycle `CYC-2026-M` (per the new seed); the other 3 are open.
5. **`/admin/notifications`** — when picking `جمهور = فئة قبول`, the chip list pulls the 4 categories from the lookup (verified by hitting the new chip labels).

> **Screenshots:** intentionally not bundled with this report. The user is mid-session in Chrome (the running browser blocks programmatic screenshots from this agent), and the visual states above are reproducible end-to-end in <5 minutes by walking the route list. If the user needs canonical screenshots, they can capture them in the existing browser session.

---

## Validation runs

```
$ npm --prefix frontend run typecheck   # 0 errors
$ npm --prefix frontend run build       # successful — dist/index-BBu24zDI.js
```

(Lint is not yet wired in this repo — see CLAUDE.md §2.)

---

## Follow-ups / things deliberately deferred

1. **Soft-delete UI for categories.** `categoriesAdminService.softDelete()` and `restore()` still exist and always reject. No UI consumes them; can be retired in a cleanup pass once the broader admin pattern (which uses them generically) is touched.
2. **`useCategorySoftDelete` / `useCategoryRestore` query hooks** are likewise still exported. Kept for now to avoid forcing every potential downstream consumer to refactor; both reject at the service boundary.
3. **`tactical_training` / `security_training` test-kinds** in `RequiredTestKind` (domain.ts) — no category uses them anymore, but they remain in the union since `category-test-labels.ts` and `test-instructions.ts` still reference them. Safe to leave; nothing in the runtime path emits them.
4. **Mock applicants `department` / `certType` strings** carry Arabic labels seeded before the lock. These are string columns (not type-pinned to the union), so they read fine, but they retain references to retired departments like "معهد المرور" until the seed is re-rolled. Low priority — no UI displays them in a category-aware context.
5. **`CategoryConditions` shape** (the admin-rule-builder schema in `domain.ts`) is unrelated to the wizard's `ApplicantSpecializationYear` shape — kept as-is. If the admin condition-builder is ever wired up against the new 4-category set, the brief's per-category fields are already mirrored in the year row, so the second condition shape becomes redundant.
6. **Backend integration.** The mock service methods' `INTEGRATION CONTRACT` JSDoc headers were updated (commit 1 trimmed `POST` / `DELETE` from the categories API). [docs/DB_CONSTRAINTS.md §11](../../DB_CONSTRAINTS.md) should add `AGE_RANGE_INVALID` to the conflict list when backend writes against the new schema — flagged for the backend team's handoff doc.

---

**End of report.**
