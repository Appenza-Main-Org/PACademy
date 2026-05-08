# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify the plan against `.specify/memory/constitution.md` v1.1.0. Each gate is a yes/no the plan author MUST answer before proceeding.

- **I. Code Quality & Maintainability** — Plan stays in TypeScript `strict: true` (no `any`, `@ts-ignore`, non-null `!`; `@ts-expect-error` only with reason + linked issue). Components are single-responsibility, soft target ≤ 150 lines / hard ceiling ≤ 200. Data fetching uses TanStack Query — `useEffect` for data is forbidden. Named exports only (default exports forbidden); a feature's public surface is its `index.ts` barrel. Public functions / hooks / exported components carry JSDoc. New dependencies are listed with gzipped size and a justification; anything > 30 KB requires explicit approval.
- **II. Testing Standards (NON-NEGOTIABLE)** — Plan commits to test-first for business logic, hooks, and utilities. Every new UI component has a smoke + interaction + a11y test planned. Critical user journeys are covered by Playwright/Cypress E2E running on every PR. Snapshot tests are supplemental only — never the only assertion. No live network calls — MSW or equivalent. Coverage budget enforced in CI: ≥ 80% statements, ≥ 75% branches, 100% on auth / payments / form-validation paths. Flake-quarantine policy: any E2E that flakes 2× in 7 days is quarantined within 24h, fixed within 5 working days, or removed. No `.skip` / `.only` reaches `main`. Pre-commit hook runs the test subset for changed files.
- **III. UX Consistency** — Plan consumes design tokens only (no raw hex / magic px / inline motion durations). Per-app surfaces consume `var(--accent-*)` only; hardcoded brand colors (`--teal-*`, `--gold-*`, etc.) are forbidden — `data-app="<key>"` on the shell is the single switch. Interactive elements come from the shared component library; one-off variants are added to the library, not inlined. WCAG 2.1 AA (keyboard nav, visible focus, semantic HTML, 4.5:1 contrast). **RTL is mandatory**: logical properties only (`text-start` / `text-end`, `ms-*` / `me-*`, `ps-*` / `pe-*`); physical properties (`text-left`, `ml-*`, `pl-*`) are forbidden. Direction-aware icons flip via `rtl:rotate-180` or `rtl:scale-x-[-1]`. All four async states (idle / loading / empty / error) are designed before implementation. Motion respects `prefers-reduced-motion: reduce`. User-facing strings are centralized for i18n. Responsive verified at ≤ 480px / ~768px / ≥ 1024px.
- **IV. Performance Requirements** — Plan respects bundle budgets (landing route ≤ 170 KB gzipped, every other route ≤ 250 KB gzipped incremental) and Core Web Vitals targets (LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1) on a mid-tier mobile device on 4G. Routes are code-split and lazy-loaded behind Suspense boundaries with skeletons sized to prevent CLS. Web fonts use `font-display: swap` (or `optional`) with `preconnect`. Images are AVIF/WebP, responsive, lazy-loaded below the fold, with explicit `width` / `height`. Lists > 50 items are virtualized. Network calls are deduplicated and cached via the data layer (e.g., TanStack Query). Lighthouse CI gate is wired and a > 5-point regression on Performance or Accessibility blocks merge. `useMemo` / `useCallback` are added only when a measurable benefit is verified with the Profiler — never cargo-culted.
- **V. Spec-Driven Discipline** — `spec.md` stays tech-agnostic (tech terms there block merge); all technical decisions live in this plan. Traceability spec → plan → tasks → PR → tests is preserved; the PR will link the originating spec.

Violations MUST be recorded in **Complexity Tracking** below with justification and an expiry date. Reviewers reject silent violations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
