# HANDOFF — pick up the polish program in a new session

**Status:** Phase 0 done. Phase 0.5 batch is **mid-flight, uncommitted**. Tree is typecheck-clean (`npx tsc --noEmit` → 0 errors); no commits made yet this run.

**The next session should finish Phase 0.5, commit once, then proceed under "speed mode" through Phase 1 → Phase 4.**

---

## 1 · Read these first (in order)

| File | Why |
|---|---|
| `PRODUCT.md` | Strategic context. Refined twice already. Don't synthesize anything here. |
| `DESIGN.md` (symlink → `Tasks/DESIGN_SYSTEM.md`) | Visual constitution. Source of truth. |
| `POLISH_PLAN.md` | The full plan: 10 systemic fixes (S1–S10), 14 flagship screens, 52 consistency screens, time budget. |
| `docs/polish/POLISH_PROGRESS.md` | Latest progress entry, judgment calls, what was deferred and why. |
| `.claude/skills/impeccable/SKILL.md` | Skill behaviour (pre-flight gates, register routing). |
| `.claude/skills/impeccable/reference/polish.md` | The polish command spec. |

---

## 2 · Operating mode (verbatim from user)

**SPEED MODE — MAX AUTONOMY.** Pre-approval to execute Phase 0.5 → Phase 4 without per-screen / per-app / per-batch gates. Make polish decisions autonomously within the design system constraints. **One review at the end.**

**Stop and ask only if you'd:**
1. Change a token in `tokens.css`
2. Add a **new shared component** that didn't exist before
3. Change a route or break navigation
4. Touch `PRODUCT.md` or `DESIGN_SYSTEM.md`
5. Make a decision that contradicts `PRODUCT.md` or `DESIGN_SYSTEM.md`
6. Spend > 4 h on a single screen
7. Commit something that breaks typecheck or build
8. Push total budget > 100 h
9. Skip an entire app or screen from the plan

Everything else: your call. **Move fast.**

**What stays true:**
- `DESIGN_SYSTEM.md` is the constitution
- `PRODUCT.md` anti-references hold (no purple gradients, no decorative khayameya, no AI-slop, no glassmorphism)
- Quality stays at POLISH_PLAN.md levels — speed comes from cutting gates, not quality
- Typecheck and build stay green at every commit
- Arabic UI copy stays verbatim from karasa or `_legacy/`
- Per-app accent via `data-app="<key>"` applied consistently
- Every form uses RHF + zod (don't introduce useState forms)

---

## 3 · Phase 0.5 batch — finish this first

Single commit at the end: `fix: phase 0.5 early-out batch (S2 + S3 + S4 + S6)`.

### S3 ✓ DONE
`src/app/layouts/Sidebar.tsx` — `before:w-0.5` → `before:w-1` (sidebar accent rail bumped 2px → 4px). Verify intact:
```bash
grep "before:w-1" src/app/layouts/Sidebar.tsx
```

### S6 ✓ DONE
Hex literals migrated to tokens in 5 files. Verify zero remaining:
```bash
grep -nE "#[0-9A-Fa-f]{6}\b" \
  src/features/medical/pages/MedicalPages.tsx \
  src/features/exams/pages/ExamsPages.tsx \
  src/features/committees/pages/CommitteeOverviewPage.tsx \
  src/features/board/pages/BoardPages.tsx \
  src/features/biometric/pages/BiometricPages.tsx
```
Should return empty.

### S4 ⚠ PARTIAL — 2 of 6 mechanical files done, 4 remaining

**Done:**
- ✓ `src/features/medical/pages/MedicalCertificatePage.tsx` — added `ErrorState` import, `certQ.isError` branch.
- ✓ `src/features/investigations/pages/DistributionPage.tsx` — destructured `isError, error, refetch`, passed `error={...}` to DataTable.

**Remaining (mechanical — same pattern as DistributionPage):**

For each file, apply this 3-edit pattern:

**Edit 1 — add ErrorState to the components import:**
```ts
import {
  // ... existing imports ...
  ErrorState,  // <— add alphabetically
  // ...
} from '@/shared/components';
```

**Edit 2 — destructure isError + refetch:**
```ts
// Before:
const { data, isLoading } = useQuery({ ... });
// After:
const { data, isLoading, isError, error, refetch } = useQuery({ ... });
```

**Edit 3 — pass `error` prop to DataTable:**
```tsx
<DataTable
  data={...}
  loading={isLoading}
  error={isError ? <ErrorState error={error} onRetry={() => refetch()} /> : undefined}
  // ...
/>
```

| File | Pattern |
|---|---|
| `src/features/investigations/pages/InvestigationsPages.tsx` | DataTable + isLoading. **Note:** I started this in the previous session, then reverted the partial import to keep typecheck green. Re-add `ErrorState` to the import block (alphabetically between `EmptyState` and `PageHeader`), destructure `isError, error, refetch` on the `cases-v2` useQuery (line ~68), pass `error={...}` to the DataTable in the JSX. |
| `src/features/investigations/pages/OutgoingLettersPage.tsx` | DataTable + isLoading. Same 3-edit pattern. |
| `src/features/medical/pages/StationExamPage.tsx` | Has `if (stationsQ.isLoading) return <LoadingState>` early return. Add `if (stationsQ.isError) return <ErrorState error={stationsQ.error} onRetry={() => stationsQ.refetch()} />` right after it. ErrorState already imported here? Check line ~23 imports. |
| `src/features/barcode/pages/Sprint8Pages.tsx` | DataTable + isLoading on the scans-history query (~line 140). Same 3-edit pattern. |

**Deferred to Phase 3** (per user's "mechanical-only" rule — these need per-page judgment):
- `src/features/biometric/pages/Sprint8Pages.tsx` (BiometricMonitoringPage uses inline `isLoading ? text : ...`)
- `src/features/medical/pages/MedicalPages.tsx` (MedicalQueuePage uses inline ternary)
- `src/features/exams/pages/ExamsPages.tsx` (passive useQueries, no loading guard at all)

### S2 ⚠ NOT STARTED — two-phase signature pattern

User Guardrail #2 forbids new shared components. **Do NOT build `<TwoPhaseSignature>`.** Instead apply the canonical visual language from `PRODUCT.md §4` in-place at each consumer site.

The canonical table from PRODUCT.md (re-stated for convenience):

| State | Border | Badge | Editability | Trailing icon |
|---|---|---|---|---|
| **Preliminary** | `1.5px dashed` border in `--gold-300` | `<Badge tone="warning">قيد المراجعة</Badge>` | editable; "تعديل" present | none |
| **Final** | `1px solid` border in `--gold-500` + `--surface-card` background | `<Badge tone="success">معتمد</Badge>` | read-only | `IconStamp` on start edge |
| **Rejected** | `1.5px solid` border in `--terra-500` | `<Badge tone="danger">مرفوض</Badge>` + reason tooltip | editable | `XCircle` icon |

**Files to align:**
- `src/features/committees/pages/CommitteeDetailPage.tsx` — currently uses ad-hoc surfaces for the dual-signature card. Apply preliminary / final styling per the table.
- `src/features/medical/pages/StationExamPage.tsx` — has a verdict gate ("preliminary → chief approves"). Match.
- `src/features/exams/pages/Sprint7Pages.tsx` — question-bank workflow has a `draft → review → approved → live` lifecycle. The "approved" surface should match Final styling; "review" should match Preliminary.

If any of these requires structural rework that pushes the file >30 min, defer to Phase 3 and note it in POLISH_PROGRESS.md.

### Final commit message
```
fix: phase 0.5 early-out batch (S2 + S3 + S4 + S6)

- S3 sidebar rail 2px → 4px so per-app identity reads at desktop scale
- S6 19 hardcoded hex literals → token vars across 5 legacy bundles
- S4 ErrorState wrappers on 6 mechanical useQuery sites; 3 deferred to
  Phase 3 (need structural rework, not single-line fix)
- S2 in-place application of two-phase signature canonical styling at
  Committee · Medical · Exams consumer sites (per PRODUCT.md §4 table).
  No new shared component (Guardrail #2).
```

---

## 4 · After Phase 0.5 → Phase 1 (flagship polish)

Order from user spec:
1. `/hub`
2. `/architecture`
3. The 3 print documents (Stage 9 attendance card, medical certificate, board decision drawer)
4. `/` (PublicLandingPage) **← brand register, all other screens are product**
5. `/staff-login`
6. `/admin` (DashboardPage)
7. `/investigations/cases/:id`
8. `/applicant/profile/family` (Stage 7)
9. `/committee/:id` (results-entry surface)
10. `/medical/station/bmi`
11. `/board/sessions/:id/live`
12. `/question-bank`
13. `/biometric/enroll`
14. `/barcode` (generator)

For each:
- Write shape brief to `docs/polish/SHAPE_BRIEFS.md` (don't wait for user)
- Polish the screen
- Save before/after screenshots to `docs/polish/<screen-slug>/`
- Commit per screen: `polish(<area>): flagship — <screen>`
- Move to next, no waiting

**Append to `docs/polish/POLISH_PROGRESS.md` after every 5 screens.**

---

## 5 · Then Phase 2, Phase 3, Phase 4

Per `POLISH_PLAN.md` §3, §4, §5. Final tag: `git tag polish-complete`. Final deliverable: `POLISH_REPORT.md` at repo root.

---

## 6 · Working state at handoff

```
Branch:           main
Last commit:      b58df7d (PR #3 merged — design-revamp v2 navy)
Uncommitted:      9 modified files (Phase 0.5 work in progress)
Untracked:        PRODUCT.md, DESIGN.md (symlink), POLISH_PLAN.md, .claude/, .agents/, .devin/, .windsurf/, skills-lock.json
Typecheck:        ✓ clean
Build:            (not re-run since Phase 0.5 began — re-run before commit)
Dev server:       was running at localhost:5173, may have been killed
```

**Untracked agent dirs (`.claude/`, `.agents/`, `.devin/`, `.windsurf/`):** decide once whether to commit them as project-level skill config or add to `.gitignore`. They're harmless either way.

**Hours consumed so far:** ~3 h of 80 h budget. **Pace ON-TRACK** for the demo deadline (~4 weeks).

---

## 7 · Quick sanity check the new session should run first

```bash
cd /Users/mac/Projects/PACademy/PACademy
git status --short
npx tsc --noEmit            # must be 0 errors
cat docs/polish/POLISH_PROGRESS.md   # last entry tells you where we are
cat HANDOFF.md               # this file
```

If anything is broken or surprising, stop and ask. Otherwise: finish Phase 0.5, commit once, move into Phase 1 — Hub.
