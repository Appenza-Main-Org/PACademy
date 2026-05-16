# application_settings — جامعي / ثانوي expansion

> Wizard step: `/admin/cycles/admission-setup/wizard/application_settings`

Generalised the «الضباط المتخصصون» (faculty → specialization → rules)
pattern to every `type === 'university'` applicant-category, and added
a sibling Thanaweya combinations editor for every
`type === 'pre_university'` category. All applicant-categories sourced
from `admin/lookups/applicant-categories`; no hardcoded category lists
remain on this page.

## Files touched

### Wizard step (primary scope)

- [frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx) — rewritten to source categories from the lookup, render `<GeneralRulesSection />` for جامعي and `<ThanawiRulesSection />` for ثانوي. Active-toggle wiring preserved; the legacy `<SpecializationList />` / `<YearTable />` branches no longer reachable from this page (their files remain on disk but unreferenced from `CategoryAccordion`).
- [frontend/src/features/admin/admission-setup/components/applicationSettings/GeneralRulesSection.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/GeneralRulesSection.tsx) — rewritten. Now accepts `categoryCode`, `facultyCodes`, `specializationCodes` and applies the brief's accordion rule:
  - 1 faculty + 1 specialization → flat (no accordion).
  - 1 faculty + N specializations → accordion over specializations only.
  - N faculties → accordion per faculty (each pane recurses into the rule above).
  Per-spec form uses single-select `SearchSelect` for the new fields and a numeric `<Input>` pair for the new score range.
- [frontend/src/features/admin/admission-setup/components/applicationSettings/ThanawiRulesSection.tsx](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/ThanawiRulesSection.tsx) — new. Header (dates + الحالة الاجتماعية) + combinations grid (الدور / اللجنة / سنة التخرج / فئة المدرسة) + اعتماد footer.
- [frontend/src/features/admin/admission-setup/store/wizardSharedState.ts](../../../frontend/src/features/admin/admission-setup/store/wizardSharedState.ts) — rewritten. Discriminated-union `LocalGeneralRuleRow = LocalUniversityRow | LocalThanawiRow`; per-category `headers` map; composite-key duplicate detection across both `local` and `approved` buckets per category. Backward-compatible with `ApprovedRulesView` — every row still carries `committees[]`, `academicDegrees[]`, `graduationYears[]`, `maritalStatus[]`, faculty/spec name fields (empty strings for thanawi rows).
- [frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) — `CategoryConfigJoined` enriched with `categoryType`, `categoryFacultyCodes`, `categorySpecializationCodes` (mirrored from the underlying `applicant-categories` lookup row).

### Lookups (support for new `exam-rounds` lookup)

- [frontend/src/features/lookups/types.ts](../../../frontend/src/features/lookups/types.ts) — added `'exam-rounds'` to `LOOKUP_KEYS`, the `process` `LOOKUP_SECTIONS` group, `LOOKUP_META`, and `LookupRowMap`. New `ExamRoundRow` interface.
- [frontend/src/features/lookups/mock/lookups.mock.ts](../../../frontend/src/features/lookups/mock/lookups.mock.ts) — seeded 2 rows (الدور الأول / الدور الثاني). Added to `LOOKUPS_SEED`.
- [frontend/src/features/lookups/index.ts](../../../frontend/src/features/lookups/index.ts) — re-export `ExamRoundRow`.

The new key surfaces in `/admin/lookups` under the «العملية والمحتوى» section. `LookupTabPanel.extrasFor` and `LookupRowDrawer` fall through to their `default` cases, so CRUD UI works out of the box without per-key customisation (just name + isActive + actions).

## Lookups consumed by the wizard step

| Lookup | Where | Notes |
|---|---|---|
| `applicant-categories` | `CategoryAccordion` | Single source of truth for the list. Active-row filter applied. `type` drives جامعي/ثانوي branch. `facultyCodes` + `specializationCodes` scope the faculty/spec accordion. |
| `faculties` | `GeneralRulesSection` | Filtered by `category.facultyCodes` (if non-empty). |
| `specializations` | `GeneralRulesSection` | Filtered by `category.specializationCodes` (if non-empty). |
| `academic-grades` | `GeneralRulesSection` | الحد الأدنى / الحد الأقصى للتقدير (SearchSelect, single). |
| `academic-degrees` | `GeneralRulesSection` | الدرجة العلمية (SearchSelect, single). |
| `committees` | `GeneralRulesSection`, `ThanawiRulesSection` | Filtered by `applicantCategoryId === categoryCode`. Single-select. Replaces the prior `useCommittees()` import. |
| `marital-statuses` | both sections (in header) | الحالة الاجتماعية moved from the per-rule form to the section header. |
| `exam-rounds` | `ThanawiRulesSection` | New lookup — الدور الأول / الدور الثاني. |
| `school-categories` | `ThanawiRulesSection` | فئة المدرسة. |

## Validation rules added

- **Grade ordering** (`gradeMax ≥ grade`) — uses the index in the
  `academic-grades` lookup as the ordinal. SearchSelect goes
  `invalid` and an inline message renders; «إضافة» disabled.
- **Score non-negative** — `scoreMin ≥ 0`, `scoreMax ≥ 0`.
- **Score ordering** — `scoreMax ≥ scoreMin`.
- **Required fields** for جامعي: النوع, grade, gradeMax, scoreMin,
  scoreMax, academicDegree, committee, graduationYear.
- **Required fields** for ثانوي: examRound, committee, graduationYear,
  schoolCategory.
- **Duplicate-row block** — composite-key match against both `local`
  and `approved` rows under the same `categoryCode`. Form surfaces a
  danger toast instead of silently dropping the click. Composite
  keys:
  - **University**: `categoryCode + facultyCode + specializationCode + type + grade + gradeMax + scoreMin + scoreMax + academicDegrees + committees + graduationYears`.
  - **Thanawi**: `categoryCode + examRound + committee + graduationYear + schoolCategory`.

## Cross-step impact

- `committees` step → `ApprovedRulesView` (read-only viewer) — unchanged. Continues to render rows from `store.approved` using its array-valued fields. Thanawi rows have empty `facultyCode` / `specializationCode` / `type[]` / `grade` and render «—» for those cells, which is the viewer's existing missing-value affordance.

## Candidates for future shared-component promotion

Surfaced only — not extracted in this task, per the brief.

1. **`<FieldLabel>`** — duplicated verbatim between `GeneralRulesSection`, `ThanawiRulesSection`, and the legacy `GeneralRulesSection` shape. Three identical instances. If a fourth appears, lift into `src/shared/components/Field.tsx` (which already exists) or alongside `Input`.
2. **`<Th>` / `<Td>` table cell wrappers** — duplicated across `GeneralRulesSection`, `ThanawiRulesSection`, and `committeeBinding/ApprovedRulesView.tsx`. Three identical instances. Could become a thin `DataGrid` primitive or token-driven Tailwind class — but the existing `DataTable` covers heavier use cases, so this is low-priority.
3. **`isoToDate` / `dateToIso` ISO ↔ Date helpers** — duplicated in both sections. Already lives elsewhere in the codebase for other date pickers; if a fourth call site appears, promote into `@/shared/lib/format.ts`.
4. **Graduation-year option set** (last 5 years inclusive) — duplicated literally between both sections. Could become an exported constant if a third call site appears.

## Out-of-scope intentionally untouched

- `frontend/src/features/admin/admission-setup/components/applicationSettings/SpecializationList.tsx`, `SpecializationRow.tsx`, `AttachSpecializationCombobox.tsx`, `YearTable.tsx` — no longer rendered from `CategoryAccordion` but kept on disk. Deleting them is a cleanup task outside this brief's scope.
- The `applicant-categories` lookup already carries the `type` field (`'university' | 'pre_university'`); no schema change was required there. The brief's «جامعي / ثانوي» wording maps to those existing values and is rendered as such in the accordion header.
- No new shared components were promoted, no new third-party libraries were added, no `useEffect` for data fetching, no `any` types, no default exports, no hardcoded hex/px/duration outside the design-token system, no `pl-*` / `pr-*` Tailwind utilities (logical `ps-*` / `pe-*` only).

## Verification

- `npm run typecheck` → 0 errors.
- `npm run build` → succeeds.
- Dev server smoke-test → `GET /admin/admission-setup/wizard/application_settings` returns 200.
