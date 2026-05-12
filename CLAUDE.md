# CLAUDE.md — Police Academy Admissions Platform

> Persistent context for Claude Code. Read this first before touching code.

---

## 1. What this project is

**منظومة القبول · أكاديمية الشرطة** — the production frontend for the Egyptian Police Academy Admissions Platform. A single-page React application that unifies **9 connected applications** behind a single shell, organised across **3 surfaces** (PUBLIC / APPLICANT / STAFF), with **11 RBAC roles** and ~80 routes, fully **RTL Arabic-first** UI.

- **Owner:** وزارة الداخلية · أكاديمية الشرطة (Ministry of Interior · Police Academy)
- **Built by:** Appenza Studio — Engineering Manager: Mortada
- **Status:** Frontend feature-complete; design polish complete (`polish-complete` tag, 2026-05-03); **backend spec 005 (modular monolith) complete** (2026-05-10).
- **Demo deadline:** 2026-05-29 (~4 weeks out). The polish program (docs/POLISH_REPORT.md) was sized against this date.

### Monorepo layout (as of 2026-05-10)

The repo is organised as a monorepo with two top-level workspaces. Only `CLAUDE.md` lives at the root — every other markdown is under `docs/` or `Tasks/`.

```
PACademy/
├── CLAUDE.md           ← this file (operating context for Claude Code)
├── frontend/           ← React 18 + TS + Vite — §§2–14 of this file are primarily about this workspace
├── backend/            ← C# 13 / .NET 10  + ASP.NET Core Web API, EF Core 10 — see §15
│   ├── src/
│   │   ├── PACademy.Api/              ← HTTP host (Program.cs, controllers, middleware)
│   │   ├── Shared/
│   │   │   ├── PACademy.Shared.Contracts/          ← PagedResult, ApiError, ErrorCodes, ICurrentActor
│   │   │   └── Audit/
│   │   │       ├── PACademy.Shared.Audit.Domain/   ← AuditEntry, AuditAction, AuditOutcome
│   │   │       ├── PACademy.Shared.Audit.Public/   ← IAuditApi
│   │   │       ├── PACademy.Shared.Audit.Application/
│   │   │       └── PACademy.Shared.Audit.Infrastructure/  ← AuditDbContext, AuditModule
│   │   └── Modules/
│   │       ├── Identity/          ← SystemUser, Session, auth use cases, IdentityDbContext
│   │       ├── ReferenceData/     ← ReferenceDataEntry, 8 lookup dictionaries, ReferenceDataDbContext
│   │       ├── Workflows/         ← Workflow, WorkflowStage, publish flow, WorkflowsDbContext
│   │       └── Admissions/        ← Cycle, Category, AdmissionRule, Applicant, AdmissionsDbContext
│   ├── tests/
│   │   ├── PACademy.Api.Tests/        ← Integration tests (Testcontainers SQL Server)
│   │   ├── PACademy.Domain.Tests/     ← Unit tests
│   │   ├── PACademy.Application.Tests/
│   │   └── PACademy.Architecture.Tests/ ← NetArchTest boundary assertions (T356–T358, T340, etc.)
│   └── scripts/migrations/
│       └── 005_split_migration_history.sql  ← Idempotent per-context history split
├── Tasks/              ← project-level: DESIGN_SYSTEM.md, KARASA_GAPS.md, sprint plan, scope-alignment
└── docs/               ← all other project docs:
    ├── README.md       ← public-facing project README + quick-start
    ├── PRODUCT.md      ← strategic context: users, brand, anti-references, §4 two-phase canon
    ├── DESIGN.md       ← symlink → ../Tasks/DESIGN_SYSTEM.md (visual constitution)
    ├── POLISH_REPORT.md  POLISH_PLAN.md  HANDOFF.md   (historical polish program)
    ├── SCOPE_AUDIT.md  AUDIT_REPORT.md  DEMO_SCRIPT.md  PRESENTATION_PROMPT.md
    ├── INDEX.md        ← index of the docs/ folder (was docs/README.md)
    └── polish/  archive/   (per-screen briefs + superseded prompts)
```

All file references in this document are repo-root-relative — e.g. [frontend/src/routes.tsx](frontend/src/routes.tsx) or [docs/PRODUCT.md](docs/PRODUCT.md). When running npm scripts, either `cd frontend` first or use `npm --prefix frontend run <script>`.

The app is a **production-grade rebuild** of a vanilla HTML/JS demo (preserved under [frontend/_legacy/](frontend/_legacy/)). The legacy demo is the **functional, visual, and data spec** — recreate, do not reinvent.

---

## 2. Tech stack (mandatory — see [Tasks/tasks.md](Tasks/tasks.md))

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18.3 | function components only |
| Language | TypeScript 5.6 | **strict mode**, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride` |
| Build | Vite 5.4 | path alias `@/*` → `src/*` |
| Routing | react-router-dom 6.26 | `useRoutes` over the `routes` array in [frontend/src/routes.tsx](frontend/src/routes.tsx) |
| Server state | @tanstack/react-query 5 | every service is wrapped by a `*.queries.ts` |
| Client state | zustand 4.5 + persist | sessionStorage for auth (`pa-auth` key) |
| Styling | Tailwind 3.4 + ported CSS tokens | utility classes layered on top of legacy CSS |
| Forms | react-hook-form + zod | wired in `LoginForm`; expand to other forms |
| Icons | lucide-react | |
| Dates | date-fns | |
| Class merge | clsx + tailwind-merge | exposed via [frontend/src/shared/lib/cn.ts](frontend/src/shared/lib/cn.ts) |

### Forbidden
- ❌ `any` — use `unknown` and narrow
- ❌ `useEffect` for data fetching — TanStack Query only
- ❌ Redux, Material UI, styled-components, CRA
- ❌ Default exports — named exports only
- ❌ Third-party chart libraries — charts are inline SVG, see [frontend/src/shared/components/charts/](frontend/src/shared/components/charts/)

### Scripts (run from `frontend/`, or use `npm --prefix frontend run <script>`)
```bash
npm run dev         # vite dev server → http://localhost:5173 (auto-opens)
npm run typecheck   # tsc --noEmit (must be 0 errors)
npm run build       # tsc -b && vite build → dist/
npm run preview     # serve built bundle
npm run lint        # eslint (config not yet committed; planned)
```

---

## 2.5 Component authoring rules (read every session)

Every component — existing or new — follows these rules. They override the convenience of any library suggestion.

### The three layers (in order)

1. **Tokens** (`src/styles/tokens.css`) — the *only* source of truth for color, spacing, radius, shadow, typography, motion. Never hardcode a hex, a px value where a token exists, or a duration outside `--motion-*`.
2. **Behavior primitives** (`@radix-ui/react-*`) — the *only* sanctioned source of headless accessibility, focus management, popper positioning, and portal rendering. Wrap them in `src/shared/components/`; never import them directly from a feature.
3. **Composition** in `src/shared/components/` — token-styled wrappers around layer 2, exposing the smallest API a feature page needs. Features import from `shared/`, never from `@radix-ui/*` directly.

### Forbidden in component code

- ❌ Adopting any styled component library (MUI, Chakra, HeroUI, Ant, Mantine, Bootstrap, NextUI). The visual identity is sacred; PRODUCT.md anti-references rule them out.
- ❌ Installing `shadcn-ui` as a dependency. Shadcn is a pattern (copy + own), not a package. Read its source for ideas, write our own.
- ❌ `framer-motion` and other animation libraries. Use CSS transitions on `--motion-fast` / `--motion-slow` tokens. Charts already hand-roll their own SVG animation.
- ❌ Hardcoded hex / rgb / hsl outside `tokens.css`. Per-app accents come through `var(--accent-*)` resolved by `data-app="<key>"`.
- ❌ `pl-*` / `pr-*` / `left-*` / `right-*` / `ml-*` / `mr-*` Tailwind utilities. Use logical equivalents (`ps-*` / `pe-*` / `start-*` / `end-*` / `ms-*` / `me-*`). RTL is not a flip — it's authored.
- ❌ Inline `style={{}}` for static values. Inline style is allowed only for **dynamic** values (chart bar widths, runtime-computed colors via tokens, SVG transforms).
- ❌ Default exports.
- ❌ A new shared component without a name in PRODUCT.md, POLISH_PLAN.md, or HANDOFF.md, and without explicit user approval. The bar is high — see *Guardrail* below.

### Required for every component

- ✅ Named export from `src/shared/components/<Name>.tsx`.
- ✅ JSDoc header with prop contract + one usage example.
- ✅ All five interactive states wired where applicable: `default / hover / active / focus-visible / disabled`. Focus rings use `var(--ring)`.
- ✅ Loading / empty / error states are designed, not placeholder. Use `Skeleton`, `EmptyState`, `ErrorState` from shared.
- ✅ Built on the relevant Radix primitive when the component has any of: focus management, popper positioning, dismissable layers, ARIA roles beyond a single button/input. The list of primitives we use is in `RADIX_ADOPTION_REPORT.md`.
- ✅ `prefers-reduced-motion` respected on every transition.
- ✅ Keyboard-navigable end-to-end (Tab / Shift-Tab / Enter / Space / Esc / arrow keys per WAI-ARIA APG for the relevant pattern).
- ✅ Arabic copy verbatim from `_legacy/` or the karasa PDF — never paraphrased.
- ✅ Per-app accent applied via `var(--accent-*)`, never the brand color directly, when the component lives inside a `data-app="<key>"` scope.

### Guardrail — when *not* to add a component

A new shared component costs more than it saves whenever any of these are true:
- The pattern appears fewer than 3 times across the codebase.
- The "component" is really a layout (use a CSS class on `tokens.css` + `Card variant`).
- It's a one-screen flourish (write it inline in the feature, not in shared).
- It overlaps with an existing primitive plus 5 lines of styling. Style the existing one.

Per HANDOFF.md, the §4 two-phase signature pattern is **not** a shared component — it's a canonical visual language applied in-place at each consumer site. New patterns follow that precedent unless the user explicitly asks for a shared abstraction.

### When the user says "use component library X"

Stop. Re-read this section. Reply with:
1. What headless primitive in our existing Radix set already covers the behavior.
2. What token / class on the existing system already covers the visual.
3. What specific gap, if any, remains. If the gap is real, propose a Radix-based composition; if not, decline and explain.

Never install a styled component library. Never re-theme an existing screen onto one. The visual identity is the product.

---

## 3. Architecture — Clean / feature-based

```
frontend/src/
├── main.tsx              StrictMode + createRoot
├── App.tsx               QueryProvider + BrowserRouter + ToastViewport
├── routes.tsx            Single source of truth for all routes
│
├── app/
│   ├── providers/        QueryProvider · AuthGuard
│   └── layouts/          AppShell · Sidebar · PublicShell · CenteredShell
│
├── features/             ⭐ Self-contained vertical slices
│   ├── auth/             RBAC + LoginPage (`/staff-login`) + Zustand store
│   ├── landing/          PUBLIC surface — PublicLandingPage (`/`), ApplyEntryPage (`/apply`), TermsPage
│   ├── help/             PUBLIC HelpPage (`/help`)
│   ├── hub/              Authenticated landing (`/hub`) — 9 app cards
│   ├── profile/          /profile (any authenticated user)
│   ├── architecture/     /architecture (route still registered; UI entry points hidden — direct URL only)
│   ├── design-revamp/    /design-revamp (internal before/after viewer)
│   ├── admin/            17+ sub-routes — DashboardPage, ReportsPage (command-center),
│   │                     Applicants/Users/Audit/Settings, Cycles, Categories,
│   │                     Workflows, AdmissionRules, ReferenceData
│   ├── applicant-portal/ Pre-wizard gate (`/applicant/start`, `/eligibility`, `/tests`)
│   │                     + 11-stage Wizard (`/applicant/auth/step-1` … `/acquaintance-doc`)
│   ├── applicants/       Shared applicant service+queries (consumed by admin)
│   ├── audit/            service + queries
│   ├── committees/       overview, list, schedule, create, :id detail — all served under `/admin/committee/*` and rendered inside AdminLayout
│   ├── board/            overview, sessions list/create/live, decisions, members
│   ├── investigations/   cases, incoming, outgoing, distribution, create, detail
│   ├── medical/          overview, queue, results, station/:key, certificate
│   ├── barcode/          generate, lookup, batch, scan, replace, scans-history
│   ├── biometric/        verify, enroll, history, verify-ops, monitoring
│   └── exams/            QuestionBank (CRUD), Exams list, Exam create/detail/take/proctor,
│                         dedicated /question-bank/proctor landing, results
│
├── shared/               ⭐ Cross-cutting code (NEVER imports from features/)
│   ├── components/       Button, Card, Badge, Input, Select, Avatar, Skeleton,
│   │   │                 PageHeader, EmptyState, ErrorState, LoadingState,
│   │   │                 StageStepper, StatCard, StatusBadge, Toast, Icon,
│   │   │                 Modal, Drawer, Wizard, PrintLayout, FileUpload,
│   │   │                 DatePicker, DateRangePicker, Combobox, MultiSelect,
│   │   │                 DataTable, Pattern, KhayameyaStripe, CornerFlourish,
│   │   │                 LogoMark (real ministerial crest), Code128Barcode,
│   │   │                 NotificationCenter, CommandPalette
│   │   └── charts/       BarChart · LineChart · DonutChart · Heatmap · HeatmapChart
│   │                     · Sparkline · Gauge · Funnel (all inline SVG)
│   ├── lib/              cn · format · arabic · national-id · mock-helpers · constants
│   ├── types/            api.ts (Pagination, ApiError) · domain.ts (Applicant, etc.)
│   └── mock-data/        seed (LCG, seed=42) · dictionaries · index (generates MOCK)
│
├── config/
│   └── routes.ts         URL constants (`ROUTES`, `ROOT_PATH_BY_APP`)
│
└── styles/
    ├── globals.css       Tailwind + token imports
    ├── tokens.css        ← ported 1:1 from frontend/_legacy/styles
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

## 4. Routes — three surfaces

All routes are registered in [frontend/src/routes.tsx](frontend/src/routes.tsx). URL constants live in [frontend/src/config/routes.ts](frontend/src/config/routes.ts) — link via `ROUTES.*`, never hard-code paths. Per-route `ROOT_PATH_BY_APP` (in same file) is what `AuthGuard` uses to bounce app-denied users to the right landing.

The app is organised across **3 surfaces**:
- **PUBLIC** — no auth, no `AuthGuard`.
- **APPLICANT** — Stage 1+2 phone/SMS *is* the auth; gated by `<AuthGuard app="applicant">`.
- **STAFF** — gated by `<AuthGuard>` (and `app="..."` for per-app surfaces). Login is at `/staff-login` (not `/login` — that's a backwards-compat redirect).

### PUBLIC surface
| URL | Component |
|---|---|
| `/` | PublicLandingPage |
| `/apply` | ApplyEntryPage (pre-wizard gate; routes into `/applicant/start`) |
| `/staff-login` | LoginPage |
| `/login` | → redirect to `/staff-login` (legacy alias) |
| `/terms` | TermsPage |
| `/help` | HelpPage |

### STAFF surface (AuthGuard required)
| URL | Component | RBAC app |
|---|---|---|
| `/hub` | HubPage | (any authenticated) |
| `/profile` | ProfilePage | (any authenticated) |
| `/architecture` | ArchitecturePage — **route registered but UI entry points removed** (no app-shell button, no command-palette entry). Direct URL still works. | `architecture` |
| `/design-revamp` | RevampComparisonPage | `architecture` |
| `/admin` | AdminIndexRoute (super_admin → ReportsPage; others → DashboardPage) | `admin` |
| `/admin/applicants` `/new` `/:id` `/:id/edit` | Applicants* | `admin` |
| `/admin/users` `/audit` `/settings` `/reports` | Users / Audit / Settings / Reports | `admin` |
| `/admin/reference-data` `/:tab` | ReferenceDataPage | `admin` |
| `/admin/admission-rules` | AdmissionRulesPage | `admin` |
| `/admin/cycles` `/new` `/:id` | Cycles* | `admin` |
| `/admin/categories` `/:key` | Categories* | `admin` |
| `/admin/workflows` `/new` `/:id` | Workflow editor | `admin` |
| `/admin/committee` `/list` `/schedule` `/create` `/:id` | Committee* (renders inside `AdminLayout` chrome; `/committee/*` legacy URLs redirect here) | `committee` |
| `/board` `/sessions` `/sessions/create` `/sessions/:id/live` `/decisions` `/members` (+ `*-legacy`) | Board* | `board` |
| `/investigations` `/incoming` `/outgoing` `/distribution` `/create` `/cases/:id` | Investigations* | `investigations` |
| `/medical` `/queue` `/results` `/station/:key` `/certificate` | Medical* | `medical` |
| `/barcode` `/lookup` `/batch` `/scan` `/replace` `/scans` | Barcode* | `barcode` |
| `/biometric` `/enroll` `/history` `/verify-ops` `/monitoring` | Biometric* | `biometric` |
| `/question-bank` `/manage` `/exams` `/exams/create` `/exams/:examId` `/take` `/proctor` `/results` | QuestionBank + Exams* (also `/question-bank/proctor` standalone) | `exams` |

### APPLICANT surface (AuthGuard `app="applicant"`)
| URL | Component | Layout |
|---|---|---|
| `/applicant/start` | CategorySelectionPage | ApplicantPreWizardLayout (slim) |
| `/applicant/eligibility` | EligibilityCheckPage | ApplicantPreWizardLayout |
| `/applicant/tests` | TestScheduleAndResultsPage | ApplicantPreWizardLayout |
| `/applicant` | ApplicantPortalPage (wizard hub) | ApplicantPortalLayout |
| `/applicant/auth/step-1`, `/auth/step-2` | Stage1AuthPhone, Stage2AuthSms | ApplicantPortalLayout |
| `/applicant/profile/personal` `/education` `/marital` `/family` | Stage 3 / 4 / 5 / 7 | ApplicantPortalLayout |
| `/applicant/payment` | Stage6PaymentPage | ApplicantPortalLayout |
| `/applicant/exam-schedule` | Stage8ExamSchedulePage | ApplicantPortalLayout |
| `/applicant/print-card` | Stage9PrintCardPage | ApplicantPortalLayout |
| `/applicant/follow-up` | Stage10FollowUpPage | ApplicantPortalLayout |
| `/applicant/acquaintance-doc` | Stage11AcquaintanceDocPage | ApplicantPortalLayout |

### Fallback
| URL | Behaviour |
|---|---|
| `*` | `<Navigate to="/" replace />` (lands on PublicLandingPage) |

---

## 5. RBAC — 11 roles

Defined in [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts). `ROLES` is a `const`-tuple → derives `Role` union type.

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
- `<AuthGuard app="...">` enforces access at the route level; redirects to `/staff-login` if not authenticated, or back to `/hub` (`/applicant` if applicant) with an Arabic toast if app-denied.

### App keys (single source of truth)
```ts
// frontend/src/shared/lib/constants.ts
export const APP_KEYS = ['admin','applicant','committee','board',
  'investigations','medical','barcode','biometric','exams','architecture'] as const;
export type AppKey = (typeof APP_KEYS)[number];
```

---

## 6. Mock service layer (the bridge to the future backend)

Every feature exposes:
- **`api/<feature>.service.ts`** — typed methods with `INTEGRATION CONTRACT` JSDoc header listing the real REST endpoints. Reads from `MOCK` (in [frontend/src/shared/mock-data/index.ts](frontend/src/shared/mock-data/index.ts)) and uses [`simulateLatency`](frontend/src/shared/lib/mock-helpers.ts) + [`paginate`](frontend/src/shared/lib/mock-helpers.ts).
- **`api/<feature>.queries.ts`** — TanStack Query hooks (`useX`, `useXMutation`) with a `keys` factory (e.g. `applicantKeys.list(filters)`).

To wire up the real backend, **only the body of each service method changes** — query hooks, components, and types stay the same:

```ts
// before (mock)
async list(filters) { await simulateLatency(); return paginate(MOCK.applicants.filter(...), ...); }
// after (real)
async list(filters) { return apiClient.get('/applicants', { params: filters }).then(r => r.data); }
```

### Mock data shape
- **Deterministic** — LCG seeded with `reseed(42)` in [frontend/src/shared/mock-data/seed.ts](frontend/src/shared/mock-data/seed.ts). Same render → same data.
- 240 applicants, 10 system users, 80 audit entries, 8 questions, 8 medical stations, 5 committees, 14-day timeseries, KPIs.
- Seed is reset to 42 at module load **and again at the bottom** so any consumer using `rng()` gets fresh deterministic output.

### Domain types — see [frontend/src/shared/types/domain.ts](frontend/src/shared/types/domain.ts)
`Applicant`, `ApplicantStatus`, `PaymentStatus`, `InvestigationStatus`, `ResultOutcome`, `AuditEntry`, `AuditAction`, `AuditColor`, `SystemUser`, `MedicalStation`, `Committee`, `Question`, `DayPoint`, `Kpis`, `TimelineEvent`.

### DB constraints (backend integration handshake)

The admin gap closure work (Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md) introduced typed `ConflictError` codes (`ACTIVE_CYCLE_EXISTS`, `EXAM_ORDER_DUPLICATE`, `COMMITTEE_AT_CAPACITY`, `NID_CYCLE_DUPLICATE`, …) that the frontend already throws from its mock services. The full list of invariants — paired with the SQL Server expressions backend must implement — lives in [docs/DB_CONSTRAINTS.md](docs/DB_CONSTRAINTS.md). Read it before opening any service file that mutates state; the frontend mirrors are not negotiable on integration day.

---

## 7. Auth flow

1. `LoginPage` ([frontend/src/features/auth/pages/LoginPage.tsx](frontend/src/features/auth/pages/LoginPage.tsx)) renders `LoginArtPanel` + `RoleSelector` + `LoginForm`.
2. `LoginForm` (react-hook-form + zod) calls `useLoginMutation` → `authService.login(credentials)`.
3. The demo derives `AuthUser` from the picked **role** — credentials are not validated; any non-empty username/password passes. Role determines `apps`, `permissions`, `roleLabel` from `ROLE_DEFINITIONS`.
4. On success, `useAuthStore.setUser(user)` writes to sessionStorage under `pa-auth`. Refresh keeps you logged in.
5. `AuthGuard` reads `useAuthStore((s) => s.user)`; redirects unauthenticated users to `/login` and app-denied users back to hub.
6. Logout: `AppShell` triggers `useLogoutMutation` → clears store + navigates to `/login` with toast.

---

## 8. Design system — "Arabic Heritage Modern" (Sprint 0)

Source of truth: [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md). Every value in [frontend/src/styles/tokens.css](frontend/src/styles/tokens.css) traces back to §2 of that file.

Per-app accents are applied by writing `data-app="medical"` (etc.) on `AppShell`'s root. CSS variables `--accent-50` / `--accent-500` / `--accent-600` / `--accent-700` flip for the subtree (see [frontend/src/styles/apps.css](frontend/src/styles/apps.css)). Components consume `--accent-*`, never `--teal-*` directly, so they pick up app flavour.

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
- `<html lang="ar" dir="rtl">` in [frontend/index.html](frontend/index.html).
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

Mini Zustand-backed toast in [frontend/src/shared/components/Toast.tsx](frontend/src/shared/components/Toast.tsx):
- `<ToastViewport />` is mounted once at app root in [frontend/src/App.tsx](frontend/src/App.tsx).
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
  - frontend/index.html serves the new font stack; theme color is teal-500.
  - Foundational primitives: `Pattern` (8-fold tessellation + Khayameya stripe + corner-flourish variants), `KhayameyaStripe`, `CornerFlourish`.
  - State primitives: `EmptyState` (7 variants with bespoke heritage illustrations), `LoadingState` (5 skeleton variants + spinner), `ErrorState` (with retry/back actions).
  - Layout primitives: `Modal` (focus trap, Esc, sm/md/lg, with optional flourishes), `Drawer` (end-edge slide, same API), `Wizard` (vertical stepper + sticky footer + auto-save indicator), `PrintLayout` (ministry header + Khayameya footer + restricted stamp).
  - Form primitives: `FileUpload` (drag-drop + state machine), `DatePicker` + `DateRangePicker` (Arabic months, Saturday-first, quick ranges), `Combobox` (virtualised >100 options), `MultiSelect` (chip-style).
  - Workhorse: `DataTable<TRow>` — generic, paginated, sortable, multi-select, density modes, sticky header, per-column hide-on, custom empty/loading/error states, accent-flavoured selected row.
  - Charts: existing `BarChart`/`LineChart`/`DonutChart` re-skinned; new `Heatmap`, `Sparkline`, `Gauge`, `Funnel` — all inline SVG, all motion-aware.
  - Custom icons: `IconBarcode`, `IconBiometric`, `IconCertificate`, `IconStamp`, `IconSeal` under [frontend/src/shared/components/icons/](frontend/src/shared/components/icons/).
  - Refreshed primitives: `Button` (5 variants × 5 sizes + loading), `Card` (variants: default/feature/compact/elevated, accent border-top), `Badge`/`StatusBadge`/`SuspendedBadge`, `Input`/`Textarea`/`Select`, `StageStepper` (5 states), `Toast` (semantic kinds + actions), `Avatar`, `StatCard` (with sparkline support), `PageHeader` (breadcrumbs + actions).
  - Refreshed shells: `AppShell` (Khayameya stripe at top, app-pill, IconSeal logo), `Sidebar` (256px, accent start-edge active state), `PublicShell` (tessellation watermark), `CenteredShell` (size variants).
  - Refreshed pages: `LoginPage` (calm institutional split, gold-foil header, lucide-only role picker), `HubPage` (time-of-day greeting, Pattern hero, lucide-only app icons, accent border-top per card).
  - `motion.ts` helper — reduced-motion-aware durations and transitions.
- **Pre-Sprint baseline** (from initial commit): Vite + TS + Tailwind, deterministic mock data (LCG seed=42), 11-role RBAC, all 12 top-level routes wired, ToastViewport, AuthGuard, sessionStorage persistence.

✅ **Done (additional, post-Sprint 0)**
- **Sprints 1–9 shipped** (tags `sprint-1-complete` through `sprint-9-complete`): Admin Portal, Applicant Portal 11-stage Wizard, Committees, Board, Investigations, Medical Commission, Barcode, Biometric, Question Bank + Exams.
- **Demo cut** (tag `v0.2.0-demo`).
- **Polish program** (tag `polish-complete`, 2026-05-03): 4-phase 80-hour program closed in ~24h. 16 flagship screens polished; all 10 audit findings (S1–S10) addressed. Cross-screen visual coherence patterns canonized: §4 two-phase signature affordance (preliminary notice + IconStamp on معتمد Badge), shared `SignatureBlock` shape across the 3 print docs, action-color dot lookup map across hub + admin tickers. See [POLISH_REPORT.md](docs/POLISH_REPORT.md).
- **`/architecture` rebuilt** as a 9-section English-LTR technical reference with comprehensive system diagram (apps + integrations on one canvas), citation-rich, print-friendly. See `frontend/src/features/architecture/`.
- **Terminology rename:** all `KARASA` references in code and inline copy renamed to `RFP Scope Document`. The `Tasks/KARASA_GAPS.md` file retains its filename for git-history continuity but the user-facing term is now "RFP Scope Document."

✅ **Done (post-polish, 2026-05-04 → 2026-05-07)**
- **Three-surface route model** (PUBLIC / APPLICANT / STAFF). Root `/` is now `PublicLandingPage`, hub moved to `/hub`, login at `/staff-login` (`/login` is a back-compat redirect). New public pages: `/apply`, `/terms`, `/help`. New `landing/`, `help/`, `profile/`, `design-revamp/` feature modules.
- **Admin Reports command-center** (`/admin/reports`) — 12 sections under `frontend/src/features/admin/components/reports/` (CycleOverview, RegistrationTempo, StagePipelineFunnel, OperationalStatus, TestResults, Governance, DepartmentBreakdown, StatusPulseStrip, RangeChips, ReportsExportRow, SectionHeading). Backed by `reports.service.ts` + `reports.queries.ts`. super_admin lands here on `/admin` via `AdminIndexRoute`.
- **Admin scope expansion** beyond the original 7 sub-routes: `cycles/` (list/new/:id), `categories/` (list/:key), `workflows/` (list/new/:id), `admission-rules/`, `reference-data/:tab`, `applicants/new`, `applicants/:id/edit`. "إضافة فئة" wired up in CategoriesListPage.
- **Applicant pre-wizard gate** — `ApplicantPreWizardLayout` (slim shell with logo + back-to-hub) wraps `/applicant/start` (CategorySelectionPage), `/applicant/eligibility` (EligibilityCheckPage), `/applicant/tests` (TestScheduleAndResultsPage). Verified NID flows from eligibility → Stage 1 → Stage 6.
- **Exams expansion** — 50-question Arabic MCQ pool (`frontend/src/shared/mock-data/questionPool.ts`, 5 categories), Exam detail page + clickable rows on exams list, `/question-bank/proctor` standalone landing in sidebar, ImportWizard with inline next/back, default question-pool filter to `live`.
- **Shared components added**: `LogoMark` (real ministerial crest, replaces `IconSeal` as the primary brand mark across hub/login/admin/print docs), `Code128Barcode` (integer module widths + native size — actually scans), `NotificationCenter` (drawer, scrollable, mark-all feedback, notif Zustand store), `CommandPalette`, `HeatmapChart` (inline-SVG primitive distinct from older `Heatmap`).
- **Staff chrome polish** — bigger logout button, AppShell active cycle flipped to 2026 male, public/applicant slim shell headers raised to match staff chrome height, IconSeal-watermark drama dropped from staff-login art panel.
- **Routing fixes**: super_admin can now reach other apps from `/admin/reports` (was a dead-end); `/apply` CTA goes through pre-wizard gate (not Stage 1); barcode redirect was eating direct nav; investigations `/incoming` replaced stub redirect with real inbox.
- **Real Arabic content** — 50-question MCQ pool replaces lorem; landing copy and role labels matched to hub app titles.

✅ **Done (admin chrome consolidation, 2026-05-10 → 2026-05-11)**
- **Committees moved under admin chrome.** All 5 committee URLs migrated from `/committee/*` → `/admin/committee/*` and rendered inside `AdminLayout` (not the old standalone `CommitteeLayout`, which is now unused but still exported). The `/admin/committee` route is a sibling of `/admin` (not a child) so its `AuthGuard` stays `app="committee"` — committee_user holds `committee` but not `admin`, and we don't want to lock them out. Legacy `/committee/*` URLs redirect (including a `LegacyCommitteeDetailRedirect` for `:id`). The admin sidebar gained a dedicated **لجان القبول** section mirroring the committee app's three views (نظرة عامة / قائمة اللجان / الجدول الزمني).
- **Admission-setup index polish.** Dropped the "دورات أخرى" list and its `SetupRow` component — only the active cycle card remains. Removed the unused `draftTone` helper. Updated the "no active cycle" notice copy.
- **Admission-setup fees step.** Dropped the optional fee inputs (deposit / replacement / late) and the `FawryConfigCard` — only the application-fee input remains.
- **Admin categories table.** Dropped the "نوع التقديم" (نوع تقديم عام / بالترشيح) badge column from `CategoriesPanel` — the distinction is already exposed in category detail.
- **`/architecture` hidden from chrome.** Removed the "System Architecture" link from `AppShell` header and the "معمارية النظام" entry from `CommandPalette`. The route itself stays registered, so direct URL access still works.
- **Popover scroll fix** in `Combobox` and `MultiSelect`: the global capture-phase scroll listener used to close the popover on **any** scroll, including scrolling the popover's own option list. Both now ignore scroll events whose target is inside `popoverRef.current`. Outer-page scrolls still close the popover (it's `position: fixed`, so it'd otherwise detach from its trigger). Hit by `/admin/users/new` role picker.

🚧 **Next sprints**
- **Sprint 10 — Hardening**: Vitest + Testing Library, Playwright smoke E2E, `eslint-plugin-boundaries`, Husky pre-commit, accessibility audit, print polish.
- **Backend integration** (post-demo): replace `simulateLatency()` + `MOCK` reads in every `*.service.ts` with real `apiClient.get/post(...)` calls. See §6 for the integration pattern. Component/query/type contracts stay unchanged.

---

## 12. Working with this repo — Claude-specific guidance

1. **Always start by reading this CLAUDE.md, then the affected feature's `index.ts`** to understand what it exports. For visual changes, also read [POLISH_REPORT.md](docs/POLISH_REPORT.md) §5 (cross-screen coherence wins) and the relevant entry in [docs/polish/SHAPE_BRIEFS.md](docs/polish/SHAPE_BRIEFS.md).
2. **The legacy demo is the spec.** When recreating a screen, open the matching file under [frontend/_legacy/js/pages/](frontend/_legacy/js/pages/) and the styles in [frontend/_legacy/styles/](frontend/_legacy/styles/). Don't invent.
3. **Mock service contracts are real.** The JSDoc `INTEGRATION CONTRACT` headers in `*.service.ts` document the real REST endpoints — keep them in sync if you add methods.
4. **Don't break Clean Arch.** `shared/` cannot import `features/`. Cross-feature imports must go through the source feature's `index.ts` barrel.
5. **Don't add new chart libs.** Inline SVG for any new chart — match the existing `BarChart` / `LineChart` / `DonutChart` patterns.
6. **Verify before recommending:** the legacy demo is preserved but not authoritative for the new structure — always check `frontend/src/` first for what actually exists.
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
| Add a route | [frontend/src/routes.tsx](frontend/src/routes.tsx) + [frontend/src/config/routes.ts](frontend/src/config/routes.ts) |
| Change RBAC | [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts) |
| Add a domain type | [frontend/src/shared/types/domain.ts](frontend/src/shared/types/domain.ts) |
| Add mock data | [frontend/src/shared/mock-data/index.ts](frontend/src/shared/mock-data/index.ts) (+ dictionaries) |
| Create a service | `frontend/src/features/<x>/api/<x>.service.ts` |
| Wrap with hooks | `frontend/src/features/<x>/api/<x>.queries.ts` |
| Format date/number | [frontend/src/shared/lib/format.ts](frontend/src/shared/lib/format.ts) |
| Validate national ID | [frontend/src/shared/lib/national-id.ts](frontend/src/shared/lib/national-id.ts) |
| Toast | `import { toast } from '@/shared/components'` |
| Per-app theming | wrap shell with `<AppShell app="medical" appLabel="القومسيون الطبي">` |
| Per-app accent in styles | inline `style={{ background: 'var(--accent-500)' }}` |
| §4 preliminary notice | `border border-dashed border-gold-300 bg-gold-50 text-2xs text-gold-700` |
| §4 final stamp on Badge | `<IconStamp width={12} height={12} className="me-1 inline-block" />` inside `<Badge tone="success">` |
| Ministerial brand mark (preferred) | `<LogoMark size={N} />` — the real crest, used across hub / login art / admin / print docs |
| Ministerial seal (decorative only) | `<IconSeal width={N} height={N} className="text-gold-600" />` — keep for watermarks; do not use as the primary logo |
| URL constants | `import { ROUTES } from '@/config/routes'` |
| Add an admin Reports section | new file under `frontend/src/features/admin/components/reports/` + import in `ReportsPage.tsx`; data via `reports.queries.ts` |
| Notify the user from anywhere | Zustand notif store consumed by `<NotificationCenter />` (mounted in `AppShell`) |
| Portal-based popover (Combobox/MultiSelect) | Outer-page scroll closes the popover; scrolls whose target is inside `popoverRef.current` are ignored so the option list can scroll. Replicate this guard in any new portal-anchored popover that has its own scrollable region. |

---

## 14. Context-document index

| Doc | Purpose | Status |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | This file — operating context for Claude Code | Live (always read first) |
| [PRODUCT.md](docs/PRODUCT.md) | Strategic context: users, brand, anti-references, §4 two-phase canon | Live (read for product/UX decisions) |
| [DESIGN.md](docs/DESIGN.md) → [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md) | Visual constitution — tokens, type, motion | Live (read before any visual work) |
| [POLISH_REPORT.md](docs/POLISH_REPORT.md) | Closeout report on the 4-phase polish program | Live snapshot at 2026-05-03 |
| [docs/polish/SHAPE_BRIEFS.md](docs/polish/SHAPE_BRIEFS.md) | Per-screen shape briefs for all 16 flagship screens | Reference (read before re-touching a flagship) |
| [docs/polish/POLISH_PROGRESS.md](docs/polish/POLISH_PROGRESS.md) | Append-only live log of the polish program | Historical record |
| [POLISH_PLAN.md](docs/POLISH_PLAN.md) | Original polish program plan + 10 audit findings (S1–S10) | Historical (superseded by POLISH_REPORT.md) |
| [HANDOFF.md](docs/HANDOFF.md) | Session-handoff doc that ran the polish work | Historical (polish is complete) |
| [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md) | Visual constitution (Arabic Heritage Modern) | Live |
| [Tasks/KARASA_GAPS.md](Tasks/KARASA_GAPS.md) | RFP Scope Document coverage map | Live (filename retained; terminology inside is "RFP Scope Document") |
| [Tasks/tasks.md](Tasks/tasks.md) | Original sprint task plan | Reference |
| [Tasks/CLAUDE_CODE_BRIEF.md](Tasks/CLAUDE_CODE_BRIEF.md) | Original Claude-Code project brief | Historical (kickoff context) |
| [README.md](docs/README.md) | Public-facing README + quick-start | Live |
| [specs/005-modular-monolith/tasks.md](specs/005-modular-monolith/tasks.md) | Backend spec 005 task list (T300–T371) | Live |
| [specs/005-modular-monolith/quickstart.md](specs/005-modular-monolith/quickstart.md) | Backend operator's guide (migrations, seeding, dev DB) | Live |
| [specs/007-auth-rbac-integration/tasks.md](specs/007-auth-rbac-integration/tasks.md) | Backend spec 007 task list (T400–T471) — Auth+RBAC ✅ Complete | Live |

---

## 15. Backend Architecture (Spec 005 — Modular Monolith) ✅ Complete 2026-05-10

**Pattern**: Single deployable `PACademy.Api` host, 5 bounded-context EF Core DbContexts sharing one SQL Server database, no distributed transactions (Docker-safe).

### Module reference rules (FR-M02 — enforced by `PACademy.Architecture.Tests`)
- Each module exposes a `*.Public` project (1 interface + a few DTOs) as its inter-module contract.
- Modules may ONLY reference: `Shared.Contracts` + other modules' `*.Public` projects.
- Modules must NOT reference any sibling's `*.Domain` or `*.Infrastructure` project.
- `Shared.Contracts` references zero `PACademy.*` projects (root of the dependency graph).

### Per-context migration history (FR-X01)
| Context | History table | Owns |
|---|---|---|
| `AuditDbContext` | `__EFMigrationsHistory_Audit` | `audit_entries` |
| `IdentityDbContext` | `__EFMigrationsHistory_Identity` | `system_users`, `sessions`, AspNet Identity tables |
| `ReferenceDataDbContext` | `__EFMigrationsHistory_ReferenceData` | `reference_data_entries` |
| `WorkflowsDbContext` | `__EFMigrationsHistory_Workflows` | `workflows`, `workflow_stages` |
| `AdmissionsDbContext` | `__EFMigrationsHistory_Admissions` | `cycles`, `categories`, `admission_rules`, `applicants`, `applicant_stage_submissions` |

Run `backend/scripts/migrations/005_split_migration_history.sql` once on pre-phase-5 databases to split the legacy `__EFMigrationsHistory`. On fresh dev DBs, run each context's migrations directly (`dotnet ef database update --context <Context>` from the relevant Infrastructure project).

### Cross-module transactions
Use `CrossModuleUnitOfWork` in `PACademy.Api/Hosting/CrossModuleUnitOfWork.cs`. It opens a single `SqlConnection` + `SqlTransaction`, then wraps each context via `Database.UseTransaction(tx)`. `TransactionScope` / DTC are forbidden (Docker SQL Server doesn't support DTC).

### Spec 007 — Auth + RBAC Integration ✅ Complete 2026-05-10

Two-step OTP login (US1), lock policy management (US2), officer lookup via MOIPASS/Stub (US3), and permission-based access control (US4). Tasks T400–T471.

**Key endpoints added:**
- `POST /auth/login/request-otp` — validate password → send OTP via configured transport
- `POST /auth/login/verify-otp` — verify PBKDF2-hashed OTP → issue `pa-session` cookie with permissions claims
- `POST /auth/login` → 410 Gone (T467 cutover)
- `GET /auth/lock-policy`, `PATCH /auth/lock-policy` — manage lockout thresholds
- `GET /auth/lock-policy/locked-users`, `POST /auth/lock-policy/unlock` — manage locked users
- `POST /v1/officers/lookup` — officer lookup with Polly-protected MOIPASS or stub

**Key infrastructure:**
- `IdentityDbContext` migration `007_AuthRbacIntegration` — creates `pending_otps`, `lockout_states`, `lock_policy` tables
- `OtpExpirySweeper` + `LockoutAutoUnlockSweeper` background services
- `PermissionPolicyProvider` + `PermissionRequirementHandler` — custom `[Authorize(Policy = "resource:verb")]` evaluation
- `IPermissionEvaluator` — pure function: `*` wildcard, exact match, `resource:*` wildcard
- `RolePermissions.ForRole()` — static mapping of 12 roles to permission arrays
- All admin controllers migrated from `Role:super_admin` / `AppAccess:admin` to `[Authorize(Policy = "*")]` or per-action `[Authorize(Policy = "resource:verb")]`

### Remaining backend roadmap (post-spec-007)
- **Spec 006 — Admin Controllers wire-up**: Bind the Admissions/ReferenceData/Workflows module use cases to the existing controllers (currently still calling legacy `PaDbContext` paths).
- **Spec 008 — Applicant Portal API**: REST endpoints for the 11-stage applicant wizard.
- **Spec 009 — Reports API**: Aggregate query endpoints for the admin reports command-center.
- **Spec 010 — Seeder split** (deferred P2 from spec 005): Split `DemoDataSeeder` into 5 per-module seeders (`Identity`, `Audit`, `ReferenceData`, `Workflows`, `Admissions`).
- **Frontend integration**: Replace `simulateLatency()` + `MOCK` reads in every `*.service.ts` with real `apiClient.get/post(...)` calls (§6 integration pattern).

<!-- SPECKIT START -->
**Active spec**: [`specs/008-lookup-excel-import`](specs/008-lookup-excel-import/spec.md) — Lookup Excel + CSV Import.
Plan: [`specs/008-lookup-excel-import/plan.md`](specs/008-lookup-excel-import/plan.md).
<!-- SPECKIT END -->
