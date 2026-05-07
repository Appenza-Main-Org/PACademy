# Product

> **Bootstrap source:** CLAUDE.md, Tasks/DESIGN_SYSTEM.md §1, Tasks/KARASA_GAPS.md (RFP Scope Document coverage map — filename retained for git-history continuity), docs/DEMO_SCRIPT.md, docs/archive/DESIGN_REVAMP.md.
> **Nothing in this file was synthesized from a one-line prompt.** Every claim traces back to one of those documents.
> **Authoritative DESIGN.md** — `Tasks/DESIGN_SYSTEM.md` is the source of truth (the v2 navy proposal in `docs/archive/DESIGN_REVAMP.md` is a future direction not yet adopted).
> **Status:** Polish program complete (tag `polish-complete`, 2026-05-03). See [POLISH_REPORT.md](POLISH_REPORT.md) for the closeout. Demo cut tagged `v0.2.0-demo`.

## Register

product

> **Per-surface override:** `/` (PublicLandingPage) is the only **brand**-register surface. `/staff-login` carries brand framing on its left rail but the form itself is product. All seven internal staff apps + the 11-stage applicant wizard are pure product.

---

## Users

Three concrete user groups. Each occupies a different shell and has a distinct job.

### 1 · Applicants — public surface (`/applicant/*`)
- **Who:** Egyptian high-school graduates (~17–21 years old) applying to the Police Academy. Cycle 2026 expects ~2,847 of them. Mostly first-time users; many on mobile.
- **Context:** At home, possibly under family supervision, in Arabic only. The flow is high-stakes — failure to complete blocks them from a year-long admission cycle.
- **Job:** Complete the 11 RFP-Scope-Document-defined stages — phone OTP, NID verification, personal data, education, marital, payment, family-up-to-4th-degree, exam slot, attendance card print, follow-up, acquaintance document — without losing progress, without re-typing what the system already knows.

**Sub-segments — different polish defaults**
- **First-time nervous applicant** (Stages 1–9): never opened the system before. Polish defaults to **calm + verbose**: explicit progress, generous helper text under every input, confirmation copy before any irreversible step ("نعم، أرسِل" not "إرسال"). Errors are recoverable in-place; never blocking.
- **Returning status-checker** (Stages 10–11 + follow-up loop): file is submitted, they're checking state. Polish defaults to **fast + status-forward**: page loads land them straight on the latest pipeline state, no re-onboarding, no walk-through. Notifications are the primary surface, not the form.

### 2 · Internal staff — staff surface (`/admin`, `/committee`, `/board`, `/investigations`, `/medical`, `/barcode`, `/biometric`, `/question-bank`)
- **Who:** Officers and civilian processors. Per `features/auth/rbac.ts` there are 9 distinct staff roles: committee admin/user, medical admin/doctor, investigator, board admin, exams admin, biometric user, records clerk. Each role lives in 1–4 of the 9 apps.
- **Context:** Desktop-bound. Internal LAN. Long sessions (8-hour shifts during the admission cycle). Often working under audit — every action is logged with diff-level "before/after" detail.
- **Job:** Process applications through their pipeline stage. Most flows have a **two-phase pattern** — an officer enters a result, the chief of the committee/clinic signs off. The signed copy becomes the legal record.

**Sub-segments — different polish defaults**
- **Younger officers using the system daily** (default cohort): muscle memory builds quickly. Polish defaults to **dense + keyboard-first**: tight tables, no destructive confirmations on routine actions, ⌘K palette is the primary navigator.
- **Senior officers / occasional users** (chiefs, board members, ministry oversight): touch the system rarely, mostly to sign off. Polish defaults to **verbose + confirmation-on-write**: explicit "هل تريد اعتماد ٢ نتائج؟" prompts before commit, action buttons larger and labelled, no hidden ⌘ shortcuts as the only path to a critical action.

### 3 · Decision-makers — super_admin / admin tier
- **Who:** Academy administration, IT directors, audit/compliance.
- **Context:** Desktop. Both networks. They use `/admin/*` (dashboard, reports, audit log, cycles, reference data) and the gated `/architecture` page.
- **Job:** Oversee the cycle end-to-end. Configure reference data, admission rules, and cycle parameters. Read the audit log when something is contested. Demonstrate scope comprehension to the Ministry of Interior at the tender stage.

> **Polish constraint:** This group **only sees the demo path**, not the live product. Polish must NOT optimise for decision-makers outside the 15 demo-path screens listed in POLISH_PLAN.md. Configurator screens (`/admin/reference-data/*`, `/admin/cycles/*`, `/admin/admission-rules`) get Pass-2 consistency polish only — flagship treatment is wasted budget there.

---

## Product Purpose

**منظومة القبول الإلكتروني · أكاديمية الشرطة** — the production frontend for the Egyptian Police Academy Admissions Platform.

- A unified frontend that digitises the entire 11-stage admissions cycle and binds it to 9 connected staff applications behind a single shell.
- Built by **Appenza Studio** for the Egyptian Ministry of Interior · Police Academy (per CLAUDE.md §1).
- The product's purpose is **threefold**, in this priority order:
  1. **Win the tender** — this codebase is the visible proof that Appenza Studio comprehends the RFP Scope Document, has built a modern frontend, and can ship. The demo on 2026-05-29 (4 weeks out) is the decision moment.
  2. **Demonstrate scope coverage** — every RFP Scope Document requirement (108-page tender document) is mapped to an actual route, page, or component. The `Tasks/KARASA_GAPS.md` file proves ~95% in-scope coverage.
  3. **Run the admissions cycle** — once the tender is won and the backend integrates, the same codebase becomes the working system used by ~2,847 applicants and dozens of staff per cycle.

**Success looks like:** the Ministry of Interior decision committee leaves the tender presentation believing Appenza is the only vendor that has actually built what the RFP Scope Document describes.

---

## Brand Personality

**Three words:** Institutional. Heritage. Disciplined.

- **Voice:** Formal, calm, ministerial Arabic. First-person plural ("نقدّم"). No hype, no marketing adjectives. Numbers carry weight; copy doesn't try to.
- **Tone:** The interface should feel like it was made *for* the Ministry of Interior, not *sold to* it. The product knows the RFP Scope Document intimately; that knowledge shows.
- **Emotional goal — applicants:** quiet confidence. The system is heavy and serious, but never punishes a typo. Errors recover gracefully.
- **Emotional goal — staff:** shoulders relax. The chrome stays out of the way; data is dense but legible; every two-phase signature loop is visually obvious so the wrong button is never clicked.
- **Emotional goal — decision-makers:** scope comprehension lands without being told. They click a screen, recognise the RFP Scope Document section it implements, and trust grows.

---

## Anti-references

The platform is allergic to looking like any of the following. From `Tasks/DESIGN_SYSTEM.md §1` verbatim:

> *"Every screen should feel like it was designed for the Egyptian Ministry of Interior in 2026 — not for Stripe, not for Vercel, not for any Gulf ministry, not for a 2015 government portal. If a screen looks generic, it is wrong."*

| Anti-reference | Why it's banned | Failure mode it represents |
|---|---|---|
| **Stripe / Vercel / Linear** | Western SaaS aesthetic — slick gradients, marketing-first, optimistic-blue everywhere | Loses institutional gravity; reads as "consumer product trying to sell itself" |
| **2015-era government portal** | Heavy headers, table-of-tables layouts, CSS-2 hierarchy | Reads as legacy, contradicts the "2026" positioning |
| **Decorative khayameya** repeated as section dividers | Per DESIGN_REVAMP §1.4 | The motif fights the content instead of framing it |
| **AI-slop tells** — concrete list, no ambiguity | Vendor looks like they shipped a prompt, not a product. Match-and-refuse: | |
| ↳ AI-generated illustrations (DALL·E / Midjourney / SD blob art) | | |
| ↳ Purple gradients (`#7C3AED → #EC4899` and the rest of the AI-startup palette) | | |
| ↳ Robot / mascot iconography in the chrome | | |
| ↳ "Powered by AI" badges, ✨ sparkle icons on chat affordances | | |
| ↳ Bento-box dashboards (rounded mosaic of variable-height cards) | | |
| ↳ Glassmorphism (`backdrop-filter: blur` on decorative cards) | | |
| ↳ Plus the impeccable skill's absolute bans: gradient text, side-stripe card accents, hero-metric template, identical card grids, modal-as-first-thought | | |

> **Note on dropped anti-references:** "Generic Gulf-ministry cliché" and "v1 spa-teal" were in the first draft but couldn't be cited to a specific URL or screenshot, so they're dropped per Approval Gate 1 feedback. If a reference surfaces during polish that crosses either line, add it back with the citation.

---

## Design Principles

Five strategic principles, derived from `Tasks/DESIGN_SYSTEM.md §1` and the demo posture in `docs/DEMO_SCRIPT.md`. These guide every polish decision.

### 1. Distinctly Egyptian, distinctly modern, distinctly institutional
Three sources, refuses to look like any one of them: Egyptian heritage typography + ornamentation; government-grade trust signals; 2026-era product UI craftsmanship. The test: if the screen could plausibly belong to a Western SaaS, a Gulf ministry, or a 2015 gov portal, it has failed.

### 2. The RFP Scope Document is visible
Every screen ties back to an RFP Scope Document section (`RFP Scope Document §6.2.B`, `§3.C`, etc.) — sometimes literally rendered as a `JetBrains Mono` reference tag. Decision-makers reading the screen recognise the spec being implemented. **Scope comprehension is the product.**

### 3. Density with discipline
Government workflows show a lot of data. Embrace it — but with strict typographic hierarchy, generous line-height, and ruthless whitespace between groups. A dashboard showing 6 KPIs + an activity feed + a heatmap is correct; the same dashboard with everything in identical 16px gray text is wrong.

### 4. Two-phase signature is sacred — visually specific
Most staff workflows have a "officer-enters → chief-approves" gate (committees, medical, exams). The UI must make this loop visually obvious — the entered state vs. the signed state are **different surfaces**, not different badges. Wrong button presses are unacceptable; this is a legal record.

**Canonical visual language** — apply consistently across Committees, Medical, and Exams:

| State | Border | Badge | Editability | Trailing icon |
|---|---|---|---|---|
| **Preliminary** (officer entered, chief hasn't signed) | `1.5px dashed` border in `--gold-300` | `<Badge tone="warning">قيد المراجعة</Badge>` | editable inline; "تعديل" affordance present | none |
| **Final** (chief signed, locked) | `1px solid` border in `--gold-500` + `--surface-card` background | `<Badge tone="success">معتمد</Badge>` | read-only; "تعديل" hidden, only "عرض" + "طباعة" | gold seal icon (`IconStamp`) on the start edge |
| **Rejected** (chief rejected, returns to officer) | `1.5px solid` border in `--terra-500` | `<Badge tone="danger">مرفوض</Badge>` + reason tooltip | editable inline (officer must address rejection) | terra `XCircle` icon |

These three states must be **visually distinct from across the room**. If a staff user can't tell preliminary from final without reading the badge text, the polish is wrong.

### 5. Every state is designed
Loading is not "spinner". Empty is not "no data". Error is not "something went wrong". Each state gets a real composition with Arabic copy, an illustrative element, and a recovery path. This is how a modest SPA reads as a mature product.

---

## Accessibility & Inclusion

- **WCAG 2.1 AA** baseline. AAA on hero/body pairings where the new v2 navy makes it easy (`white on #143764` = 11.6).
- **RTL-first**. Layouts authored RTL from scratch, not flipped LTR. Logical properties (`ps-`/`pe-`) used everywhere — `grep` confirms zero `pl-`/`pr-` in `src/`.
- **Reduced motion respected.** Per `tokens.css` and `Wizard.tsx` — animations check `prefers-reduced-motion` and degrade to instant transitions.
- **Keyboard navigation.** Every interactive element reachable via Tab in source order; focus rings visible on all buttons, links, inputs.
- **Arabic numerics where natural.** `font-numeric tnum` (Inter tabular figures) for KPIs and IDs that need column alignment; otherwise Arabic numerals (٢٠٢٦) where the design language calls for them.
- **Screen-reader labels** on every icon-only button (per audit fixes already applied — e.g. logout, notifications, search).
- **Per-app accents** picked for AA contrast in both light and dark text directions (committee gold `#B0822A`, terra `#B8412A` darkened from v1 originals specifically for AA on white).

---

## Out of scope (so polish doesn't drift here)

- **Mobile-first responsive.** The applicant portal must work on mobile; staff apps are **desktop-first** by design (LAN-bound, multi-window workflows). Polish should not rebuild staff dashboards as mobile-first.
- **Tablet (iPad+) IS in scope for staff.** Senior officers may demo on iPad and chiefs may sign off from a tablet. Staff polish must hold up at ≥768px viewport (no broken sidebars, no overflowing tables, no clipped buttons). **Phone-sized layouts (<768px) are explicitly out of scope for staff apps** — gracefully degrade to a "open this on a desktop" notice rather than reflowing.
- **Dark mode.** The app is light-mode only. Tokens support a theme swap if needed, but no dark-mode polish work in this pass.
- **Animations beyond the existing motion vocabulary.** 120ms micro / 180ms page / 240ms stage. Polish does not invent new motion durations.
- **English UI.** English appears only as identifiers (route paths, eyebrows, audit IDs). Polish never translates Arabic copy to English "to clean it up."
