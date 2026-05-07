<!--
Sync Impact Report
==================
Version change: [none] → 1.0.0 (initial ratification)
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles
    - I. Code Quality & Maintainability (NON-NEGOTIABLE)
    - II. Testing Standards (NON-NEGOTIABLE)
    - III. User Experience Consistency
    - IV. Performance Requirements
    - V. Spec-Driven Discipline
  - Governance
Removed sections: N/A

Templates requiring updates:
  - .specify/templates/plan-template.md          ⚠ pending (no template found in repo)
  - .specify/templates/spec-template.md          ⚠ pending (no template found in repo)
  - .specify/templates/tasks-template.md         ⚠ pending (no template found in repo)
  - .specify/templates/commands/*.md             ⚠ pending (no commands directory present)

Follow-up TODOs:
  - Spec Kit toolkit is not yet initialized in this repository. When it is installed,
    re-run the constitution sync to propagate the five principles into plan/spec/tasks
    templates and the Constitution Check section of the PR template.
  - Add a "Constitution Check" section to the PR template enforcing Principle 5.
  - Wire CI gates referenced by Principles 1, 2, and 4 (ESLint+Prettier, coverage
    thresholds, Lighthouse CI, bundle-size budget) into the backend & frontend pipelines
    once those pipelines exist.
-->

# PACademy Constitution

## Core Principles

### I. Code Quality & Maintainability (NON-NEGOTIABLE)

- All code MUST be written in TypeScript with `strict: true`; `any`, `@ts-ignore`,
  and non-null assertions (`!`) are forbidden except with an inline comment
  explaining why and a linked issue.
- Every module MUST pass ESLint + Prettier on pre-commit; CI MUST fail on lint
  errors or formatting drift.
- Components MUST be single-responsibility and ≤ 200 lines; files exceeding the
  limit MUST be decomposed before merge.
- Public functions, hooks, and exported components MUST have JSDoc describing
  intent, params, and return shape.
- Dead code, commented-out blocks, and `console.log` statements MUST NOT reach
  `main`.
- Dependencies MUST be justified in the PR description; adding a library
  > 30 KB gzipped requires explicit approval.

**Rationale**: Strict typing and small modules turn whole classes of runtime
bugs into compile-time errors and keep the codebase navigable as it grows.

### II. Testing Standards (NON-NEGOTIABLE)

- Test-first is REQUIRED for all business logic, hooks, and utilities: write a
  failing test, see it fail, then implement.
- Coverage thresholds MUST be enforced in CI: ≥ 80% statements, ≥ 75% branches,
  100% on auth, payments, and form validation paths.
- Every UI component MUST have at least: (1) a render smoke test, (2) one
  user-interaction test using Testing Library, and (3) an accessibility
  assertion (`axe` or `jest-axe`).
- Critical user journeys (auth, checkout, primary CRUD flow) MUST have
  end-to-end tests in Playwright or Cypress that run on every PR.
- Tests MUST be deterministic — no flaky retries, no `sleep`, no live network
  calls. Use MSW or equivalent for API mocking.
- A failing test in CI is a hard block on merge; skipping (`.skip`, `.only`)
  MUST NOT exist on `main`.

**Rationale**: A trustworthy test suite is the only thing that lets the team
move fast without breaking users.

### III. User Experience Consistency

- A single design-token source (colors, spacing, typography, radii, shadows,
  motion) MUST be the only origin of style values; raw hex codes and magic
  pixel values in components are forbidden.
- All interactive elements MUST come from a shared component library (Button,
  Input, Modal, etc.); one-off variants MUST be added to the library, not
  inlined.
- WCAG 2.1 AA is the minimum accessibility bar: keyboard navigation, visible
  focus rings, semantic HTML, ARIA only when semantics are insufficient, and
  4.5:1 contrast for body text.
- Every async UI state MUST handle four cases explicitly: idle, loading, empty,
  error. "Just spinner" is not acceptable for empty or error.
- Forms MUST provide inline validation, preserve user input on error, announce
  errors to assistive tech, and disable submit only after attempted submission.
- Copy MUST follow the project voice guide; user-facing strings MUST be
  centralized for future i18n (no hard-coded text in JSX).
- Responsive behavior MUST be verified at three breakpoints minimum
  (mobile ≤ 480px, tablet ~768px, desktop ≥ 1024px) before merge.

**Rationale**: Consistency is what makes an interface feel like one product
instead of a collection of screens, and it is the cheapest accessibility win
available.

### IV. Performance Requirements

- Production builds MUST meet Core Web Vitals on a mid-tier mobile device on
  4G: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- Initial JS bundle for the landing route MUST stay ≤ 170 KB gzipped; routes
  MUST be code-split and non-critical components lazy-loaded.
- Images MUST be served in modern formats (AVIF/WebP), responsive (`srcset`),
  and lazy-loaded below the fold; layout dimensions MUST be reserved to prevent
  CLS.
- Every list rendering > 50 items MUST be virtualized.
- Network requests MUST be deduplicated and cached via the chosen data layer
  (e.g., React Query / SWR); waterfalls of dependent fetches MUST be flattened
  or parallelized.
- A Lighthouse CI check MUST run on each PR; regressions of > 5 points on
  Performance or Accessibility block the merge.
- Re-render audits: components MUST NOT re-render on unrelated state changes —
  verify with React DevTools Profiler for any component in a hot path.

**Rationale**: Performance is a feature; users abandon slow apps before they
ever see the rest of the work.

### V. Spec-Driven Discipline

- `spec.md` MUST stay technology-agnostic (what & why); `plan.md` owns all
  technical decisions (how). Tech terms in `spec.md` block the merge.
- Every feature MUST be traceable: spec → plan → tasks → PR → tests. PRs MUST
  link the originating spec.
- Constitution amendments require a PR that bumps the version (semver: MAJOR
  for breaking principles, MINOR for new principle, PATCH for clarifications)
  and updates affected templates.

**Rationale**: The constitution only works if the workflow respects its
boundaries.

## Governance

- This constitution supersedes ad-hoc conventions. Conflicts are resolved in
  favor of the constitution.
- Exceptions MUST be documented in the relevant `plan.md` under "Complexity
  Tracking" with justification and an expiry date.
- All PRs MUST include a "Constitution Check" confirming the five principles
  were considered; reviewers MUST reject PRs that silently violate a MUST
  clause.
- The constitution is reviewed quarterly; principles that no longer reflect
  reality MUST be amended rather than ignored.

**Version**: 1.0.0 | **Ratified**: 2026-05-07 | **Last Amended**: 2026-05-07
