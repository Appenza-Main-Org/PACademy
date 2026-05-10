# Rank Picker Pilot — Inventory

> Phase 1 deliverable. Lists every consumer site of the military-rank
> picker. Includes pre-flight answers per pilot 2 REPORT §5.

**Date:** 2026-05-07
**Total picker sites:** **1** (well under the 8-site stop-and-ask threshold)
**Pilot scope:** military rank values (`REF_RANKS.nameAr`), all consumers in app code.

---

## 0. Pre-flight answers

### Q1: One source or two?

**One.** Only `REF_RANKS` in
[`src/shared/mock-data/referenceData.ts:67`](frontend/src/shared/mock-data/referenceData.ts#L67).
No `RANKS` constant exists in `dictionaries.ts` (grep confirmed). No
divergence to flag.

### Q2: Raw strings or coded objects?

The dictionary itself is **coded**:

```ts
export const REF_RANKS: readonly RefRank[] = [
  { id: 'RNK-01', nameAr: 'مساعد',    level: 1, applicableTo: 'enlisted' },
  { id: 'RNK-02', nameAr: 'ملازم',     level: 2, applicableTo: 'officer'  },
  { id: 'RNK-03', nameAr: 'ملازم أول', level: 3, applicableTo: 'officer'  },
  { id: 'RNK-04', nameAr: 'نقيب',     level: 4, applicableTo: 'officer'  },
  { id: 'RNK-05', nameAr: 'رائد',     level: 5, applicableTo: 'officer'  },
  { id: 'RNK-06', nameAr: 'مقدم',      level: 6, applicableTo: 'officer'  },
  { id: 'RNK-07', nameAr: 'عقيد',     level: 7, applicableTo: 'officer'  },
  { id: 'RNK-08', nameAr: 'عميد',     level: 8, applicableTo: 'officer'  },
  { id: 'RNK-09', nameAr: 'لواء',     level: 9, applicableTo: 'officer'  },
  { id: 'RNK-10', nameAr: 'مدني',     level: 0, applicableTo: 'civilian' },
];
```

But **consumer-side, ranks are stored as raw `nameAr` strings**, not as
`RNK-XX` codes. Confirmed via two sources:

- [`shared/mock-data/sprint3to9.ts:135-139`](frontend/src/shared/mock-data/sprint3to9.ts#L135) — board-member seed: `{ rank: 'لواء' }`, `{ rank: 'عقيد' }`, `{ rank: 'عميد' }`, `{ rank: 'رائد' }` — Arabic name, not the code.
- [`shared/types/domain.ts:1181`](frontend/src/shared/types/domain.ts#L1181) — `BoardMember.rank: string` (no code/ID type).

This **is** a drop-in pilot (same shape as governorate's `g.nameAr` →
string round-trip in pilots 1 / 2). **No stop-and-ask** triggered on
the value-shape question.

### Q3 (auto-flagged): No English alias

`RefRank` has only `nameAr` — no `nameEn` field. The
`keywords: r.nameEn` Latin-search trick from pilot 1 is unavailable
here. If the team wants Latin-search ("colonel" → عقيد) as a future
enhancement, add `nameEn` to `RefRank` as a separate task.

---

## 1. Migration target

| # | Path · line | Current implementation | Surrounding context | Form integration | Source |
|---|---|---|---|---|---|
| 1 | [Sprint6Pages.tsx:554](frontend/src/features/board/pages/Sprint6Pages.tsx#L554) | **`<Input>` (free text!)** with default `'عقيد'` from `useState` | Board → Members → "Add member" Drawer. Sibling fields: name (Input), role (Select). | `useState` (`rank`, `setRank`) | Today: hardcoded default. After pilot: should consume `REF_RANKS` |

### 1.1 This is the first non-strict-drop-in pilot

**Important divergence from pilots 1 / 2:** the existing site is a
free-text `<Input>`, not a dropdown. Migrating to `<SearchSelect>` is a
*user-facing input model change* — from "type any rank" to "pick from a
fixed list." The brief framed this pilot as "rank picker → SearchSelect"
which is what we're doing, but I want to call out the trade-off so the
review knows what's changing:

| Dimension | Before | After |
|---|---|---|
| **Stored value shape** | `string` | `string` *(unchanged)* |
| **Schema / validation** | none | none *(unchanged)* |
| **What user can enter** | any free text | only the 10 ranks in `REF_RANKS` |
| **Behaviour for an unrecognized incoming value** | displays the value verbatim | trigger shows the placeholder; value still in state, but invisible until the user re-selects |

For the demo + the seed data (which only uses canonical names), this is
strictly an upgrade — a typo can't slip through, the dropdown teaches
the user the canonical list, and the constraint matches the data the
backend will return.

**Edge case to track post-pilot:** if a real backend ever returns a
rank not in `REF_RANKS` (e.g., a courtesy title or a deprecated rank),
the SearchSelect trigger will silently display the placeholder while
the underlying state still holds the unknown value. Solutions if/when
that becomes a real problem (out of scope for this pilot):

1. Render the unknown value as an extra "—custom—" SearchSelect option
   that's only included when `value` ∉ options.
2. Add an "other" free-text fallback row inside the popover.
3. Backfill `REF_RANKS` from the backend on app startup so the local
   list matches reality.

Filed as a follow-up note in the pilot 3 report; not a blocker for the
demo.

### 1.2 Pre-flight integration notes

- **No RHF.** This site uses `useState`, like pilot 1 site #1
  (governorate filter) and pilot 2 site #1 (cert-type filter). No
  `Controller` needed.
- **No `'all'` sentinel.** Unlike the filter sites, this is a *form
  field*, not a filter — there's no "no rank" sentinel. The empty
  state when the user hasn't picked is just `''` (the existing
  `useState('عقيد')` default may want to flip to `''` so the
  placeholder shows initially; out of scope unless the form needs it).
- **Dictionary import needed.** Sprint6Pages.tsx doesn't currently
  import `REF_RANKS`. Add the import.
- **Soft-delete filter.** `REF_RANKS` extends `SoftDeleteFields`. Filter
  out `deletedAt != null` rows before rendering options — same pattern
  as the governorate filter's "active rows only" semantic. The existing
  seed has no soft-deleted ranks, but the filter is cheap and correct.

### 1.3 No `<select>`/`<Select>` rank picker exists today

This was confirmed by:

- `grep -rn "rank\|الرتبة" src --include="*.tsx" | grep -E "<select|<Select"` returned 0 hits for any rank-bearing select.
- The only "rank" references in `<Select>` form fields (e.g. role
  selectors, applicableTo selectors) are *about* ranks, not pickers
  *of* ranks.

So the pilot's scope is one site, currently `<Input>`-shaped.

---

## 2. Excluded — read-only display, leaderboard rank, dictionary CRUD

| File · line | Reason |
|---|---|
| [Sprint6Pages.tsx:515](frontend/src/features/board/pages/Sprint6Pages.tsx#L515) | DataTable column `render: (m) => m.rank` — read-only display |
| [ExamsPages.tsx:366,377,426,441,446](frontend/src/features/exams/pages/ExamsPages.tsx#L366) | `rank: number` — *leaderboard* rank (#1, #2 ranking position), unrelated semantically to military rank |
| [ReferenceDataPage.tsx:329-611](frontend/src/features/admin/pages/ReferenceDataPage.tsx#L329) | CRUD admin for the rank *dictionary itself* — edits a row of `REF_RANKS`, doesn't pick one. Same exclusion logic as governorates' ReferenceDataPage in pilot 1 |
| [Stage9PrintCardPage.tsx:164](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx#L164) | Print signature line caption — no input |
| [SystemDiagram.tsx:203](frontend/src/features/architecture/components/SystemDiagram.tsx#L203) | Architecture diagram label text |
| [audit/components/fieldLabels.ts](frontend/src/features/audit/components/fieldLabels.ts), [admin/components/applicants/AuditTimeline.tsx](frontend/src/features/admin/components/applicants/AuditTimeline.tsx) | Field-label dictionary / timeline display |
| [DepartmentBreakdownSection.tsx:106](frontend/src/features/admin/components/reports/DepartmentBreakdownSection.tsx#L106) | "ranked-bar list" — sorted display, not military rank |

---

## 3. Wrapper-instance count after pilot 3

For the Phase 3 promotion decision:

| Site | File | Current wrapper status | After pilot 3 |
|---|---|---|---|
| pilot 1 #2 | `ApplicantForm.tsx` | inline definition (label/required/error/**helper**/children) | unchanged |
| pilot 1 #3 | `Stage3PersonalPage.tsx` | inline definition (label/required/error/children) | unchanged |
| pilot 1 #4 | `Stage4EducationPage.tsx` | inline definition (label/required/error/children) | unchanged |
| pilot 3 #1 | `Sprint6Pages.tsx` *(new)* | none today (`<Input>` carries its own label) | **+1 new inline definition** |

**Net total inline `SearchSelectField` definitions after pilot 3: 4.**
This crosses the brief's promotion threshold (≥ 4).

### Shape question — does pilot 3's wrapper match the canonical superset?

Sprint6Pages.tsx's add-member form is non-required (no asterisk on the
existing `<Input label="الرتبة">`) and has no `helper` text. The minimal
shape needed for this site is `label, error, children` — even sparser
than the wizard wrappers.

**Recommendation:** declare the new wrapper using the canonical superset
shape from pilot 2 REPORT §3.3 (`label, required, error, helper,
children`), with `required` and `helper` left undefined at the call
site. Phase 3 will then audit all four definitions, confirm they
collapse to the same superset, and promote.

If the audit reveals any ApplicantForm-specific behaviour that the
shared `Field` can't safely cover, defer.

---

## 4. Pilot order

Single site — no ordering needed. After the migration:

1. Phase 3 audit + promotion (or defer with reason).
2. Phase 4 verify.
3. Phase 5 report.

---

## 5. Acceptance for Phase 1

- ✅ Pre-flight answered: one source (`REF_RANKS`), drop-in (consumers store `nameAr` string), no `keywords` opportunity.
- ✅ All consumer sites identified (1 picker; 7 read-only / unrelated excluded with reason).
- ✅ Site #1's input-vs-picker model change documented with the trade-off and the "value not in list" edge case noted as future-only.
- ✅ Wrapper-instance arithmetic shows promotion threshold (≥ 4) is now hit. Phase 3 will audit + promote.
- ✅ Total ≤ 8 — within scope ceiling.

**Stopping per brief.** Awaiting confirmation before Phase 2.
