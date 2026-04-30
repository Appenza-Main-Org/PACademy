# 🎯 Mission: Rebuild the Police Academy Admissions Frontend in Production-Grade React

You are taking over a complete vanilla HTML/JS/CSS demo and rebuilding it as a **production-ready React 18 + TypeScript + Vite + shadcn/ui** application. The current demo lives in this repository — it is your **functional, visual, and data specification**. The backend will be built in a later session and is not your concern now.

---

## ⚠️ CRITICAL: Read These Files FIRST

Before writing a single line of code, do this in order:

1. **Open the project in your browser** — start a local server (`python3 -m http.server 8000`) and click through every page. Login, visit all 9 apps, check the architecture page. **Take notes on what you see.** You are recreating this exactly.
2. **`README.md`** — project overview, RBAC matrix, design system, full file structure
3. **`index.html`** — entry point + script load order (this is your dependency graph)
4. **`styles/tokens.css`** — every color, spacing, radius, shadow, font, and animation token. **This is your design system. Copy these tokens 1:1.**
5. **`styles/components.css`, `layout.css`, `apps.css`** — read every selector. These are your component variants (primary buttons, cards, badges, sidebar, login art, biometric scan, barcode, etc.)
6. **`js/services/mock-data.js`** — the exact shape of every entity. Your TypeScript types must match.
7. **`js/services/auth.service.js`** — the **complete RBAC matrix (11 roles)**. This is your authorization spec.
8. **`js/services/*.service.js`** (other 8 files) — each has API contracts in JSDoc comments. **You will replicate these as TanStack Query hooks against a mock service layer.**
9. **`js/pages/*.js`** — read every page. Understand the layout, the data shown, the interactions. Your React components mirror these.
10. **`js/lib/charts.js`** — inline SVG charts (bar, line, donut, heatmap). You'll port these to React components — do **not** reach for a third-party chart library; the inline SVGs are part of the design.

**Do not skip step 1.** You cannot rebuild what you have not seen running.

---

## 🎯 What You Are Building

A **single-page React application** that:

1. Visually matches the existing demo **pixel-for-pixel** (or improves where shadcn/ui offers a clearly better pattern)
2. Has the same 12 routes (`/login`, `/`, `/admin`, `/applicant`, `/committee`, `/board`, `/investigations`, `/medical`, `/barcode`, `/biometric`, `/question-bank`, `/architecture`)
3. Uses the same mock service layer pattern — but rewritten as **TypeScript modules with proper types** and **TanStack Query hooks** so they're trivially swappable for a real API later
4. Implements the same RBAC (11 roles, route guards, conditional UI)
5. Is **fully RTL** with Arabic-first content
6. Has **zero console errors, zero TypeScript errors, zero ESLint warnings**
7. Builds to a static bundle deployable to any web server (no Node runtime needed in production)

You are **not** building a backend. The mock service layer stays — it just gets typed and modernized.

---

## 🛠️ Tech Stack — MANDATORY

| Layer | Choice | Version | Why |
|---|---|---|---|
| **Framework** | React | 18.3+ | latest stable |
| **Language** | TypeScript | 5.5+ | strict mode mandatory |
| **Build tool** | Vite | 5.4+ | fastest DX, native ESM |
| **Routing** | `react-router-dom` | 6.26+ | data router with loaders |
| **Server state** | `@tanstack/react-query` | 5+ | fetching, caching, mutations |
| **Client state** | `zustand` | 4.5+ | minimal, no Redux boilerplate |
| **UI library** | `shadcn/ui` (latest) | — | install components as needed |
| **Styling** | Tailwind CSS | 3.4+ | matches shadcn/ui, RTL-friendly |
| **Forms** | `react-hook-form` + `zod` | 7+ / 3+ | type-safe validation |
| **Icons** | `lucide-react` | latest | matches shadcn/ui |
| **Date utils** | `date-fns` | 3+ | tree-shakable, Arabic locale |
| **HTTP client** | `axios` | 1+ | interceptors for auth header |
| **Linting** | ESLint + `eslint-config-airbnb-typescript` | latest | strict |
| **Formatting** | Prettier | 3+ | with `prettier-plugin-tailwindcss` |
| **Testing** | Vitest + Testing Library | latest | unit + integration |
| **E2E** | Playwright | latest | smoke tests |
| **Git hooks** | Husky + lint-staged | latest | quality gate |

### Forbidden Choices

- ❌ **No Create React App** — deprecated, use Vite
- ❌ **No Redux / Redux Toolkit** — Zustand is sufficient and simpler
- ❌ **No Material UI / Ant Design / Chakra** — shadcn/ui is mandated
- ❌ **No styled-components / emotion** — Tailwind is mandated
- ❌ **No `any` in TypeScript** — strict mode, prefer `unknown` and narrow
- ❌ **No `useEffect` for data fetching** — TanStack Query only

---

## 🏗️ Project Architecture — Feature-Based Clean Structure

```
police-academy-frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Root component + providers
│   ├── routes.tsx                    # Route registration
│   │
│   ├── app/
│   │   ├── providers/                # All app-level providers
│   │   │   ├── QueryProvider.tsx     # TanStack Query
│   │   │   ├── ThemeProvider.tsx     # shadcn theme
│   │   │   └── AuthGuard.tsx         # Route protection
│   │   └── layouts/
│   │       ├── AppShell.tsx          # Header + sidebar + main
│   │       ├── PublicShell.tsx       # For login, applicant portal
│   │       └── BlankShell.tsx
│   │
│   ├── features/                     # ⭐ Feature modules (one per app)
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   │   ├── auth.service.ts   # Mock service (typed)
│   │   │   │   └── auth.queries.ts   # TanStack Query hooks
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RoleSelector.tsx
│   │   │   │   └── LoginArtPanel.tsx
│   │   │   ├── pages/
│   │   │   │   └── LoginPage.tsx
│   │   │   ├── store/
│   │   │   │   └── auth.store.ts     # Zustand store
│   │   │   ├── types.ts
│   │   │   └── rbac.ts               # Role definitions, permission helpers
│   │   ├── applicants/
│   │   ├── committees/
│   │   ├── board/
│   │   ├── investigations/
│   │   ├── medical/
│   │   ├── barcode/
│   │   ├── biometric/
│   │   ├── exams/
│   │   ├── audit/
│   │   ├── architecture/
│   │   └── hub/                      # Landing page with 9 app cards
│   │
│   ├── shared/                       # ⭐ Shared/cross-cutting code
│   │   ├── components/               # Custom shared components
│   │   │   ├── charts/               # Bar, Line, Donut, Heatmap (port from charts.js)
│   │   │   │   ├── BarChart.tsx
│   │   │   │   ├── LineChart.tsx
│   │   │   │   ├── DonutChart.tsx
│   │   │   │   └── Heatmap.tsx
│   │   │   ├── data-table/           # Reusable data table with filters/pagination
│   │   │   ├── stat-card/
│   │   │   ├── status-badge/         # Maps applicant status → colored badge
│   │   │   ├── stage-stepper/        # 11-stage applicant journey
│   │   │   ├── empty-state/
│   │   │   ├── page-header/
│   │   │   ├── breadcrumbs/
│   │   │   ├── activity-feed/
│   │   │   ├── biometric-scan/       # The animated face/fingerprint widget
│   │   │   ├── barcode-display/      # Visual barcode card
│   │   │   └── arabic-avatar/        # Avatar with Arabic letter fallback
│   │   ├── components/ui/            # shadcn/ui generated components live here
│   │   ├── hooks/
│   │   │   ├── useDebounce.ts
│   │   │   ├── useDocumentTitle.ts
│   │   │   └── usePagination.ts
│   │   ├── lib/
│   │   │   ├── api-client.ts         # axios instance with interceptors
│   │   │   ├── format.ts             # num, date, relTime, masking
│   │   │   ├── arabic.ts             # Arabic text utilities, name truncation
│   │   │   ├── national-id.ts        # Egyptian National ID validator
│   │   │   ├── cn.ts                 # className merge (clsx + tailwind-merge)
│   │   │   └── constants.ts
│   │   ├── types/                    # Cross-feature types
│   │   │   ├── api.ts                # Pagination, ApiError, etc.
│   │   │   └── rbac.ts
│   │   └── mock-data/                # Centralized mock data generators
│   │       ├── applicants.ts
│   │       ├── users.ts
│   │       ├── audit.ts
│   │       ├── committees.ts
│   │       └── index.ts
│   │
│   ├── styles/
│   │   ├── globals.css               # Tailwind base + tokens as CSS vars
│   │   └── tokens.css                # Direct port from current demo
│   │
│   └── config/
│       ├── env.ts                    # Validated env vars (zod)
│       └── routes.ts                 # Route constants
│
├── tests/
│   ├── unit/                         # Vitest tests
│   └── e2e/                          # Playwright smoke tests
│
├── .vscode/
│   ├── settings.json                 # Format on save, ESLint
│   └── extensions.json
├── .eslintrc.cjs
├── .prettierrc
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json                     # strict: true, no implicit any
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml                    # use pnpm, not npm
├── .gitignore
├── .env.example
├── components.json                   # shadcn/ui config
├── README.md
├── ARCHITECTURE.md
├── DESIGN_SYSTEM.md
└── CHANGELOG.md
```

### Architecture Rules — STRICTLY ENFORCED

1. **`features/X/` is self-contained.** It owns its types, API, components, pages, and store. Other features import only via the feature's barrel `index.ts`.
2. **`features/X/` may import from `shared/`.** Never the reverse.
3. **`shared/` may not import from any `features/`.** This is the critical Clean Arch rule.
4. **Pages are dumb composers.** They orchestrate hooks + components. No business logic in pages.
5. **API services are typed and isolated.** Every service file exports typed functions; queries.ts wraps them in hooks.
6. **No prop drilling beyond 2 levels.** Use Zustand for cross-cutting state, TanStack Query for server state.

If a junior dev imports `features/admin/...` from inside `features/medical/...`, the architecture is broken. **Catch this with `eslint-plugin-boundaries`.**

---

## 🎨 Design System — DIRECT PORT from Existing Demo

You will port `styles/tokens.css` to a Tailwind config + CSS variables setup. **The demo's tokens are authoritative — don't invent new colors.**

### Step 1: Copy Tokens to CSS Variables

Create `src/styles/tokens.css`:
- Read `styles/tokens.css` from the demo
- Copy every `--brand-*`, `--surface-*`, `--text-*`, `--success/warning/danger/info`, `--r-*`, `--shadow-*`, `--sp-*`, `--fs-*`, `--ease-*`, `--dur-*`, `--app-*` token verbatim
- Keep the `[data-app="x"]` per-app accent overrides

### Step 2: Map Tokens to Tailwind Config

In `tailwind.config.ts`:
```ts
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'hsl(var(--brand-primary-hsl) / <alpha-value>)',
          // ... all brand-* tokens
        },
        // shadcn/ui semantic colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        // etc.
      },
      fontFamily: {
        ar: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
        en: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: { /* from --r-* */ },
      boxShadow: { /* from --shadow-* */ },
      spacing: { /* from --sp-* */ },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### Step 3: Configure shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate** (we'll override with our brand colors)
- CSS variables: **Yes**
- RTL: **Yes** (configure manually if not auto-detected)
- Components path: `src/shared/components/ui`
- Utils path: `src/shared/lib/cn.ts`

Then install components as needed (don't install all at once):
```bash
pnpm dlx shadcn@latest add button card badge input select table dialog dropdown-menu \
  alert avatar progress separator tabs form label tooltip toast skeleton \
  command popover scroll-area sheet
```

### Step 4: RTL Configuration

- `<html lang="ar" dir="rtl">` in `index.html`
- Tailwind classes use `text-start`/`text-end` not `text-left`/`text-right`
- Use logical properties: `ms-` (margin-start), `me-` (margin-end), `ps-`, `pe-`
- Icons that have direction (arrows) need flipping — use `rtl:rotate-180` or `rtl:scale-x-[-1]`

---

## 📋 Implementation Plan — Phase by Phase

Work through these phases **in order**. After each phase, **commit and verify the app runs without errors** before moving to the next.

### Phase 1 — Project Foundation (~30 min)

1. `pnpm create vite police-academy-frontend --template react-ts`
2. Install all dependencies from the Tech Stack table
3. Configure TypeScript with strict mode (read `tsconfig.json` requirements below)
4. Configure ESLint with airbnb + boundaries plugin
5. Configure Prettier with tailwind plugin
6. Set up Husky + lint-staged
7. Set up directory structure exactly as specified above
8. Configure path alias `@/*` → `src/*` in both Vite and tsconfig
9. Set up `index.html` with RTL, fonts, and meta tags matching the demo

**`tsconfig.json` must include:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

**Verify:** `pnpm dev` runs and shows a blank page. `pnpm lint` passes. `pnpm typecheck` passes.

### Phase 2 — Design System & shadcn/ui (~45 min)

1. Port `tokens.css` from the demo to `src/styles/tokens.css`
2. Convert each color token to HSL format (Tailwind requires HSL for `<alpha-value>`)
3. Configure `tailwind.config.ts` to expose all tokens
4. Run `pnpm dlx shadcn@latest init` and install the listed components
5. Customize shadcn theme to use **our brand colors** (not the default slate)
6. Create `src/styles/globals.css` with `@tailwind base/components/utilities` + token imports
7. Test: render `<Button variant="default">Test</Button>` — should match the demo's `.btn-primary` styling

**Verify:** A test page renders a button, card, and badge using our brand colors with proper RTL alignment.

### Phase 3 — Shared Infrastructure (~1 hour)

Build the foundation everything else depends on:

1. **`shared/lib/api-client.ts`** — axios instance with base URL, request/response interceptors, error normalization
2. **`shared/lib/format.ts`** — port `UI.num`, `UI.date`, `UI.escape`, `relTime` from `js/lib/ui.js`
3. **`shared/lib/national-id.ts`** — Egyptian National ID validator with full TypeScript types
4. **`shared/lib/arabic.ts`** — Arabic name truncation (smart — handles `العميد د. أحمد محمود` correctly), text normalization
5. **`shared/lib/cn.ts`** — `clsx` + `tailwind-merge`
6. **`shared/types/api.ts`** — `Pagination<T>`, `ApiError`, `ApiResponse<T>`
7. **`shared/mock-data/`** — port `js/services/mock-data.js` to typed TS modules
   - **Maintain deterministic output** — same seed produces same data on every render
   - 240 applicants, 10 users, 80 audit entries, 8 questions, 8 medical stations, 5 committees, 14-day timeseries, KPIs
8. **`features/auth/rbac.ts`** — port `ROLE_DEFINITIONS` from `auth.service.js` to typed TypeScript with proper enums

**Verify:** All utilities have unit tests. National ID validator passes with valid IDs and rejects invalid.

### Phase 4 — Auth Feature (~1 hour)

1. **`features/auth/types.ts`** — `User`, `Role`, `Permission`, `LoginCredentials`, `AuthState`
2. **`features/auth/api/auth.service.ts`** — typed mock service with documented endpoint contracts
3. **`features/auth/api/auth.queries.ts`** — `useLoginMutation`, `useCurrentUser`, `useLogoutMutation`
4. **`features/auth/store/auth.store.ts`** — Zustand store with `persist` middleware (sessionStorage)
5. **`features/auth/components/RoleSelector.tsx`** — 8 role cards, single-select
6. **`features/auth/components/LoginArtPanel.tsx`** — left-side branded panel with stats (12K+, 9 apps, 100%)
7. **`features/auth/components/LoginForm.tsx`** — react-hook-form + zod
8. **`features/auth/pages/LoginPage.tsx`** — composes the above
9. **`app/providers/AuthGuard.tsx`** — redirects to `/login` if not authenticated, with role-based access check
10. **Permission helper** — `hasPermission(perm: string)` + `canAccessApp(appKey: string)` with wildcard support (`*`, `applicants:*`)

**Verify:** Login → Hub flow works. Refreshing the page keeps you logged in. Logging out clears state.

### Phase 5 — App Shell & Layouts (~1 hour)

1. **`app/layouts/AppShell.tsx`** — header + collapsible sidebar + main content
2. **Header**: brand logo, app pill (when inside an app), notifications icon, user menu, logout button
3. **Sidebar**: per-app navigation with active state, badges for counts, RTL borders
4. **`shared/components/page-header/PageHeader.tsx`** — title + subtitle + breadcrumbs + actions slot
5. **`shared/components/breadcrumbs/Breadcrumbs.tsx`**
6. **Per-app theming** — wrap shell in `<div data-app="medical">` to activate per-app accent colors via CSS variables

**Verify:** Render a placeholder page inside the shell. Sidebar navigation works. Active route highlighted.

### Phase 6 — Hub Page (~30 min)

1. **`features/hub/pages/HubPage.tsx`**
2. **Hero section** with welcome message (handle Arabic name truncation properly)
3. **KPI section** — 4 stat cards (total applicants, paid, under review, approved) with trend arrows
4. **Apps grid** — 9 app cards, grouped by platform (Internet 🌐 / Internal 🏢)
5. **App card hover effects** — top accent line scales in on hover, arrow translates
6. **Lock state** — show all 9 apps but lock cards user can't access (per RBAC) with `🔒 محظور` badge
7. **Footer** — government attribution

**Verify:** All 9 apps visible. Cards link correctly. Locked cards show locked state for limited roles.

### Phase 7 — Charts (~45 min)

Port `js/lib/charts.js` to React components in `shared/components/charts/`:

1. **`BarChart.tsx`** — props `{ data: ChartData[]; height?: number; color?: string; showValues?: boolean }`
2. **`LineChart.tsx`** — props with optional gradient area fill
3. **`DonutChart.tsx`** — with center total + legend
4. **`Heatmap.tsx`** — grid with intensity colors

Use **inline SVG** (not a chart library). Same animations as the demo (`<animate>` SVG elements). Add subtle tooltips on hover.

**Verify:** Storybook-like test page renders all 4 chart types with sample data identical to demo.

### Phase 8 — Admin Feature (~2 hours)

The biggest feature. Build all 7 routes:

1. **`/admin`** — Dashboard with KPIs, line chart (registrations), donut (cert types), recent applicants table, audit feed, geographic distribution bar chart
2. **`/admin/applicants`** — Filterable, paginated data table with search, status filter, governorate filter, certificate type filter
3. **`/admin/applicants/:id`** — Detail page with personal info, academic info, test results grid, investigation status, sidebar with current status + activity timeline + payment info
4. **`/admin/users`** — System users table with role badges, status indicators, last login
5. **`/admin/audit`** — Audit log with action color coding, filters, IP column
6. **`/admin/settings`** — Two-column: admission requirements + external integrations status
7. **`/admin/reports`** — Reports with charts (line, donut, bar) and export buttons

**Use `shared/components/data-table/`** as the reusable table primitive. Build it once, use everywhere.

### Phase 9 — Applicant Portal (~1 hour)

1. **`/applicant`** — Public-facing portal
2. **Hero** — "أهلاً بك في منظومة القبول الإلكتروني" with application ID
3. **Stage stepper** — 11 stages (تسجيل أولي → سداد → ... → الاختبار النهائي) with done/current/pending states
4. **Current stage content** — for the demo, show "رفع المستندات" stage with 6 document upload cards
5. **Support section** — 3 cards (phone, email, FAQ)

**Verify:** Stepper shows correct progress. Document cards have hover/upload states.

### Phase 10 — Remaining Apps (~3 hours)

Build all remaining 7 features. Each follows the same structure: `api/`, `components/`, `pages/`, optionally `store/`.

1. **Committee (2.1)** — `/committee` (overview with 5 committee cards), `/committee/list`, `/committee/schedule`
2. **Board (2.2)** — `/board` (members + decisions), `/board/sessions`, `/board/decisions`
3. **Investigations (2.3)** — `/investigations` (cases with secrecy alert), `/investigations/incoming`, `/investigations/outgoing`
4. **Medical (2.4)** — `/medical` (8 station cards), `/medical/queue`, `/medical/results`
5. **Barcode (2.5)** — `/barcode` (generator + visual card preview), `/barcode/lookup`, `/barcode/batch`
6. **Biometric (2.6)** — `/biometric` (face + fingerprint scan), `/biometric/enroll` (4-step wizard), `/biometric/history`
7. **Question Bank (2.7)** — `/question-bank` (categories + question cards with correct answer highlight), `/question-bank/exams`, `/question-bank/results`

For each: **the visual must match the demo screenshots.** Use shadcn/ui primitives but customize to match.

### Phase 11 — Architecture Page (~30 min)

1. **`/architecture`** — Visual representation of the entire platform
2. **Legend** — 5 color swatches for each tier
3. **Diagram** — 6 stacked tiers (Internet, Security/DMZ, Internal, Services, Data, External Integrations)
4. **Each tier** — colored box with arch-blocks inside
5. **Integrations table** — 6 external systems with endpoint, auth, purpose, status
6. **Tech stack section** — 6 cards (Frontend, Backend, Data, Security, DevOps, Integration) with tech lists

### Phase 12 — Polish, Testing, Docs (~2 hours)

1. **Loading states** — every async data fetch has a skeleton
2. **Error states** — friendly Arabic error messages, retry buttons
3. **Empty states** — when filters return no results
4. **Toast notifications** — for actions (login success, logout, etc.)
5. **Page transitions** — fade + slide-up animation (matches demo's `page-enter`)
6. **Unit tests** — at least 80% coverage on `shared/lib/` and feature stores/services
7. **E2E tests** — Playwright smoke test: login → hub → click each app card → verify URL
8. **Documentation**:
   - `README.md` — quick start, dev commands, project structure
   - `ARCHITECTURE.md` — Clean Arch rules, feature module pattern, why each lib was chosen
   - `DESIGN_SYSTEM.md` — token reference, component variants, RTL guidelines
   - `CHANGELOG.md` — semantic versioning from v0.1.0

---

## 🎨 Design Principles to Follow

### Code Style

- **TypeScript strict mode**, no `any`, prefer `unknown` and narrow with type guards
- **Component files** are PascalCase: `LoginForm.tsx`. Hooks are camelCase: `useDebounce.ts`
- **Named exports only** (no default exports) — easier refactoring
- **Co-locate** types with their primary user (component types in component file, not in separate `types.ts` unless shared)
- **Boolean props prefix**: `is*`, `has*`, `should*` (`isLoading`, `hasError`)
- **Event handlers**: `on*` for props, `handle*` for implementations
- **Index files** export feature's public API only — internal components are not exported

### Components

- **Single responsibility** — if a component is >150 lines, split it
- **Accept `className`** to allow style composition
- **Use `forwardRef`** for components that wrap an HTML element
- **Memoize expensive renders** with `React.memo` only when profiler shows benefit
- **Don't pass entire objects** if you only need 2 fields — destructure at the call site

### Performance

- **Code-split routes** with `React.lazy` + `Suspense`
- **TanStack Query staleTime** — set to 5 min for relatively static data, 30s for live
- **Virtualize long lists** with `@tanstack/react-virtual` (if a table has >100 rows)
- **Debounce search inputs** (300ms)
- **Lazy-load images** with `loading="lazy"`
- **Bundle analysis** — run `vite-plugin-visualizer` to keep bundle <500KB initial chunk

### State Management

| State Type | Tool | When |
|---|---|---|
| **Server data** | TanStack Query | Anything fetched from a service |
| **URL state** | React Router params/search | Filters, pagination, current applicant |
| **Global client state** | Zustand | Auth user, theme, toast queue |
| **Local state** | `useState` | Form inputs, modals, accordions |
| **Derived state** | `useMemo` / computed | Filtered lists, formatted strings |

**Never use Redux.** Never use Context for things Zustand handles better.

### Forms

- **react-hook-form + zod** for every form
- **Zod schemas** are the source of truth — TypeScript types are inferred from them
- **Field-level validation** with errors shown inline
- **Loading state** disables submit button + shows spinner
- **Reset on success** unless editing an existing entity

### Accessibility

- All interactive elements have **visible focus states** (use shadcn/ui defaults — they're WCAG AA)
- **Semantic HTML** — `<nav>`, `<main>`, `<aside>`, `<button>` (not `<div onClick>`)
- **ARIA labels** for icon-only buttons
- **Keyboard navigation** works everywhere — Tab, Enter, Escape
- **Color contrast** ≥4.5:1 (already satisfied by our token palette)
- **RTL screen reader** support — semantic order matches visual order

### Logging & Errors

- **Error Boundary** at app root (and per route) catches React errors
- **TanStack Query error handler** for all async failures
- **User-facing errors** are in Arabic, friendly, actionable
- **Dev-only console errors** are warnings — production logs go to a service later

---

## 🔌 Mock Service Layer Pattern

**This is critical** — the entire app must be ready to swap mocks for real APIs by changing one import.

### Service File Structure

```ts
// features/applicants/api/applicant.service.ts

/**
 * Applicants API Contract
 *
 * REAL ENDPOINTS (to implement in backend):
 *   GET    /api/applicants?page=&search=&status=&governorate=&certType=
 *   GET    /api/applicants/:id
 *   POST   /api/applicants
 *   PUT    /api/applicants/:id
 *   POST   /api/applicants/:id/stage
 *   GET    /api/applicants/:id/timeline
 *   GET    /api/applicants/stats
 */

import type { Applicant, ApplicantFilters, ApplicantStats, TimelineEvent } from '../types';
import { mockApplicants } from '@/shared/mock-data/applicants';
import { simulateLatency } from '@/shared/lib/mock-helpers';

export const applicantService = {
  async list(filters: ApplicantFilters): Promise<Pagination<Applicant>> {
    await simulateLatency();
    // ... mock implementation
  },

  async getById(id: string): Promise<Applicant | null> {
    await simulateLatency();
    return mockApplicants.find((a) => a.id === id) ?? null;
  },

  async getStats(): Promise<ApplicantStats> {
    await simulateLatency();
    // ...
  },
};
```

### Query Hooks

```ts
// features/applicants/api/applicant.queries.ts

import { useQuery } from '@tanstack/react-query';
import { applicantService } from './applicant.service';

export const applicantKeys = {
  all: ['applicants'] as const,
  lists: () => [...applicantKeys.all, 'list'] as const,
  list: (filters: ApplicantFilters) => [...applicantKeys.lists(), filters] as const,
  details: () => [...applicantKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicantKeys.details(), id] as const,
};

export function useApplicants(filters: ApplicantFilters) {
  return useQuery({
    queryKey: applicantKeys.list(filters),
    queryFn: () => applicantService.list(filters),
    staleTime: 30_000,
  });
}
```

### Why This Pattern Wins

When the real backend ships, you change **one line per service**:
```ts
// Before:
async list() { return mockData.filter(...); }

// After:
async list(filters) { return apiClient.get('/applicants', { params: filters }).then(r => r.data); }
```

The query hooks, components, types — everything else is unchanged.

---

## 📦 Deliverables

When complete, the user should be able to:

```bash
git clone <repo>
cd police-academy-frontend
pnpm install
pnpm dev               # → http://localhost:5173

# Verify everything works:
pnpm lint              # → 0 errors, 0 warnings
pnpm typecheck         # → 0 errors
pnpm test              # → all tests pass
pnpm test:e2e          # → smoke test passes
pnpm build             # → builds to dist/
pnpm preview           # → serves built bundle
```

The built `dist/` folder is a static bundle deployable to any web server.

---

## 🚦 Definition of Done

For each phase to be considered complete:

- [ ] All TypeScript compiles with zero errors in strict mode
- [ ] All ESLint rules pass (zero warnings)
- [ ] All Prettier formatting applied
- [ ] No `any` types (use `unknown` + narrow)
- [ ] No `// @ts-ignore` (only `// @ts-expect-error` with explanation)
- [ ] No console.log left in code
- [ ] All pages from the demo are navigable
- [ ] Visual matches the demo (compare side-by-side)
- [ ] RTL is correct everywhere
- [ ] Arabic text renders correctly
- [ ] No console errors in browser
- [ ] At least one test per critical utility
- [ ] Documentation updated

---

## 🤝 Working Style

- **Commit per phase** with conventional commit messages: `feat: add login page`, `chore: setup tailwind`, etc.
- **Run the dev server in watch mode** while working
- **After each major component, take a screenshot** of your work and compare to the demo
- **When you hit a design ambiguity** (e.g., "should this badge be `secondary` or `outline` shadcn variant?"), check the existing demo and replicate. If unclear, **ask the user**.
- **When you hit a technical decision** (e.g., "should the audit log filters be in URL params or local state?"), prefer the more shareable/refreshable choice (URL params) and document why in `ARCHITECTURE.md`
- **Don't move to the next phase** until the current phase's app runs without errors

---

## 🎯 Final Reminders

1. **The demo is your spec.** Open it. Click everything. Take screenshots. Match it.
2. **Tokens are sacred.** Don't invent colors. Don't change spacing. Port `tokens.css` exactly.
3. **shadcn/ui components are owned by you** — customize them freely to match the demo.
4. **The mock service layer pattern is the bridge to the future backend.** Get it right.
5. **TypeScript strict mode is non-negotiable.** Better to spend 5 min typing correctly than 50 min debugging.
6. **RTL first.** Test every component in RTL before moving on.
7. **Arabic content is exact** — copy-paste from the demo, don't retype.
8. **Performance matters.** Code-split routes. Lazy-load. Memoize when needed.
9. **Ask before assuming.** If something's unclear, ask. The demo is incomplete in places — confirm intent.

---

## 🚀 Now: Start

1. Open the demo in a browser. Navigate to every page. Take notes.
2. Read `README.md`, `mock-data.js`, `auth.service.js` carefully.
3. Begin Phase 1: project foundation.
4. After Phase 1 completes, **show the user the dev server running and ask for confirmation** before proceeding to Phase 2.

Build with care. This is going to be the production frontend that the Police Academy will rely on for years.