# Application Settings — Step 0 Inventory

> Gate 1 — surface findings to the human before any code is written.
> Read this top-to-bottom; it contains **two structural blockers** that
> contradict load-bearing assumptions in the prompt.

---

## 1. Current wizard step

| | |
|---|---|
| Wizard step key | `application_settings` |
| URL | `/admin/admission-setup/wizard/application-settings` |
| Config entry | [frontend/src/features/admin/admission-setup/config.ts:79-90](frontend/src/features/admin/admission-setup/config.ts#L79-L90) |
| Renderer map | [frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx:90](frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx#L90) — `application_settings: () => <ApplicationSettingsPage />` |
| Current page | [frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx](frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx) — **88 lines** |
| Composed surface | [frontend/src/features/admin/components/cycles/CategoriesPanel.tsx](frontend/src/features/admin/components/cycles/CategoriesPanel.tsx) — **368 lines** |
| Mutation hook | `useToggleCycleCategory` from `features/admin/api/cycles.queries` |
| Categories source | `useCategoriesAdmin()` → `categoriesAdminService.list()` → `MOCK.categories` (the legacy `APPLICANT_CATEGORIES` const, **not** the lookup module) |

**The current step is not a "flat hardcoded table".** It already iterates `MOCK.categories` (7 strongly-typed `ApplicantCategory` rows with `key`, `labelAr`, `description`, `conditions`, `requiredTests`). It renders one row per category with columns: الفئة · النوع (gender multi-toggle) · الحالة (open/closed checkbox) · السعة · بداية · نهاية · save button. Edits write through `useToggleCycleCategory` → `cycle.openCategories[key]`.

So the current state is **per-cycle, per-category, single-row config** — not three-tier, but also not stub. The prompt describes a flat hardcoded table; the actual code is `cycle.openCategories`-driven via `CategoriesPanel`.

---

## 2. Hardcoded category names under admission-setup

```bash
$ grep -rn "قسم الضباط\|قسم المعاونين\|الكلية" frontend/src/features/admin/admission-setup/
# (zero hits — no hardcoded category strings under admission-setup)
```

Hardcoded category labels do live in [frontend/src/shared/mock-data/categories.ts:42](frontend/src/shared/mock-data/categories.ts#L42) (`APPLICANT_CATEGORIES` const), but those are mock seed rows for a typed domain entity, not hardcoded UI strings inside the wizard step.

---

## 3. Wizard state shape

The wizard uses **no centralized form store**. Each step page reads/writes its own server state through TanStack Query hooks. The only persisted client state is a "last step pointer" per cycle in localStorage ([frontend/src/features/admin/admission-setup/lib/wizard-draft.ts](frontend/src/features/admin/admission-setup/lib/wizard-draft.ts)) — `{ cycleId, lastStepKey, savedAt }`. That's it.

Cycle context comes from `useAdmissionSetupCycle()` (sessionStorage-backed, key `pa-admission-setup-cycle`). The application-settings step reads `cycle.openCategories[catKey]` and mutates it via `useToggleCycleCategory`. No draft store exists for in-flight edits — the existing `CategoriesPanel` uses per-row `useState` and a per-row "حفظ" button.

---

## 4. "Next step" gating

The wizard's "التالي" button is **never gated** by step content ([AdmissionSetupWizardPage.tsx:197-204](frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx#L197-L204)). It just advances the URL. Per-step status is computed *separately* by `computeStepStatus(key, inputs)` for the stepper-rail pill, but Next is not blocked. The prompt's "Wizard 'التالي' stays enabled — UnsavedChangesPrompt handles the dirty case" is consistent with current behavior.

---

## 5. **Gender source audit (mandatory)**

```bash
$ grep -rn "GenderType\|genderType" frontend/src/shared frontend/src/features/lookups frontend/src/features/admin
# domain.ts:794:  genderTypes?: ('male' | 'female')[];   ← inline literal on CycleCategoryConfig
# (no `GenderType` type alias is exported anywhere)
```

**Finding: there is no exported `GenderType` union type in the codebase.** The pattern `'male' | 'female'` (or `'male' | 'female' | 'any'`) is duplicated as an inline literal at **15+ sites**, including:

| Site | Shape |
|---|---|
| [frontend/src/shared/types/domain.ts:165](frontend/src/shared/types/domain.ts#L165) — `Applicant.gender` | `'male' \| 'female'` |
| [frontend/src/shared/types/domain.ts:794](frontend/src/shared/types/domain.ts#L794) — `CycleCategoryConfig.genderTypes` | `('male' \| 'female')[]` |
| [frontend/src/shared/types/domain.ts:809](frontend/src/shared/types/domain.ts#L809) — `AdmissionCycle.cohort` | `'male' \| 'female'` |
| [frontend/src/shared/types/domain.ts:409](frontend/src/shared/types/domain.ts#L409) — `Committee.gender` | `'male' \| 'female' \| 'any'` |
| [frontend/src/shared/types/domain.ts:603](frontend/src/shared/types/domain.ts#L603) — `CategoryConditions.gender` | `'male' \| 'female' \| 'any'` |
| [frontend/src/shared/lib/national-id.ts:18](frontend/src/shared/lib/national-id.ts#L18) — `parseNationalId` return | `'male' \| 'female'` |
| [frontend/src/features/lookups/types.ts:114](frontend/src/features/lookups/types.ts#L114) — `RelationshipGender` ✅ exported | `'male' \| 'female' \| 'any'` |
| [frontend/src/features/lookups/types.ts:163](frontend/src/features/lookups/types.ts#L163) — `ApplicantCategoryGenderScope` ✅ exported | `'male' \| 'female' \| 'any'` |
| [frontend/src/features/lookups/types.ts:207](frontend/src/features/lookups/types.ts#L207) — `AnnouncementGender` ✅ exported | `'male' \| 'female' \| 'any'` |
| [frontend/src/features/admin/components/cycles/CategoriesPanel.tsx:42](frontend/src/features/admin/components/cycles/CategoriesPanel.tsx#L42) | `type Gender = 'male' \| 'female'` (local) |

**Three exported gender-related unions exist** — all three are in the lookups feature and all three include `'any'`. None of them is a project-wide canonical `GenderType`. The closest match to what the prompt's `ApplicantSpecializationYear.genderType` needs (binary male/female, no "any") is the inline literal `'male' | 'female'` used in `Applicant.gender`, `AdmissionCycle.cohort`, and `CycleCategoryConfig.genderTypes` — but those are inline literals, **not an exported type**.

### Per Step 0 instruction — this is a stop.

The prompt says verbatim: *"If — and only if — there is provably no existing gender source after the grep, document that finding in Step 0 inventory and **stop**; do not invent one without explicit human approval."*

Three reasonable resolutions, ordered by my preference:

1. **(Preferred)** Use `type GenderType = Applicant['gender']` — derives `'male' | 'female'` from the canonical applicant record. No new constants, no new union, but a single one-line `import` of an existing inline shape. Strictly speaking this is "inventing a name" but it does not invent values or any new declaration.
2. Reuse `ApplicantCategoryGenderScope` from `features/lookups/types.ts` and restrict it (`Exclude<ApplicantCategoryGenderScope, 'any'>`). Already exported, lives in the lookups module the prompt wants me to source from. Carries the `'any'` value through the type system though.
3. Promote a new `export type GenderType = 'male' | 'female'` to `shared/types/domain.ts`. Cleanest long-term, but explicitly "inventing" — the prompt forbids this without approval.

**I will not pick without you.**

---

## 6. **Lookup module surface audit — structural blocker**

The prompt assumes a lookup module API surface that does not match the shipped one. The actual surface, file-by-file:

### What exists

| Concept | Actual location | Shape |
|---|---|---|
| Service entry | [frontend/src/features/lookups/api/lookups.service.ts:150](frontend/src/features/lookups/api/lookups.service.ts#L150) — `lookupsService` (plural) | `listLookup<K>(key)`, `createLookupRow`, `updateLookupRow`, `deleteLookupRow`, `getRow` |
| MOCK shape | [frontend/src/shared/mock-data/index.ts:993](frontend/src/shared/mock-data/index.ts#L993) — `MOCK.lookups: { [K in LookupKey]: LookupRow<K>[] }` | A single dict keyed by `LookupKey` |
| Query hooks | `features/lookups/api/lookups.queries.ts` | `useLookup(key)` etc. — need to read full file but exists |
| Lookup key constants | [frontend/src/features/lookups/types.ts:18-37](frontend/src/features/lookups/types.ts#L18-L37) — `LOOKUP_KEYS` | 18 kebab-case keys: `'applicant-categories'`, `'specializations'`, `'faculties'`, … |

### What the prompt assumed (and does **not** exist)

| Prompt symbol | Status |
|---|---|
| `lookupService.list(type)` (singular) | ❌ — actual is `lookupsService.listLookup(key)` (plural service, different method name) |
| `lookupService.listMappings(mappingKey)` | ❌ — **no such method exists** |
| `lookupService.listMappings('categorySpecializations')` | ❌ — **no such mapping exists anywhere** |
| `MOCK.lookupItems` | ❌ — actual is `MOCK.lookups[key]` |
| `MOCK.lookupTypes` | ❌ — does not exist |
| `MOCK.lookupMappings.categorySpecializations` | ❌ — does not exist |
| Lookup type code `APPLICANT_CATEGORIES` | ❌ — actual key is `'applicant-categories'` (kebab, lowercase) |
| Lookup type code `SPECIALIZATIONS` | ❌ — actual key is `'specializations'` |
| `parentId === null` on root category items | ❌ — `ApplicantCategoryRow` has no `parentId`. The 8 rows are flat. The only lookup with a `parentCode`/`parentId` is `relationships` (4-degree tree) and `jobs` (category→job tree). |
| `LookupItem` (generic shape) | ❌ — there is no generic `LookupItem`. Each lookup key has its own typed row shape via `LookupRowMap[K]`. |
| `lookupTypeCode` field | ❌ — keys are top-level, not a field on rows |

### Cross-lookup mappings that **do** exist

Only one mapping table exists in the lookup module:

- **`specialization-faculty-map`** (key `'specialization-faculty-map'`, code prefix `SFM-`) — junction between `specializations` (SPC-*) and `faculties` (FAC-*). [frontend/src/features/lookups/mock/lookups.mock.ts:172-190](frontend/src/features/lookups/mock/lookups.mock.ts#L172-L190).

There is **no** `category-specialization` mapping table. No SPC×CAT junction. The lookup module currently models specializations as faculty-bound (police academy faculty), not category-bound (applicant category).

### Two parallel "applicant categories" sources

Critically, the project has **two unrelated sources of applicant categories** today:

- `MOCK.categories` — the 7 typed `ApplicantCategory` rows in [frontend/src/shared/mock-data/categories.ts:42](frontend/src/shared/mock-data/categories.ts#L42), keyed `'officers_general'`, `'officers_specialized'`, … with rich `conditions` / `requiredTests` / `procedures`. This is what the **current wizard step**, applicant portal, eligibility flow, and admission rules all consume.
- `MOCK.lookups['applicant-categories']` — the 8 flat lookup rows in [frontend/src/features/lookups/mock/lookups.mock.ts:194-203](frontend/src/features/lookups/mock/lookups.mock.ts#L194-L203), coded `CAT-01`…`CAT-08`, with `genderScope` + `applicationMode`. Used today by the **Lookup Management module** and by `announcements.categoryCode`.

The two sets are **not reconciled**. They have different keys (string enum vs `CAT-NN` code), different labels, and different row counts (7 vs 8). The prompt's "Categories are read from the existing `APPLICANT_CATEGORIES` lookup type" maps onto the second source (the lookup-module rows), which would **fork the wizard step away from the rest of the admission/applicant flow** that still uses `MOCK.categories`.

---

## 7. **What is implementable today, what is not**

| Prompt requirement | Verdict |
|---|---|
| Three-tier dynamic editor (category → spec → years) | ✅ Implementable in shape |
| Categories sourced from existing `applicant-categories` lookup | ⚠️ Implementable, but **forks** the wizard step from the rest of the project (which uses `MOCK.categories`). Reconciliation is out of scope for this task by the prompt's own rules. |
| Specializations sourced from `lookupService.listMappings('categorySpecializations')` | ❌ **Blocker.** That mapping does not exist. The only cross-lookup mapping is `specialization-faculty-map` (SPC×FAC). |
| Strict filtering (zero mappings → EmptyState) | ❌ Would always show EmptyState — no mappings exist for any category. |
| Reuse existing gender source | ⚠️ Soft blocker — no exported canonical `GenderType` exists. See §5. |
| Mock data, services, queries, components | ✅ Implementable once §6 is resolved. |
| Validation module, conflict codes, DB constraints append | ✅ Implementable. |

---

## 8. Proposed file tree (assuming §5 + §6 are resolved)

```
frontend/src/features/admin/admission-setup/
├── types.ts                              [APPEND — 3 new interfaces + AppSettingsConflict]
├── lib/
│   └── appSettingsValidation.ts          [NEW]
├── store/
│   └── appSettingsDraft.ts               [NEW — Zustand draft store]
├── mock/
│   └── appSettings.mock.ts               [NEW]
├── api/
│   ├── applicationSettings.service.ts    [NEW]
│   └── applicationSettings.queries.ts    [NEW]
├── components/applicationSettings/        [NEW]
│   ├── ScopeBanner.tsx
│   ├── CategoryAccordion.tsx
│   ├── SpecializationList.tsx
│   ├── AttachSpecializationDialog.tsx
│   ├── SpecializationRow.tsx
│   ├── YearTable.tsx
│   ├── StickyBulkSaveBar.tsx
│   └── UnsavedChangesPrompt.tsx
└── pages/
    └── ApplicationSettingsPage.tsx        [REWRITE body]

frontend/src/shared/mock-data/
└── index.ts                              [APPEND — 3 new MOCK keys, lookup MOCK untouched]

docs/
├── DB_CONSTRAINTS.md                     [APPEND — Application Settings invariants section]
└── migration/application-settings/
    ├── INVENTORY.md                      [this file]
    ├── REPORT.md                         [Step 10]
    ├── before.png   after-*.png          [Step 10 screenshots]
```

Out-of-scope per prompt:
- `MOCK.lookupItems` / `MOCK.lookupTypes` / `MOCK.lookupMappings` — do not exist; even if they did, no edits per "Do not modify" rule.
- No new shared components.

---

## 9. **Open questions — please answer before I proceed**

### Q1. Gender source

Which resolution from §5? My preference: **(1) `type GenderType = Applicant['gender']`**, imported as type-only.

### Q2. Lookup module mismatch — pick a path

The prompt's "strict specialization sourcing from `categorySpecializations` mapping" is unbuildable as written. Four options:

- **A. Build the editor on `MOCK.categories` (the legacy 7-category source).** Specializations would come from the lookup module's `specializations` lookup directly (12 rows), with **no category filter** — every category can attach any specialization. Pragmatic, matches the rest of the admission flow, but drops the prompt's "strict mapping" rule.
- **B. Build on `MOCK.lookups['applicant-categories']` (8 lookup rows).** Forks this wizard step from every other category consumer in the project. Still no `categorySpecializations` mapping, so we'd add an **in-feature** mapping inside the new mock — does not touch lookup MOCK. The prompt forbids new lookups/mappings; an in-feature mapping is technically not a lookup mapping, but the spirit is borderline.
- **C. Extend the lookup module to add a `category-specialization-map` lookup** (key `'category-specialization-map'`, code prefix `CSM-`, junction `categoryCode × specializationCode`). Mirrors the existing `specialization-faculty-map`. This is a new lookup — the prompt's "single most important rule" forbids it.
- **D. Pause and reconcile `MOCK.categories` ↔ `MOCK.lookups['applicant-categories']` first.** Different ticket.

My preference is **A** for V1 (ship the editor on the source the rest of the app uses; drop the strict-mapping rule since there is no mapping to enforce). If you want strict mapping, **C** is the only honest path and means broadening this task to extend the lookup module — which the prompt explicitly forbids.

### Q3. Global vs cycle scope — sanity check

The prompt says the three new entities are global master data (not cycle-scoped). The current step is cycle-scoped (`cycle.openCategories[key]`). Going global means the existing `cycle.openCategories` setting becomes a **second**, independent toggle layer, or the global config **replaces** per-cycle category configuration entirely.

If global replaces per-cycle: applicant-side cycle-aware filtering breaks (eligibility, applicant portal, AdmissionRulesPage). That's a much larger blast radius than this task.

If global *adds* a layer: the wizard step now has two unrelated category controls (the new global editor here + the old per-cycle `CategoriesPanel` somewhere else?), and we need to decide where the old one goes. Confusing UX.

I'd like explicit confirmation that going global on this step is correct, and what happens to the existing `cycle.openCategories` data path.

### Q4. Banner copy + scope link

Prompt copy: "هذه الإعدادات بيانات مرجعية عامة. التعديلات تطبق على كل دورات القبول التي تستخدم هذه الفئات." Linked to `/admin/lookups/APPLICANT_CATEGORIES` — but the actual lookup route is `/admin/lookups/applicant-categories` (kebab-case). I will use the kebab-case URL — confirm.

### Q5. BEFORE.png

The prompt asks me to capture `BEFORE.png` of "current flat hardcoded table". The current step is **not** a flat hardcoded table — it's the cycle-scoped per-category panel described in §1. I'll capture what's actually there and label it accurately.

---

## 10. Stopping at Gate 1

Per the prompt: *"Stop here. Wait for explicit 'go'."* Awaiting answers on Q1–Q5 above before any code is written.
