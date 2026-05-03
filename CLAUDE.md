# CLAUDE.md — Police Academy Admissions Platform (Frontend)

> Persistent context for Claude Code. Read this first before touching code.

---

## 1. What this project is

**منظومة القبول · أكاديمية الشرطة** — the production frontend for the Egyptian Police Academy Admissions Platform. A single-page React application that unifies **9 connected applications** behind a single shell, with **11 RBAC roles**, **12 top-level routes**, fully **RTL Arabic-first** UI.

- **Owner:** وزارة الداخلية · أكاديمية الشرطة (Ministry of Interior · Police Academy)
- **Built by:** Appenza Studio — Engineering Manager: Mortada
- **Status:** Frontend feature-complete; design polish complete (`polish-complete` tag, 2026-05-03); backend integration is a later session.
- **Demo deadline:** 2026-05-29 (~4 weeks out). The polish program (POLISH_REPORT.md) was sized against this date.

The app is a **production-grade rebuild** of a vanilla HTML/JS demo (preserved under [_legacy/](_legacy/)). The legacy demo is the **functional, visual, and data spec** — recreate, do not reinvent.

---

## 2. Tech stack (mandatory — see [Tasks/tasks.md](Tasks/tasks.md))

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18.3 | function components only |
| Language | TypeScript 5.6 | **strict mode**, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride` |
| Build | Vite 5.4 | path alias `@/*` → `src/*` |
| Routing | react-router-dom 6.26 | `useRoutes` over the `routes` array in [src/routes.tsx](src/routes.tsx) |
| Server state | @tanstack/react-query 5 | every service is wrapped by a `*.queries.ts` |
| Client state | zustand 4.5 + persist | sessionStorage for auth (`pa-auth` key) |
| Styling | Tailwind 3.4 + ported CSS tokens | utility classes layered on top of legacy CSS |
| Forms | react-hook-form + zod | wired in `LoginForm`; expand to other forms |
| Icons | lucide-react | |
| Dates | date-fns | |
| Class merge | clsx + tailwind-merge | exposed via [src/shared/lib/cn.ts](src/shared/lib/cn.ts) |

### Forbidden
- ❌ `any` — use `unknown` and narrow
- ❌ `useEffect` for data fetching — TanStack Query only
- ❌ Redux, Material UI, styled-components, CRA
- ❌ Default exports — named exports only
- ❌ Third-party chart libraries — charts are inline SVG, see [src/shared/components/charts/](src/shared/components/charts/)

### Scripts
```bash
npm run dev         # vite dev server → http://localhost:5173 (auto-opens)
npm run typecheck   # tsc --noEmit (must be 0 errors)
npm run build       # tsc -b && vite build → dist/
npm run preview     # serve built bundle
npm run lint        # eslint (config not yet committed; planned)
```

---

## 3. Architecture — Clean / feature-based

```
src/
├── main.tsx              StrictMode + createRoot
├── App.tsx               QueryProvider + BrowserRouter + ToastViewport
├── routes.tsx            Single source of truth for all routes
│
├── app/
│   ├── providers/        QueryProvider · AuthGuard
│   └── layouts/          AppShell · Sidebar · PublicShell · CenteredShell
│
├── features/             ⭐ Self-contained vertical slices
│   ├── auth/             RBAC + login + Zustand store
│   ├── hub/              Landing page (9 app cards)
│   ├── admin/            7 sub-routes
│   ├── applicant-portal/ Public 11-stage portal
│   ├── applicants/       Shared applicant service+queries (consumed by admin)
│   ├── audit/            service + queries
│   ├── architecture/     /architecture page
│   ├── committees/       3 sub-routes
│   ├── board/            3 sub-routes
│   ├── investigations/   3 sub-routes
│   ├── medical/          3 sub-routes
│   ├── barcode/          3 sub-routes
│   ├── biometric/        3 sub-routes
│   └── exams/            3 sub-routes (question bank)
│
├── shared/               ⭐ Cross-cutting code (NEVER imports from features/)
│   ├── components/       Button, Card, Badge, Input, Select, Avatar, Skeleton,
│   │   │                 PageHeader, EmptyState, StageStepper, StatCard,
│   │   │                 StatusBadge, Toast, Icon
│   │   └── charts/       BarChart · LineChart · DonutChart (inline SVG)
│   ├── lib/              cn · format · arabic · national-id · mock-helpers · constants
│   ├── types/            api.ts (Pagination, ApiError) · domain.ts (Applicant, etc.)
│   └── mock-data/        seed (LCG, seed=42) · dictionaries · index (generates MOCK)
│
├── config/
│   └── routes.ts         URL constants (`ROUTES`, `ROOT_PATH_BY_APP`)
│
└── styles/
    ├── globals.css       Tailwind + token imports
    ├── tokens.css        ← ported 1:1 from _legacy/styles
    ├── base.css          ← ported 1:1
    ├── components.css    ← ported 1:1
    ├── layout.css        ← ported 1:1
    └── apps.css          ← ported 1:1
```

### Architecture rules — STRICTLY ENFORCED
1. **`features/X/` is self-contained.** Owns its `api/`, `components/`, `pages/`, optional `store/`. External consumers go through the feature's barrel `index.ts`.
2. **`features/X/` may import from `shared/`.** Never the reverse.
3. **`shared/` may not import from any `features/`.** This is the critical Clean Arch rule.
4. **Pages are dumb composers** — orchestrate hooks + components, no business logic.
5. **API services are typed and isolated** — every service file exports typed functions; `*.queries.ts` wraps them in TanStack Query hooks.
6. **No prop drilling beyond 2 levels** — Zustand for cross-cutting client state, TanStack Query for server state.

**Exception worth noting:** `features/applicants/` provides shared applicant data used by multiple features (admin primarily). It is treated as a feature module that exposes a public API rather than being moved to `shared/` because it has its own domain types and could grow its own UI.

---

## 4. Routes (12 top-level + 22 sub-routes)

All routes are registered in [src/routes.tsx](src/routes.tsx) and protected by `<AuthGuard app="...">`. URL constants live in [src/config/routes.ts](src/config/routes.ts) — link via `ROUTES.*`, never hard-code paths.

| URL | Component | RBAC app |
|---|---|---|
| `/login` | LoginPage | (public) |
| `/` | HubPage | (any authenticated user) |
| `/architecture` | ArchitecturePage | (any authenticated user) |
| `/admin` | DashboardPage | `admin` |
| `/admin/applicants` | ApplicantsPage | `admin` |
| `/admin/applicants/:id` | ApplicantDetailPage | `admin` |
| `/admin/users` | UsersPage | `admin` |
| `/admin/audit` | AuditPage | `admin` |
| `/admin/settings` | SettingsPage | `admin` |
| `/admin/reports` | ReportsPage | `admin` |
| `/applicant` | ApplicantPortalPage | `applicant` |
| `/committee` `/list` `/schedule` | Committee* | `committee` |
| `/board` `/sessions` `/decisions` | Board* | `board` |
| `/investigations` `/incoming` `/outgoing` | Investigations* | `investigations` |
| `/medical` `/queue` `/results` | Medical* | `medical` |
| `/barcode` `/lookup` `/batch` | Barcode* | `barcode` |
| `/biometric` `/enroll` `/history` | Biometric* | `biometric` |
| `/question-bank` `/exams` `/results` | Exams* | `exams` |
| `*` | `<Navigate to="/" replace />` | — |

---

## 5. RBAC — 11 roles

Defined in [src/features/auth/rbac.ts](src/features/auth/rbac.ts). `ROLES` is a `const`-tuple → derives `Role` union type.

| Role | Arabic label | Apps |
|---|---|---|
| `super_admin` | مدير النظام الرئيسي | all 9 + architecture |
| `committee_admin` | مدير لجنة قبول | admin, committee, barcode, biometric |
| `committee_user` | موظف لجنة قبول | committee, barcode, biometric |
| `medical_admin` | مدير القومسيون الطبي | medical, barcode, biometric |
| `medical_doctor` | طبيب عيادة | medical |
| `investigator` | محقق | investigations |
| `board_admin` | أمين سر الهيئة | board |
| `exams_admin` | مدير الاختبارات | exams |
| `biometric_user` | مستخدم بوابة الأمن | biometric |
| `records_clerk` | مدخل نتائج | medical, exams |
| `applicant` | متقدم | applicant |

### Permission helpers
- `hasPermission(perms, required)` — supports `*` (super) and `resource:*` wildcard prefix.
- `canAccessApp(apps, app)` — simple membership check.
- `<AuthGuard app="...">` enforces access at the route level; redirects to `/login` if not authenticated, or back to hub (`/applicant` if applicant) with an Arabic toast if app-denied.

### App keys (single source of truth)
```ts
// src/shared/lib/constants.ts
export const APP_KEYS = ['admin','applicant','committee','board',
  'investigations','medical','barcode','biometric','exams','architecture'] as const;
export type AppKey = (typeof APP_KEYS)[number];
```

---

## 6. Mock service layer (the bridge to the future backend)

Every feature exposes:
- **`api/<feature>.service.ts`** — typed methods with `INTEGRATION CONTRACT` JSDoc header listing the real REST endpoints. Reads from `MOCK` (in [src/shared/mock-data/index.ts](src/shared/mock-data/index.ts)) and uses [`simulateLatency`](src/shared/lib/mock-helpers.ts) + [`paginate`](src/shared/lib/mock-helpers.ts).
- **`api/<feature>.queries.ts`** — TanStack Query hooks (`useX`, `useXMutation`) with a `keys` factory (e.g. `applicantKeys.list(filters)`).

To wire up the real backend, **only the body of each service method changes** — query hooks, components, and types stay the same:

```ts
// before (mock)
async list(filters) { await simulateLatency(); return paginate(MOCK.applicants.filter(...), ...); }
// after (real)
async list(filters) { return apiClient.get('/applicants', { params: filters }).then(r => r.data); }
```

### Mock data shape
- **Deterministic** — LCG seeded with `reseed(42)` in [src/shared/mock-data/seed.ts](src/shared/mock-data/seed.ts). Same render → same data.
- 240 applicants, 10 system users, 80 audit entries, 8 questions, 8 medical stations, 5 committees, 14-day timeseries, KPIs.
- Seed is reset to 42 at module load **and again at the bottom** so any consumer using `rng()` gets fresh deterministic output.

### Domain types — see [src/shared/types/domain.ts](src/shared/types/domain.ts)
`Applicant`, `ApplicantStatus`, `PaymentStatus`, `InvestigationStatus`, `ResultOutcome`, `AuditEntry`, `AuditAction`, `AuditColor`, `SystemUser`, `MedicalStation`, `Committee`, `Question`, `DayPoint`, `Kpis`, `TimelineEvent`.

---

## 7. Auth flow

1. `LoginPage` ([src/features/auth/pages/LoginPage.tsx](src/features/auth/pages/LoginPage.tsx)) renders `LoginArtPanel` + `RoleSelector` + `LoginForm`.
2. `LoginForm` (react-hook-form + zod) calls `useLoginMutation` → `authService.login(credentials)`.
3. The demo derives `AuthUser` from the picked **role** — credentials are not validated; any non-empty username/password passes. Role determines `apps`, `permissions`, `roleLabel` from `ROLE_DEFINITIONS`.
4. On success, `useAuthStore.setUser(user)` writes to sessionStorage under `pa-auth`. Refresh keeps you logged in.
5. `AuthGuard` reads `useAuthStore((s) => s.user)`; redirects unauthenticated users to `/login` and app-denied users back to hub.
6. Logout: `AppShell` triggers `useLogoutMutation` → clears store + navigates to `/login` with toast.

---

## 8. Design system — "Arabic Heritage Modern" (Sprint 0)

Source of truth: [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md). Every value in [src/styles/tokens.css](src/styles/tokens.css) traces back to §2 of that file.

Per-app accents are applied by writing `data-app="medical"` (etc.) on `AppShell`'s root. CSS variables `--accent-50` / `--accent-500` / `--accent-600` / `--accent-700` flip for the subtree (see [src/styles/apps.css](src/styles/apps.css)). Components consume `--accent-*`, never `--teal-*` directly, so they pick up app flavour.

| Token | Value | Notes |
|---|---|---|
| `--teal-500` | `#1A6868` | PRIMARY — "navy of the Nile" |
| `--gold-400` | `#D4A445` | accent / heritage / highlight |
| `--terra-500` | `#C8462C` | critical / restricted / secrecy |
| `--ink-50` | `#F4F2ED` | page surface — the cream |
| `--ink-900` | `#0E0C07` | headings + body emphasis |
| `--font-ar` | IBM Plex Sans Arabic | UI body + labels |
| `--font-ar-display` | Tajawal | h1/h2 + hero copy |
| `--font-en` | Inter | tabular numerals (`tnum`) |
| `--font-mono` | JetBrains Mono | code-like identifiers |

Per-app accent (per DESIGN_SYSTEM §2.2):
- admin → teal-600 · applicant → teal-500 · committee → gold-500
- board → gold-700 · investigations → terra-500 · medical → teal-400
- barcode → ink-700 · biometric → terra-400 · exams → gold-600

**Don't invent new colors / px / motion durations** — extend `Tasks/DESIGN_SYSTEM.md §2` first, then `tokens.css`, then use. The legacy `--brand-*` / `--fs-*` / `--sp-*` / `--r-*` / `--ease-out` / `--shadow-brand` aliases exist in tokens.css for transitional compatibility (slated for removal in Sprint 9).

### RTL
- `<html lang="ar" dir="rtl">` in [index.html](index.html).
- Use logical properties: `text-start` / `text-end`, `ms-` / `me-` / `ps-` / `pe-`.
- Direction-aware icons (arrows): `rtl:rotate-180` or `rtl:scale-x-[-1]`.

---

## 9. Conventions & code style

- **Strict mode TS** — no `any`, no `@ts-ignore` (use `@ts-expect-error` with reason).
- **Named exports only** — easier refactoring.
- **PascalCase** components (`LoginForm.tsx`), **camelCase** hooks (`useDebounce.ts`).
- **Boolean prop prefixes:** `is*`, `has*`, `should*`.
- **Event handlers:** `on*` for props, `handle*` for implementations.
- **Index files** export the feature's public API only; internal components stay private.
- **Co-locate** types with their primary user; promote to `shared/types/` only when shared.
- **Components >150 lines → split.** Single responsibility.
- **`shared/components` accept `className`** for composition; use `forwardRef` when wrapping HTML elements.

### State management cheatsheet
| Type | Tool |
|---|---|
| Server data | TanStack Query |
| URL state (filters, pagination) | React Router params/search |
| Global client state | Zustand |
| Local state | `useState` |
| Derived | `useMemo` |

### Path imports — always use `@/*`
```ts
import { Button, toast } from '@/shared/components';
import { useAuthStore } from '@/features/auth';
```

---

## 10. Toast system

Mini Zustand-backed toast in [src/shared/components/Toast.tsx](src/shared/components/Toast.tsx):
- `<ToastViewport />` is mounted once at app root in [src/App.tsx](src/App.tsx).
- `toast(message, kind?)` — call from anywhere (`'success' | 'danger' | 'warning' | 'info'`).
- Used inside `AuthGuard` for access-denied messages and in `AppShell` for logout success.

---

## 11. What's done · what's next

✅ **Done**
- **Sprint 0 — Arabic Heritage Modern design system** (this session):
  - tokens.css rewritten per DESIGN_SYSTEM §2 (ink/teal/gold/terra ramps, semantic, surfaces, typography, spacing, radii, shadows, motion, z-index).
  - base.css rewritten (IBM Plex Arabic / Tajawal / Inter / JetBrains Mono fonts, cream surface, RTL defaults, reduced-motion safety net).
  - apps.css rewritten — only `[data-app="..."]` accent overrides per §2.2.
  - print.css + motifs.css added; tailwind.config.ts mirrors §2 exactly.
  - index.html serves the new font stack; theme color is teal-500.
  - Foundational primitives: `Pattern` (8-fold tessellation + Khayameya stripe + corner-flourish variants), `KhayameyaStripe`, `CornerFlourish`.
  - State primitives: `EmptyState` (7 variants with bespoke heritage illustrations), `LoadingState` (5 skeleton variants + spinner), `ErrorState` (with retry/back actions).
  - Layout primitives: `Modal` (focus trap, Esc, sm/md/lg, with optional flourishes), `Drawer` (end-edge slide, same API), `Wizard` (vertical stepper + sticky footer + auto-save indicator), `PrintLayout` (ministry header + Khayameya footer + restricted stamp).
  - Form primitives: `FileUpload` (drag-drop + state machine), `DatePicker` + `DateRangePicker` (Arabic months, Saturday-first, quick ranges), `Combobox` (virtualised >100 options), `MultiSelect` (chip-style).
  - Workhorse: `DataTable<TRow>` — generic, paginated, sortable, multi-select, density modes, sticky header, per-column hide-on, custom empty/loading/error states, accent-flavoured selected row.
  - Charts: existing `BarChart`/`LineChart`/`DonutChart` re-skinned; new `Heatmap`, `Sparkline`, `Gauge`, `Funnel` — all inline SVG, all motion-aware.
  - Custom icons: `IconBarcode`, `IconBiometric`, `IconCertificate`, `IconStamp`, `IconSeal` under [src/shared/components/icons/](src/shared/components/icons/).
  - Refreshed primitives: `Button` (5 variants × 5 sizes + loading), `Card` (variants: default/feature/compact/elevated, accent border-top), `Badge`/`StatusBadge`/`SuspendedBadge`, `Input`/`Textarea`/`Select`, `StageStepper` (5 states), `Toast` (semantic kinds + actions), `Avatar`, `StatCard` (with sparkline support), `PageHeader` (breadcrumbs + actions).
  - Refreshed shells: `AppShell` (Khayameya stripe at top, app-pill, IconSeal logo), `Sidebar` (256px, accent start-edge active state), `PublicShell` (tessellation watermark), `CenteredShell` (size variants).
  - Refreshed pages: `LoginPage` (calm institutional split, gold-foil header, lucide-only role picker), `HubPage` (time-of-day greeting, Pattern hero, lucide-only app icons, accent border-top per card).
  - `motion.ts` helper — reduced-motion-aware durations and transitions.
- **Pre-Sprint baseline** (from initial commit): Vite + TS + Tailwind, deterministic mock data (LCG seed=42), 11-role RBAC, all 12 top-level routes wired, ToastViewport, AuthGuard, sessionStorage persistence.

✅ **Done (additional, post-Sprint 0)**
- **Sprints 1–9 shipped** (tags `sprint-1-complete` through `sprint-9-complete`): Admin Portal, Applicant Portal 11-stage Wizard, Committees, Board, Investigations, Medical Commission, Barcode, Biometric, Question Bank + Exams.
- **Demo cut** (tag `v0.2.0-demo`).
- **Polish program** (tag `polish-complete`, 2026-05-03): 4-phase 80-hour program closed in ~24h. 16 flagship screens polished; all 10 audit findings (S1–S10) addressed. Cross-screen visual coherence patterns canonized: §4 two-phase signature affordance (preliminary notice + IconStamp on معتمد Badge), shared `SignatureBlock` shape across the 3 print docs, action-color dot lookup map across hub + admin tickers. See [POLISH_REPORT.md](POLISH_REPORT.md).
- **`/architecture` rebuilt** as a 9-section English-LTR technical reference with comprehensive system diagram (apps + integrations on one canvas), citation-rich, print-friendly. See `src/features/architecture/`.
- **Terminology rename:** all `KARASA` references in code and inline copy renamed to `RFP Scope Document`. The `Tasks/KARASA_GAPS.md` file retains its filename for git-history continuity but the user-facing term is now "RFP Scope Document."

🚧 **Next sprints**
- **Sprint 10 — Hardening**: Vitest + Testing Library, Playwright smoke E2E, `eslint-plugin-boundaries`, Husky pre-commit, accessibility audit, print polish.
- **Backend integration** (post-demo): replace `simulateLatency()` + `MOCK` reads in every `*.service.ts` with real `apiClient.get/post(...)` calls. See §6 for the integration pattern. Component/query/type contracts stay unchanged.

---

## 12. Working with this repo — Claude-specific guidance

1. **Always start by reading this CLAUDE.md, then the affected feature's `index.ts`** to understand what it exports. For visual changes, also read [POLISH_REPORT.md](POLISH_REPORT.md) §5 (cross-screen coherence wins) and the relevant entry in [docs/polish/SHAPE_BRIEFS.md](docs/polish/SHAPE_BRIEFS.md).
2. **The legacy demo is the spec.** When recreating a screen, open the matching file under [_legacy/js/pages/](_legacy/js/pages/) and the styles in [_legacy/styles/](_legacy/styles/). Don't invent.
3. **Mock service contracts are real.** The JSDoc `INTEGRATION CONTRACT` headers in `*.service.ts` document the real REST endpoints — keep them in sync if you add methods.
4. **Don't break Clean Arch.** `shared/` cannot import `features/`. Cross-feature imports must go through the source feature's `index.ts` barrel.
5. **Don't add new chart libs.** Inline SVG for any new chart — match the existing `BarChart` / `LineChart` / `DonutChart` patterns.
6. **Verify before recommending:** the legacy demo is preserved but not authoritative for the new structure — always check `src/` first for what actually exists.
7. **Run `npm run typecheck` after non-trivial edits.** Strict-mode TS catches a lot here.
8. **For UI changes, run `npm run dev` and click through the affected route.** Do not claim a UI feature works without exercising it.
9. **No backend.** This frontend is pre-integration. Any "fetch from API" answer is wrong — the answer is "extend the mock service and add a query hook."
10. **Arabic content is exact** — copy-paste from the legacy demo or existing files; do not retype Arabic strings (rendering edge cases bite).
11. **Per-app surfaces consume `var(--accent-*)`, never hardcoded `bg-teal-*` / `text-gold-*`.** The S1 audit (POLISH_REPORT §3) closed this across 7 of 9 apps. New per-app surfaces must use `var(--accent-500/700/50)` via inline `style` so the `data-app="<key>"` overrides flow through.
12. **§4 two-phase signature canon** (PRODUCT.md §4): any "preliminary save" affordance uses the dashed `border-gold-300 bg-gold-50 text-gold-700` notice shape; any "final / approved / معتمد" Badge carries the `<IconStamp width={12} height={12} />` glyph on the start edge. Don't invent new affordances for the same workflow.
13. **App.tsx auto-seeds a super_admin demo user** (`ensureDemoUser()`). To verify `/staff-login` visually, temporarily disable that block — `LoginPage` redirects authenticated users straight to `/hub`.
14. **Terminology — use "RFP Scope Document" not "karasa"** in code, comments, and user-facing copy. The `Tasks/KARASA_GAPS.md` filename stays for git-history continuity, but the term inside is "RFP Scope Document."

---

## 13. Quick reference

| Need | File |
|---|---|
| Add a route | [src/routes.tsx](src/routes.tsx) + [src/config/routes.ts](src/config/routes.ts) |
| Change RBAC | [src/features/auth/rbac.ts](src/features/auth/rbac.ts) |
| Add a domain type | [src/shared/types/domain.ts](src/shared/types/domain.ts) |
| Add mock data | [src/shared/mock-data/index.ts](src/shared/mock-data/index.ts) (+ dictionaries) |
| Create a service | `src/features/<x>/api/<x>.service.ts` |
| Wrap with hooks | `src/features/<x>/api/<x>.queries.ts` |
| Format date/number | [src/shared/lib/format.ts](src/shared/lib/format.ts) |
| Validate national ID | [src/shared/lib/national-id.ts](src/shared/lib/national-id.ts) |
| Toast | `import { toast } from '@/shared/components'` |
| Per-app theming | wrap shell with `<AppShell app="medical" appLabel="القومسيون الطبي">` |
| Per-app accent in styles | inline `style={{ background: 'var(--accent-500)' }}` |
| §4 preliminary notice | `border border-dashed border-gold-300 bg-gold-50 text-2xs text-gold-700` |
| §4 final stamp on Badge | `<IconStamp width={12} height={12} className="me-1 inline-block" />` inside `<Badge tone="success">` |
| Ministerial seal | `<IconSeal width={N} height={N} className="text-gold-600" />` |
| URL constants | `import { ROUTES } from '@/config/routes'` |

---

## 14. Context-document index

| Doc | Purpose | Status |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | This file — operating context for Claude Code | Live (always read first) |
| [PRODUCT.md](PRODUCT.md) | Strategic context: users, brand, anti-references, §4 two-phase canon | Live (read for product/UX decisions) |
| [DESIGN.md](DESIGN.md) → [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md) | Visual constitution — tokens, type, motion | Live (read before any visual work) |
| [POLISH_REPORT.md](POLISH_REPORT.md) | Closeout report on the 4-phase polish program | Live snapshot at 2026-05-03 |
| [docs/polish/SHAPE_BRIEFS.md](docs/polish/SHAPE_BRIEFS.md) | Per-screen shape briefs for all 16 flagship screens | Reference (read before re-touching a flagship) |
| [docs/polish/POLISH_PROGRESS.md](docs/polish/POLISH_PROGRESS.md) | Append-only live log of the polish program | Historical record |
| [POLISH_PLAN.md](POLISH_PLAN.md) | Original polish program plan + 10 audit findings (S1–S10) | Historical (superseded by POLISH_REPORT.md) |
| [HANDOFF.md](HANDOFF.md) | Session-handoff doc that ran the polish work | Historical (polish is complete) |
| [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md) | Visual constitution (Arabic Heritage Modern) | Live |
| [Tasks/KARASA_GAPS.md](Tasks/KARASA_GAPS.md) | RFP Scope Document coverage map | Live (filename retained; terminology inside is "RFP Scope Document") |
| [Tasks/tasks.md](Tasks/tasks.md) | Original sprint task plan | Reference |
| [Tasks/CLAUDE_CODE_BRIEF.md](Tasks/CLAUDE_CODE_BRIEF.md) | Original Claude-Code project brief | Historical (kickoff context) |
| [README.md](README.md) | Public-facing README + quick-start | Live |
