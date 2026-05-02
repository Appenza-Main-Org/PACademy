# PROMPT_AUTOPILOT.md — Run Sprints 1–9 in Sequence

> **When to use:** You want all 9 apps redesigned and navigable as fast as possible. You'll review at the end, not per-sprint.
> **What it does:** Tells Claude Code to chain through Sprints 1–9 without waiting for screenshot sign-off between them.
> **Expected duration:** Multiple Claude Code sessions across 2–4 weeks. This single prompt drives every session.
> **Prerequisites:** Sprint 0 must be tagged complete (`git tag --list` should show `sprint-0-complete`).

---

## When to use this vs. PROMPT_0_MASTER.md

| Scenario | Use |
|---|---|
| Per-sprint review, careful pace | `PROMPT_0_MASTER.md` |
| Ship all 9 apps fast, review at the end | **`PROMPT_AUTOPILOT.md`** (this file) |
| Just one specific sprint | `PROMPT_3_GAP_FILL.md` directly |
| Final review after autopilot | `PROMPT_4_FINAL_REVIEW.md` |

---

## Copy everything below this line into Claude Code

```
You are operating in AUTOPILOT MODE for the Police Academy Admissions Platform (منظومة القبول · أكاديمية الشرطة).

The user wants all 9 application sprints (1 through 9) executed in sequence with minimal back-and-forth. They will review the entire system at the end via PROMPT_4_FINAL_REVIEW.md, not per-sprint. Your job is to ship correct, working, navigable code as efficiently as possible without sacrificing the non-negotiables.

## Read these files first, in this order

1. `CLAUDE_CODE_BRIEF.md` — operating contract
2. `DESIGN_SYSTEM.md` — visual contract
3. `KARASA_GAPS.md` — feature contract (skim §1–§10, read §11 + §12)
4. `PROMPT_3_GAP_FILL.md` — the per-sprint procedure (you'll execute this 9 times)
5. `CLAUDE.md` and `README.md` for codebase context

After reading: continue to baseline check.

## Baseline check

Run:
1. `git tag --list` — confirm `sprint-0-complete` exists. If not, STOP and tell the user Sprint 0 must finish first.
2. `git status` — must be clean.
3. `npm run typecheck` — must return 0 errors.
4. `npm run build` — must return 0 errors and 0 warnings.

If any of these fail, STOP and report. Do not start autopilot on a broken baseline.

## What changes in autopilot mode

The standard `PROMPT_3_GAP_FILL.md` procedure has Step 4 ("End-of-sprint review") where the user signs off before the next sprint. In autopilot, you replace that step with **AUTOPILOT_SPRINT_GATE** below.

Everything else from PROMPT_3_GAP_FILL.md stays the same:
- Inventory reconciliation at the start of each sprint
- Mock data extensions, types, services, routes, pages, components, schemas planned and built per the documented order
- Milestone-by-milestone within each sprint, with typecheck gates between milestones
- Commits per milestone with the standard `feat(<app>): ...` message format

## What does NOT change

These remain absolute. Autopilot is not a license to skip them:

- ☐ Typecheck must be 0 errors after every meaningful edit (within milestones too, not just at sprint boundaries)
- ☐ Build must be 0 errors at the end of each sprint
- ☐ Every screen marked ❌ in `KARASA_GAPS.md` for the active sprint must become ✅ before moving to the next sprint
- ☐ Every form uses react-hook-form + zod
- ☐ Every list/table uses the shared `DataTable` from Sprint 0
- ☐ Every modal/drawer uses the shared `Modal`/`Drawer`
- ☐ Every empty/loading/error state uses the shared state components
- ☐ All new services have `INTEGRATION CONTRACT` JSDoc headers
- ☐ Mock data is deterministic (LCG-seeded)
- ☐ RBAC: every route wrapped in `<AuthGuard app="..." />`
- ☐ `data-app="<key>"` applied at AppShell root for each app
- ☐ Arabic copy verbatim from karasa or `_legacy/` — never invented
- ☐ No hardcoded hex outside `tokens.css`
- ☐ No `any`, no `useEffect` for data fetching, no new chart libraries
- ☐ Cross-feature imports through barrels only

## AUTOPILOT_SPRINT_GATE — the replacement for end-of-sprint review

When all milestones of a sprint are complete, instead of waiting for the user to sign off:

1. Run the full Definition of Done checklist from `PROMPT_3_GAP_FILL.md` Step 4.
2. If every item passes:
   - Tag: `git tag sprint-<N>-complete`
   - Update `KARASA_GAPS.md` (❌ → ✅ for completed items in the relevant section)
   - Write a 5-line autopilot log entry (see template below)
   - Without pausing, start the NEXT sprint by running its Step 1 (re-read KARASA_GAPS section + inventory feature folder)
3. If any item fails:
   - STOP autopilot
   - Report the failure to the user with: which item, why it failed, what would unblock it
   - Wait for user direction before proceeding

## Autopilot log entry — append to `AUTOPILOT_LOG.md` after each sprint

Create `AUTOPILOT_LOG.md` at repo root if it doesn't exist. After each sprint completes the gate, append:

```
## Sprint <N>: <App Name> — <YYYY-MM-DD HH:MM>
- Milestones: <list of milestone names completed>
- New routes: <count>
- New components: <count> shared, <count> feature-local
- New services: <list>
- Karasa items resolved: <count> ❌→✅
- Typecheck: ✅  Build: ✅ (0 errors, 0 warnings)
- Notable decisions: <one line if any non-trivial decision was made>
- Skipped/deferred: <one line if anything was deferred to final review>
```

This log is what the user reads when they come back. It's also what the final review prompt scans to compile its audit.

## Sprint sequence

Execute in this exact order. Use the matching KARASA_GAPS.md section for each:

1. Sprint 1 — Admin Portal (`KARASA_GAPS.md §1`)
2. Sprint 2 — Applicant Portal (`§2`) — largest sprint; if mid-sprint context gets tight, split into 2a (Stages 1-6) and 2b (Stages 7-11) but do NOT skip stages
3. Sprint 3 — Committees (`§3`)
4. Sprint 4 — Medical Commission (`§6`) — note section number; karasa orders apps differently than KARASA_GAPS sections
5. Sprint 5 — Investigations (`§5`) — sensitive features, ensure restricted-UI affordances per §5.2.E are correctly applied
6. Sprint 6 — Board / Secretariat (`§4`)
7. Sprint 7 — Question Bank & e-Exams (`§9`) — large; the live-exam interface is roughly half the sprint
8. Sprint 8 — Biometric & Barcode together (`§7 + §8`)
9. Sprint 9 — Cross-cutting (`§10`) — hub refresh, global search, notifications, profile, architecture page, help

After Sprint 9 tags complete, STOP autopilot and report to the user. Do NOT auto-start Sprint 10 (hardening) or the final review — those happen via separate user-initiated prompts.

## When to break autopilot and ask the user

Autopilot ends and you wait for user input in any of these cases:

1. **Baseline broken:** typecheck or build fails at sprint-start and you can't fix it within 3 attempts.
2. **Karasa ambiguity:** a field, validation, or business rule from KARASA_GAPS.md is unclear AND can't be reasonably resolved by reading the karasa context. Propose an update to KARASA_GAPS.md and wait for approval.
3. **Design system gap:** you discover a token, color, or component that doesn't exist in DESIGN_SYSTEM.md and is needed. Propose adding it, wait for approval.
4. **Scope explosion:** a sprint plan grows beyond ~3x the originally estimated milestones. This is a signal that KARASA_GAPS.md may have under-specified the work; pause to discuss.
5. **Architectural decision:** anything that would change the public shape of `shared/` types, the mock service interface, or the RBAC model.
6. **End of Sprint 9:** stop and report.

In all other cases, keep moving. Don't wait for permission to do work that's already documented.

## Within-sprint efficiency rules

To keep autopilot moving without sacrificing quality:

- **Plan once per sprint, not per milestone.** At sprint start, write the full milestone breakdown. Within milestones, just announce-and-execute.
- **Batch typecheck reads.** Run typecheck at end of milestone, not after every file save, unless you're chasing a specific error.
- **Screenshot at sprint completion only.** Save to `docs/screenshots/sprint-<N>/` per the standard procedure. The user reviews these in bulk during final review.
- **Commit per milestone, push per sprint.** Reduces git overhead while preserving granularity.
- **Reuse Sprint 0 primitives aggressively.** If you're tempted to build a new variant of an existing primitive, check if you can extend props instead. Add to DESIGN_SYSTEM.md only if a genuinely new component is needed.

## What I expect from you in your first response

After reading the docs and running the baseline check:

1. Confirm baseline is green.
2. Confirm `sprint-0-complete` tag exists.
3. State which sprint you're starting (Sprint 1 — Admin Portal).
4. Produce the Sprint 1 plan per `PROMPT_3_GAP_FILL.md` Step 2 (inventory reconciliation, mock data extensions, types, services, routes, pages, components, schemas, milestone sequence).
5. Then **start executing without waiting for approval** — this is autopilot mode. The user has already pre-approved by pasting this prompt.

The only time you stop is for the conditions listed in "When to break autopilot and ask the user".

Begin now. Confirm baseline → state sprint → produce plan → start executing.
```

---

## What you do during autopilot

Honestly: not much. That's the point.

**Per Claude Code session (2-4 hours each):**
- Open Claude Code
- If it's the first session: paste this prompt
- If it's a resume session: paste `PROMPT_0_MASTER.md` (it'll detect autopilot is in progress from `AUTOPILOT_LOG.md`)
- Let it work
- Check the chat occasionally for "stop" signals — if Claude Code hits one of the 6 break conditions above, it'll wait for you

**Across sessions:**
- Check `AUTOPILOT_LOG.md` to see what shipped
- Check `git tag --list` to see how many sprints are tagged complete

**You only intervene when:**
- Claude Code asks (one of the 6 break conditions)
- You want to spot-check a sprint mid-flight (rare)
- All 9 sprints complete — then you run `PROMPT_4_FINAL_REVIEW.md`

## How to know it's working

After each session, check:

```bash
git tag --list                    # how many sprint-N-complete tags?
cat AUTOPILOT_LOG.md              # what shipped in each sprint?
git log --oneline | head -50      # recent commits
npm run typecheck && npm run build # still green?
```

If `git tag --list` shows progressively more sprint tags and `AUTOPILOT_LOG.md` keeps growing, you're winning.

If you see no tags but lots of commits, something is stuck — Claude Code is probably mid-sprint and hasn't gated yet. Check the chat for a stop signal.

## Realistic expectations

Even on autopilot, this is **not a single-session project**. Claude Code has context limits and will need to start fresh sessions periodically. That's fine — the AUTOPILOT_LOG.md and git tags let any new session pick up exactly where the previous one left off.

Rough pacing across many sessions:
- Sprint 1 (Admin): 4-8 hours of Claude Code work
- Sprint 2 (Applicant): 8-16 hours
- Sprint 3-9: 4-12 hours each
- Total: 60-100 hours of Claude Code session time across 2-4 weeks of calendar time, depending on how often you can run sessions

## When autopilot ends

Claude Code stops after Sprint 9 completes. At that point:

1. Read `AUTOPILOT_LOG.md` end-to-end
2. Click through all 9 apps yourself in `npm run dev` to spot-check
3. Run `PROMPT_4_FINAL_REVIEW.md` for the comprehensive audit + cleanup pass

That's when the per-sprint review you skipped happens, in aggregate, against the whole system.
