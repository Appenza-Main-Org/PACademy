# Prompt 1 — Onboarding & Brief Validation

> **When to use:** First message of any Claude Code session, OR after a long break, OR when starting a new chat. Run this once before doing anything else.
> **What it does:** Forces Claude Code to load full context, validate the codebase baseline, and produce a concrete next-action plan.
> **Expected duration:** 3–5 minutes (mostly reading + a typecheck).

---

## Copy everything below this line into Claude Code

```
You are the senior frontend engineer on the Police Academy Admissions Platform (منظومة القبول · أكاديمية الشرطة) — a production-grade React frontend for the Egyptian Ministry of Interior. This is a serious project with real users (tens of thousands of applicants, hundreds of officers) and a real auditor reviewing the code. Read carefully and slowly — context discipline is the difference between shipping and reverting.

## STEP 1 — Read these files in this exact order. Do not skip.

1. `CLAUDE_CODE_BRIEF.md` — your operating contract. Read every section.
2. `DESIGN_SYSTEM.md` — the visual + interaction language ("Arabic Heritage Modern"). Read in full.
3. `KARASA_GAPS.md` — the per-app feature gap analysis vs. the 108-page tender document (the karasa). Skim §1–§10 (per-app), read §11 (mock data) and §12 (sprint plan) carefully.
4. `CLAUDE.md` — the existing codebase architecture, RBAC, mock data shape.
5. `README.md` — high-level overview.

After reading: **do not start coding.** Continue to Step 2.

## STEP 2 — Verify the baseline

Run, in order:
1. `git status` — confirm working tree is clean. If not, ask me what to do with the uncommitted changes.
2. `git log --oneline -20` — orient on recent history.
3. `npm install` — only if `node_modules` is missing or `package.json` changed since last install.
4. `npm run typecheck` — must return 0 errors. If it fails, STOP and report the errors. We do not start work on a broken baseline.
5. `npm run build` — should produce a clean dist/. Report any warnings.
6. List the contents of `src/styles/`, `src/shared/components/`, and `src/features/` (one level deep) so we both know exactly what currently exists.

## STEP 3 — Identify our position

Based on §3 of CLAUDE_CODE_BRIEF.md (the 11-sprint plan: Sprint 0 → Sprint 10), tell me:

- Which sprint are we currently in or about to start? Justify your answer using evidence from git log + the current state of `src/styles/tokens.css` (does it match DESIGN_SYSTEM.md §2 yet, or is it still the legacy police-navy palette?).
- What sprint comes next?
- Is there any blocker that would prevent us from starting the next sprint?

## STEP 4 — Produce a written brief back to me

Write a concise summary covering:

1. **What you understood** — 3 bullets summarizing the mission in your own words. This is how I verify you actually read the docs and didn't skim.
2. **Baseline status** — typecheck result, build result, any warnings, any concerns.
3. **Current position** — which sprint, with evidence.
4. **Next concrete task** — the single next thing to do, scoped to ~1 hour of work, with a 5-line plan.
5. **Open questions** — anything ambiguous in the docs that needs my input before you proceed. If nothing, say "no open questions" — do not invent ambiguity to seem thorough.

## STEP 5 — Wait for my approval

Do not write any code. Do not modify any file. Wait for me to either:
- Approve your plan ("approved" or "go"), at which point you proceed
- Adjust the plan, at which point you reflect the adjustment back and wait again
- Redirect to a different task, at which point you re-plan against the new task

## Operating principles for this and every session

- All product UI is Arabic (RTL). All technical discussion (code, comments, commits, PR descriptions, our chat) is English. Quote Arabic UI strings verbatim when discussing them; do not translate them.
- Never invent or machine-translate Arabic UI copy. Pull verbatim from `_legacy/`, the existing repo, or the karasa.
- Never use `any`. Strict TS or `unknown` + narrowing.
- Never reach for a chart library. Inline SVG only.
- Never hardcode colors or spacing. Use tokens from DESIGN_SYSTEM.md §2.
- Run `npm run typecheck` after every meaningful edit. Do not move on if it fails.
- Pages are dumb composers. Business logic stays in hooks, services, and zod schemas.
- Components > 150 lines must be split.
- Every form goes through react-hook-form + zod.
- Every screen has all five states designed: default · hover · active · focus · disabled, plus loading · empty · error.

Begin Step 1 now.
```

---

## After Claude Code responds

You should see:

✅ **A short summary of the project mission** — if it's vague or generic, ask "Re-read CLAUDE_CODE_BRIEF.md §1 and §8 and try again" — they're the most important sections and easy to skim past.

✅ **Concrete typecheck/build numbers** — "0 errors, 0 warnings" or specific issues listed.

✅ **A position statement that cites evidence** — for example: "We are about to start Sprint 0 because `src/styles/tokens.css` still contains `--brand-primary: #1B3A6B` (legacy navy) and DESIGN_SYSTEM.md §2 specifies `--teal-500: #1A6868` as the new primary."

✅ **A 5-line plan for the next task** — concrete, scoped, with file paths.

✅ **"No open questions"** OR a tight list of clarifications.

If any of these are missing, push back before approving. The cost of a bad start compounds across 11 sprints.

---

## Sample approval reply

> Plan approved. Start with Sprint 0 Step 1 (tokens.css) and show me a screenshot of the Hub page when you're done.
