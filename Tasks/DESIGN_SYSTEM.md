# DESIGN_SYSTEM.md — Arabic Heritage Modern

> **Source of truth for the visual and interaction design of the Police Academy Admissions Platform** (منظومة القبول · أكاديمية الشرطة).
> This file replaces all visual decisions baked into `_legacy/styles/*.css`. The legacy demo is no longer the visual spec — only this file is.

---

## 0. How to use this file

- Every change in `src/styles/tokens.css` MUST trace back to a section here.
- Every new component in `src/shared/components/` MUST cite the spec section it implements.
- Tailwind config (`tailwind.config.ts`) MUST mirror the tokens in §2.
- When in doubt, this file wins over `_legacy/`.

---

## 1. Design philosophy — Arabic Heritage Modern

The visual language for the Police Academy Admissions Platform is **distinctly Egyptian, distinctly modern, distinctly institutional.** It is not generic SaaS. It is not a Western product. It is not a knockoff of a Gulf government portal. It draws from three sources and refuses to look like any one of them:

1. **Egyptian heritage typography and ornamentation** — the calligraphic weight of Arabic, Islamic geometric tessellations as subtle background texture, gold-leaf restraint borrowed from manuscript bindings.
2. **Government-grade trust signals** — the sober color discipline, the disciplined typographic hierarchy, the institutional gravity of a ministerial system.
3. **2026-era product UI craftsmanship** — keyboard navigation, optimistic UI, motion that respects the user, density without clutter, every state designed (loading, empty, error, success).

Every screen should feel like it was designed for the Egyptian Ministry of Interior in 2026 — not for Stripe, not for Vercel, not for any Gulf ministry, not for a 2015 government portal. If a screen looks generic, it is wrong.

### Five non-negotiable principles

1. **Arabic-first, not Arabic-translated.** Layouts are designed RTL from scratch. Numbers, dates, and identifiers respect Arabic conventions. English appears only for technical identifiers (`Q1-2026`, `barcode 4837`).
2. **Density with discipline.** Government workflows show a lot of data. We embrace it — but with strict typographic hierarchy, generous line-height, and ruthless whitespace between groups.
3. **Color encodes meaning, never decoration.** Teal = primary action. Terracotta = critical / restricted. Gold = highlight / heritage. Cream = surface. Anything outside this is wrong.
4. **Motion serves the task.** Page transitions are 180ms. Micro-interactions are 120ms. Stage progression is 240ms. Anything longer is decoration and gets cut.
5. **Every state is designed.** Loading is not "spinner". Empty is not "no data". Error is not "something went wrong". Each gets a real composition with copy, illustration, and recovery path.

---

## 2. Design tokens

> Every value below goes verbatim into `src/styles/tokens.css`. Do not invent intermediate values. If a new shade is needed, add it here first, then to the CSS, then to `tailwind.config.ts`.

### 2.1 Color — the institutional palette

The system runs on **four core hues** plus semantic alerts. Each hue has a 9-stop ramp (50–900). Per-app accents reuse these ramps — no per-app custom colors.

```css
/* === CORE === */
--ink-50:  #F4F2ED;  /* page background, the "cream" surface */
--ink-100: #ECE7DC;
--ink-200: #D8CFB8;
--ink-300: #B5A88A;
--ink-400: #8C7E5E;
--ink-500: #5C5238;  /* body text on cream */
--ink-600: #3D3624;
--ink-700: #2A2517;
--ink-800: #1C190F;
--ink-900: #0E0C07;  /* headings */

/* === TEAL — primary brand, "navy of the Nile" === */
--teal-50:  #E6F0F0;
--teal-100: #BFD8D8;
--teal-200: #95BDBD;
--teal-300: #6AA1A1;
--teal-400: #3F8585;
--teal-500: #1A6868;  /* PRIMARY */
--teal-600: #155454;
--teal-700: #103F3F;
--teal-800: #0A2B2B;
--teal-900: #051818;

/* === GOLD — accent / heritage / highlight === */
--gold-50:  #FBF5E8;
--gold-100: #F4E5BD;
--gold-200: #ECD18C;
--gold-300: #E2BC5C;
--gold-400: #D4A445;  /* PRIMARY GOLD */
--gold-500: #B8862C;
--gold-600: #8E6620;
--gold-700: #674916;
--gold-800: #432F0D;
--gold-900: #221706;

/* === TERRACOTTA — critical, restricted, secrecy === */
--terra-50:  #FDF0EB;
--terra-100: #F8D6CC;
--terra-200: #F1B19F;
--terra-300: #E68870;
--terra-400: #D85F44;
--terra-500: #C8462C;  /* PRIMARY TERRA */
--terra-600: #A53620;
--terra-700: #7B2718;
--terra-800: #501810;
--terra-900: #280B07;

/* === SEMANTIC === */
--success: #2D7A4A;     /* success-500 */
--success-bg: #E8F3EC;
--warning: #B8862C;     /* alias of gold-500 */
--warning-bg: #FBF5E8;
--danger: #C8462C;      /* alias of terra-500 */
--danger-bg: #FDF0EB;
--info: #1A6868;        /* alias of teal-500 */
--info-bg: #E6F0F0;

/* === SURFACES === */
--surface-page: var(--ink-50);          /* main page bg */
--surface-card: #FFFFFF;                /* card bg */
--surface-elevated: #FFFFFF;            /* modals, drawers */
--surface-sunken: var(--ink-100);       /* table headers, secondary panels */
--surface-overlay: rgba(28, 25, 15, 0.55); /* modal backdrop */

/* === BORDERS === */
--border-subtle: rgba(28, 25, 15, 0.08);   /* default card border */
--border-default: rgba(28, 25, 15, 0.14);
--border-strong: rgba(28, 25, 15, 0.22);
--border-focus: var(--teal-500);

/* === TEXT === */
--text-primary: var(--ink-900);
--text-secondary: var(--ink-500);
--text-tertiary: var(--ink-400);
--text-inverse: #FFFFFF;
--text-on-teal: #FFFFFF;
--text-on-gold: var(--ink-900);
--text-on-terra: #FFFFFF;
```

### 2.2 Per-app accent — strict mapping

No app gets to invent a color. Each app picks a stop from the 4 ramps and a semantic role.

| App | Primary | Surface tint | Use |
|---|---|---|---|
| `admin` | `--teal-600` | `--teal-50` | the institutional baseline |
| `applicant` | `--teal-500` | `--ink-50` | calm, trustworthy public-facing |
| `committee` | `--gold-500` | `--gold-50` | committee = authority = gold |
| `board` | `--gold-700` | `--gold-50` | board / amana = deeper gold |
| `investigations` | `--terra-500` | `--terra-50` | restricted = terracotta |
| `medical` | `--teal-400` | `--teal-50` | clinical, calm |
| `barcode` | `--ink-700` | `--ink-100` | utility, achromatic |
| `biometric` | `--terra-400` | `--terra-50` | identity + caution |
| `exams` | `--gold-600` | `--gold-50` | knowledge / scholarship |

`AppShell` writes `data-app="<key>"` on its root. Each value triggers a CSS rule that overrides `--accent-500` and `--accent-50` for that subtree. Components use `--accent-500` not `--teal-500` directly when they want app-flavored surfaces.

### 2.3 Typography

```css
/* === FAMILIES === */
--font-ar: 'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui, sans-serif;
--font-ar-display: 'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif;
--font-en: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
--font-numeric: 'Inter', sans-serif;  /* tabular numbers */

/* Load via Google Fonts in index.html:
   IBM Plex Sans Arabic 400/500/600/700
   Tajawal 400/500/700/900
   Inter 400/500/600 + Inter tnum
   JetBrains Mono 400/500
*/

/* === SCALE — modular, ratio 1.200 (minor third) === */
--text-2xs: 11px;     /* line 16px - badges, micro labels */
--text-xs:  12px;     /* line 18px - meta, table footers */
--text-sm:  13px;     /* line 20px - body small, table cells */
--text-base: 15px;    /* line 24px - body default (Arabic reads better at 15 than 14) */
--text-md:  17px;     /* line 26px - lede paragraphs */
--text-lg:  20px;     /* line 28px - h4 / card titles */
--text-xl:  24px;     /* line 32px - h3 / page subtitles */
--text-2xl: 30px;     /* line 38px - h2 / page titles */
--text-3xl: 38px;     /* line 46px - h1 / hero headings */
--text-4xl: 48px;     /* line 54px - login splash, hub welcome */

/* === WEIGHTS — only three, ever === */
--weight-regular: 400;
--weight-medium:  500;
--weight-bold:    700;
/* No 300, no 600, no 800. Discipline. */

/* === LETTER SPACING === */
--tracking-tight: -0.01em;     /* large display only */
--tracking-normal: 0;
--tracking-wide: 0.04em;       /* small caps labels */
--tracking-arabic: 0;          /* never letter-space Arabic */

/* === LINE HEIGHTS === */
--leading-tight: 1.25;     /* display */
--leading-snug: 1.4;       /* headings */
--leading-normal: 1.6;     /* body */
--leading-relaxed: 1.75;   /* long-form Arabic prose */
```

### 2.4 Spacing — 4px base, geometric

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;     /* card padding inner */
--space-5: 20px;     /* card padding default */
--space-6: 24px;     /* section gap small */
--space-7: 32px;     /* section gap default */
--space-8: 40px;
--space-9: 48px;     /* section gap large */
--space-10: 64px;    /* page rhythm */
--space-11: 80px;
--space-12: 96px;    /* hero spacing */
```

### 2.5 Radii

```css
--radius-none: 0;
--radius-sm: 4px;       /* tags, micro */
--radius-md: 6px;       /* inputs, buttons */
--radius-lg: 10px;      /* cards */
--radius-xl: 14px;      /* hero cards, modals */
--radius-2xl: 20px;     /* feature panels */
--radius-pill: 999px;   /* pills, avatars */
```

### 2.6 Shadows — restrained

```css
--shadow-none: none;
--shadow-xs: 0 1px 2px rgba(28, 25, 15, 0.04);
--shadow-sm: 0 1px 3px rgba(28, 25, 15, 0.06), 0 1px 2px rgba(28, 25, 15, 0.04);
--shadow-md: 0 4px 8px rgba(28, 25, 15, 0.06), 0 2px 4px rgba(28, 25, 15, 0.04);
--shadow-lg: 0 12px 24px rgba(28, 25, 15, 0.08), 0 4px 8px rgba(28, 25, 15, 0.04);
--shadow-xl: 0 24px 48px rgba(28, 25, 15, 0.12);
--shadow-focus-teal: 0 0 0 3px rgba(26, 104, 104, 0.18);
--shadow-focus-terra: 0 0 0 3px rgba(200, 70, 44, 0.18);
--shadow-focus-gold: 0 0 0 3px rgba(212, 164, 69, 0.24);
```

Default elevation: cards use `--shadow-xs` resting, `--shadow-sm` hover. Modals use `--shadow-xl`. Drawers use `--shadow-lg`. **Never** use `--shadow-md` or larger on cards — it reads as web-app-from-2018.

### 2.7 Motion

```css
--duration-instant: 80ms;
--duration-fast: 120ms;       /* hover, focus, button press */
--duration-base: 180ms;       /* tab switch, accordion */
--duration-slow: 240ms;       /* page transition, drawer */
--duration-slower: 320ms;     /* hero reveal, large modal */

--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-emphasized: cubic-bezier(0.3, 0, 0, 1);
--ease-decelerate: cubic-bezier(0, 0, 0, 1);
--ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
```

Rules: page transitions fade + 4px translate, no slide. Stage stepper progression: 240ms. Toasts slide in from start-edge over 180ms, fade out 120ms.

Respect `prefers-reduced-motion: reduce` — set every duration to `0.01ms` and remove translate.

### 2.8 Z-index scale

```css
--z-base: 0;
--z-raised: 10;
--z-sticky: 100;
--z-dropdown: 200;
--z-modal-backdrop: 900;
--z-modal: 1000;
--z-toast: 1100;
--z-tooltip: 1200;
```

---

## 3. Heritage motifs — the Egyptian touches

These are the elements that make this product feel Egyptian rather than generic. Use sparingly — they are **garnish**, not the meal.

### 3.1 Geometric pattern — the "tessellation tile"

A subtle 8-fold star tessellation, used at 4% opacity as a watermark on:
- Login splash background
- Hub page hero panel
- Empty states for primary feature areas
- PDF report headers

**Spec:** SVG pattern tile, 64×64px, single line stroke 0.5px, color `var(--gold-500)` at 4% alpha. Render in `src/shared/components/Pattern.tsx` as `<HeritagePattern variant="tessellation-8" />`. Variants: `tessellation-8`, `khayameya-stripes`, `corner-flourish`.

### 3.2 Khayameya stripe

A horizontal multi-color stripe (teal · gold · terra · ink) used as:
- Top border of `AppShell` header (3px tall)
- Decision document / Board sessions header (6px tall)
- Bottom of certificate-style printables (12px tall)

Width breakdown: `30% teal · 20% gold · 6% terra · 44% ink-700`. Always in this exact ratio. Renders as a single `<div>` with `linear-gradient`.

### 3.3 Corner flourish

A small ornament (Islamic geometric corner motif) at 16×16px placed in:
- Modal corners (4 corners, gold-300, 30% alpha)
- Certificate top corners (gold-500, 100%)
- Print headers

`src/shared/components/CornerFlourish.tsx` — props: `corner` ('tl'|'tr'|'bl'|'br'), `size`, `color`.

### 3.4 Numeric display

Numbers in stat cards and KPIs use **Latin tabular figures** (Inter `font-feature-settings: "tnum"`) for alignment, but the **label** above them is Arabic. Never use Arabic-Indic numerals (٠١٢٣) in dashboards — they read poorly at small sizes. Reserve Arabic-Indic numerals for printed certificates and legal documents only.

---

## 4. Component specs

> Every component below has a corresponding file under `src/shared/components/`. Specs are non-negotiable. Variations beyond what's listed need to be added here first.

### 4.1 Button

States: `default` · `hover` · `active` · `focus-visible` · `disabled` · `loading`.
Variants: `primary` · `secondary` · `ghost` · `danger` · `success`.
Sizes: `sm` (28px) · `md` (36px, default) · `lg` (44px) · `xl` (52px, hero only).

```
primary:    bg teal-500, text white, hover teal-600, active teal-700,
            focus 3px teal-500/18% ring, disabled teal-200/text-on-teal at 60%
secondary:  bg surface-card, border 1px border-default, text ink-900,
            hover bg ink-50 border border-strong, focus same ring as primary
ghost:      bg transparent, text teal-600, hover bg teal-50, no border
danger:     bg terra-500, text white, hover terra-600, focus terra ring
success:    bg success, text white (used only for terminal positive actions like "اعتماد نهائي")
```

Loading: replace icon with 14px spinner + keep label.
Icon: 16px, 8px gap from label, color inherits.

### 4.2 Input / Select / Textarea / Combobox

Height: 36px default, 44px when label is inline, 28px in dense tables.
Border: 1px `--border-default`, hover `--border-strong`, focus 1px `--border-focus` + 3px teal ring.
Radius: `--radius-md`.
Padding: `0 12px` horizontal, plus 36px on the side that has an icon.

Label: above input, 13px medium ink-700, 4px gap. Required marker: terra-500 asterisk after label.
Helper: below input, 12px ink-500, 4px gap.
Error: replace helper with terra-600 text + 14px error icon.

**Validation timing:** never on first blur. Always on submit, then live on change for fields that previously errored. Use zod resolver in `react-hook-form`.

### 4.3 Card

Default card:
```
bg surface-card, border 1px border-subtle, radius lg, padding 20px,
shadow xs at rest, shadow sm on hover (only if interactive)
```

Variants:
- `Card.Stat` — KPI card, 16px label + 28px medium number + optional trend
- `Card.Feature` — hub-page app card, 24px padding, includes icon, accent border-top 3px in app color
- `Card.Compact` — 12px padding, 13px text, used in dense lists
- `Card.Elevated` — shadow sm at rest, shadow md hover, used for "primary CTA" grouping

Card never has a gradient. Card never has a colored background outside of `--surface-card`, `--surface-sunken`, or a 50-stop tint at 40% alpha. Period.

### 4.4 DataTable — the workhorse

The single most important component in the system. Used in 20+ screens.

Architecture:
```
<DataTable
  columns={...}                  // typed array
  data={...}                     // typed
  pagination={{ page, pageSize, total }}
  sortBy={...}
  filters={...}
  selectionMode="multi" | "single" | "none"
  onRowClick={(row) => ...}
  density="compact" | "default" | "comfortable"
  emptyState={<EmptyState ... />}
  loadingState="skeleton" | "spinner"
  stickyHeader
  zebraStripes
/>
```

Visual:
- Header row: bg `--surface-sunken`, 11px tracking-wide uppercase ink-500.
- Rows: bg `--surface-card`, alternating with `--ink-50` if `zebraStripes`.
- Hover: bg `--teal-50` if interactive.
- Selected row: 3px start-edge in `--accent-500`, bg `--accent-50`.
- Border between rows: 1px `--border-subtle`, never a heavy border.
- Cell padding: `12px 16px` default, `8px 12px` compact, `16px 20px` comfortable.
- Numeric cells: `font-numeric`, tnum, end-aligned.
- Status cells: use `<Badge />` not raw text.

Pagination: at bottom, end-aligned. Shows total count, page X of Y, prev/next, "10 / 25 / 50" page-size selector.

**Empty state inside table:** centered cell across all columns, 200px tall, illustration 96px + Arabic label + recovery CTA.

### 4.5 Badge / StatusBadge / Pill

```
Pill (neutral): bg ink-100, text ink-700, 11px medium, padding 2px 10px, radius pill
Badge.Status: maps domain enum → ramp:
  pending  → gold     (bg gold-50, text gold-700, dot gold-500)
  approved → success  (bg success-bg, text success, dot success)
  rejected → danger   (bg danger-bg, text danger, dot danger)
  suspended → terra-700 strong (bg terra-100, text terra-800, no dot, plus 🚫 icon)
  in-review → info    (bg info-bg, text info, dot info)
```

Each badge has a 6px dot when status is "live" (in-review, pending), no dot when terminal.

### 4.6 Stage stepper (for applicant 11-stage portal)

Horizontal on desktop, vertical on mobile (<640px).
States: `complete` · `current` · `upcoming` · `blocked` · `skipped`.

```
complete:   filled circle teal-500 with check icon, label ink-900 medium
current:    filled circle teal-500 with pulsing ring, label ink-900 bold + 13px helper
upcoming:   hollow circle border ink-300, number inside, label ink-400
blocked:    hollow circle border terra-500, lock icon, label terra-700
skipped:    hollow dashed circle ink-300, dash inside, label ink-400 italic
```

Connector line between steps: 2px ink-200, animates to teal-500 from start to end at 240ms when stage completes.

### 4.7 Wizard

Used for: applicant registration (11 stages), biometric enrollment (4 steps), exam creation (5 steps).

Layout: 2-column on desktop — left 30% (vertical stepper) + right 70% (current step content). On mobile, stepper collapses to a single-line breadcrumb above content.

Header: page title + step number "الخطوة X من Y" + auto-save indicator.
Footer: sticky, 64px tall, bg `--surface-card` border-top, with "السابق" (ghost) + "حفظ كمسودة" (secondary) + "التالي" (primary) on end-edge.

Each step has its own zod schema. Submit happens on final step only. Drafts auto-save every 8 seconds via `useDebounce(formValues, 8000)` → `mutate('/draft')`.

### 4.8 Modal / Drawer

Modal: centered, max-width 560px (sm), 720px (md), 920px (lg). Bg `--surface-elevated`, radius xl, shadow xl. Close button top-end, 32×32 ghost button.
Backdrop: `--surface-overlay` with backdrop-filter blur 4px (skip if reduced-motion).
Header: 24px title + optional subtitle, 24px padding bottom border.
Body: 24px padding, scrollable if > 60vh.
Footer: end-aligned buttons, 16px padding, top border.

Drawer: slides in from end-edge, width 480px (sm), 640px (md), 840px (lg). Same internal structure as modal. Used for: applicant quick-view, audit detail, biometric history, edit forms. Drawer is preferred over modal whenever the user might want to compare to the underlying page.

Both: trap focus, Escape closes, click-backdrop closes (configurable). First focusable element receives focus on open; on close, focus returns to trigger.

### 4.9 Toast

Position: bottom-end (RTL: bottom-left), 16px margin from edge.
Kinds: `success` · `info` · `warning` · `danger`.
Width: 360px max, auto on smaller viewports.
Auto-dismiss: 4s default, 6s for `warning`, no auto-dismiss for `danger` with action.

Spec already exists in `src/shared/components/Toast.tsx` — re-skin with new tokens, keep API.

### 4.10 Empty / Loading / Error states

These are FIRST-CLASS components, not afterthoughts.

**EmptyState:**
```
Centered, padding 48px, max-width 400px
Illustration: 120px SVG (gold linework on cream bg) — bespoke per context
Arabic title: 17px medium ink-900
Description: 14px ink-500, max 2 lines
CTA: primary or secondary button
```

Variants per context: `no-results-search`, `no-applicants-yet`, `no-cases`, `no-results-medical`, `no-questions`, `app-not-accessible` (RBAC-denied).

**LoadingState:**
- Skeleton boxes for table rows (8 rows) + cards (mirror layout)
- Shimmer animation: linear-gradient sweep, 1.5s loop, ink-100 to ink-50
- Never a spinner alone for >300ms layouts

**ErrorState:**
- 120px SVG illustration with terra-500 accents
- Arabic title: "تعذر تحميل البيانات"
- Description: actual error message in ink-500
- Two CTAs: "إعادة المحاولة" (primary) + "العودة" (ghost)
- Logs error to client error-tracking on mount

### 4.11 FileUpload

Drag-drop zone, 200×120px default, dashed border `--border-strong`.
States: `idle` · `dragover` · `uploading` · `success` · `error`.
Shows: file icon, name, size, progress bar 4px tall, retry/remove actions.
Accepts: configurable `accept` prop. Default size limit: 10MB.
Multiple files: stack in a list below the zone.

### 4.12 DateRangePicker / DatePicker

Two-month calendar dropdown, Arabic month names, week-start = Saturday (Egyptian convention).
Quick ranges: "اليوم", "الأسبوع", "الشهر", "آخر 30 يوم", "هذا الفصل".
Numeric display in calendar grid: Latin numerals (per §3.4).

### 4.13 Charts — extend existing

Existing: BarChart, LineChart, DonutChart (inline SVG). All re-skin with new palette.

**Add:**
- `Heatmap` — 7×N grid (days × weeks), color stops from `--ink-100` (cold) to `--teal-700` (hot). Used in Admin/Reports.
- `Sparkline` — 80×24px micro line chart for stat cards.
- `Gauge` — semicircle gauge, used for medical BMI station, exam pass-rate.
- `Funnel` — 4-stage funnel for applicant pipeline visualization.

All charts: respect `prefers-reduced-motion` (skip the entry animation).

### 4.14 Sidebar / AppShell

Sidebar: 256px wide expanded, 64px collapsed. Background `--surface-card`, border-end `--border-subtle`.

Top: app logo + name (28px tall logo + 17px medium app label).
Nav items: 40px tall, 12px icon + 14px label, hover bg `--ink-50`, active 3px start-edge `--accent-500` + bg `--accent-50` + text `--accent-600`.
Footer: user card (avatar 32px + name + role) clickable to open user menu.

Header: 64px tall, sticky, bg `--surface-card` border-bottom `--border-subtle`. Contains: page title + breadcrumb + global search (⌘K) + notifications + user avatar.
Khayameya stripe: 3px tall, top of header, per §3.2.

### 4.15 Combobox / Multi-select

Searchable dropdown with virtualized list for >100 items. Used for: governorates, certificates, committees, stations, exam categories.
Header inside dropdown: search input (always visible).
Item: 36px tall, optional avatar/icon + label + optional badge.
Selected: check icon at end-edge.

### 4.16 PrintLayout (the killer detail)

Many screens print. We design print explicitly.

`<PrintLayout>` wraps content for printing:
- A4 portrait or landscape (controlled by prop)
- Header: ministry crest + academy name + report title + date + "سري للغاية" stamp if restricted
- Footer: page number / total + generation timestamp + report ID barcode
- Khayameya stripe at bottom (§3.2, 12px tall)
- All charts re-render in print-safe SVG (no shadows, line widths +0.5px)
- All Arabic numerals can be flipped to Indic via `dir="rtl"` lang switch (per §3.4)

Trigger: `useReactToPrint()` hook from `react-to-print`. CSS uses `@media print` for hiding nav, sidebar, action buttons.

---

## 5. Icon system

Use **lucide-react** (already installed). Icon stroke-width: 1.75 default (slightly chunkier than default 2 reads better at small sizes against the cream surface). Sizes: 14 / 16 / 20 / 24 / 32.

Custom icons (Egyptian-context):
- `app/IconBarcode` (replaces lucide barcode for scale)
- `app/IconBiometric` (composite: face + fingerprint)
- `app/IconCertificate` (Arabic certificate scroll)
- `app/IconStamp` (سري للغاية stamp)
- `app/IconSeal` (Egyptian eagle seal — outline only)

All custom icons live in `src/shared/components/icons/` as `.tsx` SVG components.

---

## 6. Page templates

Four canonical page templates. Every page in the app inherits one of these.

### 6.1 Dashboard template
1. PageHeader (title + actions + filters)
2. KPI grid (3-4 stat cards)
3. Primary chart row (1-2 large charts)
4. Secondary content (table + side panel OR two charts)

Used by: `/admin`, `/medical`, `/exams`, `/biometric`, `/committee`, `/board`.

### 6.2 List + Detail template
1. PageHeader (title + filters + bulk actions)
2. DataTable (full width)
3. Optional: drawer opens on row click for quick view; click-through goes to detail page

Used by: `/admin/applicants`, `/admin/users`, `/admin/audit`, `/committee/list`, `/investigations/cases`, `/medical/queue`.

### 6.3 Wizard template
1. PageHeader compact (title only + auto-save badge)
2. 2-column: vertical stepper (30%) + step content (70%)
3. Sticky footer (back/draft/next)

Used by: `/applicant`, `/biometric/enroll`, `/exams/create`.

### 6.4 Document / Report template
1. PrintLayout header
2. Cover section (title + meta table)
3. Content sections (numbered, Arabic-prefixed)
4. Charts and tables (print-safe)
5. PrintLayout footer

Used by: applicant detail print, certificate, board decisions, audit reports, medical results.

---

## 7. RTL specifics

- Always use logical properties: `padding-inline-start`, `margin-inline-end`, `border-inline-start`, `text-align: start`.
- Tailwind: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`.
- Direction-flipping: arrows, breadcrumb separators, charts that have a time axis (time goes right-to-left in Arabic).
- Numbers stay LTR even inside RTL paragraphs (Unicode bidi handles this; never override with `direction: ltr` unless inside a code block).
- Mixing Arabic + English in one line: use `<span dir="ltr">` around English-only content (e.g., barcode IDs, email addresses).

---

## 8. Accessibility — WCAG AA mandatory

- Every interactive element has a visible focus ring (3px ring per §2.6).
- Color contrast: text ≥ 4.5:1 against bg, large text ≥ 3:1, UI controls ≥ 3:1.
- Every form field has a `<label>` (or `aria-labelledby` for compound fields).
- Every modal/drawer traps focus.
- Live regions: toasts use `role="status"`, error toasts use `role="alert"`.
- Tables have `<caption>` (visually hidden) and `scope="col|row"` on headers.
- Charts have `role="img"` + `aria-label` + visually-hidden `<table>` fallback for SR users.
- Keyboard shortcuts: ⌘K global search, Esc closes overlay, Tab order matches visual order.

---

## 9. Implementation checklist for Claude Code

When refactoring an existing component or creating a new one, verify in order:

1. ☐ Tokens used? (no hard-coded hex, no hard-coded px outside tokens)
2. ☐ App-accent variable? (`--accent-500` not `--teal-500`)
3. ☐ All five states designed? (default · hover · active · focus · disabled)
4. ☐ Loading + empty + error states implemented?
5. ☐ Keyboard navigation works? (Tab, Esc, Enter)
6. ☐ Focus visible on all interactives?
7. ☐ RTL logical properties used?
8. ☐ Arabic copy exact-match from `_legacy/` or this repo (never retyped)?
9. ☐ Reduced-motion respected?
10. ☐ Print styles defined (if applicable)?

---

## 10. Files to create / modify

The following file structure must result from applying this design system:

```
src/styles/
├── tokens.css           ← REWRITE entirely from §2
├── base.css             ← REWRITE: reset + body bg + arabic font defaults
├── components.css       ← DELETE (replaced by Tailwind utilities + component CSS modules)
├── apps.css             ← REWRITE: only data-app[data-app="x"] { --accent-*: ... } overrides
├── print.css            ← NEW: @media print rules per §6.4
└── motifs.css           ← NEW: keyframes for stage stepper, toast, modal entry

src/shared/components/
├── Pattern.tsx           ← NEW (heritage tessellation)
├── CornerFlourish.tsx    ← NEW
├── KhayameyaStripe.tsx   ← NEW
├── PrintLayout.tsx       ← NEW
├── Heatmap.tsx           ← NEW (chart)
├── Sparkline.tsx         ← NEW
├── Gauge.tsx             ← NEW
├── Funnel.tsx            ← NEW
├── DataTable.tsx         ← NEW (replaces ad-hoc tables across features)
├── Modal.tsx             ← NEW
├── Drawer.tsx            ← NEW
├── Wizard.tsx            ← NEW
├── FileUpload.tsx        ← NEW
├── DateRangePicker.tsx   ← NEW
├── Combobox.tsx          ← NEW
├── EmptyState.tsx        ← REPLACE existing with §4.10 spec
├── LoadingState.tsx      ← NEW (skeletons)
├── ErrorState.tsx        ← NEW
└── icons/                ← NEW folder for app-specific icons

src/shared/lib/
└── motion.ts             ← NEW: reduced-motion-aware framer-motion presets
```

`tailwind.config.ts` — extend `theme.colors`, `theme.spacing`, `theme.borderRadius`, `theme.fontFamily`, `theme.fontSize`, `theme.boxShadow`, `theme.transitionDuration`, `theme.transitionTimingFunction` to mirror §2 exactly. Do not allow Tailwind defaults to leak in for these scales.

---

## 11. What NOT to do — failure modes

The following appear in 80% of generic SaaS rebuilds. They are forbidden here.

- ❌ Purple gradients on white (the most overused AI-generated aesthetic)
- ❌ Glassmorphism / frosted-glass cards
- ❌ Heavy drop shadows (anything `> --shadow-md` on a card)
- ❌ Mid-sentence bolding in body copy
- ❌ "Vercel-style" inverted-color hero sections
- ❌ Animated illustrations on dashboards (motion serves the task, not the eye)
- ❌ More than 3 weights of the same font on one screen
- ❌ Color-only meaning (always pair with icon or text)
- ❌ Untranslated English UI labels (every label is Arabic; English appears only as identifiers)
- ❌ Title Case in Arabic (Arabic doesn't have casing — never apply English-style capitalization rules to Arabic)
- ❌ Emoji in production UI (the only exception: in the Toast component, optionally, for personality)

---

*Maintained by Engineering Manager · Appenza Studio. Updated alongside any token or component change.*
