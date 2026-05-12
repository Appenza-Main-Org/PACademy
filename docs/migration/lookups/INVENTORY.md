# Lookup Management — Inventory (Wave A · Gate 1)

**Date:** 2026-05-11
**Scope:** Replace the existing parallel reference-data systems with a single canonical Lookup Management Module under `features/lookups/`. Decisions taken at plan-gate: full replacement of the admin-managed system; committees feature stays untouched; `@dnd-kit/sortable` for tree reorder.

---

## 1. Files slated for deletion

| File | Lines | Reason |
|---|---:|---|
| [frontend/src/features/admin/pages/ReferenceDataPage.tsx](../../../frontend/src/features/admin/pages/ReferenceDataPage.tsx) | 545 | Replaced by `LookupsHubPage` at `/admin/lookups`. |
| [frontend/src/features/admin/components/lookups/LookupTab.tsx](../../../frontend/src/features/admin/components/lookups/LookupTab.tsx) | 520 | Replaced by `LookupTree` + `LookupGrid` in `features/lookups/components/`. |
| [frontend/src/features/admin/api/lookups.queries.ts](../../../frontend/src/features/admin/api/lookups.queries.ts) | 75 | Replaced by `features/lookups/api/lookups.queries.ts` with the new `LookupTypeCode`-keyed API. |
| [frontend/src/features/admin/api/lookups.service.ts](../../../frontend/src/features/admin/api/lookups.service.ts) | 268 | Replaced by `features/lookups/api/lookups.service.ts`. |
| [frontend/src/features/admin/api/referenceData.queries.ts](../../../frontend/src/features/admin/api/referenceData.queries.ts) | 71 | Folded into the new queries; per-tab `ReferenceTab` shapes converted to `LookupItem`. |
| [frontend/src/features/admin/api/referenceData.service.ts](../../../frontend/src/features/admin/api/referenceData.service.ts) | 166 | Folded into the new service. |
| [frontend/src/shared/mock-data/lookups.ts](../../../frontend/src/shared/mock-data/lookups.ts) | 239 | Replaced by `features/lookups/mock/lookups.mock.ts`. Existing 15-key data migrated to new `LookupItem` shape. |

**Subtotal:** ~1,884 lines deleted.

**Partial edit (not deleted):** [frontend/src/shared/mock-data/referenceData.ts](../../../frontend/src/shared/mock-data/referenceData.ts) (139 lines). The `REFERENCE_DATA` dict, `REFERENCE_TAB_LABELS`, and the `MOCK.referenceData` aggregation key are removed; the raw `REF_GOVERNORATES`/`REF_SPECIALIZATIONS`/`REF_NATIONALITIES`/`REF_RELATIONSHIPS`/`REF_CASE_TYPES`/`REF_RANKS` exports stay so 5 non-admin consumers (see §3) keep working.

**Type cleanup in [frontend/src/shared/types/domain.ts](../../../frontend/src/shared/types/domain.ts):** lines 657–700 (`LookupKey`, `LookupRow`) and the `ReferenceTab` / `ReferenceRowMap` shapes around line 704 onward — the `LookupKey` union and `LookupRow` interface go; `ReferenceTab` + `ReferenceRowMap` go; the `Ref*` row shapes (RefGovernorate, RefSpecialization, RefNationality, RefRelationship, RefCaseType, RefRank) stay because non-admin consumers import them.

---

## 2. Files slated for edit

| File | Edit |
|---|---|
| [frontend/src/shared/lib/errors.ts](../../../frontend/src/shared/lib/errors.ts) | Extend `ConflictCode` union with 7 lookup codes (`CIRCULAR_HIERARCHY`, `PARENT_HAS_CHILDREN`, `SELF_PARENT`, `DUPLICATE_CODE`, `DUPLICATE_MAPPING`, `INVALID_DATE_RANGE`, `IN_USE`). |
| [frontend/src/shared/mock-data/index.ts](../../../frontend/src/shared/mock-data/index.ts) | Drop `import { LOOKUP_SEED } from './lookups'` (line 62) and `import { REFERENCE_DATA } from './referenceData'` (line 35). Drop `lookups:` (line 991) and `referenceData:` (line 956) entries on `MOCK`. Add `lookupTypes`, `lookupItems`, `lookupMappings`. Preserve the trailing `reseed(42)`. |
| [frontend/src/shared/types/domain.ts](../../../frontend/src/shared/types/domain.ts) | Remove `LookupKey`, `LookupRow`, `ReferenceTab`, `ReferenceRowMap`; keep `Ref*` interfaces and `SoftDeleteFields`. |
| [frontend/src/routes.tsx](../../../frontend/src/routes.tsx) | Add 3 `/admin/lookups*` routes; replace `/admin/reference-data*` (lines 229–230) with `<Navigate to="/admin/lookups" replace />`. Add `/_dev/lookups` inside the DEV-only conditional spread (line 419). Drop `ReferenceDataPage` import. |
| [frontend/src/config/routes.ts](../../../frontend/src/config/routes.ts) | Add `adminLookups`, `adminLookupsType(code)`, `adminLookupsMappings(kind)` constants. Annotate `referenceData` / `referenceDataRoot` as `@deprecated`. |
| [frontend/src/features/admin/AdminLayout.tsx](../../../frontend/src/features/admin/AdminLayout.tsx) | Sidebar entry `to: ROUTES.admin.referenceDataRoot` (line ~74) → `to: ROUTES.admin.adminLookups`. Label "البيانات المرجعية" stays. |
| [frontend/package.json](../../../frontend/package.json) | Add `@radix-ui/react-collapsible`, `@radix-ui/react-checkbox`, `@radix-ui/react-switch`. |
| [docs/DB_CONSTRAINTS.md](../../DB_CONSTRAINTS.md) | Append "Lookups — invariants" section with the 7 conflict codes paired to SQL Server expressions. |
| [frontend/src/shared/components/index.ts](../../../frontend/src/shared/components/index.ts) | Export new `Switch` + `Checkbox` primitives. |

### Files needing API rewire (4 consumers + 1 raw read)

These were imported via `useLookupList` / `MOCK.lookups.*` / `MOCK.referenceData.*` and must move to the new typed API as part of commits 2–8:

| File · line | Current call | New call |
|---|---|---|
| [frontend/src/features/committees/api/committee.service.ts:394](../../../frontend/src/features/committees/api/committee.service.ts#L394) | `MOCK.lookups.educationTypes.filter(...).sort(...)` | `MOCK.lookupItems.filter((i) => i.lookupTypeCode === 'EDUCATION_TYPES' && !i.deletedAt && i.isActive).sort(...)` |
| [frontend/src/features/admin/admission-setup/pages/MaritalStatusRulesPage.tsx:43](../../../frontend/src/features/admin/admission-setup/pages/MaritalStatusRulesPage.tsx#L43) | `useLookupList('maritalStatuses')` | `useLookupList({ typeCode: 'MARITAL_STATUSES' })` |
| [frontend/src/features/admin/components/categories/CategoryConditionBuilder.tsx:44–46](../../../frontend/src/features/admin/components/categories/CategoryConditionBuilder.tsx#L44) | `useLookupList('educationTypes')` × 3 (educationTypes, maritalStatuses, examTypes) | `useLookupList({ typeCode: 'EDUCATION_TYPES' })` × 3 |
| [frontend/src/features/admin/components/notifications/AudienceSelector.tsx:39–40](../../../frontend/src/features/admin/components/notifications/AudienceSelector.tsx#L39) | `useLookupList('notificationDepartments')` × 2 | `useLookupList({ typeCode: 'NOTIFICATION_DEPARTMENTS' })` × 2 |
| [frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx:463](../../../frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx#L463) | `MOCK.referenceData.specializations` | `MOCK.lookupItems.filter((i) => i.lookupTypeCode === 'SPECIALIZATIONS' && !i.deletedAt && i.isActive)` |

**Non-admin raw `REF_*` consumers — left untouched.** These import the static `REF_*` const arrays for picker option sources, not the admin-managed dictionaries. The raw exports stay alive in `referenceData.ts`:
- [frontend/src/features/board/pages/Sprint6Pages.tsx:40](../../../frontend/src/features/board/pages/Sprint6Pages.tsx#L40) — `REF_RANKS`
- [frontend/src/features/admin/components/applicants/ApplicantForm.tsx:36](../../../frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L36) — `REF_RELATIONSHIPS`
- [frontend/src/features/applicant-portal/pages/Stage3PersonalPage.tsx:19](../../../frontend/src/features/applicant-portal/pages/Stage3PersonalPage.tsx#L19) — `REF_GOVERNORATES`
- [frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx:15](../../../frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L15) — `REF_GOVERNORATES`
- [frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:15](../../../frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L15) — `REF_RELATIONSHIPS`

---

## 3. Lookup type codes — extended set (~31 codes, not 20)

The brief's 20 codes don't cover 11 of the 15 existing `LookupKey` values that live admin/feature consumers depend on. To preserve "Full replacement" without breaking those consumers, `LOOKUP_TYPE_CODES` is extended:

**Brief's 20 codes (kept verbatim):**
RELATIONSHIP_CATEGORY · TESTS · TEST_MODELS · SPECIALIZATIONS · UNIVERSITIES · FACULTIES · APPLICANT_CATEGORIES · COMMITTEES · ACADEMIC_GRADES · EDUCATIONAL_ENTITY_RANKING · COUNTRIES · GOVERNORATES · POLICE_DEPARTMENTS · JOBS · QUALIFICATIONS · ADMISSION_PERIODS · APPLICANT_NETWORK · SCHOOL_LANGUAGE · FOREIGN_APPLICANTS · EDUCATION_LEVELS

**Added (11) — preserve existing consumers:**
EDUCATION_TYPES · MARITAL_STATUSES · SPECIALTIES · SPECIALTY_TYPES · DEGREE_TYPES · EXAM_TYPES · EXAM_GROUPS · COMMITTEE_TYPES · REJECTION_REASONS · NOTIFICATION_DEPARTMENTS · APPLICANT_SECTIONS · NATIONAL_ID_MISSING_REASONS · NATIONALITIES · CASE_TYPES

**Hierarchical set updated:**
`RELATIONSHIP_CATEGORY`, `TESTS`, `TEST_MODELS`, `COUNTRIES`, `GOVERNORATES`, `POLICE_DEPARTMENTS`, `JOBS`, `APPLICANT_CATEGORIES`, **`FACULTIES`** (parent = UNIVERSITIES), **`SPECIALTIES`** (parent = FACULTIES), **`SPECIALTY_TYPES`** (parent = FACULTIES).

The 3 added hierarchical types preserve existing parent–child wiring in `MOCK.lookups`. The original brief listed FACULTIES as flat, but the existing seed has faculties.parentId → universities and 6 downstream consumers; flattening would silently lose that wiring.

---

## 4. Routes

| Current | New |
|---|---|
| `/admin/reference-data` ([routes.tsx:229](../../../frontend/src/routes.tsx#L229)) | `<Navigate to="/admin/lookups" replace />` |
| `/admin/reference-data/:tab` ([routes.tsx:230](../../../frontend/src/routes.tsx#L230)) | `<Navigate to="/admin/lookups" replace />` (tab → typeCode mapping handled inside LookupsHubPage via URL fallback) |
| — | `/admin/lookups` → `LookupsHubPage` (default landing) |
| — | `/admin/lookups/:typeCode` → `LookupsHubPage` |
| — | `/admin/lookups/mappings/:kind` → `MappingsPage` |
| — | `/_dev/lookups` (DEV-only) → `LookupsReviewPage` |

`ROUTES.admin.referenceData` and `referenceDataRoot` in [config/routes.ts](../../../frontend/src/config/routes.ts) stay one cycle as `@deprecated` shims that resolve to the new path (no caller — they're only referenced from `AdminLayout` sidebar which gets rewired).

---

## 5. Sidebar

[frontend/src/features/admin/AdminLayout.tsx:72–74](../../../frontend/src/features/admin/AdminLayout.tsx#L72) — single entry in the "البيانات المرجعية والإعدادات" section:

```
{ key: 'reference-data', label: 'البيانات المرجعية', icon: <Database size={18} />, to: ROUTES.admin.adminLookups }
```

---

## 6. Proposed file tree

```
frontend/src/features/lookups/
├── index.ts                              # barrel: types + hooks (not components/pages)
├── types.ts                              # LookupTypeCode, LookupItem, LookupTreeNode, etc.
├── api/
│   ├── lookups.service.ts                # typed service + INTEGRATION CONTRACT JSDoc
│   └── lookups.queries.ts                # React Query hooks + lookupKeys factory
├── mock/
│   └── lookups.mock.ts                   # LOOKUP_TYPES, LOOKUP_ITEMS, LOOKUP_MAPPINGS
├── components/
│   ├── LookupTree.tsx                    # Radix Accordion+Collapsible + @dnd-kit/sortable
│   ├── LookupGrid.tsx                    # wraps shared DataTable<LookupItem>
│   ├── LookupFormDrawer.tsx              # RHF + zod inside shared Drawer
│   ├── MappingMatrix.tsx                 # generic checkbox matrix
│   └── lookups-i18n.ts                   # type-name labels (الجامعات, الكليات, ...)
└── pages/
    ├── LookupsHubPage.tsx                # /admin/lookups[/:typeCode]
    └── MappingsPage.tsx                  # /admin/lookups/mappings/:kind

frontend/src/shared/components/
├── Switch.tsx                            # NEW (Radix Switch wrapper)
└── Checkbox.tsx                          # NEW (Radix Checkbox wrapper)

frontend/src/features/dev/
└── LookupsReviewPage.tsx                 # NEW (/_dev/lookups, matches PrimitivesReviewPage)
```

---

## 7. Untouched

- [frontend/src/features/committees/](../../../frontend/src/features/committees/) — entire feature stays. `COMMITTEES` is a lookup type only for picker contexts; rich domain (capacity / officers / score-thresholds / results) keeps reading from `committeeService`. 9 admission-setup consumers untouched.
- [frontend/src/features/admin/pages/CategoriesListPage.tsx](../../../frontend/src/features/admin/pages/CategoriesListPage.tsx), [CategoryNewPage.tsx](../../../frontend/src/features/admin/pages/CategoryNewPage.tsx), [CategoryEditPage.tsx](../../../frontend/src/features/admin/pages/CategoryEditPage.tsx) — rich domain feature, untouched.
- All raw `REF_*` const exports in `referenceData.ts` — kept alive for 5 non-admin picker consumers.

---

## 8. Acceptance for Wave A

- [x] All files-to-delete enumerated with line counts.
- [x] All files-to-edit enumerated with the specific change.
- [x] All consumers of `MOCK.lookups`, `MOCK.referenceData`, `useReferenceData*`, `useLookupList(key)`, `LOOKUP_LABELS`, `LookupKey`, `ReferenceTab` outside `features/admin/` listed.
- [x] Lookup type code list reconciled with existing consumers (extended from 20 → 31).
- [x] Untouched zones confirmed.
- [x] Proposed file tree.

**Auto mode: proceeding to Wave B without a gate stop.**
