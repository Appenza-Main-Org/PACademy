# CLAUDE_CODE_BRIEF.md — How Claude Code Should Approach This Project

> **This is the entry-point document for Claude Code.** Read this first, then read `DESIGN_SYSTEM.md` and `KARASA_GAPS.md` in that order. After that, read the existing `CLAUDE.md` for codebase context.

---

## 1. The mission

You are the senior frontend engineer on **منظومة القبول · أكاديمية الشرطة** (Police Academy Admissions Platform) — a production-grade React frontend for the Egyptian Ministry of Interior's Police Academy admissions platform. The existing codebase is a strong scaffold (12 routes, 11 RBAC roles, 9 connected applications, all wired to a typed mock service layer). It is NOT, however, complete. It is a skeleton with placeholder UIs.

Your job is to take this skeleton and deliver:

1. **A new visual language** — the **"Arabic Heritage Modern"** design system specified in `DESIGN_SYSTEM.md`. Every screen, every component, every token gets refreshed.
2. **Every missing feature from the كرّاسة** (the 108-page tender document, referred to throughout this project as "the karasa"). Specific gaps per app are itemized in `KARASA_GAPS.md`.

The output is a frontend that, at the end of the work, gives an external auditor confidence that the team has interpreted the entire scope correctly and can integrate a backend in a clean handoff.

> Note on language: All product UI is Arabic (RTL). All technical documentation, code comments, commit messages, and PR descriptions are English. Mix freely in chat with the user — they read both fluently. **Never invent or machine-translate Arabic UI copy** — pull it verbatim from the karasa, the existing repo, or `_legacy/`.

---

## 2. Critical operating principles

### 2.1 Document order is mandatory
Read in this order. Do not skip:
1. **`DESIGN_SYSTEM.md`** — the visual + interaction contract
2. **`KARASA_GAPS.md`** — the feature contract
3. **`CLAUDE.md`** (existing) — codebase architecture, RBAC, mock data shape
4. **`README.md`** — high-level overview
5. The relevant feature's `index.ts` barrel before touching any file inside it

### 2.2 The two source documents are the constitution
- If `DESIGN_SYSTEM.md` says one thing and `_legacy/styles/` says another, **the design system wins.** The legacy styles are deprecated reference only; do not preserve them.
- If `KARASA_GAPS.md` says a screen needs fields A, B, C, and the existing screen has D, E, F — replace what's there. Do not merge for the sake of merging. The existing screens are placeholder UIs.
- If `CLAUDE.md` (the existing one) conflicts with `DESIGN_SYSTEM.md` or `KARASA_GAPS.md`, the new docs win. Update `CLAUDE.md` at the end of the work.

### 2.3 Do not break Clean Architecture
The existing repo enforces strict Clean Arch. **`shared/` cannot import from `features/`.** Cross-feature imports go through the source feature's `index.ts` barrel only. Every new component you add must respect this. Don't introduce a regression here.

### 2.4 Respect the mock service contract
Every existing service file has a JSDoc `INTEGRATION CONTRACT` header documenting the future REST endpoints. When you add new methods or new services, you MUST add the same kind of header. The shape of the contract is what allows the future backend to slot in without touching the rest of the codebase.

### 2.5 Build deterministically
Mock data is LCG-seeded with `seed=42`. When you add new mock data:
- Use the existing seed mechanism (`reseed`, `rng()` from `src/shared/mock-data/seed.ts`)
- Generate at module load
- Do NOT use `Math.random()` or `Date.now()` outside of that
- Goal: every render produces identical data for screenshot/snapshot testing later

### 2.6 No backend, ever, in this work
The backend is a separate work-stream. Every "fetch from API" instinct is wrong here. The right answer is always: extend the mock service, add a query hook, render with TanStack Query. The mock service simulates latency (300–800ms) so loading states are exercised properly.

### 2.7 Arabic content is sacred
- Never retype Arabic copy. Copy-paste from `_legacy/`, this repo, or the karasa directly.
- Never machine-translate English UI copy into Arabic. Use the exact wording from the karasa.
- When the karasa uses "متقدم" (applicant) do not write "مرشح" (candidate) or "طالب" (student) elsewhere. Vocabulary consistency is part of the contract.

### 2.8 Run typecheck after every non-trivial edit
The repo has zero TypeScript errors today. **Keep it that way.** Run `npm run typecheck` after every meaningful change. A green typecheck is a precondition for moving on.

### 2.9 Verify UI changes by running the dev server
Do not claim a screen "works" without opening it in the browser. `npm run dev` and click through. Take screenshots if the user requests them.

---

## 3. Execution plan — Sprint-by-sprint

The work is divided into **11 sprints** detailed in `KARASA_GAPS.md` §12. Execute them in order. Each sprint is a separate PR (or commit batch if working in one branch).

### Sprint 0 (FIRST — foundation, no features) — Design system
1. Replace `src/styles/tokens.css` entirely with the spec in `DESIGN_SYSTEM.md` §2.
2. Replace `src/styles/base.css` to apply the new font stack and bg.
3. Delete `src/styles/components.css` (deprecated). Move any styles still needed into Tailwind utilities or component-level CSS modules.
4. Replace `src/styles/apps.css` to only carry `[data-app="X"]` overrides for the 9 apps per `DESIGN_SYSTEM.md` §2.2.
5. Add `src/styles/print.css` and `src/styles/motifs.css`.
6. Update `tailwind.config.ts` so its `theme.extend` mirrors `DESIGN_SYSTEM.md` §2 exactly.
7. Update `index.html` to load IBM Plex Sans Arabic, Tajawal, Inter, JetBrains Mono.
8. Build all new shared primitives:
   - `Pattern.tsx`, `CornerFlourish.tsx`, `KhayameyaStripe.tsx`
   - `DataTable.tsx`, `Modal.tsx`, `Drawer.tsx`, `Wizard.tsx`
   - `FileUpload.tsx`, `DateRangePicker.tsx`, `Combobox.tsx`
   - `Heatmap.tsx`, `Sparkline.tsx`, `Gauge.tsx`, `Funnel.tsx`
   - `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`
   - `PrintLayout.tsx`
   - `icons/` folder with the custom Egyptian-context icons
9. Refresh `AppShell.tsx`, `Sidebar.tsx`, `LoginPage.tsx`, `HubPage.tsx` to use the new tokens and primitives.
10. Verify: typecheck passes, dev server boots, every existing route renders without console errors. Screenshots showcase the new visual language.

**Sprint 0 acceptance:** Running `npm run dev` and visiting `/` shows the new Arabic Heritage Modern aesthetic on the Hub. Login is redesigned. `data-app="medical"` correctly tints the Medical app's accent. Zero TS errors.

### Sprint 1 — Admin app (per `KARASA_GAPS.md` §1)
Highest stakeholder visibility. Build:
- Reference data CRUD (8 entities)
- Admission rules editor (versioned)
- Cycles management
- Reports with real PDF/Excel/Word exports (use `react-pdf`, `xlsx`, `docx` libraries)
- Heatmap-enriched Dashboard

### Sprint 2 — Applicant Portal (per `KARASA_GAPS.md` §2)
Largest single chunk of work. Restructure `/applicant` into the 11-stage wizard. One stage per file under `features/applicant-portal/pages/Stage<N>Page.tsx`. Each stage has its own zod schema in `features/applicant-portal/schemas/`.

### Sprints 3–9 (per `KARASA_GAPS.md` §12)
Committees → Medical → Investigations → Board → Exams → Biometric/Barcode → Cross-cutting (search, notifications, profile, help, architecture refresh).

### Sprint 10 — Hardening
- Vitest + Testing Library: at minimum, unit tests for every zod schema and every shared primitive.
- Playwright: smoke E2E for each app's primary flow.
- ESLint with `eslint-plugin-boundaries` to make the Clean Arch rule machine-enforced.
- Husky pre-commit running typecheck + lint + Vitest.
- Accessibility audit using `axe-core` — fix every flagged issue.
- Print stylesheets polished.
- Update `CLAUDE.md` and `README.md` to reflect the new state.

---

## 4. How to start a session

When you (Claude Code) sit down at a fresh session, do this sequence:

```
1. Read CLAUDE_CODE_BRIEF.md (this file)        — refreshes mission
2. Read DESIGN_SYSTEM.md                        — refreshes visual contract
3. Read KARASA_GAPS.md                          — refreshes feature scope
4. Read CLAUDE.md (existing)                    — refreshes codebase architecture
5. Run: git status && git log --oneline -10     — refreshes where we are
6. Run: npm run typecheck                       — verifies a clean baseline
7. Identify the current sprint from §3 above and from git log
8. Identify the next concrete task within that sprint
9. Write a 5-line plan to the user before touching code
10. Execute, test, commit
```

If the user gives you a specific sprint or task, skip steps 7–8 and go to step 9.

---

## 5. Definition of done — per task

A task is "done" only when ALL of the following are true:

- ☐ Typecheck passes (`npm run typecheck` returns 0)
- ☐ Build passes (`npm run build` returns 0)
- ☐ Screen visually conforms to `DESIGN_SYSTEM.md` (compare against a sibling screen if unsure)
- ☐ All 5 states are designed: default, hover, active, focus, disabled
- ☐ Loading + empty + error states present
- ☐ Keyboard navigation works (Tab order matches visual order, Esc closes overlays)
- ☐ Visible focus ring on every interactive
- ☐ RTL using logical properties (`ms-*`, `pe-*`, `text-start`, etc.)
- ☐ Reduced-motion respected
- ☐ Mock service has the new methods + `INTEGRATION CONTRACT` JSDoc
- ☐ Feature's barrel `index.ts` re-exports the new public components only
- ☐ No `any`, no `// @ts-ignore` (use `// @ts-expect-error` with a reason if truly needed)
- ☐ No business logic in pages — pages are dumb composers
- ☐ Components > 150 lines split into smaller pieces
- ☐ Arabic copy is exact (cross-checked against `_legacy/` or the karasa)

If any item is unchecked, the task is not done. Communicate this honestly.

---

## 6. Communication contract with the user

- Before any non-trivial work, write a **plan**. 5 lines max. The user approves before you proceed.
- Before destructive work (deleting files, mass refactors), ask explicitly.
- After each task, summarize **what changed**, **what's now possible**, and **what's still pending**.
- If you discover a gap in `DESIGN_SYSTEM.md` or `KARASA_GAPS.md` that isn't covered, say so and propose how to update those files. **Update those files** before writing the code that depends on the gap.
- If the karasa contradicts itself or is unclear (e.g., a field listed in one section but not another), **flag it.** Do not silently invent.
- The user reads English and Arabic fluently. Use English for all technical discussion. Quote Arabic UI strings verbatim from the karasa when discussing them. Mix where natural.

---

## 7. Anti-patterns to avoid

These are the failure modes that will get you reverted:

- ❌ **Writing CSS that's not token-based.** Hex codes belong in `tokens.css`, not in components.
- ❌ **Hardcoding numerical px / rem outside the spacing scale.** Use `--space-*`.
- ❌ **Importing across features.** Use barrels.
- ❌ **Inventing new colors.** If a need arises, add to the spec first, then to tokens, then use.
- ❌ **Coupling to backend specifics that don't exist.** Do not write code like `if (response.status === 'AWAITING_MOIPASS_VERIFY')` — define the type union, mock the service to return one of those values, and switch on the union.
- ❌ **Building ~70%-complete screens.** Ship the screen with all states (incl. loading, empty, error) or don't merge it.
- ❌ **Using `any`.** Narrow with `unknown` and type guards.
- ❌ **Bypassing react-hook-form for a one-off form.** Every form goes through RHF + zod.
- ❌ **Adding a new chart library.** Inline SVG only, matching existing patterns.
- ❌ **Disabling lint rules to pass CI.** Fix the underlying issue.
- ❌ **Calling external APIs from the frontend.** All data goes through the mock service layer.

---

## 8. The bigger picture

This product will be used by:
- **Tens of thousands of teenagers** registering for one of the most prestigious institutions in Egypt — for many of them, this will be the most consequential digital experience of their lives so far. The applicant portal must be calm, clear, and respectful.
- **Hundreds of officers and committee members** running operations day in and day out. Speed, density, and keyboard-friendliness matter as much as visual polish.
- **The ministry leadership** who will judge whether this is a credible system. The design system, the print outputs, the report templates — these are what they'll see in their hands.
- **An external auditor** who will review the source code and ask whether the team understood the scope. Code clarity, contract documentation, and the fidelity of the implementation to the karasa all factor in.

You are building one product for four very different audiences. Every decision should serve all four.

---

*This brief is the first document Claude Code should read in any session. When in doubt, return to this file and re-read.*
