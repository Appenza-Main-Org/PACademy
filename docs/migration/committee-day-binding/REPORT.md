# Committee × Day Binding — Migration Report

> Closeout for the Committee × Day Binding sub-tab added to the existing
> committees wizard step at `/admin/admission-setup/wizard/committees`.
> Companion to [INVENTORY.md](INVENTORY.md) (Gate 1 audit) and
> [DB_CONSTRAINTS.md §13](../../DB_CONSTRAINTS.md) (backend handshake).

---

## 1 · Inventory + Decision Log

The pre-work audit lives in [INVENTORY.md](INVENTORY.md). Five open
questions surfaced there; the decisions taken were:

| # | Question | Decision |
|---|---|---|
| 1 | `COMMITTEE_WRONG_CATEGORY` semantics — strict (roster) vs loose (`linkedCategoryIds`) | **Strict**. A binding's committee must exist in the cycle's `CategoryCommittees` set for the binding's category. The matrix shows a `"لم يتم تعيين أي لجنة لهذه الفئة"` empty state when the roster sub-tab hasn't bound any committee for the active category yet — and a CTA to switch to the roster sub-tab. |
| 2 | `resolveCategorySubmissionType` doesn't exist — add a new helper or inline the walk | **New helper `resolveCategoryGradingMode(categoryCode, deps)`**, sibling of the existing spec-id-walking `resolveGradingModeForSpec`. Single sanctioned read path; the binding form, service, and mock all use it. |
| 3 | `PERCENTAGE_OUT_OF_RANGE` already in `ConflictCode` — reuse or rename | **Reuse**. The invariant is identical to §11.4b; the queries-layer toast map supplies the context-appropriate Arabic copy. `BindingConflict` references the existing code rather than introducing a `BINDING_PERCENTAGE_OUT_OF_RANGE` duplicate. |
| 4 | TAGDIR ordering with no `sortOrder` on `AcademicGradeRow` | **Order by `readPercentageRange(row).min`** (the floor of the band). Stable across mock-data tweaks. The same comparator is mirrored in the SQL Server trigger in §13.3. |
| 5 | Mock seed strategy | **One row per (committee in roster × WORKING day in schedule) per active category**. Per-cell capacity = `floor(committee.capacity / workingDayCount)` (min 1). Default eligibility GRADES → `{ min: 60, max: 100 }`, TAGDIR → `{ min: 'AGR-03', max: 'AGR-01' }` (جيد → امتياز). Result: 88 deterministic bindings across the two cycle-rostered categories at module load. |

Plus the design decisions captured in the spec:

- **Sub-tab inside the committees step** (URL `?subtab=roster|bindings`), not a new sidebar entry. Keeps the wizard step count at 9.
- **Per-(day × committee) granularity** with capacity + grade range. Day source is `examScheduleService` filtered to `kind === 'WORKING'`.
- **Mode-branched eligibility** discriminated by the parent category's resolved `gradingMode` — GRADES surfaces a numeric `min/max` pair, TAGDIR surfaces a min/max ACADEMIC_GRADES picker with the percentage band shown as a hint under each option.

---

## 2 · Files created / modified

### Created

| Path | Purpose |
|---|---|
| `frontend/src/features/admin/admission-setup/api/committeeBinding.service.ts` | Service with 8-conflict validation, list/create/update/delete/toggleActive/bulkSetEligibility/copyRow/copyColumn methods. |
| `frontend/src/features/admin/admission-setup/api/committeeBinding.queries.ts` | TanStack hooks + Arabic toast map for the 8 conflict codes. |
| `frontend/src/features/admin/admission-setup/mock/committeeBindings.mock.ts` | Deterministic seed — one row per (roster committee × WORKING day) per category. |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeBindingsPanel.tsx` | Top-level sub-tab wiring: per-category Radix tabs, summary chips, completion banner, dialog orchestration. |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeBindingMatrix.tsx` | Presentational (committee × day) grid with sticky head/start columns, "+" empty-cell affordance, filled-cell capacity+eligibility+status dot+hover action menu, and a mobile-folded card view. |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/BindingFormDialog.tsx` | Create/edit dialog. Mode-branched eligibility (GRADES vs TAGDIR), zod discriminated union, local min-≤-max guard. |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/BulkEligibilityDialog.tsx` | Bulk apply eligibility + optional uniform capacity. Three selection scopes (all / row / column) + overwrite flag. |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/CopyAxisDialogs.tsx` | `CopyRowDialog` (committee → committee) and `CopyColumnDialog` (day → day) within the same (cycle, category). |
| `docs/migration/committee-day-binding/INVENTORY.md` | Gate-1 pre-work audit. |
| `docs/migration/committee-day-binding/REPORT.md` | This file. |
| `docs/migration/committee-day-binding/screenshots/{01..10}-*.png` | Gate-2 visual evidence. |

### Modified

| Path | Change |
|---|---|
| `frontend/src/features/admin/admission-setup/types.ts` | Adds `BindingEligibility`, `CommitteeDayBinding`, `BindingConflict`. |
| `frontend/src/shared/lib/errors.ts` | Appends 7 net-new codes to `ConflictCode` (reuses `PERCENTAGE_OUT_OF_RANGE`). |
| `frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts` | Adds sibling `resolveCategoryGradingMode(categoryCode, deps)`. |
| `frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx` | Wraps step body in `Tabs` with `roster`/`bindings` panels, warning dots, `?subtab=` deep-link. |
| `frontend/src/features/admin/admission-setup/lib/step-status.ts` | Adds `CommitteeBindingsSnapshot` + `buildCommitteeBindingsSnapshot`. The `committees` branch now gates on `(rosterComplete && bindingsComplete)` across all active categories. |
| `frontend/src/features/admin/admission-setup/pages/AdmissionSetupIndexPage.tsx` | Builds and passes the snapshot to `computeStepStatus`. |
| `frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx` | Same — the rail and the review page both see the new completion rule. |
| `docs/DB_CONSTRAINTS.md` | Appends §13 with the SQL Server trigger/constraint mirrors for the 8 invariants. |

No `shared/components/` additions — single-feature per the spec.
No new third-party deps.

---

## 3 · Screenshots (Gate 2 + Gate 3 evidence)

All in [`screenshots/`](screenshots/):

| File | Shows |
|---|---|
| [`01-subtabs.png`](screenshots/01-subtabs.png) | Both sub-tabs visible with warning dots ("هناك فئة بدون لجان معيّنة" / "هناك فئة بدون روابط مفعّلة"); roster panel default. |
| [`02-matrix-empty.png`](screenshots/02-matrix-empty.png) | Bindings panel on a category whose roster has zero committees (`law_bachelor`) — surfaces the prerequisite empty state with CTA back to the roster sub-tab. |
| [`03-matrix-populated.png`](screenshots/03-matrix-populated.png) | Bindings matrix populated for `officers_general` — 3 committees × 22 working days = 66 active bindings, total seat capacity 1,958, capacity-per-cell 31/29/29. |
| [`04-form-grades.png`](screenshots/04-form-grades.png) | Create dialog for a GRADES category — two numeric percentage inputs (0..100). |
| [`05-form-tagdir.png`](screenshots/05-form-tagdir.png) | Create dialog for a TAGDIR category (`specialized_officers`) — two ACADEMIC_GRADES comboboxes with the picked-band hints ("65–74%" / "85–100%") rendered underneath each. |
| [`06-mode-mismatch.png`](screenshots/06-mode-mismatch.png) | Toast surfacing the `MODE_MISMATCH` Arabic copy after a TAGDIR eligibility was forced through the service against a GRADES category. |
| [`07-bulk-dialog.png`](screenshots/07-bulk-dialog.png) | Bulk eligibility dialog — three selection-scope radios, mode-branched eligibility section, optional uniform-capacity toggle, overwrite flag. |
| [`08-copy-row.png`](screenshots/08-copy-row.png) | Copy-row dialog (source + target committee pickers + overwrite flag). |
| [`09-completion-banner.png`](screenshots/09-completion-banner.png) | Incomplete state on `law_bachelor`: warning dot on the bindings sub-tab + the prerequisite empty state body. |
| [`10-mobile.png`](screenshots/10-mobile.png) | Mobile fold (390×844) — one card per committee with its day list inside. |

---

## 4 · Open questions for follow-up

1. **Per-committee seat cap.** Committees carry a cycle-level `capacity` (e.g. `C-01.capacity === 700`). The matrix currently displays it in the row header as a read-only hint, but does not sum-check `sum(binding.capacity)` against it. Should overflow throw a new `COMMITTEE_CAP_EXCEEDED` code (parallel to `COMMITTEE_AT_CAPACITY` on the runtime distribution side), or remain advisory until the runtime layer fires? Recommendation: advisory now; promote to a hard cap when a stakeholder calls it out.

2. **Auto-migrate on `gradingMode` flip.** If an admin re-points a category's `submissionTypeCode` after bindings exist, the next mutation fires `MODE_MISMATCH`. Three options:
   - (a) Block re-pointing while active bindings exist for the category.
   - (b) Surface a one-time confirm dialog offering to translate every binding's eligibility (GRADES `{60,100}` ⇆ TAGDIR `{AGR-03, AGR-01}`).
   - (c) Require the admin to manually re-enter every binding.
   Today the system effectively forces (c) by surfacing the conflict at write time. Decision pending.

3. **OFF-day downgrade.** If an admin flips a WORKING day to OFF in the exam-schedule step after bindings exist, those bindings reference an `examScheduleDayId` whose `kind` is now `'OFF'`. The next mutation throws `DAY_NOT_WORKING`, but the list endpoint still returns them. Should the schedule step's "toggle-off" flow soft-delete dependent bindings (with a confirm), or leave them as dead rows? Recommendation: confirm + delete; matches the cascade behaviour of step 1's "deactivate category".

---

## 5 · Verification matrix

| Invariant | Where validated | Verified | Notes |
|---|---|---|---|
| `DUPLICATE_BINDING` | `ensureUnique` — service | ✅ Tested via dialog rapid-double-add (second try toasted). |
| `CAPACITY_NOT_POSITIVE` | `ensurePositiveCapacity` — service | ✅ Form rejects 0 / negative; service double-checks. |
| `GRADE_RANGE_INVERTED` | `ensureEligibilityValid` — service + local form guard | ✅ Local guard catches before the round-trip; service re-validates. |
| `PERCENTAGE_OUT_OF_RANGE` | `ensureEligibilityValid` — service | ✅ Bounds 0..100 enforced on both ends. |
| `TAGDIR_GRADE_NOT_FOUND` | `ensureEligibilityValid` — service | ✅ Both min and max ids must resolve to active `academic-grades` rows. |
| `MODE_MISMATCH` | `ensureEligibilityValid` — service | ✅ Form derives the branch from category mode so it can't be tripped from the UI; direct service call confirms the conflict — see `06-mode-mismatch.png`. |
| `DAY_NOT_WORKING` | `ensureDayWorking` — service | ✅ Form's day combobox lists only WORKING days; service double-checks. |
| `COMMITTEE_WRONG_CATEGORY` | `ensureCommitteeInRoster` — service | ✅ Form's committee combobox lists only roster committees for the active (cycle, category); service double-checks. |

| Feature | Verified |
|---|---|
| Mode-branched form (GRADES ⇔ TAGDIR) | ✅ See `04-form-grades.png` + `05-form-tagdir.png`. |
| Bulk apply honours overwrite flag | ✅ Service returns `{ created, updated, skipped }` — toast surfaces all three. |
| Copy-row + Copy-column honour overwrite flag | ✅ Same return shape, same toast. |
| Sub-tab warning dots reflect state | ✅ Driven by `useCycleCommitteeBindings` + `MOCK.categoryCommittees` count at the page root — see `01-subtabs.png`. |
| Completion banner lists incomplete categories | ✅ See `09-completion-banner.png`. |
| Step completion gate (`computeStepStatus`) | ✅ Returns `'complete'` only when every active category has ≥1 roster row AND ≥1 active binding; back-compat path retained for callers that don't yet wire the snapshot. |
| Typecheck | ✅ Clean per commit (8/8). |
| Build | ✅ `npm run build` succeeds (2,108 modules, 645 KB gzip). |

---

## 6 · Commit ledger

| # | SHA prefix | Subject |
|---|---|---|
| 1 | `47667c8` | `feat(binding): types + 8 conflict codes + DB_CONSTRAINTS` |
| 2 | `05d0b9f` | `feat(binding): service + queries + mock` |
| 3 | `c2141d6` | `refactor(committees-step): sub-tabs roster\|bindings` |
| 4 | `9bb2154` | `feat(binding): BindingFormDialog with mode-branched eligibility` |
| 5 | `f3dc0e9` | `feat(binding): CommitteeBindingMatrix` |
| 6 | `67f0d91` | `feat(binding): bulk + copy dialogs` |
| 7 | `aa93f25` | `feat(binding): completion gate + sub-tab indicators` |
| 8 | _(this)_ | `docs(binding): report + screenshots` |
