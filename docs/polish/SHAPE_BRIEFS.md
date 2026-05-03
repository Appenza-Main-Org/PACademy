# SHAPE_BRIEFS.md

> Per-screen shape briefs for the 14 Phase-1 flagship screens. Each brief states the **shape** of the polish before code is written — what's wrong, what good looks like, what must NOT change.

---

## Screen 1 — `/hub`

**File:** [src/features/hub/pages/HubPage.tsx](../../src/features/hub/pages/HubPage.tsx)
**Demo role:** First impression after login. The "do these people understand what they built" surface for Decision-makers.
**Pass-1 input from POLISH_PLAN.md §2:** Compact greeting bar + 6-tile KPI hero already shipped. **Principles: tighten activity log, validate at iPad.**

### Current state (before polish)
- Hero (rounded-2xl, teal-700→teal-500→teal-600 gradient) with KhayameyaStripe header, tessellation Pattern at 0.08 opacity, gold-300 chip row (date · hijri · cycle), display-bold greeting + paragraph, then a **bottom status strip** with 4 list items: success-dot ("كل الخدمات نشطة"), Layers icon ("منصة التحقق · مفعّلة"), UserCog ("{roleLabel}"), Activity ("اليوم: N تسجيل جديد").
- KPI strip — 6 StatCards in auto-fit grid. Tones already align with §4 (gold for review, success for approved, terra for rejected).
- App grids — split into "إنترنت" (2 apps) and "شبكة داخلية" (7 apps). Cards use `data-app` for accent, `var(--accent-*)` for the icon swatch and the slide-in border-top on hover.
- No live activity ticker / recent-events strip.

### What's wrong (the shape problem)
1. The hero's bottom status strip mixes four metaphors (signal-dot, abstract-layers, user-icon, time-icon) at the same visual weight. It reads as **a loose list, not a status bar**. POLISH_PLAN's "tighten activity log" means: this strip should function as the system's pulse at a glance — not a bulleted list of unrelated facts.
2. The hub never tells the user what just happened. There's no "آخر الأحداث" surface — for the demo audience, that hub is all they'll see for 30 seconds, and the KPIs feel **static** without a small live-events affordance.
3. The hero gradient is a brand-register flourish on a product page. PRODUCT.md says hub is product. **Don't redesign**, but tighten so it doesn't read as Stripe-y.

### What good looks like (after polish)
- **Hero status strip** → tight inline row, single-baseline, dot-or-divider separated, all entries equal weight. No more mixed icon metaphors. The strip becomes a "system pulse" — short, in `text-2xs text-white/75`, no flex-wrap, with thin vertical dividers between segments.
- **Recent activity strip** → compact horizontal "آخر الأحداث" block above the App grids, drawing 3 most-recent entries from `MOCK.audit`. Each row: action label · target · time-ago, in a single `Card variant="compact"` with `density="compact"`. Per-app accent dot on the start edge keyed to the entry's source app. No new shared component (Guardrail #2): inline Card + inline list.
- **iPad-portrait verified** — 768×1024 won't break the auto-fit grids (already use `minmax(280px, 1fr)`); confirm hero padding doesn't overflow.

### What must NOT change
- The KhayameyaStripe at the top of the hero — it's the **only** decorative khayameya on the hub, and it's a header treatment, not a divider, so it doesn't violate PRODUCT.md §anti-references.
- The teal gradient — single-hue institutional, not the Stripe-y multi-hue gradient banned in §anti-references.
- The 6-tile KPI strip — POLISH_PLAN says it's already shipped; don't reorder, recolor, or rename.
- The 9-card app grid + locked affordance + per-app accent.

### Risks / things to verify post-polish
- **iPad-portrait (768×1024):** the hero padding `p-9` (36px) with `text-3xl` greeting may overflow on small viewport. Test.
- **Reduced-motion:** ensure activity-strip and any new dot indicators are static when `prefers-reduced-motion: reduce`.
- **Mock data:** `MOCK.audit` exists per `src/shared/mock-data/index.ts`; confirm shape matches what the activity strip needs (action, target/applicant id, ts, source app).

### Decision shorthand
`hero status strip → tighter`, `+ activity strip (3 events, no new shared component)`, `iPad-portrait sanity`.

---

## Screen 2 — `/architecture`

**File:** [src/features/architecture/pages/ArchitecturePage.tsx](../../src/features/architecture/pages/ArchitecturePage.tsx)
**Demo role:** Scope-comprehension showcase. Decision-makers click here to verify the karasa coverage. Truth in numbers.
**Pass-1 input:** 4-layer diagram + 6 integrations + 11×9 RBAC + 500-unit hardware shipped. **Principle #2 visibility check.**

### Current state (before polish)
- 4-layer diagram with `border-2` colored boxes (teal/gold/terra/ink), saturated bg-50 fills. Connector between layers = a 14px-tall lucide ChevronLeft icon.
- 6-row Integrations table — clickable rows hover into teal-50 → opens Drawer with flow steps.
- Hardware inventory: 7-tile auto-fit grid, all teal-50 swatches, font-numeric tnum counts.
- RBAC matrix: 11 roles × 9 apps. "Allowed" = solid `●` Unicode bullet in teal-500 square. "Not allowed" = `○` empty Unicode circle. No legend, no row striping.
- Stack: 6-card grid, fine.

### What's wrong
1. **Layer diagram screams** — `border-2` in saturated terra/gold/teal makes the 4 layers fight each other. The chevron connector reads as a UI control, not as a flow indicator.
2. **RBAC dots are unicode glyphs** at small size — they pixel-snap inconsistently and lack the institutional crispness of a proper Check icon. The `○` is too prominent for "not allowed" — should fade.
3. **No RBAC legend** — a Ministry decision-maker reading this needs the legend visible without inferring meaning.
4. **No row striping on RBAC** — the eye loses track between roles 5 and 8.

### What good looks like (after polish)
- **Layer diagram → calmer**: drop `border-2` to a 4px **start-edge color rail** + a 1px subtle border-subtle around the rest, plus `shadow-sm` for depth. Replace the chevron with a thin 1px gradient line (border-subtle → ink-300) for a flow connector that reads as wire, not control.
- **Inner block hover**: subtle `hover:border-ink-300` for affordance.
- **RBAC matrix**:
  - Allowed → `<Check size={14} strokeWidth={2.5} />` inside a `bg-teal-500` square — same visual weight as before, but a proper icon.
  - Not allowed → `<Minus size={12} />` in `text-ink-300` — recedes properly.
  - **Zebra striping** on rows (alternate `bg-surface-card` / `bg-ink-50/40`) so the eye doesn't lose its place across 11 rows.
  - **Legend strip** at the end: small inline pair `[Check] مسموح · [Minus] غير مسموح` in `text-2xs text-ink-500`.

### What must NOT change
- The 4 sections (diagram → integrations → hardware → RBAC → stack → sovereignty footer + Khayameya stripe close).
- Per-layer colors (teal/gold/terra/ink) — they're meaningful (DMZ vs intranet), not decorative.
- Integrations table behavior (click → Drawer with flow steps).
- Hardware-inventory monochrome — varying accent-per-tile would be AI-slop.

### Decision shorthand
`layer diagram → calmer borders + flow-line connector`, `RBAC → proper Check/Minus + zebra + legend`. No new shared components. No token edits.

---

## Screen 3 — `/applicant/print-card` (Stage 9 attendance card, print)

**File:** [src/features/applicant-portal/pages/Stage9PrintCardPage.tsx](../../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx)
**Demo role:** First of 3 print documents — the applicant's gate pass on exam day.
**Pass-1 input:** Photo + 4-part name + barcode shipped. **Final pass on signature block + Khayameya footer.**

### What's wrong
- **No signature block.** The card is a printable attendance pass with no place for officer/applicant signatures or a ministry seal. POLISH_PLAN explicitly flags this.
- The exam appointment shows only Gregorian — for ministerial gravity an inline Hijri equivalent is expected.

### What good looks like (after polish)
- **3-column signature block** at the bottom, before the Khayameya footer:
  1. `توقيع المتقدم` — empty signature line (dashed-bottom).
  2. `موظف الاستقبال — الاسم والرتبة` — empty signature line.
  3. `ختم الإدارة` — `<IconSeal width={36} height={36} />` in `text-gold-600` over a labelled tile.
- **Hijri inline** under the appointment Gregorian date, in `text-2xs text-ink-500`.

### What must NOT change
- Photo box, identity grid, barcode block, documents checklist, KhayameyaStripe footer.
- The `border-2 border-ink-700` on the barcode block — print legibility justifies it.

### Decision shorthand
`+ 3-col signature block (IconSeal for ministry stamp)`, `+ Hijri inline date`. No new shared component (helpers stay file-local).

---

## Screen 4 — `/medical/certificate` (medical certificate, print)

**File:** [src/features/medical/pages/MedicalCertificatePage.tsx](../../src/features/medical/pages/MedicalCertificatePage.tsx)
**Demo role:** Print document #2. The pass/fail verdict the medical commission hands to the board.
**Pass-1 input:** Color-coded verdict stamp + per-station table done. **Final pass on 3-col signature + seal placement.**

### What's wrong
- Existing `SignatureBlock` uses a `border-t-2 border-ink-700` rule above the title — the rule reads as a separator, not as a place to sign on. No room for a real signature.
- The "ختم" placeholder is a dashed circle with text — not ministerial.
- Verdict stamp shows Gregorian only.

### What good looks like (after polish)
- `SignatureBlock` rebuilt: dashed-bottom signature line above title (signing surface), then title + name. For the seal variant: replace dashed-circle with `<IconSeal width={56} height={56} />` in `text-gold-600`.
- Verdict stamp gets Hijri inline below the Gregorian on the trailing edge.

### What must NOT change
- Verdict-stamp color logic (success/terra/gold/ink); per-station table; KhayameyaStripe footer; auto-rule note.

### Decision shorthand
`SignatureBlock → dashed signature line + IconSeal seal variant`, `+ Hijri inline date`.

---

## Screen 5 — Board decision drawer (`/board/decisions` → drawer, print)

**File:** [src/features/board/pages/Sprint6Pages.tsx](../../src/features/board/pages/Sprint6Pages.tsx) (`BoardDecisionsListPage` + `DecisionSignature`)
**Demo role:** Print document #3. The signed, sealed, dated final decision the board hands down.
**Pass-1 input:** Hijri+Gregorian dates + formal Arabic prose + member signatures done. **Final pass on stamp typography.**

### What's wrong
- `DecisionSignature` uses a `border-t-2 border-ink-700` rule above the title — same separator-not-signing-surface anti-pattern as the medical certificate.
- The "ختم هيئة القبول" placeholder is a 24×24 dashed circle in gold-500 with literal text "ختم"/"هيئة القبول" inside it — reads as a wireframe note, not a ministerial seal.
- Verdict box has identity/outcome on the start, no date on the trailing edge — the Gregorian+Hijri pair already exists in the decision-number stamp above, but the verdict box itself is undated. For a one-page formal print where each block must stand alone, the date pair belongs there too.

### What good looks like (after polish)
- `DecisionSignature` rebuilt: dashed-bottom signature line above title (signing surface) + title + name. Same shape as the new `MedicalCertificate` `SignatureBlock` — visual coherence across the 3 print docs is an explicit Phase-1 goal.
- Official seal swapped: `<IconSeal width={72} height={72} className="text-gold-600" />` + a single `text-2xs font-medium text-gold-700` label "ختم هيئة القبول". Drops the wireframe-circle.
- Verdict box gets a trailing-edge date pair (`fmtDate · hijriDate هـ`) in `font-mono text-2xs`.

### What must NOT change
- Decision-number stamp (gold border, ScrollText icon, formal number) — already canonical.
- Formal Arabic body, "بسم الله الرحمن الرحيم" opening, formal closing.
- Khayameya footer.

### Decision shorthand
`DecisionSignature → match SignatureBlock`, `seal placeholder → IconSeal`, `+ verdict-box trailing date pair`.

---

## Screen 6 — `/` PublicLandingPage (BRAND register, only one)

**File:** [src/features/landing/pages/PublicLandingPage.tsx](../../src/features/landing/pages/PublicLandingPage.tsx)
**Demo role:** Brand-register front door. The only screen polished against brand laws (not product). The first thing a citizen visitor sees.
**Pass-1 input:** Hero + 4 highlights + footer done. **Flagship pass.**

### What's wrong
- **Hero headline** is `text-4xl md:text-4xl` — too small for a brand-register hero. The product-register equivalent (hub) has `text-3xl` for a greeting; the brand entry page should sit a step above.
- **Meta strip** uses a flex-wrap `<ul>` with 3 unrelated items: two date entries + a Badge. Same shape problem the hub had — fixed there, drifted here.
- **Bottom attribution bar** has the Khayameya stripe at the trailing edge but no anchoring on the leading edge; reads as decorative-only.

### What good looks like (after polish)
- Headline scales `text-4xl` → `text-5xl` on `md+`, with tighter `leading-[1.15]` for ministerial display gravity.
- Meta strip rebuilt as a tight inline `dl` with label/value pairs and vertical dividers (mirroring the hub's improved status strip — visual coherence).
- Bottom bar gains an `IconSeal` (28px) anchor in `text-gold-600` on the leading edge — the ministerial seal balances the Khayameya tail.

### What must NOT change
- Cycle badge (gold-50, dot, "التقديم متاح الآن"); the `<LogoMark>` hero anchor; the radial-gradient + tessellation Pattern hero treatment.
- Dual CTA cards (teal applicants, gold staff) — they're already canonical and PRODUCT.md anti-references confirm dual-color institutional accents are correct, not Stripe-y.
- 4-highlight card grid; Khayameya stripe at the bottom corner.

### Decision shorthand
`headline → text-5xl on md+`, `meta strip → dl + dividers`, `+ IconSeal anchor on bottom bar`.

---

## Screen 7 — `/staff-login`

**Files:** [src/features/auth/pages/LoginPage.tsx](../../src/features/auth/pages/LoginPage.tsx) · [src/features/auth/components/LoginArtPanel.tsx](../../src/features/auth/components/LoginArtPanel.tsx) · [src/features/auth/components/LoginForm.tsx](../../src/features/auth/components/LoginForm.tsx)
**Demo role:** Auth gate for officers. MOIPASS-styled framing + role picker.
**Pass-1 input:** LoginArtPanel + RHF+zod + 1.5s MOIPASS sim done. **Final pass on form-pane density at iPad.**

### What's wrong
- `LoginArtPanel` is `min-h-screen` regardless of viewport — at iPad portrait (`<lg`), the panel pushes the form a full screen below the fold.
- `LoginPage`'s right pane is `p-6` everywhere — at iPad portrait the form is centered in a tall vertically-empty container.
- `LoginForm` uses `gap-5` and `text-2xl` headline — slightly heavy on the smaller stacked layout.

### What good looks like (after polish)
- `LoginArtPanel` becomes responsive: `p-8` and natural-height on `<lg`, `min-h-screen` + `p-12` only on `lg+`. The hero text scales `text-2xl → text-3xl` at `lg`, the stat strip mt-margin tightens on small viewports.
- `LoginPage` right pane: `px-6 py-10` on small, `p-6` (centered) on `lg`.
- `LoginForm`: `gap-4` on small, `gap-5` on `lg`. Headline scales `text-xl → text-2xl`. Paragraph gains `leading-relaxed` for readability.

### What must NOT change
- The demo bootstrap (`ensureDemoUser()` in `App.tsx`) — that's a debug shortcut, not part of the demo path. It happens to make /staff-login skip on demo runs.
- LoginForm's RHF + zod + MOIPASS-styled flow + role picker.
- The teal gradient + KhayameyaStripe header on the art panel — brand register elements that are appropriate here (login is the boundary between brand and product).

### Visual verification
- Could not screenshot `/staff-login` directly — `App.tsx`'s `ensureDemoUser()` auto-seeds a super_admin user on startup, and `LoginPage` redirects authenticated users straight to `/hub`. Polish was applied based on file-level review; **typecheck clean**, **build clean**. Visual verification deferred to Phase 4 cohesion review (which can run with the demo bootstrap temporarily disabled).

### Decision shorthand
`art panel + page + form → responsive padding/typography for iPad-portrait stacked layout`. Visual deferred.

---

## Screen 8 — `/admin` (DashboardPage)

**File:** [src/features/admin/pages/DashboardPage.tsx](../../src/features/admin/pages/DashboardPage.tsx)
**Demo role:** Decision-maker control panel. KPIs, live ticker, charts, heatmap, recent activity, governorate distribution.
**Pass-1 input:** KPI strip + heatmap + activity ticker shipped. **Principles: align two-phase sig styling with §4.**

### What's wrong
- **Live activity ticker** uses a single `var(--accent-500)` dot for every event regardless of action color. Each row already carries an `actionColor` (success/warning/danger/info/neutral) — the dot should track it. As-is, the ticker reads as visually flat; a quick scan can't surface the danger entries.
- **Geographic distribution bars** use hardcoded `bg-teal-500` — token-aligned for admin app accent (teal-600) but not respecting `data-app` accent. Per S1 audit finding, hardcoded brand should consume `var(--accent-*)`.

### What good looks like (after polish)
- Live ticker dot keyed by action color via a small `TICKER_DOT` lookup map. Same shape as the hub's new `AUDIT_DOT`. Cross-screen consistency.
- Live ticker rows gain `hover:border-ink-300` for affordance.
- Geographic bars consume `var(--accent-500)` so the admin's teal-600 accent flows through automatically and any future `data-app` override propagates without further edits.

### What must NOT change
- The 5-tile KPI strip; the cycle selector + "ملخص جديد" CTA in the page header.
- "إجراءات مطلوبة" warning panel.
- Donut + line chart + heatmap — already inline-SVG, already canonical.
- "آخر النشاط" Badge-based recent-activity list — already uses `e.actionColor` for the Badge tone (the §4 alignment was already correct here; the new ticker treatment now matches it).

### Decision shorthand
`live ticker dot → action-colored`, `geo bars → var(--accent-500)`. Cross-screen coherence with hub's new activity strip.

---

## Screen 9 — `/investigations/cases/:id`

**File:** [src/features/investigations/pages/InvestigationDetailPage.tsx](../../src/features/investigations/pages/InvestigationDetailPage.tsx)
**Demo role:** "Restricted file" demo. Family tree + 6 external checks + restricted banner.
**Pass-1 input:** Restricted banner + family tree + 6 named external checks done. **Tighten classification strip.**

### What's wrong
- Classification banner is a single terra-50 surface with the restriction copy inline. It reads more like a warning toast than a classified-document marking. For demo audience expecting a Ministry-of-Interior look, the strip should feel like a stamped marking on a security file, not a UI alert.

### What good looks like (after polish)
- Classification banner gets a 2-row treatment:
  1. **Top rail** — terra-500 solid bar with `font-mono uppercase tracking-[0.18em] text-2xs text-white` reading `RESTRICTED · CLASSIFIED` on the start edge and the case ID on the trailing edge. LTR. Reads like the bilingual security stamp on real classified files.
  2. **Bottom row** — existing Arabic restriction notice + ShieldAlert icon + "وُصول مُسجَّل" badge.
- Outer border drops from `border-2` to `border` (the top rail now carries the visual weight).

### What must NOT change
- Family tree visualization (4 generations × FamilyNode).
- 6-row external checks list (ChecklistItem).
- Upload zone, "الخلاصة والقرار" verdict block.
- Per-row content of the existing banner — the Arabic restriction notice is the legal text and stays verbatim.

### Decision shorthand
`classification → 2-row stamp (mono Latin top rail + Arabic body)`.

---

## Screen 10 — `/applicant/profile/family` (Stage 7)

**File:** [src/features/applicant-portal/pages/Stage7FamilyPage.tsx](../../src/features/applicant-portal/pages/Stage7FamilyPage.tsx)
**Demo role:** Applicant fills in 4 generations of family. Investigations app reads from this. The most consequential single applicant form.
**Pass-1 input:** Section-grouped + role-tinted + ShieldCheck banner done. **Principle #4 styling for "preliminary" state.**

### What's wrong
- Submit row is just the button on the trailing edge with nothing communicating that the saved data enters a preliminary state pending the security investigation. PRODUCT.md §4 makes the two-phase pattern explicit: data committed by the applicant should visibly indicate it's awaiting verification.

### What good looks like (after polish)
- Submit row becomes a 2-column flex on `sm+`: an inline §4-aligned "preliminary save" notice on the leading edge (`border-dashed border-gold-300 bg-gold-50 text-2xs text-gold-700` — same shape as the CommitteeDetail "preliminary" panel) reading the canonical "ستُحفظ هذه البيانات بصورة «أوليّة» ولن تُعتمد إلا بعد اكتمال التحريات الأمنية..." copy. Submit button stays on the trailing edge.

### What must NOT change
- Form structure: father/mother/paternal-grandparents/maternal-grandparents fixed + siblings + relatives field arrays.
- Role tones (teal-50 for father, gold-50 for mother, ink-100 for grandparents).
- ShieldCheck info banner at the top.

### Decision shorthand
`+ §4 preliminary-save notice on the trailing-row, leading edge`.

---

## Screen 11 — `/committee/:id` (results-entry surface)

**File:** [src/features/committees/pages/CommitteeDetailPage.tsx](../../src/features/committees/pages/CommitteeDetailPage.tsx)
**Demo role:** Two-phase signature flagship — KARASA §3.C dual-approval workflow.
**Pass-1 input:** Two-phase explainer + live score preview done. **Canonical signature treatment per S2.**

### What's wrong
- **S2 already partially addressed in Phase 0.5** — IconStamp glyph on the `معتمد` Badge ✓.
- The two-phase explainer card uses `border-gold-300` all-around. Per §4 visual canon for surface-emphasis, a **start-edge color rail** reads stronger and reduces visual noise.
- The explainer says "preliminary → final" in prose but doesn't show the visual transition. For the demo audience, a small inline pictogram of the actual `[Hourglass] قيد المراجعة → [IconStamp] معتمد` flow makes the workflow legible at a glance.

### What good looks like (after polish)
- Explainer card border drops from `border-gold-300` (full) to `border-s-4 border-gold-500` (start-edge rail) — same shape as the architecture page's 4-layer treatment. Less visual noise, stronger semantic.
- Trailing edge of the explainer (visible on `lg+`): a dashed `border-gold-300` mini-pictogram showing the canonical state transition: warning Badge with Hourglass icon → Check arrow → success Badge with IconStamp.

### What must NOT change
- Result row's phase Badge with IconStamp on `معتمد` (Phase 0.5 work).
- "اعتماد المحدد ({n})" multi-select bulk-approve flow.
- Live score preview drawer.
- 4-tile KPI strip.

### Decision shorthand
`explainer card → border-s-4 rail + lg-only mini-pictogram showing preliminary→final transition`.

---

## Screen 12 — `/medical/station/bmi`

**File:** [src/features/medical/pages/StationExamPage.tsx](../../src/features/medical/pages/StationExamPage.tsx)
**Demo role:** Two-phase signature flagship (medical-side). BMI gauge + verdict commit.
**Pass-1 input:** BMI gauge + ✓/✗ checklist done. **Principle #4 for verdict commit + cyan-teal accent (per app rail).**

### What's wrong
- Submit row is just the button on the trailing edge, no §4 preliminary indicator. The KARASA §6.2.D two-phase rule (officer enters, chief signs) isn't visible at the commit moment.
- Active station pill in the header uses hardcoded `bg-teal-500` — per S1 audit, hardcoded brand colors on per-app surfaces should consume `var(--accent-500)` so the medical app's accent (teal-400 per CLAUDE.md §8) reads through.

### What good looks like (after polish)
- Submit row becomes 2-column flex on `sm+` with a §4-aligned dashed gold-300 notice on the leading edge: "ستُحفظ هذه النتيجة كـ «قيد المراجعة» ولن تُعتمد إلا بتوقيع رئيس القومسيون · KARASA §6.2.D". Same shape as the CommitteeDetail and Stage 7 preliminary notices — cross-screen §4 coherence.
- Active station pill consumes `var(--accent-500)` via inline `style` (Tailwind doesn't allow `bg-[var(...)]` on conditionals cleanly here without arbitrary values).

### What must NOT change
- BMI gauge widget; per-station field set; verdict select; existing IconStamp on معتمد in the today-results list (Phase 0.5).

### Decision shorthand
`+ §4 preliminary notice on submit row`, `active-station pill → var(--accent-500)`. S1 partial fix in-place.

---

## Screen 13 — `/board/sessions/:id/live`

**File:** [src/features/board/pages/Sprint6Pages.tsx](../../src/features/board/pages/Sprint6Pages.tsx) (`BoardSessionLivePage`)
**Demo role:** Live board deliberation. Quorum + 4 voting members + tally.
**Pass-1 input:** Live indicator + quorum + tally bars done. **Principle #4 for vote-passed state.**

### What's wrong
- Tally container is a static `border-gold-300 bg-gold-50` regardless of vote outcome. When all 4 members have voted and the result is decided, the surface should communicate that the decision is **final** (the §4 Final state) — currently it stays in the same warning-tone container.
- "مُحصِّلة الأصوات" label gets a "{n} / 4 صوّتوا" counter on the trailing edge — when the count reaches a clear majority decision, that counter is the wrong affordance.

### What good looks like (after polish)
- Tally container becomes adaptive: `border-s-4` start-edge rail with **success / terra / gold** color depending on `verdict` (computed from counts when totalCast === 4 and one outcome strictly dominates).
- When verdict resolves to **pass**, replace the "{n}/4 صوّتوا" counter with a `<Badge tone="success">` containing an `IconStamp` glyph and the canonical Arabic copy "قرار: قبول · جاهز للاعتماد". Decision-makers see at a glance: vote is in, decision is final, ready for the secretary's sign-off.
- Other verdicts (reject, defer) get the appropriate border color but keep the counter — only the "passed" outcome warrants the §4 Final affordance because that's the consequential commit moment.

### What must NOT change
- 3-bar tally (pass/reject/defer); 4-member voting grid; agenda list; live indicator strip.

### Decision shorthand
`tally container → adaptive border-s-4 + IconStamp Badge on decided pass verdict`.

---

## Screen 14 — `/question-bank`

**File:** [src/features/exams/pages/ExamsPages.tsx](../../src/features/exams/pages/ExamsPages.tsx) (`QuestionBankPage`)
**Demo role:** Question repository overview. Read-only catalogue. Different page from `/question-bank/manage` (the §4 workflow lives there, polished in Phase 0.5).
**Pass-1 input:** 5-tile stats + category-tree sidebar done. **Principle #4 across draft/review/approved/live workflow.**

### What's wrong
- Category buttons use legacy CSS (`.card`, `.text-tertiary`, inline `borderColor: var(--brand-primary)`) — token-bypass and not token-aligned.
- No discoverability link to the management page (`/question-bank/manage`) where the §4 workflow lives.

### What good looks like (after polish)
- Category buttons rebuilt with Tailwind: `rounded-md border bg-surface-card px-4 py-3 text-end transition-all duration-fast ease-standard hover:border-ink-300`. Active state: `shadow-sm` + inline `borderColor: var(--accent-500), borderWidth: 2` (S1 alignment).
- "إدارة الأسئلة (دفق الاعتماد) ←" deep link added to the page header next to the "سؤال جديد" CTA — surfaces the §4 workflow on the management page (which is where Phase 0.5's `IconStamp` on approved Badge already lives).

### What must NOT change
- The question list rendering with `.question-card` legacy CSS — this is a Phase 3 concern (S7 audit: ad-hoc bordered divs codemod). Out of scope here.
- The `categories` query and filtering behavior.

### Decision shorthand
`category buttons → Tailwind + var(--accent-500) active`, `+ deep link to /manage`. Legacy `.question-card` deferred to Phase 3.

---

## Screen 15 — `/biometric/enroll`

**File:** [src/features/biometric/pages/BiometricPages.tsx](../../src/features/biometric/pages/BiometricPages.tsx) (`BiometricEnrollPage`)
**Demo role:** 4-step biometric enrollment wizard. Face scan + fingerprint + commit.
**Pass-1 input:** 4-step wizard + capture state + quality badges done. **Final pass on micro-interactions.**

### What's wrong
- Step indicator's "current" state uses hardcoded `bg-teal-500 text-white ring-4 ring-teal-100` and `text-teal-700` for the label — biometric's per-app accent is terra-400 per CLAUDE.md §8, but the indicator forces teal regardless of `data-app`.
- Without per-app accent, the wizard reads as generic-teal, not biometric-app-flavored.

### What good looks like (after polish)
- Step indicator's current-state circle: drop the teal Tailwind classes, use inline `style={{ background: 'var(--accent-500)', boxShadow: '0 0 0 4px var(--accent-50)' }}` so the active swatch and ring read as biometric's terra accent (or whichever app the wizard is rendered under).
- Current label: `style={{ color: 'var(--accent-700)' }}` instead of `text-teal-700`.

### What must NOT change
- 4-step structure (تحديد ← وجه ← بصمة ← اعتماد).
- BiometricCapture component (face/fp scan UI).
- Quality badges, before-you-start tips card, save-confirmation surface.

### Decision shorthand
`step indicator current state → var(--accent-500/50/700) via inline style`. S1 partial fix in-place.

---

## Screen 16 — `/barcode` (generator)

**File:** [src/features/barcode/pages/BarcodePages.tsx](../../src/features/barcode/pages/BarcodePages.tsx)
**Demo role:** Officers print attendance cards. Card-shaped preview + barcode bars + Khayameya stripe.
**Pass-1 input:** Card-shaped preview + Khayameya stripe done. **Final pass on print preview density.**

### What's wrong
- Card preview header strip uses `bg-teal-700`, border uses `border-2 border-teal-500` — barcode app's per-app accent is **ink-700** per CLAUDE.md §8, not teal. Hardcoded teal forces a generic look that ignores barcode's institutional dark accent.
- Footer (issued + valid-until row) lacks any seal mark — print outputs read as a plain receipt.

### What good looks like (after polish)
- Card border + header strip consume `var(--accent-500)` and `var(--accent-700)` via inline `style`. Barcode's ink-700 accent reads as a near-black header strip — that's the institutional treatment the page deserves.
- Footer trailing-edge gains a tiny `IconSeal` (14px gold-600) inline before the validity date — a small ministerial stamp that anchors the print output as official.

### What must NOT change
- BarcodeBars rendering; mock-data identity strip; KhayameyaStripe.
- Right-side applicant selector + "توليد كارت التردد" generate button.

### Decision shorthand
`card border + header → var(--accent-*)`, `+ tiny IconSeal at footer trailing edge`. S1 alignment.
