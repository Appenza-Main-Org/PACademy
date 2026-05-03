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

---

## 2026-05-03 · Phase 1 — flagship screens 1–5 complete (SPEED MODE)

### Completed in this batch
1. **Screen 1 — `/hub`** (commit `ba76759`). Hero status strip rebuilt as a single-baseline `dl` row with vertical dividers; signal-dot now pulses (motion-safe); today's-registration delta shown in gold-300/terra-300. New "آخر الأحداث" recent-activity strip showing 3 most-recent audit entries above the App grids. iPad-portrait verified.
2. **Screen 2 — `/architecture`** (commit `73e2b0c`, **subsequently superseded** by user's English-LTR rebuild — see preceding log entry). My pass softened the saturated 4-layer borders, added a flow-line connector between layers, replaced the RBAC `●`/`○` unicode glyphs with proper lucide `Check`/`Minus` icons, added zebra striping + a legend strip. The user's rebuild replaced the page entirely with a 9-section technical reference; my polish lives in git history (`73e2b0c`) but is no longer on disk.
3. **Screen 3 — Stage 9 attendance card** (commit `9b8b8be`). Added a 3-column signature block (applicant · receiving officer · ministry seal w/ IconSeal) before the Khayameya footer. Hijri date inline under Gregorian on the appointment.
4. **Screen 4 — medical certificate** (commit `9f76db2`). `SignatureBlock` rebuilt with a real signing surface (dashed-bottom line above title); seal variant uses IconSeal. Verdict stamp gains Hijri date inline.
5. **Screen 5 — board decision drawer** (commit `1748f2c`). `DecisionSignature` mirrors the new `SignatureBlock`; dashed-circle "ختم" wireframe replaced with IconSeal at 72px. Verdict box now carries a trailing-edge `fmtDate · hijriDate هـ` pair.

All commits ship typecheck-clean. Build verified after Phase 0.5 close; subsequent commits typecheck-only.

### Hours spent vs budget
- **Estimated ~6 h consumed in this batch** on top of the ~3.5 h pre-existing → **~9.5 h / 80 h** total.
- Original Phase-1 estimate for these 5 screens was 13 h (3+4+2+2+2 from POLISH_PLAN §2). Closed in ~6 h thanks to mechanical visual-coherence pattern (3 print docs share a SignatureBlock shape).
- **Pace: ON-TRACK.** 9 flagship screens remaining; 70.5 h of budget remaining.

### Judgment calls flagged
- **JUDGMENT CALL (architecture overwrite):** my Screen-2 polish (`73e2b0c`) was applied to the previous Arabic-RTL ArchitecturePage. The user then replaced the entire page with an English-LTR technical reference. I did not revert — per the system note "this change was intentional" — and I am noting the polish is now historical. The new architecture page may need its own polish pass (different screen, different architecture, different design language). Flagging for the final-cohesion review (Phase 4).
- **JUDGMENT CALL (visual coherence across the 3 print docs):** rather than three independent signature treatments, I applied the SAME shape (dashed-bottom signature line above title + IconSeal for seal variant) across all three print docs. This is a small but explicit cohesion choice — the 3 print documents are likely to be seen together by demo-evaluators, and divergent signature blocks would read as drift.
- **JUDGMENT CALL (before screenshots only on later screens):** I captured before-state for Screen 2 and Screen 3 but not for Screens 1, 4, 5 (the changes were already on disk before the dev server initialized for those screens). The git history at `b58df7d^...HEAD~5` preserves the pre-polish state for any of the 5 screens if a comparison is needed retroactively.

### New issues discovered
- None outside the audit's 10 + the architecture rebuild. **Total budget projection unchanged.**

### What's next
- Continue Phase 1 — Screen 6 = `/` (PublicLandingPage), per POLISH_PLAN.md ordering.
- Next progress entry: at the close of Phase 1 (after screen 14), or at the 10-screen mark.

---

## 2026-05-03 · Phase 1 — flagship screens 6–10 complete

### Completed in this batch
6. **Screen 6 — `/` PublicLandingPage** (commit `8fbea87`). Headline scaled `text-4xl → text-5xl` on `md+` for brand-register hero gravity. Meta strip rebuilt as inline `dl` with vertical dividers (mirrors hub). IconSeal anchor added to bottom attribution bar.
7. **Screen 7 — `/staff-login`** (commit `410c202`). LoginArtPanel responsive: natural-height + `p-8` on small, `min-h-screen` + `p-12` only on `lg+`. LoginPage right pane: `px-6 py-10` on small, `p-6` on `lg`. LoginForm: `gap-4 → gap-5` at `lg`, headline `text-xl → text-2xl`. **Visual verification deferred** — App.tsx's `ensureDemoUser()` auto-seeds super_admin and `LoginPage` redirects authenticated users to `/hub`. Phase 4 cohesion review will spot-check with the demo bootstrap temporarily disabled. Typecheck + build clean.
8. **Screen 8 — `/admin` dashboard** (commit `b3d7556`). Live activity ticker dot keyed by action color via `TICKER_DOT` map (matches the hub's new `AUDIT_DOT` shape). Geographic distribution bars now consume `var(--accent-500)` instead of hardcoded `bg-teal-500` (S1 alignment).
9. **Screen 9 — `/investigations/cases/:id`** (commit `1462ebc`). Classification banner reshaped from a single terra-toned UI alert into a 2-row security-document stamp: terra-500 solid top rail with mono Latin "RESTRICTED · CLASSIFIED" + case ID, Arabic restriction body below. Reads like the bilingual stamp on real classified files.
10. **Screen 10 — `/applicant/profile/family` Stage 7** (commit `1de561b`). Submit row gains a §4-aligned "preliminary save" notice on the leading edge: dashed gold-300 border + gold-50 bg + canonical Arabic copy stating the data is saved as «أوليّة» pending the security investigation. Same visual shape as the CommitteeDetail preliminary panel.

### Hours spent vs budget
- **~4 h consumed in this batch** → **~13.5 h / 80 h** total.
- Phase-1 estimate for these 5 screens was 17 h (4+2+4+4+3). Closed in ~4 h. Budget gain: 13 h.
- **Pace: ON-TRACK.** 4 flagship screens remaining; ~66.5 h of budget remaining.

### Judgment calls flagged
- **JUDGMENT CALL (/staff-login screenshots):** could not capture verified after-screenshots due to App.tsx's auto-seed redirecting all visits to /hub. Polish was applied based on file-level review with typecheck + build verification. Phase 4 cohesion review will close the loop.
- **JUDGMENT CALL (canonical preliminary-save copy on Stage 7):** the §4 PRODUCT.md table didn't pre-script the exact applicant-side copy for a "preliminary" affordance — only the Badge/border/icon. I wrote a one-sentence inline notice that matches the tone of the CommitteeDetail explainer ("النتيجة المُدخَلة...تُحفظ كـ «قيد المراجعة»...") and rephrased it for the applicant-side context. Worth a copy review by the Arabic-content reviewer.
- **JUDGMENT CALL (/investigations/cases bilingual stamp):** introducing English mono "RESTRICTED · CLASSIFIED" on a Ministry-of-Interior page might raise questions. Decision: kept it because (a) the bilingual stamp is a real-world convention on classified files, and (b) it gives the page genuine institutional gravity that pure Arabic warning-tone alerts can't reach. The page already has the case ID in mono LTR elsewhere, so the convention is established.

### New issues discovered
- The architecture page's user-driven rebuild (English-LTR technical reference) is now divergent from the rest of the app's Arabic-RTL register. This isn't an issue — it's intentional per the rebuild log entry — but **Phase 4 cohesion** should verify the rebuild's six-tier-security and 9-section structure read coherently when navigating in/out of the page.

### What's next
- Continue Phase 1 — Screen 11 = `/committee/:id` results-entry, per POLISH_PLAN.md ordering.
- Next progress entry: at Phase 1 close (after screen 14).
