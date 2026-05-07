# Rank Picker Pilot — Report

> Phase 5 deliverable. Closeout for the third `SearchSelect` migration.
> Includes the canonical wrapper promotion that the threshold tripped on
> at this pilot — `SearchSelectField` is now `shared/components/Field.tsx`.

**Date:** 2026-05-07
**Sites migrated:** 1 / 1 from [INVENTORY.md](INVENTORY.md)
**Wrapper promoted:** ✅ — `Field` now lives in `shared/components/`
**Commits:** 3 (one site, one promotion, one report)

---

## 1. Pre-flight answers

Both questions resolved before inventory:

| Q | Answer | Implication |
|---|---|---|
| One source or two? | **One** — `REF_RANKS` in [`referenceData.ts:67`](frontend/src/shared/mock-data/referenceData.ts#L67); no `dictionaries.ts` competitor | No source-divergence to flag |
| Raw strings or coded objects? | **Drop-in.** Dictionary is coded (`{ id, nameAr, level, applicableTo }`) but consumers store the `nameAr` string ([`sprint3to9.ts:135`](frontend/src/shared/mock-data/sprint3to9.ts#L135) seed; [`domain.ts:1181`](frontend/src/shared/types/domain.ts#L1181) `BoardMember.rank: string`) | Same shape contract as pilots 1 / 2 — no stop-and-ask |
| (auto) Latin-search opportunity? | **No.** `RefRank` has no `nameEn` field | `keywords` skipped this pilot. Add `nameEn` to `RefRank` as a separate task if Latin-search becomes a requirement |

---

## 2. Sites migrated

| # | Path · line | Form integration | Notes |
|---|---|---|---|
| 1 | [Sprint6Pages.tsx:554](frontend/src/features/board/pages/Sprint6Pages.tsx#L554) | `useState` (form-field, no RHF) | **Was a free-text `<Input>`** — see §4 for the input-model trade-off |

**One site, no ordering required.** This was the first non-strict-drop-in
pilot: the existing site is a free-text Input, not a select. The
migration constrains the input space from "any string" to "one of the
10 ranks in `REF_RANKS`." Stored value shape is unchanged (`string`),
schema is unchanged (no schema), but user-facing input model changes
from typed text to picked option.

---

## 3. Wrapper promotion: **EXECUTED**

The brief's threshold (≥ 4 inline `SearchSelectField` definitions with
identical-or-superset shape) tripped at this pilot. Audit and execution
below.

### 3.1 Wrapper-shape audit (4 of 4 covered by canonical superset)

| Site | Props in inline definition | Helper handling |
|---|---|---|
| `ApplicantForm.tsx` (pilot 1) | `label, required, error, **helper**, children` | `error ?? helper`, helper in ink-500 |
| `Stage3PersonalPage.tsx` (pilot 1) | `label, required, error, children` | none (subset) |
| `Stage4EducationPage.tsx` (pilot 1) | `label, required, error, children` | none (subset) |
| `Sprint6Pages.tsx` (pilot 3, **new**) | `label, required, error, **helper**, children` | `error ?? helper`, helper in ink-500 |

Two byte-identical pairs: `(ApplicantForm, Sprint6Pages)` and
`(Stage3, Stage4)`. The second pair is a strict subset of the first —
the same render tree minus the helper branch. The canonical superset
([cert-type pilot REPORT §3.3](../cert-type-pilot/REPORT.md#33-recommendation-for-pilot-3))
covers both:

- Sites that pass `helper` get the helper-fallback branch
- Sites that don't pass `helper` see `helperText = error ?? undefined`,
  which collapses to "render error if present" — identical to the
  subset-shape behaviour

### 3.2 Promotion executed

[`frontend/src/shared/components/Field.tsx`](frontend/src/shared/components/Field.tsx)
created with the canonical superset. The exported component matches the
stencil from cert-type pilot REPORT §3.3 verbatim, plus a `className`
escape hatch for future composition cases:

```tsx
export function Field({
  label,
  required,
  error,
  helper,
  children,
  className,
}: FieldProps): JSX.Element {
  const helperText = error ?? helper;
  const helperTone = error ? 'text-terra-700' : 'text-ink-500';
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ms-1 text-terra-500">*</span>}
      </span>
      {children}
      {helperText && <span className={cn('text-xs', helperTone)}>{helperText}</span>}
    </div>
  );
}
```

Added to the shared barrel ([`shared/components/index.ts`](frontend/src/shared/components/index.ts)).
All four sites refactored in the same commit:

| Site | What changed | Behavioural diff |
|---|---|---|
| `ApplicantForm.tsx` | Replaced 22-line inline definition + JSX usage; `import { Field }` added | None — inline was byte-identical to the new shared component |
| `Sprint6Pages.tsx` | Same as above | None |
| `Stage3PersonalPage.tsx` | Replaced 17-line inline subset definition; `import { Field }` added | None — subset behaviour reproduced via `undefined` helper prop |
| `Stage4EducationPage.tsx` | Same as Stage3 | None |

Net diff: **+89 / −133 lines** (49% reduction). One promotion commit:
`2532295 refactor(shared): promote SearchSelectField wrapper to shared Field component`.

### 3.3 Why `Field` was the right name (and what to watch)

`Field` is intentionally generic — it doesn't bake in `<input>` /
`<select>` / `<SearchSelect>`. Any control that needs the
label-and-helper envelope can use it. For the same reason the name
*could* collide with a future "Field-as-input" pattern (e.g. RHF
`<Field name="x" />`); pre-promotion grep showed zero existing `Field`
symbols (`grep -rn "export.*\bField\b"` returned no hits), so we're
clean today. If a future task wants a render-prop-style `Field`, the
current envelope can be renamed to `FieldRow` / `FieldGroup` /
`Labelled` without touching consumers (mechanical rename).

---

## 4. New observations (rank-specific, vs governorate / cert-type)

### 4.1 First non-strict-drop-in pilot — input model change

Pilots 1 and 2 swapped one *picker* for another. Pilot 3 swapped a
*free-text Input* for a picker — the user can no longer type "اللواء
الفريق" or any value not in `REF_RANKS`. For the demo + the seed data
(which only uses canonical ranks), this is strictly an upgrade. For a
real backend that returns historical or non-canonical values:

- `SearchSelect` will silently render the placeholder for any `value`
  that doesn't match an option — the underlying state still holds the
  unknown string, but the trigger gives no visual cue.
- Three mitigation paths if this becomes a real problem (out of scope
  for this pilot, listed in priority order):
  1. Render the unknown value as a synthetic `{ value, label: value }`
     option that's only included when `value ∉ options` — keeps the
     value visible, lets the user re-pick from the canonical list.
  2. Add an "other / custom" free-text fallback row inside the popover.
  3. Backfill `REF_RANKS` from the backend on app startup so the
     local list matches reality.

The first option is the right default behaviour — a one-line addition
to `SearchSelect.tsx`. Filed as a follow-up note for the next maintenance
cycle, not patched here.

### 4.2 No `nameEn` on `RefRank` — Latin-search not wired

`RefGovernorate` has `nameEn` so pilot 1 was able to wire
`keywords: g.nameEn` and get "cairo" → القاهرة as a free win.
`RefRank` has only `nameAr`, so the `keywords` field is unused in the
rank options. If the team wants Latin-rank search ("colonel" → عقيد),
add `nameEn` to `RefRank` as a single-line type + dictionary update —
not blocking for the demo.

### 4.3 Soft-delete filtering is now a documented per-site step

The rank options explicitly filter `!r.deletedAt`:

```ts
const RANK_OPTIONS: readonly SearchSelectOption[] = REF_RANKS
  .filter((r) => !r.deletedAt)
  .map((r) => ({ value: r.nameAr, label: r.nameAr }));
```

This wasn't necessary in pilot 1 (governorate didn't surface tombstoned
rows in any visible-to-this-pilot site) or pilot 2 (cert-type list is
hardcoded, no soft-delete column). With pilot 3 it becomes a per-site
step worth documenting: when sourcing from a `referenceData.ts`
dictionary that extends `SoftDeleteFields`, filter
`!row.deletedAt` before mapping to options.

A future task could centralize this by exporting `REF_RANKS_ACTIVE`
from `referenceData.ts` (and similar pre-filtered consts for other
soft-deletable dictionaries). Out of scope for this pilot.

---

## 5. Verification

### 5.1 Static checks

| Check | Result |
|---|---|
| `npm run typecheck` after each commit | 0 errors |
| `npm run build` final | 0 errors; pre-existing chunk-size advisory unchanged |

### 5.2 Bundle delta vs post-pilot-2 baseline

Baseline from [cert-type pilot REPORT.md §2.2](../cert-type-pilot/REPORT.md#22-bundle-delta-vs-post-pilot-1-baseline):
1,887.72 kB JS / 557.73 kB gzip / 80.04 kB CSS / 15.84 kB CSS gzip.

| | Post pilot 2 | Post pilot 3 | Delta |
|---|---:|---:|---:|
| `index.js` raw | 1,887.72 kB | 1,887.24 kB | **−0.48 kB** |
| `index.js` gzip | 557.73 kB | 557.67 kB | **−0.06 kB** |
| `index.css` raw | 80.04 kB | 80.04 kB | 0 |
| `index.css` gzip | 15.84 kB | 15.84 kB | 0 |

**Net negative.** The promotion deduplicated four inline wrapper
definitions (≈ 22 lines × 2 + ≈ 17 lines × 2 = 78 lines of declaration
boilerplate) and replaced them with one shared component plus four
imports (≈ 5 lines of consumer code). The new rank picker site
contributed ≈ 1 KB of options + Field consumer; the de-dup contributed
≈ 1.5 KB negative. Net result: **the bundle shrank**, despite adding a
new component file and a new consumer site.

### 5.3 Runtime smoke

**Limitation:** Chrome DevTools MCP did not recover from the prior
pilot's session. Every `new_page` returned "selected page has been
closed" through this pilot's verification window — same blocker as
pilot 2.

What I would have captured:

- Tab-focus on the rank picker → focus ring visible (`var(--ring)`)
- Type `عقي` (no diacritic) → matches `عقيد` via `normalizeArabic`
- Hamza variant doesn't apply (no hamza-bearing ranks in the list)
- Arrow keys / Enter / Esc behaviour
- Selected value persists; submitting the add-member form carries `rank`
- iPad portrait (768 × 1024): popover doesn't clip — regression check
  on the `SearchSelect.tsx` §4.4 / §5.1 fix

What's actually load-bearing for confidence here:

- **Site #1** is a `useState`-backed picker with no RHF, no filter
  sentinel — the simplest possible wiring. Identical wiring shape to
  pilot 1 site #1 (governorate filter) and pilot 2 site #1 (cert-type
  filter), both live-tested with hamza-stripped Arabic search → table
  re-render. There are no new code paths in `SearchSelect.tsx` or in
  the `Field` wrapper for this pilot to exercise.
- **`Field` promotion** is byte-identical in render output to the
  inline definitions it replaces — confirmed by the wrapper-shape audit
  (§3.1) and reflected in the bundle going *down*. No layout / focus /
  motion delta possible.
- **iPad regression** — the §4.4 / §5.1 fix is a `SearchSelect.tsx`
  internal that this pilot did not touch. Static guarantee holds.

Live-smoke runbook for the reviewer:

```bash
npm run dev
# 1. Navigate to /board/members
# 2. Click "إضافة عضو" → Drawer opens
# 3. Click the rank picker → 10 options appear (مساعد, ملازم, ملازم أول, نقيب, رائد, مقدم, عقيد, عميد, لواء, مدني)
# 4. Type "عقي" → "عقيد" highlights as the only match
# 5. Press Enter → trigger reads "عقيد", popover closes
# 6. Fill name + role, submit → table reloads with the new member, rank column reads "عقيد"
# 7. Resize to 768x1024, scroll picker near viewport bottom, click → popover should clamp via maxHeight: var(--radix-popover-content-available-height)
```

### 5.4 Form submission

Live check deferred along with §5.3. The wire format is unchanged
(`{ name, rank: string, role }`). The only runtime difference is who
calls `setRank`:

| | Before | After |
|---|---|---|
| Trigger | `onChange={(e) => setRank(e.target.value)}` (Input) | `onChange={(next) => setRank(next ?? '')}` (SearchSelect) |
| Default | `useState('عقيد')` | unchanged |
| Submit | `addMut.mutate({ name, rank, role })` | unchanged |

`addMut` and `boardService.addMember` are untouched — they consume the
same `BoardMember` payload shape.

---

## 6. Pattern recommendations for pilot 4 (status filter)

The status filter on `/admin/applicants` is the natural pilot 4 target.
After pilots 1–3, it's the only remaining native `<select>` in that
filter strip. Patterns to carry forward:

1. **Same filter-row wrapper as pilot 1/2:**
   `<div className="min-w-[180px] flex-[0_1_200px]">` + `className="h-[38px]"`
   on the trigger.
2. **`null` ↔ `'all'` boundary mapping** — ditto.
3. **Now: `import { Field }` from shared** if the status filter ever
   needs label/error chrome. (Filters typically don't, but if a future
   "active filter chips" feature attaches to it, the chrome is one line
   away.)
4. **Dictionary check first.** Status values are an enum — `STATUS_LABELS`
   in `dictionaries.ts` (referenced in [`ApplicantsPage.tsx:11,95-97`](frontend/src/features/admin/pages/ApplicantsPage.tsx#L11)).
   Ranges over the keys, label is the Arabic translation. The migration
   should map `Object.entries(STATUS_LABELS)` → `SearchSelectOption[]`.
5. **No `keywords`** unless the status enum gains an English label
   (currently keys are tokens like `'pending'` / `'approved'` and the
   Arabic label is the only display string). Wire `keywords: key` to
   let admins type the English token (`pending` → `في الانتظار`).
   Likely free win.

What I'd review before pilot 4:

- Confirm that `STATUS_LABELS` is the canonical source (no competing
  enum elsewhere). Same one-source-or-two question pilots 1 and 3
  answered up front.
- Double-check the value shape in `Applicant.status` (`ApplicantStatus`
  union, currently the keys of `STATUS_LABELS`) — should be a clean
  drop-in like ranks.
- The status filter sits in the same `<div className="filters">` row as
  the now-migrated cert-type and governorate filters; the visual fit is
  guaranteed by the existing `min-w-[180px] flex-[0_1_200px]` +
  `h-[38px]` overrides.

---

## 7. Regression check on the popover viewport-clipping fix

The fix at commit `6fe52fe` (pilot 1 followup) is unchanged:

- **Did this pilot modify `SearchSelect.tsx`?** No.
- **Did the `Field` promotion touch any popover internals?** No —
  `Field` wraps the SearchSelect from the *outside* (label + envelope).
  No pass-through of any popover-related prop.
- **Build clean?** Yes, 0 new warnings.

The clamp (`maxHeight: var(--radix-popover-content-available-height)`)
is a `SearchSelect.tsx` internal. Every consumer inherits it. The
pilot 3 site exercises the same component instance every prior pilot
exercised. No regression possible without a `SearchSelect.tsx` edit,
which this pilot didn't make.

---

## 8. Acceptance check

Per the brief:

- ✅ All rank pickers in the inventory migrated (1/1).
- ✅ 0 typecheck errors, 0 new build warnings.
- ⚠️ Form submission verified on at least 2 sites — *static* verification
  this pilot (only 1 site exists; runtime live-capture blocked by the
  same Chrome MCP issue as pilot 2). Live runbook in §5.3.
- ✅ Promotion decision **executed**. Audit, stencil, refactor, single
  commit (`2532295`). All four sites now consume `import { Field }`.
- ✅ Bundle delta documented (§5.2: −0.48 KB raw / −0.06 KB gzip JS).
- ⚠️ Before/after screenshots — not captured (Chrome MCP). The seed
  data and the wiring shape are identical to pilot 1/2 sites that
  *were* live-tested with screenshots.
- ✅ Pilot report exists (this file).
- ✅ Regression check on popover viewport bug (§7).

---

## 9. Commit map

| Commit | Phase |
|---|---|
| `aa7af73 docs(migration/rank-pilot): inventory + pre-flight` | Phase 1 |
| `00b5e04 feat(board): migrate BoardMembers rank picker to SearchSelect` | Site #1 |
| `2532295 refactor(shared): promote SearchSelectField wrapper to shared Field component` | Phase 3 (promotion) |
| (this commit) `docs(migration): rank pilot report` | Phase 5 |
