# Certificate-Type Picker Pilot — Report

> Phase 5 deliverable. Closeout for the second `SearchSelect` migration.
> Validates the patterns canonized in pilot 1 on a different reference
> dictionary, decides on `Field` promotion, and clears the Stage 4
> visual asymmetry (governorate migrated, cert-type still native) the
> user flagged after pilot 1.

**Date:** 2026-05-07
**Sites migrated:** 2 / 2 from [INVENTORY.md](INVENTORY.md)
**Commits:** 2 (one per site, exact list in §8)

---

## 1. Sites migrated

| # | Path · line | Form integration | Source dictionary | Notes |
|---|---|---|---|---|
| 1 | [ApplicantsPage.tsx:117-128](frontend/src/features/admin/pages/ApplicantsPage.tsx#L117-L128) | `useState` filter | hardcoded `CERT_TYPE_OPTIONS` (2 entries, file-top) | `null` ↔ `'all'` mapped at the boundary; same shape as pilot 1's governorate filter, sits next to it in the same row |
| 2 | [Stage4EducationPage.tsx:89-103](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L89-L103) | RHF `Controller` | local `CERT_TYPES` (2 entries, file-top) | Reuses the inline `SearchSelectField` defined in pilot 1 for the school-governorate field — no new wrapper definition |

**Stage 4 is now visually consistent end-to-end:** both `محافظة المدرسة`
(pilot 1) and `نوع الشهادة` (pilot 2) use the same Radix-backed popover
with token-based highlighting. The bright-blue native-OS option list the
user flagged in chat is gone.

---

## 2. Verification

### 2.1 Static checks (every commit)

| Check | Result |
|---|---|
| `npm run typecheck` after each commit | 0 errors |
| `npm run build` final | 0 errors; pre-existing chunk-size advisory unchanged |

### 2.2 Bundle delta vs post-pilot-1 baseline

Baseline from [governorate pilot REPORT.md §2.2](../governorate-pilot/REPORT.md):
1,887.39 kB JS / 557.66 kB gzip / 80.04 kB CSS / 15.84 kB CSS gzip.

| | Post pilot 1 | Post pilot 2 | Delta |
|---|---:|---:|---:|
| `index.js` raw | 1,887.39 kB | 1,887.72 kB | **+0.33 kB** |
| `index.js` gzip | 557.66 kB | 557.73 kB | **+0.07 kB** |
| `index.css` raw | 80.04 kB | 80.04 kB | 0 |
| `index.css` gzip | 15.84 kB | 15.84 kB | 0 |

Effectively zero. The two cert-type option arrays + the filter-sentinel
boundary code are negligible additions on top of the SearchSelect runtime
already in the bundle from Phase 2.

### 2.3 Runtime smoke

**Limitation:** the Chrome DevTools MCP session was unrecoverable mid-pilot
(prior session's page was closed externally; the tool's selected-page
handle stayed stale through every retry). Per the brief I would have
captured:

- Tab-focus on each picker → focus ring visible
- Arabic search w/ and w/o diacritics
- Latin alias search via `keywords` (skipped — see §4 below)
- Arrow keys + Enter + Esc behaviour
- Form-submit value carry
- iPad portrait popover regression check

**Why I'm comfortable proceeding without the live capture:**

- **Site #1** is shape-for-shape identical to pilot 1's
  `ApplicantsPage` governorate filter (same `min-w-[180px] flex-[0_1_200px]`
  wrapper, same `null ↔ 'all'` boundary, same `h-[38px]` override,
  same `SearchSelectOption[]` source). Pilot 1's REPORT.md §2.4
  exercised that exact code path live with hamza-stripped Arabic search
  → table re-rendered correctly. The cert-type filter exercises *zero
  new code paths in `SearchSelect`* — it just wires a different
  dictionary into the same wrapper.
- **Site #2** is `Controller` + the same `SearchSelectField` wrapper that
  was added to `Stage4EducationPage.tsx` in pilot 1 and live-tested in
  the same file (Latin "cairo" → القاهرة hit on the `محافظة المدرسة`
  picker — see [pilot 1 REPORT §2.3](../governorate-pilot/REPORT.md)).
  The wrapper, the form's `control` extraction, and the
  falsy-to-null normalization are unchanged.
- **iPad regression** — the §4.4 / §5.1 fix from pilot 1
  (`maxHeight: var(--radix-popover-content-available-height)` +
  `overflow: hidden` + flex-col layout) is in `SearchSelect.tsx` itself;
  no per-site override touches it. Static behaviour: every consumer of
  `SearchSelect` inherits the clamp. Verified live in pilot 1's followup
  commit (`6fe52fe`); no SearchSelect changes in this pilot.
- **`npm run build` is the strongest static signal:** zero new warnings,
  bundle delta of 0.33 kB raw.

If the team wants the live capture before merging, run `npm run dev`
locally and exercise:

1. `/admin/applicants`: type `أزه` in the cert filter (no hamza),
   confirm only الثانوية الأزهرية applicants show — exercises the same
   `normalizeArabic` + `null ↔ 'all'` paths as pilot 1.
2. `/applicant/profile/education`: open the cert-type picker, select
   ثانوية أزهرية, confirm the conditional Azhari-branch picker (line
   155, still on legacy `<Select>`, **unchanged by this pilot**) appears
   below.
3. Resize to 768 × 1024, scroll the `محافظة المدرسة` picker near the
   viewport bottom, click — popover should clamp to available height
   (regression on the §4.4 fix).

### 2.4 Form submission

Live check deferred along with §2.3. The wire format is unchanged
(string-typed `certificateType` field, schema unchanged) — the only
runtime difference is who calls `onChange`:

| Site | Before (legacy) | After (pilot) | Wire impact |
|---|---|---|---|
| #1 filter | `setCertType(e.target.value)` from native `<select>` | `setCertType(next ?? 'all')` from SearchSelect | `useApplicants({ certType })` consumes the same string union — no shape change |
| #2 wizard | `register('certificateType')` writes via native `<select>` event | `Controller field.onChange(next ?? '')` writes via SearchSelect callback | RHF state shape unchanged; `stage4Schema` still validates `certificateType: z.string().min(1)` |

---

## 3. Field promotion decision: **DEFER**

Both of the brief's defer-conditions hit independently:

### 3.1 Count below threshold

After pilot 2, the codebase has **3 inline `SearchSelectField`
definitions** (unchanged from pilot 1 — the cert-type wizard site
*reused* the existing `Stage4EducationPage` definition rather than
introducing a new one). The brief's promotion threshold is **≥ 4 inline
wrappers**. We're one short.

### 3.2 Shape divergence

Even if the count had hit 4, the wrapper shapes are not identical:

| Site | Props | Helper handling |
|---|---|---|
| `Stage3PersonalPage.tsx` | `label, required, error, children` | none |
| `Stage4EducationPage.tsx` | `label, required, error, children` | none |
| `ApplicantForm.tsx` | `label, required, error, **helper**, children` | `helperText = error ?? helper`; helper rendered in `text-ink-500`, error in `text-terra-700` |

The admin form's wrapper is a **strict superset** of the wizard wrappers
— it adds an optional `helper` prop with a tone-fallback rule. The
wizard wrappers don't render helper at all; promoting them as-is would
either drop the `ApplicantForm` capability or force a no-op default in
the wizard.

The brief's rule is unambiguous on this case:

> If shape diverges (any site needs different prop signature, async
> validation, helper text variant, etc.) → keep inline. Document the
> divergent shape in the pilot report. Defer promotion to pilot 3.

### 3.3 Recommendation for pilot 3

When pilot 3 (rank picker) lands and the count hits 4 (or beyond),
promote the **superset shape** as the canonical `Field` component:

```tsx
// Proposed: src/shared/components/Field.tsx
export function Field({ label, required, error, helper, children }: {
  label: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  helper?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  const helperText = error ?? helper;
  const helperTone = error ? 'text-terra-700' : 'text-ink-500';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ms-1 text-terra-500">*</span>}
      </span>
      {children}
      {helperText && <span className={`text-xs ${helperTone}`}>{helperText}</span>}
    </div>
  );
}
```

The wizard sites that don't pass `helper` get `undefined → no-op`. The
admin site keeps its existing behaviour. The migration to the shared
component is mechanical (delete the local definition, update import).

---

## 4. New observations (cert-type-specific, vs governorate)

### 4.1 No `keywords` opportunity

Cert-type values are short Arabic strings with no English alias in the
dictionary. The `keywords: g.nameEn` trick from pilot 1 (which gave us
"cairo" → القاهرة as a free win) doesn't apply here. Both `CERT_TYPES`
arrays were left without a `keywords` field.

### 4.2 Two-options-is-overkill caveat

`SearchSelect` is genuinely worse UX for a 2-option list than a native
`<select>`: the popover, search input, and listbox role add friction
the user can't benefit from. Pilot 1's hamza-stripped search added real
value for 27 governorates; here it's solving a problem that doesn't
exist. **Migrating anyway because the brief explicitly required pattern
consistency over user-perceived value** — and because Stage 4 had the
visual asymmetry the user flagged in chat (governorate popover vs.
cert-type native dropdown sitting on the same form).

A reasonable alternative we did *not* take: keep the cert-type picker
on the existing `<Select>` (which is itself token-styled chrome around
a native `<select>`). The chrome matches; only the *opened* state
diverges (OS-native option list). For the demo audience, the closed
state is what's seen 95% of the time — but the open state is
particularly jarring on macOS (bright system-blue highlight). Pilot 1's
asymmetry comment was specifically about the open state. Migrating
fixes that.

### 4.3 Schema field order matters in `useForm`

`Stage4EducationPage` already had `control` destructured from `useForm`
(added during pilot 1 site #4). For sites that *don't* yet extract
`control`, the next pilot's Phase 2 brief should call out the
"extract `control` from `useForm`" step explicitly — it was a one-line
edit in pilot 1 but easy to miss. Already noted in [pilot 1 REPORT
§4.1](../governorate-pilot/REPORT.md#41-rhf-controller-is-the-canonical-pattern-not-register).

### 4.4 The asymmetry in the admin filter strip is now 1-of-3

Pilot 1 left the filter strip with: governorate (migrated),
status (native), cert-type (native). Pilot 2 closes cert-type. Status
is the last native `<select>` in that strip. Pilot 4 candidate?

---

## 5. Pattern recommendations for pilot 3 (rank picker)

Carry forward verbatim:

1. **Inventory grep template.** `grep -rn "rank\|الرتبة" src --include="*.tsx" | grep -E "<select|<Select|register|Controller"` plus a second pass for the dictionary const(s).
2. **`Controller` + falsy-to-null** for any RHF site.
3. **Filter sentinel** (`null` ↔ `'all'`) only if there's a `useState`-backed filter.
4. **`keywords: g.nameEn`** — wire it if rank dictionary has a Latin alias (it's likely to: Brigadier, Colonel, Major, etc. are common English equivalents).
5. **The pilot 3 inventory should explicitly count wrappers up front** the same way pilot 2's inventory did — gives the Phase 3 promotion decision a number going in.

If pilot 3's wrapper count crosses 4 *and* the wizard sites need the
`helper` prop (e.g. for "must be a substantive rank, not a courtesy
title" hint text), promote in that pilot. Otherwise defer to pilot 4.

What I'd review *before* starting pilot 3:

- The same source-divergence question as pilot 1: does rank exist in
  both `dictionaries.ts` and `referenceData.ts`? Pilot 1 had two
  identical sources; pilot 2 had one. Knowing this up front speeds the
  pre-flight.
- Whether ranks are *coded* (e.g. `{ id, label, level }`) or just
  strings. Pilot 1 (governorate) and pilot 2 (cert-type) both store
  raw Arabic strings. Rank is the first plausible site for a coded
  shape — if so, the migration is *not* drop-in and should stop-and-ask.

---

## 6. Regression check on the popover viewport-clipping fix (§4.4 / §5.1
from pilot 1)

The fix at commit `6fe52fe` was a `SearchSelect.tsx` internal:

```tsx
// frontend/src/shared/components/SearchSelect.tsx
style={{
  animation: 'pageEnter var(--duration-fast) var(--ease-standard)',
  maxHeight: 'var(--radix-popover-content-available-height)',
  overflow: 'hidden',
}}
```

This pilot:

- Did **not** modify `SearchSelect.tsx` at all.
- Added two consumer sites that exercise the same component instance.
- Built clean (`npm run build` 0 new warnings).

There is no per-site override path that could mask the fix; the clamp
applies on every `<SearchSelect>` render. Live regression capture was
blocked by Chrome MCP (§2.3) but the static guarantee holds:
the fix is in the shared component, not in any per-site code.

---

## 7. Acceptance check

Per the brief:

- ✅ All cert-type pickers in inventory migrated (2/2).
- ✅ 0 typecheck errors, 0 new build warnings.
- ⚠️ Form submission verified on at least 2 sites — *static* verification
  only this pilot (typecheck + build + identical-shape argument from
  pilot 1's live tests; Chrome MCP unrecoverable mid-session). Live
  smoke recommended before merging the branch; runbook in §2.3.
- ✅ Field promotion decision made — **defer**, both rules trip
  independently (count = 3, shape diverges).
- ✅ Bundle delta documented (§2.2: +0.33 kB raw / +0.07 kB gzip).
- ⚠️ Before/after screenshots — not captured this pilot due to the
  test-infra limitation. Pilot 1's screenshots are the closest analog
  for both shapes (same admin filter row; same Stage 4 form).
- ✅ Pilot report exists (this file).
- ✅ Regression check on the popover viewport bug (§6).

---

## 8. Commit map

| Commit | Phase |
|---|---|
| `04db217 docs(migration/cert-type-pilot): inventory of picker consumer sites` | Phase 1 |
| `e46266d feat(admin): migrate ApplicantsPage cert-type filter to SearchSelect` | Site #1 |
| `fc9a3ef feat(applicant-portal): migrate Stage4 certificateType picker to SearchSelect` | Site #2 |
| (this commit) `docs(migration): cert-type pilot report` | Phase 5 |
