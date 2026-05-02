# Prompt 3 — Sprints 1–9: Fill Gaps from the Karasa (Per-App)

> **When to use:** After Sprint 0 (design system) is complete and you've signed off. This prompt drives Sprints 1 through 9 — the per-app feature work.
> **What it does:** Walks Claude Code through one app at a time, building all missing screens per `KARASA_GAPS.md`.
> **Expected duration:** Each sprint is its own multi-session effort. Plan for 1–3 weeks per sprint depending on app complexity.

---

## How this prompt works

Unlike Prompt 2 (one big sprint), this prompt is **parameterized**. You'll fill in `<APP>` at the top each time you start a new app, then paste the rest verbatim.

The 9 apps map to sprints as follows (per `KARASA_GAPS.md` §12):

| Sprint | Value to use for `<APP>` | Karasa section ref |
|---|---|---|
| 1 | `Admin Portal` | KARASA_GAPS.md §1 |
| 2 | `Applicant Portal` | §2 |
| 3 | `Committees` | §3 |
| 4 | `Medical Commission` | §6 |
| 5 | `Investigations` | §5 |
| 6 | `Board / Secretariat` | §4 |
| 7 | `Question Bank & e-Exams` | §9 |
| 8 | `Biometric & Barcode` | §7 + §8 (run together) |
| 9 | `Cross-cutting` | §10 (Hub, Search, Notifications, Profile, Architecture) |

Order is intentional: Admin first (stakeholder demos), Applicant second (largest scope), then operational apps in order of cross-app dependencies.

---

## Copy everything below this line into Claude Code (after filling in `<APP>` and `<SECTION>`)

```
We are starting Sprint <SPRINT_NUMBER>: <APP>.

Sprint 0 (design system) is complete and signed off. The Arabic Heritage Modern tokens and shared primitives are live. Every screen we build in this sprint MUST use those tokens and primitives — no rolling our own.

## Source of truth for this sprint

- `KARASA_GAPS.md` <SECTION> — every screen, every field, every validation, every mock service method that this app needs. This is the contract.
- `DESIGN_SYSTEM.md` — visual + interaction contract. Do not deviate.
- `CLAUDE_CODE_BRIEF.md` — operating principles. Definition of Done in §5.
- `CLAUDE.md` — codebase architecture (RBAC, mock data, file layout, naming).
- The karasa page references like `[K§1-1 p.10]` cited in KARASA_GAPS.md point to the 108-page tender doc. If you need to verify a requirement, ask me to share the relevant pages.

## Operating sequence for this sprint

I want you to execute in this exact order. Do not skip steps.

### Step 1 — Re-read

Open `KARASA_GAPS.md` and read <SECTION> carefully. Every subsection (A, B, C, …). Build a mental map of:
- Which screens already exist (✅) — these may need polish but not creation
- Which screens are partial (🟡) — gaps within them
- Which screens don't exist yet (❌) — full creation
- The mock service methods that need to be added or extended

Then open the relevant feature folder under `src/features/` and inventory what's actually there. Reconcile the inventory with the gap list. If you find anything in the codebase that's NOT mentioned in KARASA_GAPS.md, flag it — either we add it to the gaps file or we delete it from the code.

### Step 2 — Produce a sprint plan

Write a structured plan covering:

1. **Inventory reconciliation** — what's in the code vs. what KARASA_GAPS.md says. List discrepancies.
2. **Mock data extensions** — what new entities or fields need to be added to `src/shared/mock-data/`. List the new types and the deterministic generation approach.
3. **Type additions** — what new domain types need to be added to `src/shared/types/domain.ts`. List them with one-line descriptions.
4. **Service additions** — what methods to add to existing services or what new services to create under `src/features/<feature>/api/`. For each, write the typed signature and a one-line `INTEGRATION CONTRACT` JSDoc preview.
5. **Routes** — what new routes to add to `src/config/routes.ts` and `src/routes.tsx`.
6. **Pages** — list of new page components to create under `src/features/<feature>/pages/`.
7. **Components** — list of new feature-local components under `src/features/<feature>/components/`. ONLY components specific to this feature; anything reusable across features goes through `shared/`.
8. **Schemas** — list of new zod schemas under `src/features/<feature>/schemas/`.
9. **Sequence** — the order in which you'll build the above, broken into named milestones (e.g., "Milestone 1: Reference Data CRUD", "Milestone 2: Admission Rules", etc.). Each milestone should be ~1 hour of work and end at a green typecheck.

Wait for my approval before you write any code.

### Step 3 — Build, milestone by milestone

For each milestone:

1. Announce the start of the milestone with a one-line summary of what you're about to do.
2. Build the pieces of that milestone in order: types → mock data → service → query hooks → schema → components → page.
3. Run `npm run typecheck` after each major file. Do not let the build go red.
4. Run `npm run dev` and visually verify the milestone's primary screen renders correctly. Take a screenshot.
5. Commit with a clear message: `feat(<app>): <milestone description>`.
6. Tell me the milestone is done with a 3-line summary: what was built, what's now possible, what's pending.

Do not move to the next milestone without my acknowledgment.

### Step 4 — End-of-sprint review

When all milestones are complete, run the Sprint Definition of Done checklist:

- ☐ Every screen marked ❌ in KARASA_GAPS.md <SECTION> now exists
- ☐ Every screen marked 🟡 has been completed
- ☐ Every required field per the karasa is in the corresponding form
- ☐ Every form validates via zod (no ad-hoc validation)
- ☐ Every form persists drafts where the karasa implies multi-session work
- ☐ Every list/table screen uses the shared `DataTable` component (no ad-hoc table markup)
- ☐ Every modal/drawer uses the shared `Modal`/`Drawer` components
- ☐ Every loading/empty/error state uses the shared state components
- ☐ All new services have `INTEGRATION CONTRACT` JSDoc headers listing the future REST endpoints
- ☐ Mock data is deterministic (LCG-seeded, regenerates identically each load)
- ☐ Every screen passes the manual keyboard-only test (Tab through all interactives in visual order)
- ☐ Every screen renders correctly with `prefers-reduced-motion: reduce`
- ☐ RBAC: every route is wrapped in `<AuthGuard app="..." />` with the correct app key
- ☐ Per-app accent: `data-app="<key>"` is applied at AppShell root for this app
- ☐ Print: any screen marked as printable in the karasa has a `PrintLayout` wrapper
- ☐ Arabic copy is verbatim from the karasa or `_legacy/` — never retyped
- ☐ `npm run typecheck` returns 0
- ☐ `npm run build` returns 0 errors, 0 warnings
- ☐ All new screens have screenshots saved in `docs/screenshots/sprint-<N>/`
- ☐ KARASA_GAPS.md <SECTION> updated: ❌ → ✅ for every completed item

Tell me when all checks are green and Sprint <SPRINT_NUMBER> is ready for sign-off.

## Standing rules for this sprint (and every sprint)

- **No backend.** Every "API call" goes through the mock service layer. Period.
- **No new chart libraries.** Inline SVG charts only — extend the existing patterns or use the new shared chart components.
- **No `any`.** Strict TS or `unknown` + narrowing.
- **No hardcoded copy.** Arabic strings come from the karasa, the existing repo, or a centralized constants file. Never invented.
- **No new colors or spacing values.** If you need one, propose adding it to DESIGN_SYSTEM.md §2 first, then to `tokens.css`, then use it.
- **No business logic in pages.** Pages compose hooks and components. Logic lives in services, schemas, and feature-local hooks.
- **Components > 150 lines split.** Single responsibility.
- **Cross-feature imports go through barrels.** Never deep-import from another feature.
- **Two-phase results pattern (committees, medical, exams):** preliminary → final. Preliminary is editable by the entry user; final is locked except via super_admin override. UI must visually distinguish the two states.
- **Suspended-applicant guard:** any screen that touches applicant data must check `applicant.status === 'suspended'` and disable insert/edit/delete with the terra-toned banner per DESIGN_SYSTEM.md §2.2 + KARASA_GAPS.md §3.2.E. Apply this everywhere the karasa implies it.
- **Audit trail:** every CUD operation across every feature must log to the audit service. Provide the log entry shape via a typed helper, not strings.

## Anti-patterns I will reject in this sprint

- Building a "good enough" version of a screen and saying we'll come back later. Ship complete or don't ship.
- Skipping zod validation because "it's a small form".
- Using a native `<table>` instead of the shared `DataTable`.
- Using `<dialog>` or a third-party modal instead of the shared `Modal`.
- Inventing Arabic copy when the karasa has the exact wording.
- Creating a new domain type that overlaps with an existing one — extend the existing one instead.
- Letting the typecheck go red for more than one consecutive edit. If it's red, fix it before moving on.
- Putting feature-specific logic into `shared/`. If it's only used in one feature, it lives in that feature's folder.

Begin with Step 1: re-read KARASA_GAPS.md <SECTION> and inventory the existing feature folder. Wait for my approval after presenting your sprint plan in Step 2.
```

---

## How to use this prompt for each sprint

### Before pasting

1. Replace `<SPRINT_NUMBER>` with the sprint number (1–9).
2. Replace `<APP>` with the app name from the table at the top.
3. Replace `<SECTION>` with the KARASA_GAPS.md section reference (e.g., `§1`, `§2`, `§3`).

For Sprint 8 (Biometric + Barcode together), replace `<SECTION>` with `§7 + §8`. They share a fair amount of integration logic (verification flow at exam-room entry needs both), so building them together avoids rework.

### Order checklist

Run sprints in this order. **Do not skip ahead.**

- ☐ Sprint 1 — Admin Portal (KARASA_GAPS.md §1)
- ☐ Sprint 2 — Applicant Portal (§2) — this one will likely take 2 weeks alone; consider splitting into Sprint 2a (Stages 1–6) and Sprint 2b (Stages 7–11)
- ☐ Sprint 3 — Committees (§3)
- ☐ Sprint 4 — Medical Commission (§6)
- ☐ Sprint 5 — Investigations (§5) — sensitive features, leave time for the restricted-UI affordances
- ☐ Sprint 6 — Board / Secretariat (§4)
- ☐ Sprint 7 — Question Bank & e-Exams (§9) — large; the live-exam interface alone is half the sprint
- ☐ Sprint 8 — Biometric & Barcode together (§7 + §8)
- ☐ Sprint 9 — Cross-cutting (§10): hub refresh, global search, notifications, profile, architecture page, help

After Sprint 9, run **Sprint 10** (hardening) — testing, ESLint boundaries, husky, accessibility audit, Lighthouse, print polish. That sprint doesn't need this prompt; just paste the §10 portion of `KARASA_GAPS.md` and tell Claude Code to harden everything.

---

## Sample first message for Sprint 1

> Paste this in a fresh Claude Code session, after Prompt 1's onboarding has completed and confirmed Sprint 0 is done.

```
[Paste Prompt 3 here, with these substitutions:]

<SPRINT_NUMBER> = 1
<APP> = Admin Portal
<SECTION> = §1
```

Then approve Claude Code's plan, monitor the milestones, and sign off at the end of sprint review.

---

## What "approved" looks like at end-of-sprint

Before you sign off on a sprint:

1. Click through every new and refreshed route in the browser. If anything looks off (visual glitch, console error, missing state), don't approve.
2. Open `KARASA_GAPS.md` and verify every ❌ in the section is now ✅. If any are still ❌, ask Claude Code why.
3. Open one or two service files and verify the `INTEGRATION CONTRACT` JSDoc headers exist and are accurate. This is what the future backend team will read first.
4. Run `npm run build` yourself. Should be 0 errors, 0 warnings.
5. Pick one form at random and try to submit it with garbage. zod should catch it; the error UI should look like DESIGN_SYSTEM.md §4.10 ErrorState.
6. Test with `prefers-reduced-motion: reduce` enabled in DevTools. Animations should be off.
7. Test with the browser zoomed to 200%. Layouts should still work.

If everything passes, commit a sprint-summary tag (`git tag sprint-1-complete`) and move to the next sprint with a fresh Prompt 1 onboarding.
