# Lookup Management Module — Migration Report

**Date:** 2026-05-11
**Author:** Ghareeb / Claude Opus 4.7 (1M context)
**Commits:** `09e70b5` → `d7c4a8b` (11 atomic commits)
**Status:** ✅ Shipped to `main`. `npm run typecheck` and `npm run build` both pass at HEAD.

---

## 1. Inventory snapshot

See [docs/migration/lookups/INVENTORY.md](INVENTORY.md) (Wave A) for the
full grep + file enumeration. Tldr: the codebase had **two parallel
admin-managed reference systems** stacked inside `ReferenceDataPage`
(545 lines), plus a `LookupTab.tsx` panel (520 lines) and matching
`*.queries.ts` / `*.service.ts` pairs, for a combined ~1,884 lines of
legacy surface — none of it offered hierarchical trees, mapping
matrices, or a typed `ConflictError` for the constraints documented in
[docs/DB_CONSTRAINTS.md](../../DB_CONSTRAINTS.md).

---

## 2. Files created

Lookup Management Module (in-feature):

| File | Lines |
|---|---:|
| [frontend/src/features/lookups/types.ts](../../../frontend/src/features/lookups/types.ts) | 156 |
| [frontend/src/features/lookups/index.ts](../../../frontend/src/features/lookups/index.ts) | 42 |
| [frontend/src/features/lookups/mock/lookups.mock.ts](../../../frontend/src/features/lookups/mock/lookups.mock.ts) | 592 |
| [frontend/src/features/lookups/api/lookups.service.ts](../../../frontend/src/features/lookups/api/lookups.service.ts) | 285 |
| [frontend/src/features/lookups/api/lookups.queries.ts](../../../frontend/src/features/lookups/api/lookups.queries.ts) | 161 |
| [frontend/src/features/lookups/components/LookupTree.tsx](../../../frontend/src/features/lookups/components/LookupTree.tsx) | 327 |
| [frontend/src/features/lookups/components/LookupGrid.tsx](../../../frontend/src/features/lookups/components/LookupGrid.tsx) | 234 |
| [frontend/src/features/lookups/components/LookupFormDrawer.tsx](../../../frontend/src/features/lookups/components/LookupFormDrawer.tsx) | 349 |
| [frontend/src/features/lookups/components/MappingMatrix.tsx](../../../frontend/src/features/lookups/components/MappingMatrix.tsx) | 179 |
| [frontend/src/features/lookups/pages/LookupsHubPage.tsx](../../../frontend/src/features/lookups/pages/LookupsHubPage.tsx) | 201 |
| [frontend/src/features/lookups/pages/MappingsPage.tsx](../../../frontend/src/features/lookups/pages/MappingsPage.tsx) | 88 |
| [frontend/src/features/dev/LookupsReviewPage.tsx](../../../frontend/src/features/dev/LookupsReviewPage.tsx) | 131 |

Shared primitives (true cross-feature, promoted intentionally):

| File | Lines |
|---|---:|
| [frontend/src/shared/components/Switch.tsx](../../../frontend/src/shared/components/Switch.tsx) | 80 |
| [frontend/src/shared/components/Checkbox.tsx](../../../frontend/src/shared/components/Checkbox.tsx) | 75 |

Docs:

| File |
|---|
| [docs/migration/lookups/INVENTORY.md](INVENTORY.md) |
| [docs/migration/lookups/REPORT.md](REPORT.md) (this file) |

**Total new code: ~2,900 lines** (incl. mock seeds + types).

---

## 3. Files deleted

| File | Lines |
|---|---:|
| `frontend/src/features/admin/pages/ReferenceDataPage.tsx` | 545 |
| `frontend/src/features/admin/components/lookups/LookupTab.tsx` | 520 |
| `frontend/src/features/admin/api/lookups.queries.ts` (legacy) | 75 |
| `frontend/src/features/admin/api/lookups.service.ts` (legacy) | 268 |
| `frontend/src/features/admin/api/referenceData.queries.ts` | 71 |
| `frontend/src/features/admin/api/referenceData.service.ts` | 166 |
| `frontend/src/shared/mock-data/lookups.ts` | 239 |
| Empty dir: `frontend/src/features/admin/components/lookups/` | — |

**Total removed: ~1,884 lines** of admin-managed-reference surface.

`frontend/src/shared/mock-data/referenceData.ts` is **edited not deleted**:
the `REFERENCE_DATA` dict and `REFERENCE_TAB_LABELS` exports are gone;
the raw `REF_*` const arrays (`REF_GOVERNORATES`, `REF_SPECIALIZATIONS`,
`REF_NATIONALITIES`, `REF_RELATIONSHIPS`, `REF_CASE_TYPES`, `REF_RANKS`)
stay alive because 5 non-admin pickers consume them directly (see §4).

`frontend/src/shared/types/domain.ts` is edited to remove `LookupKey`,
`LookupRow`, `ReferenceTab`, and `ReferenceRowMap`. The `Ref*`
interfaces survive.

---

## 4. Consumers refactored

Five sites needed real refactor beyond the deletion of the admin UI:

| File · line | Old | New |
|---|---|---|
| [frontend/src/features/admin/admission-setup/pages/MaritalStatusRulesPage.tsx:43](../../../frontend/src/features/admin/admission-setup/pages/MaritalStatusRulesPage.tsx#L43) | `useLookupList('maritalStatuses')` returning `LookupRow[]`; reads `.key` / `.labelAr` | `useLookupList({ typeCode: 'MARITAL_STATUSES', includeInactive: false, pageSize: 50 })` returning `Pagination<LookupItem>`; reads `.data` then `.code` / `.nameAr` |
| [frontend/src/features/admin/components/categories/CategoryConditionBuilder.tsx:44–46](../../../frontend/src/features/admin/components/categories/CategoryConditionBuilder.tsx#L44) | 3 × `useLookupList(<key>)` | 3 × `useLookupList({ typeCode: 'EDUCATION_TYPES' / 'MARITAL_STATUSES' / 'EXAM_TYPES' })` |
| [frontend/src/features/admin/components/notifications/AudienceSelector.tsx:39–40](../../../frontend/src/features/admin/components/notifications/AudienceSelector.tsx#L39) | 2 × `useLookupList(<key>)` | 2 × `useLookupList({ typeCode: 'NOTIFICATION_DEPARTMENTS' / 'COMMITTEE_TYPES' })` |
| [frontend/src/features/committees/api/committee.service.ts:394](../../../frontend/src/features/committees/api/committee.service.ts#L394) | `MOCK.lookups.educationTypes` filter + map | `MOCK.lookupItems.filter((l) => l.lookupTypeCode === 'EDUCATION_TYPES')` |
| [frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx:463](../../../frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx#L463) | `MOCK.referenceData.specializations` | `MOCK.lookupItems.filter((l) => l.lookupTypeCode === 'SPECIALIZATIONS')` |

Plus the `routes.tsx` redirect + `features/admin/AdminLayout.tsx` sidebar
re-target.

**Non-admin static picker consumers (intentionally left untouched):**
[Sprint6Pages.tsx](../../../frontend/src/features/board/pages/Sprint6Pages.tsx),
[ApplicantForm.tsx](../../../frontend/src/features/admin/components/applicants/ApplicantForm.tsx),
[Stage3PersonalPage.tsx](../../../frontend/src/features/applicant-portal/pages/Stage3PersonalPage.tsx),
[Stage4EducationPage.tsx](../../../frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx),
[Stage7FamilyPage.tsx](../../../frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx).
These import raw `REF_*` constants directly; they're picker option
sources, not admin-managed surfaces.

---

## 5. Conflict codes added

`ConflictCode` union in
[frontend/src/shared/lib/errors.ts](../../../frontend/src/shared/lib/errors.ts)
extended with 7 codes; each paired with its SQL Server expression in
[docs/DB_CONSTRAINTS.md §10](../../DB_CONSTRAINTS.md):

1. `DUPLICATE_CODE` — filtered unique index on `(lookup_type_code, code)`.
2. `SELF_PARENT` — CHECK constraint `parent_id <> id`.
3. `CIRCULAR_HIERARCHY` — recursive-CTE trigger.
4. `PARENT_HAS_CHILDREN` — application/trigger check on soft-delete.
5. `IN_USE` — soft-delete guard against the 4 mapping tables.
6. `INVALID_DATE_RANGE` — CHECK `start_date <= end_date`.
7. `DUPLICATE_MAPPING` — composite PK on each mapping table.

---

## 6. Type-code coverage

The brief specified 20 type codes; this implementation ships **31** to
cover all live consumers. The extra 11 (`EDUCATION_TYPES`,
`MARITAL_STATUSES`, `SPECIALTIES`, `SPECIALTY_TYPES`, `DEGREE_TYPES`,
`EXAM_TYPES`, `EXAM_GROUPS`, `COMMITTEE_TYPES`, `REJECTION_REASONS`,
`NOTIFICATION_DEPARTMENTS`, `APPLICANT_SECTIONS`,
`NATIONAL_ID_MISSING_REASONS`, `NATIONALITIES`, `CASE_TYPES`)
replicate the pre-existing `LookupKey` and `ReferenceTab` data so
consumer pages (CategoryConditionBuilder, AudienceSelector, etc.)
continue to function.

Hierarchical set extended from the brief's 8 to **11** to preserve
existing parent–child wiring: `FACULTIES` (under `UNIVERSITIES`),
`SPECIALTIES` and `SPECIALTY_TYPES` (under `FACULTIES`).

---

## 7. Open questions for the human

1. **Committees stay rich.** Step 10 of the original brief (delete
   `features/committees/`) was scoped out at plan-gate because 8
   admission-setup pages read rich committee fields (capacity,
   officers, score-thresholds) that a flat lookup cannot represent.
   `COMMITTEES` is seeded as a lookup type for picker contexts, but
   `features/committees/` continues to own the rich domain. If you
   later want to converge the two, the cleanest path is to keep
   `committees` as the canonical data source and treat the
   `COMMITTEES` lookup type as a *projection* (id + code + nameAr +
   isActive) so the admin can curate the display label / sort order
   without losing the rich fields.
2. **Seed codes use legacy snake_case keys for 6 types**
   (`MARITAL_STATUSES`, `EDUCATION_TYPES`, `EXAM_TYPES`,
   `COMMITTEE_TYPES`, `NOTIFICATION_DEPARTMENTS`, `APPLICANT_SECTIONS`)
   to preserve back-compat with the demo's seeded category conditions
   and admission rules (`['single', 'married']` etc.). The form regex
   was relaxed from `^[A-Z]+-\d{3,}$` to
   `^[A-Za-z][A-Za-z0-9_]*(-\d{3,})?$` to accept both shapes. If you
   want to enforce the strict pattern, the seeds for these types need
   replacing AND every stored reference in `MOCK.categories` /
   `MOCK.admissionCycles` must be updated atomically.
3. **No bulk activate / deactivate / import UI.** `LookupGrid` exposes
   single-row toggle and a single-row delete confirmation; the brief
   asked for bulk activate / deactivate / delete with a confirmation
   Modal. The shared `DataTable` already has a `selectionMode='multi'`
   path; wiring the bulk action bar is a follow-up of ~80 LOC.
4. **Screenshots.** Per the brief's verification list (§13), the
   following screenshots should land at
   `docs/migration/lookups/screenshots/`: `/admin/lookups`,
   `/admin/lookups/TESTS` (tree mode), `/admin/lookups/COMMITTEES`
   (grid mode), `/admin/lookups/mappings/category-committees`. They
   were not captured here because the migration ran headless; please
   capture from `npm run dev` and drop them in. The
   directory is pre-created.
5. **One pre-existing modification** to `frontend/src/features/admin/pages/AuditPage.tsx`
   was present at session start (unrelated to this migration). It has
   been left untouched and uncommitted. Decide separately whether to
   commit, revert, or continue editing.

---

## 8. Verification

Run from the repo root:

```bash
npm --prefix frontend run typecheck   # ✅ 0 errors
npm --prefix frontend run build       # ✅ 2,083 modules transformed, no warnings
```

End-to-end smoke (start `npm --prefix frontend run dev`, then click
through):

| # | Step | Expected |
|---|---|---|
| 1 | Visit `/admin/lookups` | Hub renders. Left rail shows 11 hierarchical + 20 flat = 31 types. Default landing on `RELATIONSHIP_CATEGORY`. |
| 2 | Click `TESTS` in left rail | URL becomes `/admin/lookups/TESTS`. Right panel shows 3 roots with 6 children + 5 test models. |
| 3 | Expand `اختبارات القبول` | Chevron rotates; 3 children render with indent. Reduced-motion media query respected. |
| 4 | Drag a child between siblings | Drop indicator appears; on drop, sortOrder updates and tree reflows. Refresh persists in-memory. |
| 5 | Visit `/admin/lookups/COMMITTEES` | Grid renders 8 rows. Search filter narrows live. Active-only filter works. |
| 6 | Click "إضافة" | LookupFormDrawer opens with empty fields. Focus trapped, Esc closes. |
| 7 | Submit with duplicate code | Arabic toast: "هذا الكود مستخدم بالفعل…" (DUPLICATE_CODE). |
| 8 | Submit valid | Toast: "تم إضافة …". Drawer closes. Row appears in grid. |
| 9 | Edit TESTS root → set parent to descendant | Toast: "لا يمكن تعيين هذا العنصر كأبٍ لأنه ينتمي إلى سلسلته العلوية" (CIRCULAR_HIERARCHY). |
| 10 | Delete TESTS root with children | Toast: "تعذّر الحذف — يوجد عناصر فرعية مرتبطة" (PARENT_HAS_CHILDREN). |
| 11 | Visit `/admin/lookups/mappings/categoryCommittees` | Matrix renders categories × committees with sticky first column. Toggle a cell, in-memory state updates. |
| 12 | Visit `/admin/reference-data` | Redirects to `/admin/lookups`. |
| 13 | Visit `/admin/reference-data/governorates` | Redirects to `/admin/lookups`. |
| 14 | Sidebar "البيانات المرجعية" | Routes to `/admin/lookups`. |
| 15 | Visit `/_dev/lookups` (DEV only) | Renders all 31 types + 4 mapping matrices without runtime errors. |
| 16 | Visit `/admin/committee/*`, `/admin/categories/*` | Still work — committees and categories features untouched. |
| 17 | Visit `/applicant/profile/personal` (Stage 3) | Governorate select still populated — raw `REF_GOVERNORATES` consumer survived. |
| 18 | Visit `/admin/admission-setup/marital-status` | Page renders. New `useLookupList({ typeCode: 'MARITAL_STATUSES' })` returns Pagination<LookupItem>; options show `أعزب` / `متزوج`. |

---

## 9. Commits

| SHA | Subject |
|---|---|
| `09e70b5` | feat(lookups): types and conflict codes |
| `f58e648` | feat(lookups): mock data for 31 lookup types and 4 mapping tables |
| `90f0979` | feat(lookups): service and React Query hooks |
| `cf12a58` | feat(lookups): LookupTree composition with @dnd-kit reorder |
| `5916ac6` | feat(lookups): LookupGrid composition |
| `119d655` | feat(lookups): Switch primitive and LookupFormDrawer |
| `eaeeeeb` | feat(lookups): Checkbox primitive, MappingMatrix and 4 mapping screens |
| `595951c` | feat(lookups): LookupsHubPage, routing, and sidebar wiring |
| `a033d81` | feat(lookups): /_dev/lookups review route |
| `d7c4a8b` | chore(lookups): rewire 5 consumers and delete legacy infra |
| _this commit_ | docs(lookups): migration report |

`docs/DB_CONSTRAINTS.md §10` was appended in `09e70b5` alongside the
types/conflict-codes commit.

---

## 10. Net diff

- **+2,900** lines (features/lookups + shared Switch/Checkbox + docs)
- **−1,946** lines (legacy ReferenceDataPage + LookupTab + the 4 admin api files + old mock seed)
- **Net: +954 lines** for a unified module that adds hierarchical trees,
  4 mapping matrices, 7 typed `ConflictError` codes, drag-reorder, and a
  31-row type registry — replacing two parallel UIs and 4 legacy
  query/service files.

---

## Gate 3 — checked

Open questions surfaced in §7 above. No HIGH-severity blockers; the
module is ready for review and demo.
