# Prompt 2 — Sprint 0: Apply the Design System

> **When to use:** After Prompt 1 confirms the baseline is green and we're about to start Sprint 0. This prompt drives the entire design system rollout — typically a multi-day sprint.
> **What it does:** Replaces tokens, refreshes the existing components, and builds all new shared primitives per DESIGN_SYSTEM.md.
> **Expected duration:** Multi-session. Break across 4–6 working chunks (see "Chunking strategy" at the bottom).

---

## Copy everything below this line into Claude Code

```
We are starting Sprint 0 — the Arabic Heritage Modern design system rollout.

This sprint blocks every other sprint. Do not move on to feature work until Sprint 0 is fully shipped and I've signed off.

## Source of truth

`DESIGN_SYSTEM.md` is the entire visual contract. Every value in the new tokens.css traces back to a section there. If something is unclear in DESIGN_SYSTEM.md, STOP, flag it, and propose an update to that file before writing any code that depends on the unclear part. Do not silently invent values.

If anything in `_legacy/styles/*.css` conflicts with DESIGN_SYSTEM.md, the design system wins. Legacy is deprecated reference only.

## Scope of Sprint 0 (do all of this, in this order)

### Part A — Tokens and global styles

1. **`src/styles/tokens.css`** — replace the entire file with the spec from DESIGN_SYSTEM.md §2. Include:
   - All four core ramps: ink, teal, gold, terra (each 50–900)
   - Semantic colors (success, warning, danger, info, plus -bg variants)
   - Surfaces (page, card, elevated, sunken, overlay)
   - Borders, text colors
   - Font families, scale (--text-2xs through --text-4xl), weights, tracking, leading
   - Spacing scale (--space-0 through --space-12)
   - Radii, shadows, motion durations + easings, z-index scale
   - Per-app accent overrides via `[data-app="X"]` selectors per §2.2

2. **`src/styles/base.css`** — rewrite for: CSS reset, body bg = `--surface-page`, default font = `--font-ar`, body text = `--text-base`/`--leading-normal`, anti-aliasing, RTL `dir="rtl"` defaults.

3. **`src/styles/components.css`** — DELETE. Migrate any rules still in use into Tailwind utilities or component-level CSS modules.

4. **`src/styles/apps.css`** — keep ONLY the `[data-app="X"]` accent overrides per DESIGN_SYSTEM.md §2.2. Nothing else.

5. **`src/styles/print.css`** — NEW. `@media print` rules per DESIGN_SYSTEM.md §6.4 (hide nav/sidebar/buttons; show ministry header + Khayameya stripe).

6. **`src/styles/motifs.css`** — NEW. Keyframes for: stage-stepper progression, toast slide, modal entry, focus pulse on current wizard step. Each keyframe must have a `prefers-reduced-motion: reduce` no-op variant.

7. **`tailwind.config.ts`** — extend `theme` so colors, spacing, fontFamily, fontSize, fontWeight, borderRadius, boxShadow, transitionDuration, transitionTimingFunction all mirror DESIGN_SYSTEM.md §2 EXACTLY. Do not allow Tailwind defaults to leak in. Audit the existing `tailwind.config.ts` and remove any leftover legacy values.

8. **`index.html`** — update Google Fonts link to load: IBM Plex Sans Arabic (400/500/700), Tajawal (400/500/700/900), Inter (400/500), JetBrains Mono (400/500). Drop Noto Sans Arabic. Keep `<html lang="ar" dir="rtl">`.

### Part B — Shared component primitives (new + refresh)

For each new file, follow this order:
1. Create the component file in `src/shared/components/<Name>.tsx`
2. Add an entry in `src/shared/components/index.ts` (named export only — no defaults).
3. Write a Storybook-style usage example in a JSDoc comment block at the top of the file.
4. If the component needs a CSS module, add `<Name>.module.css` next to it.
5. Ensure props are fully typed. No `any`. No untyped event handlers.

**New primitives to build (in this priority order):**

Foundational (must come first, used by everything else):
- `EmptyState.tsx` — per DESIGN_SYSTEM.md §4.10 (variants: no-results-search, no-applicants-yet, no-cases, app-not-accessible)
- `LoadingState.tsx` — per §4.10 (skeleton boxes for tables + cards, shimmer animation)
- `ErrorState.tsx` — per §4.10 (with retry CTA)
- `Pattern.tsx` — heritage tessellation per §3.1 (variants: tessellation-8, khayameya-stripes, corner-flourish)
- `KhayameyaStripe.tsx` — per §3.2
- `CornerFlourish.tsx` — per §3.3

Layout primitives:
- `Modal.tsx` — per §4.8 (sm/md/lg sizes, focus trap, Esc to close, focus return on close)
- `Drawer.tsx` — per §4.8 (slides from end-edge, same internal API as Modal)
- `Wizard.tsx` — per §4.7 (vertical stepper + content + sticky footer)
- `PrintLayout.tsx` — per §4.16 (ministry header + Khayameya stripe + page numbers)

Form primitives:
- `FileUpload.tsx` — per §4.11
- `DateRangePicker.tsx` and `DatePicker.tsx` — per §4.12 (Arabic months, Saturday week-start)
- `Combobox.tsx` and `MultiSelect.tsx` — per §4.15 (virtualized list for >100 items)

Data primitive (the workhorse):
- `DataTable.tsx` — per §4.4. Build it once, build it right. It will replace ad-hoc tables across 20+ screens. Generic over row type, supports: typed columns, pagination, sort, filters, multi-select, density, sticky header, zebra stripes, row hover, custom empty state, custom loading state. Do not skimp here.

Charts (extend existing inline-SVG pattern):
- `Heatmap.tsx` — per §4.13
- `Sparkline.tsx` — per §4.13
- `Gauge.tsx` — per §4.13 (used in medical BMI station)
- `Funnel.tsx` — per §4.13 (used in admin dashboard)

Icons:
- `icons/IconBarcode.tsx`
- `icons/IconBiometric.tsx`
- `icons/IconCertificate.tsx`
- `icons/IconStamp.tsx`
- `icons/IconSeal.tsx`
(Each is an SVG component with `width`, `height`, `color` props.)

**Existing primitives to refresh (apply new tokens, add missing states):**

- `Button.tsx` — per §4.1 (variants: primary, secondary, ghost, danger, success; sizes sm/md/lg/xl; loading state)
- `Input.tsx`, `Select.tsx`, `Textarea.tsx` — per §4.2 (heights, focus rings, label/helper/error)
- `Card.tsx` — per §4.3 (variants: default, Stat, Feature, Compact, Elevated)
- `Badge.tsx`, `StatusBadge.tsx` — per §4.5 (status enum → ramp mapping, with/without dot)
- `StageStepper.tsx` — per §4.6 (states: complete, current, upcoming, blocked, skipped)
- `Toast.tsx` — keep API, re-skin per §4.9
- `BarChart.tsx`, `LineChart.tsx`, `DonutChart.tsx` — re-skin with new palette, keep API

### Part C — Shells and global layout

- `app/layouts/AppShell.tsx` — refresh per §4.14 (Khayameya stripe top, header, sidebar, main). Apply `data-app="<key>"` to root.
- `app/layouts/Sidebar.tsx` — per §4.14 (256px expanded, 64px collapsed; nav item active state with start-edge accent).
- `app/layouts/PublicShell.tsx` — for login; full-bleed Pattern bg at 4% opacity.
- `app/layouts/CenteredShell.tsx` — refresh tokens.
- `features/auth/pages/LoginPage.tsx` — apply new design language (per §1 — calm, institutional, distinctly Egyptian; gold-foil-style header accent, tessellation watermark behind the form).
- `features/hub/pages/HubPage.tsx` — refresh: 9 app cards with per-app accent border-top (3px); KPI strip; greeting based on time of day.

### Part D — Helpers

- `src/shared/lib/motion.ts` — NEW. Reduced-motion-aware preset generator: takes a duration + easing, returns the actual values OR a no-op if `prefers-reduced-motion: reduce`. All motion in the app routes through this helper.
- `src/shared/lib/cn.ts` — should already exist; verify it does.
- `src/shared/lib/format.ts` — verify number/date/relative-time formatters use Arabic locale where appropriate. Per DESIGN_SYSTEM.md §3.4: dashboards use Latin tabular figures; certificates and printables use Arabic-Indic.

## Process for this sprint

I expect the following workflow from you:

1. **Plan first.** Before each part (A, B, C, D), write a 5–8 line plan and wait for my approval. Do not bundle multiple parts into one plan — they're sequenced for a reason.
2. **Type-driven.** Define types/interfaces first, then implementation. If you can't type it cleanly, the design is wrong — re-think before coding.
3. **Sanity check after each file.** Run `npm run typecheck` after every component you finish. If it breaks, fix it before moving on.
4. **Visual check after Part C.** After the AppShell + Hub refresh, take screenshots of: `/login`, `/`, `/admin`, `/applicant`. Show me. We compare against the DESIGN_SYSTEM intent before moving on.
5. **Commit per part.** Four commits minimum: `feat(design): tokens & global styles`, `feat(design): shared primitives`, `feat(design): shells and login`, `feat(design): helpers and motion`.

## Definition of done — Sprint 0

Before you tell me Sprint 0 is complete, ALL of the following must be true:

- ☐ `npm run typecheck` returns 0 errors
- ☐ `npm run build` returns 0 errors and 0 warnings
- ☐ Every file in `src/styles/` matches the DESIGN_SYSTEM.md spec
- ☐ Every component listed above exists, exports cleanly, and uses tokens (no hardcoded hex/px outside the scale)
- ☐ Every existing route still renders without console errors (this is the regression check)
- ☐ Per-app accents work: visiting `/medical`, `/investigations`, `/committee` etc. show distinct accents per DESIGN_SYSTEM.md §2.2
- ☐ Reduced-motion test: with `prefers-reduced-motion: reduce` set in DevTools, no animations play
- ☐ Keyboard navigation works on Login + Hub (Tab, Enter, Esc)
- ☐ Visible focus rings on every interactive
- ☐ Screenshots of `/login`, `/`, `/admin`, `/applicant`, `/medical`, `/investigations` shared with me

If any item is unchecked, Sprint 0 is NOT done. Do not move on to Sprint 1.

## Anti-patterns I will reject

- Hardcoded colors outside `tokens.css`
- New chart libraries (Chart.js, Recharts, etc.) — inline SVG only
- `useEffect` for data fetching — TanStack Query only
- `any` anywhere
- Mid-sentence bolding in body copy
- Drop-shadows heavier than `--shadow-md` on any card
- "Generic SaaS" patterns: purple gradients, glassmorphism, "Made with ❤" footers, robot illustrations on empty states
- Components > 150 lines (split immediately)
- Imports across features (use barrels)
- Skipping the loading/empty/error states because "we'll come back to them"

Begin with Part A. Write your plan for Part A first and wait for my approval.
```

---

## Chunking strategy

Don't run all of Sprint 0 in one Claude Code session — context gets stale and quality drops. Break it across at least 4 sessions, ideally 6:

| Session | Focus | Roughly |
|---|---|---|
| 1 | Part A — tokens, base, apps, tailwind config, index.html | 1–2 hours |
| 2 | Part B — foundational primitives (Empty/Loading/Error/Pattern/Khayameya/CornerFlourish) | 1–2 hours |
| 3 | Part B — layout primitives (Modal, Drawer, Wizard, PrintLayout) | 2–3 hours |
| 4 | Part B — form primitives (FileUpload, DatePickers, Combobox) | 2 hours |
| 5 | Part B — DataTable + Charts | 2–3 hours (DataTable alone is 1.5h) |
| 6 | Part C + Part D — shells, login, hub, motion helper | 1–2 hours |

Start each session with **Prompt 1** (Onboarding & Brief Validation) so Claude Code reloads context cleanly.

---

## What "approved" looks like for each part

After Claude Code shows you the work for a part, before you say "approved" check:

- ☐ Files referenced in the plan all exist
- ☐ `npm run typecheck` was run and returned 0
- ☐ At least one quick visual check happened (Claude Code ran `npm run dev` and reported what they saw)
- ☐ Tokens are NOT hardcoded — `grep -rn "#[0-9A-Fa-f]\{6\}" src/shared/components/` should return only minimal results (icon SVGs are OK; colored backgrounds are NOT OK)

If any check fails, push back. Don't approve to keep momentum.
