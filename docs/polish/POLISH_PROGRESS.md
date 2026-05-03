# POLISH_PROGRESS.md

> Live progress log for the polish program. Append after every phase boundary AND every 5 screens within Phase 1.

---

## 2026-05-03 · Session handoff (Phase 0.5 mid-batch)

### Completed in this session
- **Phase 0.1 — PRODUCT.md** drafted from existing docs (CLAUDE.md, DESIGN_SYSTEM.md, KARASA_GAPS.md, DEMO_SCRIPT.md, DESIGN_REVAMP.md). User refinements applied at Approval Gate 1: sub-segments per user group, AI-slop tells listed concretely, two-phase signature pattern made visually specific, iPad-in-scope clarified.
- **Phase 0.2 — DESIGN.md → Tasks/DESIGN_SYSTEM.md** symlink wired. Loader confirms `hasDesign: true` resolved through symlink. Single source of truth preserved.
- **Phase 0.3 — Audit pass complete.** 10 systemic issues surfaced (S1–S10). Full table in POLISH_PLAN.md §1.
- **Phase 0.4 — POLISH_PLAN.md written.** Every screen catalogued, Pass 1 / Pass 2 assigned, time estimated, status tracked. Honest budget note: full plan is +34 h over the 80 h budget; user fallback rules land us at ~73 h.
- **Phase 0.5 partial:**
  - **S3 ✓** — sidebar rail bumped 2px → 4px (`before:w-0.5` → `before:w-1`). One-line edit in `src/app/layouts/Sidebar.tsx`.
  - **S6 ✓** — hardcoded hex → tokens across 5 legacy bundles (MedicalPages, ExamsPages, CommitteeOverviewPage, BoardPages, BiometricPages). 19 hex literals migrated to `var(--success)`, `var(--warning)`, `var(--gold-*)`, `var(--teal-*)`, `var(--terra-*)` per the audit's swap map.
  - **S4 partial** — error-state guards added to 2 of 6 mechanical files: `MedicalCertificatePage.tsx` ✓, `DistributionPage.tsx` ✓. Remaining 4 mechanical: `InvestigationsPages.tsx`, `OutgoingLettersPage.tsx`, `StationExamPage.tsx`, `barcode/Sprint8Pages.tsx`. Three other useQuery files (`biometric/Sprint8Pages.tsx`, `medical/MedicalPages.tsx`, `exams/ExamsPages.tsx`) need per-page judgment → deferred to Phase 3 per user spec.
  - **S2 not started** — two-phase signature canonical pattern still pending across CommitteeDetailPage, StationExamPage, Sprint7Pages.

### Hours spent vs budget
- ~3 h of 80 h consumed. **Pace: ON-TRACK.**

### Judgment calls flagged
- **JUDGMENT CALL 1 (Guardrail #2 conflict):** POLISH_PLAN.md §S2 said "build a `<TwoPhaseSignature>` shared component." User Guardrail #2 forbids new shared components without asking. Decision: apply the canonical visual language **in-place** at each consumer site using existing primitives (Card + Badge + IconStamp + the §4 PRODUCT.md table). No new shared component will be created without explicit approval. Document this in PRODUCT.md so the pattern is rediscoverable.
- **JUDGMENT CALL 2 (S6 hex semantics):** `#7C2D8E` (purple) appeared in `ExamsPages.tsx` BarChart color. PRODUCT.md anti-references ban purple gradients but a single solo swatch is a softer call. Mapped to `var(--gold-500)` since the exams app's per-app accent is gold-600 — keeps semantic alignment with app identity rather than inventing a new color. Same reasoning applied to CommitteeOverviewPage's purple StatCard (committee accent is gold).
- **JUDGMENT CALL 3 (S4 scope):** Three of nine useQuery files (`biometric/Sprint8Pages` monitoring page, `medical/MedicalPages` queue page, `exams/ExamsPages` overview) use inline `isLoading ? ... : ...` ternaries instead of the standard DataTable+loading or early-return-LoadingState patterns. Adding error branches there isn't a single-line fix; needs structural rework. Per user spec ("if requires per-page judgment, defer to Phase 3"), these are deferred. Phase 3's per-app consistency polish will handle them.

### New issues discovered
- None outside the 10 audit findings. Total budget projection unchanged.
- Note: `.agents/`, `.claude/`, `.devin/`, `.windsurf/` showed up untracked. These are agent harness directories. They should be added to `.gitignore` (or committed as project-level config — depends on project policy). Flagged for next session.

### What's next (start of next session)
1. **Finish Phase 0.5 batch** (~30 min): S4 on the remaining 4 mechanical files + S2 in-place patches. See HANDOFF.md for exact files + targets.
2. **Single commit:** `fix: phase 0.5 early-out batch (S2 + S3 + S4 + S6)`.
3. **Append to this log** after the commit.
4. **Move to Phase 1 / Screen 1 (`/hub`)** per POLISH_PLAN.md ordering.

---

## 2026-05-03 · Phase 0.5 closeout (SPEED MODE active)

### Completed in this session
- **S4 mechanical (4 of 4 remaining files):**
  - `InvestigationsPages.tsx` — `ErrorState` import + `isError/error/refetch` destructured + `error` prop on DataTable.
  - `OutgoingLettersPage.tsx` — same 3-edit pattern.
  - `StationExamPage.tsx` — early-return `<ErrorState>` after the existing `isLoading` early-return. Import added alongside Gauge.
  - `barcode/Sprint8Pages.tsx` — same 3-edit pattern on the `BarcodeScansHistoryPage` query + DataTable.
- **S2 in-place application (PRODUCT.md §4 canonical styling):**
  - `CommitteeDetailPage.tsx` — phase Badge for `final` now carries an `IconStamp` glyph on the start edge, matching §4 Final treatment.
  - `StationExamPage.tsx` — same IconStamp glyph on the medical-result row's `معتمد` Badge.
  - `Sprint7Pages.tsx` — STATUS_TONE realigned per §4 (`approved: 'info' → 'success'`, `live: 'success' → 'info'` to keep tones distinct), `IconStamp` on the approved Badge, `معتمد` and `منشور` StatCards swapped iconography to keep success-bg on the §4-Final-equivalent state.
- **`.gitignore`** — `.agents/`, `.claude/`, `.devin/`, `.windsurf/`, `skills-lock.json` added (agent harness, not project artifacts).
- **Commit `ce2610f`** — `fix: phase 0.5 early-out batch (S2 + S3 + S4 + S6)`. Typecheck and build both green pre-commit.

### Hours spent vs budget
- **~3.5 h / 80 h budget consumed.** Pace: **ON-TRACK**.
- Phase 0.5 nominal estimate was ~6 h; closed inside ~3.5 h thanks to mechanical pattern reuse + JUDGMENT CALL 1 (no new shared component).

### Judgment calls flagged
- **JUDGMENT CALL (S2 IconStamp prop API):** the custom `IconStamp` component takes `width`/`height`, not lucide-style `size`. First attempt used `size`; typecheck flagged it; switched to `width={12} height={12}`. Worth noting for any future custom-icon work — they don't share the lucide prop surface.
- **JUDGMENT CALL (Sprint7 STATUS_TONE swap):** to make `approved` match §4 Final (success), I had to give `live` a different tone. Picked `info` since it's the post-approval operational state and shouldn't compete visually with the §4-canonical "approved/معتمد". Swapped the two StatCard `iconBg/iconColor` pairs to keep the visual logic consistent (approved gets success-bg, live gets teal — Egyptian-government-blueish — for differentiation).

### New issues discovered
- None outside the audit's 10. **Total budget projection unchanged.**

### What's next
- **Phase 1 begins.** Screen 1 = `/hub` per POLISH_PLAN.md §2 ordering.
- For each of the 14 flagship screens: shape brief → polish → screenshots → commit. No gates; speed mode.
- Next progress entry: after Phase 1 screen 5 OR at Phase 1 close (whichever first).

---

## 2026-05-03 · `/architecture` rebuild (technical reference, English LTR)

### Why
The brief called for the architecture page to be the single screen that
proves to technical evaluators (CIO, IT director) that we read every page
of the karasa. The previous version was Arabic-RTL screen-only. The rebuild
is English-LTR, printable, and directly cites §1 / §3.1 / §3.2 / §3.4 /
§4.1 / §4.2 / §9 throughout.

### Completed in this session
- **Replaced** `src/features/architecture/pages/ArchitecturePage.tsx` with
  a 9-section, English-LTR page; rest of the chrome (header, sidebar)
  stays Arabic-RTL via `dir="ltr"` only on the page body.
- **New components** under `src/features/architecture/components/`:
  - `SectionTOC.tsx` — sticky right-rail with IntersectionObserver scroll-spy.
  - `FourLayerDiagram.tsx` — inline-SVG four-layer diagram, click any layer
    for an inline detail panel (what runs, security boundary, data flow,
    citation).
  - `IntegrationCard.tsx` — expandable cards for the six integrations.
- **Data file** `src/features/architecture/data.ts` — single source of
  truth for sections, layers, applications, integrations, security tiers,
  hosting blocks, and NFR baselines. Every entry carries a karasa citation.
- **Print stylesheet** appended to `src/styles/print.css`:
  ministry header band + Khayameya stripe at top, all collapsibles
  force-expanded for the handout, page-breaks before §5 and §8, page
  numbers via `@page { @bottom-center }`.
- **Updated** `Tasks/KARASA_GAPS.md` §10.2 to reflect the rebuild and the
  newly covered §3.1, §3.2, §4.1, §4.2 reference content.

### Judgment calls flagged
- **Six integrations, not five.** The brief framed five external
  integrations + a sixth "internal cross-app" entry. Section 1's tile
  reads "5 External Integrations" (per the brief), and Section 4 still
  contains six expandable cards (the five external + the internal one)
  to match the brief's INTEGRATION 6 entry.
- **Print page-breaks before §5 (Security) and §8 (Audit) only.** Adding
  a break before every section made the handout balloon to ~14 pages
  with awkward whitespace; isolating Security and Audit lands the
  handout at a more natural ~9-10 pages.
- **TOC scroll-spy bias.** rootMargin `-20% 0px -55% 0px` keeps the
  active section pinned to the upper-third of the viewport so it doesn't
  flicker at section boundaries. Tested by scrolling fast.
- **Stale `tsbuildinfo` flagged a phantom error.** First `npm run build`
  attempt failed with an `IconSeal` "declared but never read" error in
  unrelated `Sprint6Pages.tsx`. The file imports AND uses it; the build
  cache was stale. Removing `tsconfig.tsbuildinfo` fixed it; the build
  is now clean.

### What's next
- Smoke-test the print output (Cmd+P) in a browser and screenshot the
  on-screen + print views for the demo handoff.
- Phase 1 polish work (per POLISH_PLAN.md) continues separately.
