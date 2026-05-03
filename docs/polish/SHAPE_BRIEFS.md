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
