<!--
Sync Impact Report
==================
Version: 1.0.0 → 1.1.0 (MINOR — new MUST clauses added within Principles I–IV;
                       no principle added or removed; V unchanged)
Ratified: 2026-05-07 (unchanged)
Last Amended: 2026-05-08
Trigger: /speckit.constitution "Create principles focused on code quality,
                                testing standards, user experience consistency,
                                and performance requirements"

Refinements this run:
  Principle I (Code Quality & Maintainability):
    + No `useEffect` for data fetching — data layer (TanStack Query) is the
      only path; aligns constitution with CLAUDE.md §2 Forbidden list.
    + Named exports only; default exports forbidden (re-exports via the
      feature `index.ts` barrel are the public surface).
    + Component size: soft target ≤ 150 lines, hard ceiling ≤ 200 lines
      (was a single 200-line bar; now matches CLAUDE.md §9 guidance).
    + Tightened the `any` / `@ts-ignore` clause: prefer `unknown` and narrow;
      `@ts-expect-error` with reason and linked issue is the only escape hatch.

  Principle II (Testing Standards):
    + Snapshot tests MUST NOT substitute for behavior tests.
    + Flake budget: any E2E that flakes twice in a 7-day rolling window is
      quarantined within 24h and fixed within 5 working days, or removed.
    + Pre-commit hook runs the test subset for changed files.

  Principle III (User Experience Consistency):
    + RTL Arabic-first is mandatory: logical properties only
      (`text-start`/`text-end`, `ms-*`/`me-*`, `ps-*`/`pe-*`); physical
      properties are forbidden in component styles.
    + Direction-aware icons (arrows, chevrons) MUST flip via `rtl:rotate-180`
      or `rtl:scale-x-[-1]`.
    + Per-app accent surfaces MUST consume `var(--accent-*)`, never hardcoded
      brand colors; `data-app="<key>"` on the shell is the single switch.
    + Motion MUST respect `prefers-reduced-motion: reduce`.

  Principle IV (Performance Requirements):
    + Per-route bundle budget added: ≤ 250 KB gzipped per non-landing route
      (incremental over the landing chunk), in addition to the existing
      ≤ 170 KB landing budget.
    + Code-split routes MUST sit behind Suspense boundaries with skeletons
      sized to prevent CLS during chunk load.
    + Web fonts MUST use `font-display: swap` (or `optional` for non-critical)
      with `preconnect` to the font origin.
    + Memoization (`useMemo` / `useCallback`) MUST only be added when a
      measurable benefit is verified with React DevTools Profiler — not
      cargo-culted.

Templates to re-propagate:
  - .specify/templates/plan-template.md          ⏳ this run — Constitution
                                                   Check version reference
                                                   bumped to v1.1.0; new
                                                   gates surfaced (RTL,
                                                   per-route budget,
                                                   reduced-motion).
  - .specify/templates/tasks-template.md         ✓ no change needed (refers
                                                   to "Principle II" by name,
                                                   not version).
  - .specify/templates/spec-template.md          ✓ no change (tech-agnostic).
  - .specify/templates/checklist-template.md     ✓ no change (scaffolding).
  - .specify/templates/agent-file-template.md    ✓ no change (scaffolding).

Outstanding follow-ups (carried from prior sync, not introduced this run):
  - Register the Spec Kit slash commands in `.claude/commands/` so
    /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks
    fire natively (today the .specify/ skeleton exists but command
    definitions don't).
  - Add a "Constitution Check" section to the PR template enforcing
    Principle V.
  - Wire the CI gates referenced by Principles I/II/IV (ESLint + Prettier
    on pre-commit, coverage thresholds, Lighthouse CI, 170 KB landing-route
    bundle budget, 250 KB per-route budget) into the frontend pipeline. The
    backend workspace (C# 13 / .NET 10 + ASP.NET Core Web API + EF Core 10
    per CLAUDE.md §1) is empty; backend-specific rules will be added to this
    constitution when the backend kicks off.
  - Frontend reality vs. constitution: project is currently pre-test-suite
    and pre-eslint-config (per CLAUDE.md §11 "Sprint 10 — Hardening"). The
    constitution sets the destination; Sprint 10 closes the gap. Track any
    interim deviations as time-bound exceptions in the relevant plan.md
    "Complexity Tracking" sections.
-->

# PACademy Constitution

## Core Principles

### I. Code Quality & Maintainability (NON-NEGOTIABLE)

- All code MUST be written in TypeScript with `strict: true`. `any`,
  `@ts-ignore`, and non-null assertions (`!`) are forbidden; prefer `unknown`
  and narrow. Where a third-party type gap leaves no other option, use
  `@ts-expect-error` with an inline reason and a linked issue — never
  `@ts-ignore`.
- Every module MUST pass ESLint + Prettier on pre-commit; CI MUST fail on
  lint errors or formatting drift.
- Components MUST be single-responsibility. Soft target ≤ 150 lines, hard
  ceiling ≤ 200 lines; files exceeding the ceiling MUST be decomposed before
  merge.
- `useEffect` MUST NOT be used for data fetching — the chosen data layer
  (TanStack Query) is the only path for server state. Effects are reserved
  for subscriptions, DOM imperatives, and external-system synchronization.
- Named exports only; default exports are forbidden. The public surface of a
  feature is its `index.ts` barrel; internal components stay private.
- Public functions, hooks, and exported components MUST have JSDoc
  describing intent, params, return shape, and any side effects.
- Dead code, commented-out blocks, and `console.log` statements MUST NOT
  reach `main`.
- Dependencies MUST be justified in the PR description; adding a library
  > 30 KB gzipped requires explicit approval.

**Rationale**: Strict typing and small modules turn whole classes of runtime
bugs into compile-time errors and keep the codebase navigable as it grows.
Banning `useEffect` for data and default exports closes two of the most
common React-codebase rot patterns at the constitution level rather than at
review time.

### II. Testing Standards (NON-NEGOTIABLE)

- Test-first is REQUIRED for all business logic, hooks, and utilities: write
  a failing test, see it fail, then implement.
- Coverage thresholds MUST be enforced in CI: ≥ 80% statements, ≥ 75%
  branches, 100% on auth, payments, and form validation paths.
- Every UI component MUST have at least: (1) a render smoke test, (2) one
  user-interaction test using Testing Library, and (3) an accessibility
  assertion (`axe` or `jest-axe`).
- Critical user journeys (auth, payment, primary CRUD per app) MUST have
  end-to-end tests in Playwright or Cypress that run on every PR.
- Snapshot tests MUST NOT substitute for behavior tests — they document
  rendered shape, not correctness. A snapshot is supplemental, never the
  only assertion in a spec.
- Tests MUST be deterministic — no flaky retries, no `sleep`, no live
  network calls. Use MSW or equivalent for API mocking.
- Flake budget: any E2E that flakes twice in a rolling 7-day window MUST be
  quarantined within 24 hours and fixed within 5 working days, or removed.
  Flakes are not "just retry"; they are bugs in either the test or the
  feature.
- A failing test in CI is a hard block on merge; skipping (`.skip`,
  `.only`) MUST NOT exist on `main`.
- Pre-commit hooks MUST run the test subset for changed files before
  allowing the commit; CI runs the full suite.

**Rationale**: A trustworthy test suite is the only thing that lets the team
move fast without breaking users. Snapshots and flake-tolerance both erode
that trust silently — explicit rules close those holes.

### III. User Experience Consistency

- A single design-token source (colors, spacing, typography, radii,
  shadows, motion) MUST be the only origin of style values; raw hex codes,
  magic pixel values, and inline motion durations in components are
  forbidden.
- Per-app accent surfaces MUST consume `var(--accent-*)`, never hardcoded
  brand colors (`--teal-*`, `--gold-*`, etc.); the `data-app="<key>"`
  attribute on the app shell is the single switch that flips accent for
  the subtree.
- All interactive elements MUST come from a shared component library
  (Button, Input, Modal, etc.); one-off variants MUST be added to the
  library, not inlined.
- WCAG 2.1 AA is the minimum accessibility bar: keyboard navigation,
  visible focus rings, semantic HTML, ARIA only when semantics are
  insufficient, and 4.5:1 contrast for body text.
- The product is RTL Arabic-first. Layouts MUST use logical properties
  (`text-start` / `text-end`, `ms-*` / `me-*`, `ps-*` / `pe-*`); physical
  properties (`text-left`, `ml-*`, `pl-*`) are forbidden in component CSS
  and utility classes. Direction-aware icons (arrows, chevrons) MUST flip
  via `rtl:rotate-180` or `rtl:scale-x-[-1]`.
- Every async UI state MUST handle four cases explicitly: idle, loading,
  empty, error. "Just spinner" is not acceptable for empty or error.
- Forms MUST provide inline validation, preserve user input on error,
  announce errors to assistive tech, and disable submit only after
  attempted submission.
- Copy MUST follow the project voice guide; user-facing strings MUST be
  centralized for future LTR-language support (no hard-coded text in JSX).
- Motion MUST respect `prefers-reduced-motion: reduce`. Animations longer
  than 200ms MUST be shortened or removed when the user opts out;
  essential motion (loading indicators) may remain but at reduced
  amplitude.
- Responsive behavior MUST be verified at three breakpoints minimum
  (mobile ≤ 480px, tablet ~768px, desktop ≥ 1024px) before merge.

**Rationale**: Consistency is what makes an interface feel like one product
instead of a collection of screens, and it is the cheapest accessibility
win available. RTL and reduced-motion are first-class concerns here, not
afterthoughts — getting them wrong is a bug, not a polish item.

### IV. Performance Requirements

- Production builds MUST meet Core Web Vitals on a mid-tier mobile device
  on 4G: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- Bundle budgets — initial JS for the landing route MUST stay ≤ 170 KB
  gzipped; every other route MUST stay ≤ 250 KB gzipped (incremental over
  what is already cached after landing). Routes MUST be code-split and
  non-critical components lazy-loaded behind Suspense boundaries with
  skeletons sized to prevent CLS during chunk load.
- Images MUST be served in modern formats (AVIF/WebP), responsive
  (`srcset`), and lazy-loaded below the fold; explicit `width` / `height`
  attributes MUST reserve layout to prevent CLS.
- Web fonts MUST use `font-display: swap` (or `optional` for non-critical)
  and `preconnect` to the font origin; FOIT is forbidden.
- Every list rendering > 50 items MUST be virtualized.
- Network requests MUST be deduplicated and cached via the chosen data
  layer (e.g., TanStack Query); waterfalls of dependent fetches MUST be
  flattened or parallelized.
- A Lighthouse CI check MUST run on each PR; regressions of > 5 points on
  Performance or Accessibility block the merge.
- Re-render audits: components MUST NOT re-render on unrelated state
  changes. `useMemo` / `useCallback` MUST only be added when a measurable
  benefit is verified with React DevTools Profiler — they are not
  cargo-culted preemptively, and unused memoization MUST be removed
  during review.

**Rationale**: Performance is a feature; users abandon slow apps before
they ever see the rest of the work. The per-route budget closes a
loophole where the landing route stayed thin while internal routes
quietly bloated past it.

### V. Spec-Driven Discipline

- `spec.md` MUST stay technology-agnostic (what & why); `plan.md` owns all
  technical decisions (how). Tech terms in `spec.md` block the merge.
- Every feature MUST be traceable: spec → plan → tasks → PR → tests. PRs
  MUST link the originating spec.
- Constitution amendments require a PR that bumps the version (semver:
  MAJOR for breaking principles, MINOR for new principle, PATCH for
  clarifications) and updates affected templates.

**Rationale**: The constitution only works if the workflow respects its
boundaries.

## Governance

- This constitution supersedes ad-hoc conventions. Conflicts are resolved
  in favor of the constitution.
- Exceptions MUST be documented in the relevant `plan.md` under
  "Complexity Tracking" with justification and an expiry date.
- All PRs MUST include a "Constitution Check" confirming the five
  principles were considered; reviewers MUST reject PRs that silently
  violate a MUST clause.
- The constitution is reviewed quarterly; principles that no longer
  reflect reality MUST be amended rather than ignored.

**Version**: 1.1.0 | **Ratified**: 2026-05-07 | **Last Amended**: 2026-05-08
