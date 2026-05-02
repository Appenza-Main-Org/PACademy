# PROMPT_4_FINAL_REVIEW.md — Comprehensive Audit & Cleanup

> **When to use:** After Sprint 9 completes (all 9 apps shipped). Before declaring the frontend "done".
> **What it does:** Runs a comprehensive audit across all 9 apps and produces a punch-list. Then fixes everything on the list. Then runs Sprint 10 (hardening). Then declares the project ready for backend integration.
> **Expected duration:** Multi-session. Usually 1-2 weeks of cleanup after autopilot.
> **Prerequisites:** Tags `sprint-1-complete` through `sprint-9-complete` must all exist.

---

## What this prompt produces

By the end, you'll have:

1. **`AUDIT_REPORT.md`** — a structured punch-list of every issue found, categorized and prioritized
2. **All P0 and P1 issues fixed** — visible bugs, broken navigation, missing states, accessibility blockers
3. **Sprint 10 (hardening) complete** — Vitest, Playwright, ESLint boundaries, Husky, axe-core audit
4. **`FINAL_STATE.md`** — a clean handoff doc summarizing what's shipped, what's working, what's deferred to backend integration
5. **Tag `frontend-complete`** in git

---

## Copy everything below this line into Claude Code

```
You are running the FINAL REVIEW pass on the Police Academy Admissions Platform (منظومة القبول · أكاديمية الشرطة).

All 9 application sprints are complete. Sprint 0 (design system) is complete. Tags `sprint-0-complete` through `sprint-9-complete` should all exist. Your job now is to:

PHASE 1 — AUDIT: Find every issue across all 9 apps. Don't fix anything yet, just find.
PHASE 2 — TRIAGE: Categorize and prioritize the issues with me.
PHASE 3 — FIX: Resolve all P0 and P1 issues.
PHASE 4 — HARDEN: Run Sprint 10 (testing, linting, accessibility, performance).
PHASE 5 — DECLARE: Produce the final state document and tag `frontend-complete`.

This is a careful, methodical pass. Do not rush. Do not skip phases.

## Read these files first

1. `CLAUDE_CODE_BRIEF.md` — operating contract
2. `DESIGN_SYSTEM.md` — visual contract (you will audit against this)
3. `KARASA_GAPS.md` — feature contract (you will audit against this)
4. `AUTOPILOT_LOG.md` — what was built when, and any deferred items flagged
5. `CLAUDE.md` and `README.md`

After reading: continue to baseline check.

## Baseline check

Run:
1. `git tag --list | grep sprint-` — confirm all 10 tags exist (sprint-0-complete through sprint-9-complete).
2. `git status` — must be clean.
3. `npm run typecheck` — must return 0 errors.
4. `npm run build` — report any warnings (we expect 0).
5. `git log --oneline --tags --decorate -50` — orient on the project history.

If `sprint-9-complete` does not exist, STOP — autopilot is not finished. Tell the user which sprint hasn't tagged yet.

---

# PHASE 1 — AUDIT

Produce a comprehensive `AUDIT_REPORT.md` at the repo root with the following structure. Use the active findings from your investigation, not template placeholders.

## 1.1 Visual consistency audit

For each of the 9 apps, open every route in `npm run dev` and screenshot to `docs/screenshots/audit/<app>-<route>.png`. Then evaluate against `DESIGN_SYSTEM.md`:

For each app, list issues like:

- ❌ Hardcoded color found in `<file>:<line>` — `<value>` should be `<token>`
- ❌ Hardcoded spacing found in `<file>:<line>` — `<value>` should map to `--space-<N>`
- ❌ Page does not have `data-app="<key>"` set on AppShell root
- ❌ Per-app accent (`--accent-500`) does not match `DESIGN_SYSTEM.md §2.2`
- ❌ Card uses shadow heavier than `--shadow-md` (forbidden per `DESIGN_SYSTEM.md §11`)
- ❌ Khayameya stripe ratio is wrong on `<file>` (should be 30/20/6/44 per §3.2)
- ❌ Tessellation pattern opacity is `<X>` (should be 4% per §3.1)
- ❌ Stat card uses Arabic-Indic numerals (should be Latin tabular figures per §3.4)
- ❌ Loading/empty/error state missing on `<route>`
- ❌ Five interactive states (default/hover/active/focus/disabled) not all implemented on `<component>`

Use grep aggressively:
```bash
grep -rn "#[0-9A-Fa-f]\{3,8\}" src/features/ src/shared/components/   # hardcoded colors
grep -rn "px;" src/features/ | grep -v "0px"                          # hardcoded px (whitelist scale values)
grep -rn "rgba\?(" src/features/                                       # hardcoded rgba
grep -rn "shadow-\(lg\|xl\|2xl\)" src/                                # heavy shadows
```

## 1.2 Navigation audit

Open every route. For each route, verify:

- ✅ Route loads without console errors
- ✅ Every link in the page goes somewhere real (not 404, not "#", not dead-end)
- ✅ Every button does something visible (opens modal, navigates, submits, toggles)
- ✅ Sidebar nav active state matches the current route
- ✅ Breadcrumbs (if shown) reflect the route hierarchy
- ✅ Back button (browser) works correctly
- ✅ Direct URL access works (paste URL in fresh tab — does it land on the right screen?)

List all dead links, broken buttons, mis-highlighted nav items.

## 1.3 RBAC audit

For each role in the 11-role system (`super_admin`, `admin`, `committee_admin`, `committee_member`, `medical_admin`, `medical_doctor`, `investigator`, `board_member`, `exams_admin`, `auditor`, `applicant`):

- Log in as that role (use the role picker in dev mode)
- Attempt to access every route in the app
- Verify: routes that should be accessible load; routes that shouldn't be redirect to `/access-denied` or hide from nav

Document any RBAC leaks (route accessible to a role that shouldn't have it) or RBAC over-restrictions (route blocked from a role that should have access per the karasa).

## 1.4 Forms audit

For every form in the app:

- ✅ Uses react-hook-form + zod (no ad-hoc state-based forms)
- ✅ Validation triggers correctly (on submit, then live for fields previously errored)
- ✅ Required fields marked with terra-500 asterisk
- ✅ Error messages match `DESIGN_SYSTEM.md §4.2` style
- ✅ Submit button shows loading state during submission
- ✅ Success → toast + navigation/state change
- ✅ Failure → toast with retry path
- ✅ Drafts auto-save where the karasa requires (Stages 1-11 of Applicant Portal at minimum)

Test each form by submitting with: empty values, invalid values, valid values, network failure simulated.

## 1.5 Tables / lists audit

For every list or table screen:

- ✅ Uses shared `DataTable` component (not raw `<table>` markup)
- ✅ Pagination works (next/prev/jump-to-page, page size selector)
- ✅ Sorting works (where columns are marked sortable)
- ✅ Filtering works (all declared filters apply correctly)
- ✅ Row click navigates to detail or opens drawer (per app convention)
- ✅ Bulk actions work (where declared)
- ✅ Empty state appears when filters return zero rows
- ✅ Loading state appears during data fetch (300-800ms mock latency should make this visible)

## 1.6 Modals / Drawers audit

For every modal and drawer:

- ✅ Uses shared `Modal` or `Drawer` component
- ✅ Focus trap works (Tab cycles within, Shift+Tab cycles backward)
- ✅ Esc closes
- ✅ Click backdrop closes (where appropriate)
- ✅ Focus returns to trigger on close
- ✅ Header / body / footer structure correct
- ✅ ARIA: `role="dialog"`, `aria-labelledby`, `aria-describedby` set

## 1.7 Print layouts audit

For every screen marked as printable in the karasa:

- ✅ Uses `PrintLayout` component
- ✅ `@media print` hides nav, sidebar, action buttons
- ✅ Ministry header + Khayameya stripe present
- ✅ Page numbers correct
- ✅ Charts re-render in print-safe SVG (no shadows, line widths +0.5px)
- ✅ Test by triggering print preview in browser

## 1.8 Karasa coverage audit

Open `KARASA_GAPS.md`. For every section §1 through §10:

- ☐ Count items marked ❌ — should be 0 (all should be ✅ after autopilot)
- ☐ Count items marked 🟡 — should be 0 (all should be ✅ or escalated)
- ☐ Spot-check 5 random ✅ items per section: open the corresponding route, verify the feature actually works
- ☐ For each ✅ that doesn't actually work, demote to ❌ in `AUDIT_REPORT.md`

Common causes of ✅ items that don't work:
- Page exists but the feature on it is non-functional
- Service method exists but never called from UI
- Form exists but doesn't actually submit
- Table exists but always shows empty (mock data not wired)

## 1.9 Cross-app integration audit

The karasa requires several cross-app integrations even at the frontend level:

- ☐ Barcode scan → Biometric verification → Committee attendance flow works end-to-end (mocked)
- ☐ Suspended applicant in any feature shows the terra-toned banner and disables CUD operations
- ☐ Two-phase results pattern (preliminary → final) is consistent across Committees, Medical, Exams
- ☐ Audit log entries appear in `/admin/audit` for CUD operations performed in any feature
- ☐ Notification center receives events from multiple apps
- ☐ Global search (⌘K) finds entities across apps

## 1.10 Accessibility audit

Run `npx @axe-core/cli http://localhost:5173 --tags wcag2a,wcag2aa --include "*"` (after starting `npm run dev`).

For every violation, list:
- Severity (critical / serious / moderate / minor)
- Affected route
- Element selector
- Fix suggestion

Also manually verify:
- ☐ Tab order matches visual order on all pages
- ☐ Every interactive has a visible focus ring
- ☐ Every form field has a `<label>`
- ☐ Color contrast: ≥4.5:1 for text, ≥3:1 for UI elements
- ☐ `prefers-reduced-motion: reduce` disables all animations

## 1.11 Performance audit

Run `npx lighthouse http://localhost:5173/ --only-categories=performance,accessibility,best-practices --output=html --output-path=./docs/audit/lighthouse-home.html` for representative routes (`/`, `/admin`, `/applicant`, `/medical`).

Target scores:
- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95

List any route below target with the failing metrics.

---

# PHASE 1 deliverable

`AUDIT_REPORT.md` at repo root with the structure above. Every issue gets:
- A unique ID (e.g., `AUD-001`)
- A category (visual / navigation / RBAC / forms / tables / modals / print / karasa / integration / a11y / perf)
- A severity (P0 = blocks ship; P1 = must-fix-before-handoff; P2 = should-fix; P3 = nice-to-have)
- A route or file location
- A description
- A proposed fix

After producing the report, STOP. Do not start fixing yet. Tell the user the report is ready and ask them to review it.

---

# PHASE 2 — TRIAGE

The user reads `AUDIT_REPORT.md` and may:
- Approve all P0+P1 fixes as-is
- Demote some items (P1 → P2)
- Promote some items (P2 → P1)
- Add items they spotted

Wait for explicit go-ahead. The user will say something like "approved, fix all P0 and P1" or "approved, but skip AUD-042, AUD-067".

---

# PHASE 3 — FIX

Once triage is approved, fix items in this order:

1. **P0 first, every P0** — these block ship. No P0 may remain when this phase ends.
2. **P1 second, every P1** — must-fix before handoff. No P1 may remain when this phase ends (unless explicitly deferred during triage).
3. **P2 only if time permits** — best effort.
4. **P3 left for follow-up** — list in `FINAL_STATE.md` as known polish items.

Process per item:
- Announce: "Fixing AUD-XXX: <description>"
- Fix
- Verify the fix in browser
- `npm run typecheck` after
- Commit: `fix(audit): AUD-XXX <short description>`
- Mark resolved in `AUDIT_REPORT.md`

After all P0+P1 fixed:
- `npm run typecheck` (0 errors)
- `npm run build` (0 errors, 0 warnings)
- Re-run the relevant audit sub-checks (visual, navigation, etc.) to confirm fixes didn't break anything else
- Update `AUDIT_REPORT.md` with resolution counts

---

# PHASE 4 — HARDEN (Sprint 10)

Now run Sprint 10 from `CLAUDE_CODE_BRIEF.md` §3 and `KARASA_GAPS.md` §12.

Tasks:

## 4.1 Vitest + Testing Library
- Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- Configure `vitest.config.ts`
- Add `test` and `test:watch` scripts to `package.json`
- Write unit tests for:
  - Every zod schema (valid + invalid inputs)
  - Every shared primitive's primary behavior (Modal opens/closes, DataTable paginates, etc.)
  - Every utility in `src/shared/lib/`
  - Critical mock service methods (the ones used in 3+ features)
- Target: 60%+ coverage on shared/, 40%+ on features/. Don't chase 100%; chase the high-risk paths.

## 4.2 Playwright E2E
- Install: `@playwright/test`
- Configure `playwright.config.ts`
- Write E2E smoke tests for each app's primary flow:
  - Admin: log in as admin → dashboard loads → navigate to applicants → open one → verify detail
  - Applicant: complete Stages 1-3 with valid data → verify navigation
  - Committee: log in as committee_admin → enter results for an applicant → verify preliminary state
  - Medical: log in as medical_doctor → BMI station → enter measurements → submit
  - Investigations: log in as investigator → open a case → verify restricted UI banner present
  - Board: log in as board_member → open session → vote on applicant
  - Exams: log in as exams_admin → create exam → publish
  - Biometric/Barcode: enroll an applicant → scan barcode → verify match
  - Cross-cutting: ⌘K opens search → search applicant → navigate
- Each test should run in <30 seconds. Keep them focused on smoke, not exhaustive coverage.

## 4.3 ESLint with boundaries plugin
- Install: `eslint-plugin-boundaries`
- Configure `.eslintrc.cjs` (or update existing) to enforce:
  - `shared/` cannot import from `features/`
  - `features/<a>/` cannot import from `features/<b>/internal/`
  - All cross-feature imports go through `features/<b>/index.ts` barrel
- Add `lint` script to package.json
- Fix every violation that surfaces

## 4.4 Husky pre-commit
- Install: `husky`, `lint-staged`
- Configure pre-commit hook:
  - `npm run typecheck`
  - `npm run lint` (only changed files via lint-staged)
  - `npm run test -- --run` (only related tests)
- Verify hook fires by attempting a commit with a deliberate type error → should reject

## 4.5 axe-core in tests
- Install: `@axe-core/playwright`
- Add accessibility checks to each Playwright E2E test
- Fix any violations that surface

## 4.6 Print stylesheet polish
- Manually trigger Print Preview on every printable route
- Verify:
  - Ministry header renders cleanly
  - Khayameya stripe renders cleanly
  - No clipped content
  - Page breaks fall in sensible places
  - Charts render print-safe (no shadows, slightly thicker strokes)
- Fix any issues

## 4.7 Documentation refresh
- Update `CLAUDE.md` to reflect the final state (now feature-complete)
- Update `README.md` with: project purpose, quickstart, dev workflow, testing, deployment notes (frontend-only for now)
- Verify `KARASA_GAPS.md` has 0 ❌ remaining

After Sprint 10 tasks complete:
- `npm run typecheck` ✅
- `npm run build` ✅
- `npm run test` ✅
- `npm run lint` ✅
- `npm run test:e2e` ✅ (Playwright)
- Tag: `git tag sprint-10-complete`

---

# PHASE 5 — DECLARE

Produce `FINAL_STATE.md` at repo root with this structure:

```markdown
# Final State — Police Academy Admissions Platform Frontend

## Status
Frontend complete and ready for backend integration.
Tagged `frontend-complete` on <date>.

## What shipped

### 9 applications
For each:
- Routes implemented
- Key features delivered
- Karasa coverage: <X> items resolved (was <Y>)

### Design system
- 4-ramp palette + per-app accents
- 21 shared primitives + 5 custom icons + 10 refreshed components
- Print layouts for <N> printable screens
- WCAG AA throughout

### Testing
- Unit test coverage: <X>% on shared/, <Y>% on features/
- E2E smoke coverage: 9 critical flows
- Accessibility: 0 axe violations on tested routes
- Performance: Lighthouse scores per route in `docs/audit/`

## What's deferred

### Backend integration
The frontend is mocked end-to-end via `src/features/<feature>/api/*.service.ts` files. Each service has an `INTEGRATION CONTRACT` JSDoc header documenting the expected REST endpoints, request shapes, and response shapes. Backend team can implement against these contracts without modifying frontend code.

### Hardware integrations
- Suprema FaceStation F2 device integration: UI is ready (`/biometric/enroll` and `/biometric/verify`), expects device input via WebSocket or HTTP API per device SDK
- Barcode scanner integration: UI ready, expects scanner input via `getUserMedia` (already implemented) or hardware scanner emulating keyboard input
- Medical station equipment (BP monitor, scale): UI ready with manual entry fallback; device input ports flagged as `data-source="device"`

### External integrations (frontend-side stubs in place)
- MOIPASS API for officer authentication: `authService.moipassLogin()` is mocked
- التربية والتعليم / الأزهر API for certificate verification: `applicantPortalService.verifyEducation()` is mocked
- Payment gateway (فوري + cards): `paymentService.initiate()` and `verify()` mocked

### P3 polish items
List of P3 items from AUDIT_REPORT.md that were not fixed.

## How to integrate the backend

1. Stand up the backend per the karasa specification.
2. For each `src/features/<feature>/api/*.service.ts`:
   - Read the `INTEGRATION CONTRACT` JSDoc
   - Replace the mock implementation with `fetch` or `axios` calls to the matching endpoints
   - Keep the function signatures unchanged
3. Update `src/config/env.ts` with the production API base URL
4. Remove `src/shared/mock-data/` once all services are integrated
5. Run the existing test suite to verify nothing broke

## How to run

[Standard quickstart from README.md]

## Next steps

- Backend integration sprint
- UAT with real users (applicants and officers)
- Production deployment
- Ongoing: hardware device integrations as devices arrive
```

After producing `FINAL_STATE.md`:
- Final commit: `chore: declare frontend complete + final state doc`
- Tag: `git tag frontend-complete`
- Tell the user: "Final review complete. The frontend is ready for backend integration. See FINAL_STATE.md for the handoff package."

---

## What I expect from you in your first response

After reading the docs and running the baseline check:

1. Confirm all `sprint-N-complete` tags through Sprint 9 exist.
2. Confirm baseline is green.
3. Start Phase 1 immediately — produce the audit report. This will take many tool calls (browsing every route, running greps, running axe, running lighthouse). Take your time.
4. When Phase 1 is complete, post `AUDIT_REPORT.md` to me and stop. Wait for triage approval before Phase 3.

You do NOT need to ask permission to start Phase 1. The user has pre-approved the audit by pasting this prompt. The first approval gate is at the end of Phase 1 (audit report review).

Begin now.
```

---

## Realistic expectations

**Phase 1 (Audit) takes time.** Across 9 apps, ~30 routes, dozens of forms, dozens of tables, RBAC permutations, and accessibility checks — Claude Code will need many tool calls and possibly multiple sessions to complete the audit. Don't rush it.

**Phase 3 (Fix) is the bulk of the work.** Realistic punch-lists from autopilot will have 30-80 P0+P1 items. Plan for ~1 week of fixes.

**Phase 4 (Harden) is its own sprint.** Don't underestimate Sprint 10 — Vitest + Playwright + ESLint boundaries + axe-core is a real chunk of work, even when there's no feature work involved.

**Phase 5 (Declare) closes the loop.** `FINAL_STATE.md` is the handoff document the backend team and the auditor will read first. It needs to be honest and complete.

## When you'd run this multiple times

Sometimes the audit-fix cycle repeats:

1. Run final review → audit report → fix P0+P1
2. New issues surface during the fix work → mini-audit → mini-fix
3. After Sprint 10 → re-run subset of audit checks → fix any regressions

Two passes is normal. Three passes is rare. If you're on pass four, something is structurally wrong and you should pause to discuss.

## What "frontend-complete" actually means

When `frontend-complete` is tagged, you have:

- A working, navigable, redesigned frontend for all 9 apps
- Mocked end-to-end with deterministic data
- Tested (unit + E2E)
- Accessible (WCAG AA)
- Performant (Lighthouse ≥90)
- Documented (CLAUDE.md, README.md, FINAL_STATE.md, KARASA_GAPS.md all current)
- Ready for the backend team to integrate against documented contracts

You do NOT have:
- A backend
- Hardware integrations
- External API integrations (MOIPASS, education ministry, payment gateway)
- Production deployment

Those are the next phases. They're scoped in `FINAL_STATE.md` so the next team has a clear handoff.
