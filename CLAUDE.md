# CLAUDE.md — Police Academy Admissions Platform (Frontend)

> Persistent context for Claude Code. Read this first before touching code.

---

## 1. What this project is

**منظومة القبول · أكاديمية الشرطة** — the production frontend for the Egyptian Police Academy Admissions Platform. A single-page React application that unifies **9 connected applications** behind a single shell, organised across **3 surfaces** (PUBLIC / APPLICANT / STAFF), with **11 RBAC roles** and ~110 routes, fully **RTL Arabic-first** UI.

- **Owner:** وزارة الداخلية · أكاديمية الشرطة (Ministry of Interior · Police Academy)
- **Built by:** Appenza Studio — Engineering Manager: Mortada
- **Status:** Frontend feature-complete; design polish complete (`polish-complete` tag, 2026-05-03); major scope-alignment + admission-setup-wizard + lookups + admin-users-NID + applicant-grades work landed through 2026-05-16; post-2026-05-18 wave shipped the `/admin/committees-exam-config` management page, applicant unified-print + Stage-7 family-review, and cross-cutting chrome polish (see §11). Backend kickoff is the next workstream.
- **Demo deadline:** 2026-05-29 (~2 weeks out). The polish program (docs/POLISH_REPORT.md) was sized against this date.
- **Live demo:** https://appenzademo.com (the old `pa-cademy.vercel.app` URL is dead).
- **Deploy:** Vercel, configured by [vercel.json](vercel.json) at the repo root — installs + builds the `frontend/` workspace, serves `frontend/dist`, SPA-rewrites every path to `/index.html`, and sets long-cache headers for `/assets/*`.

### Milestone tags (baselines that docs reference)

| Tag | What shipped |
|---|---|
| `polish-complete` (2026-05-03) | 4-phase polish program — see [docs/POLISH_REPORT.md](docs/POLISH_REPORT.md) |
| `admin-gaps-complete` / `admin-gaps-verified` (2026-05-07) | 13 admin gaps A–M shipped + verified — see [Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md](Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md), [docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md), [docs/INTEGRATION_HANDOFF.md](docs/INTEGRATION_HANDOFF.md) |
| `applicant-flow-aligned` / `applicant-flow-verified` (2026-05-09) | 17 applicant-flow gaps AF-1 → AF-17 shipped + verified — see [docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md](docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md), [docs/APPLICANT_FLOW_VERIFICATION_REPORT.md](docs/APPLICANT_FLOW_VERIFICATION_REPORT.md) |
| `v0.2.0-demo` | first internal demo cut |
| (untagged, 2026-05-12 → 2026-05-16) | admission-setup wizard + lookups + admin-users-NID + applicant-grades — see §11 |
| (untagged, 2026-05-19 → 2026-05-20) | committees-exam-config management page + applicant unified-print + chrome polish — see §11 |
| (untagged, 2026-05-21) | admin backend integration pass — shared `apiClient`, backend-default admin services, typed backend errors, validation mapping — see [docs/ADMIN_BACKEND_INTEGRATION_STATUS.md](docs/ADMIN_BACKEND_INTEGRATION_STATUS.md) |

The doc baselines point at these tags — when reading `docs/*REPORT.md`, treat the named tag as the snapshot the doc was written against. Code may have moved since.

### Monorepo layout (as of 2026-05-07)

The repo is organised as a monorepo with two top-level workspaces. Only `CLAUDE.md` lives at the root — every other markdown is under `docs/` or `Tasks/`.

```
PACademy/
├── CLAUDE.md           ← this file (operating context for Claude Code)
├── frontend/           ← React 18 + TS + Vite — this CLAUDE.md is primarily about this workspace
├── backend/            ← local placeholder; backend instructions live in docs/BACKEND_IMPLEMENTATION_CONTEXT.md
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
npm run dev               # vite dev server → http://localhost:5173 (auto-opens)
npm run typecheck         # tsc --noEmit (must be 0 errors)
npm run build             # tsc -b && vite build → dist/
npm run preview           # serve built bundle
npm run lint              # eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
                          #   (config not yet committed — Sprint 10 hardening)
npm run test:routes       # scripts/test-routes.mjs — smoke-test every route returns 200 against localhost:5173
npm run test:routes:prod  # same, against the deployed URL (script default; override with arg)
```

### Notable dependencies (added since the Sprint 0 baseline)
- **@dnd-kit/core + sortable + utilities** — drag-and-drop reordering (exam plan editor, LookupTree).
- **@radix-ui/react-*** — 10 primitives: `accordion`, `alert-dialog`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `popover`, `select`, `switch`, `tabs`, `tooltip`. The sanctioned set is documented in [Tasks/RADIX_ADOPTION_REPORT.md](Tasks/RADIX_ADOPTION_REPORT.md).
- **mdb-reader + xlsx + buffer** — applicant-grades parses `.mdb` / `.accdb` / `.xlsx` / `.xls` / `.csv`. Both parsers are **lazy-loaded** (dynamic `import()`) so they don't block prod boot.

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
│   ├── admin/            20+ sub-routes — DashboardPage, ReportsPage (command-center),
│   │                     Applicants/Users/Audit/Settings, Cycles, Categories,
│   │                     Workflows, AdmissionRules + admission-setup/ wizard
│   │                     (6 steps: application_settings, fees, exams, committees,
│   │                     notifications, electronic_declaration) + users/ (NID-driven
│   │                     create + RolesPage over cloud permission matrix)
│   ├── applicant-grades/ /admin/applicant-grades — import (.mdb/.accdb/.xlsx/.xls/.csv)
│   │                     + adjustments console. Lazy-loaded parsers (mdb-reader, xlsx)
│   ├── lookups/          /admin/lookups — 22 typed lookups in 5 sections.
│   │                     Drawer-based add/edit, FK-guarded delete, sortable + inline
│   │                     status toggle, mapping screens. Replaces reference-data
│   ├── applicant-portal/ Pre-wizard gate (`/applicant/start`, `/eligibility`, `/tests`)
│   │                     + 11-stage Wizard (`/applicant/auth/step-1` … `/acquaintance-doc`)
│   ├── applicants/       Shared applicant service+queries (consumed by admin)
│   ├── audit/            service + queries — expanded detail parsing, status pill, coherent details
│   ├── committees/       overview, list, schedule, create, :id detail/edit/applicants —
│   │                     all served under `/admin/committee/*` and rendered inside AdminLayout.
│   │                     `categoryKey` + `gradeType` domain model; 12 seeded committees
│   │                     grouped by category tabs; CommitteeBindingMatrix (8 conflict codes)
│   ├── board/            overview, sessions list/create/live, decisions, members
│   ├── investigations/   cases, incoming, outgoing, distribution, create, detail
│   ├── medical/          overview, queue, results, station/:key, certificate
│   ├── barcode/          generate, lookup, batch, scan, replace, scans-history
│   ├── biometric/        verify, enroll, history, verify-ops, monitoring
│   ├── exams/            QuestionBank (CRUD), Exams list, Exam create/detail/take/proctor,
│   │                     dedicated /question-bank/proctor landing, results
│   └── dev/              /_dev/primitives, /_dev/lookups, /_dev/app-settings review pages
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
| `/admin/applicant-grades` | ApplicantGradesPage (import + adjustments console) | `admin` |
| `/admin/users` `/new` `/:id` `/:id/edit` `/roles` | Users* (NID-driven create) + RolesPage (cloud permission matrix) | `admin` |
| `/admin/audit` `/settings` `/reports` `/notifications` `/payments` | Audit / Settings / Reports / Notifications / Payments | `admin` |
| `/admin/lookups` `/:typeCode` `/mappings/:kind` | LookupsHubPage (22 typed lookups in 5 sections) — replaces `/admin/reference-data` (redirects) | `admin` |
| `/admin/admission-rules` | AdmissionRulesPage — **UI entry points hidden** (direct URL only) | `admin` |
| `/admin/admission-setup` `/wizard/:stepKey` (+ 6 step routes) | Admission-Setup wizard (top-stepper, 6 steps: application_settings → fees → exams → committees → notifications → electronic_declaration) | `admin` (perm `admission-setup:read`) |
| `/admin/cycles` `/new` `/:id` | Cycles* (single-active-cycle guard; inline status edit; one-click activation swap) | `admin` |
| `/admin/categories` `/new` `/:key` | Categories* (locked to RFP 4-category set; dedicated /new page) | `admin` |
| `/admin/workflows` `/new` `/:id` | Workflow editor | `admin` |
| `/admin/committees-exam-config` | CommitteeInstancesPage — management surface for `CommitteeInstance` rows in the active cycle. Day-grouped accordion with per-day transfer/delete, inline capacity edit, reservation refresh, and an inline «إضافة موعد اختبار» form mirroring the admission-setup wizard step. `/admin/committees` redirects here. | `admin` |
| `/admin/committee` `/list` `/schedule` `/create` `/:id` `/:id/edit` `/:id/applicants` | Committee* (renders inside `AdminLayout` chrome; `/committee/*` legacy URLs redirect here; `/schedule` is the per-cycle exam-schedule planner) | `committee` |
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

## 5. RBAC — cloud + on-prem split

Defined in [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts). `ROLES` is a `const`-tuple → derives `Role` union type. The 2026-05-24 rebuild aligned the cloud role set with the live permission matrix in [frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts).

### Cloud roles (8)

Backed by `apiClient` and the cloud permission matrix. Login through `/staff-login` (or `/applicant/auth/step-1` for the applicant role).

| Role | Arabic label | Apps |
|---|---|---|
| `super_admin` | مدير النظام الرئيسي | all 9 + architecture |
| `admissions_manager` | مدير القبول | admin |
| `applicants_officer` | موظف ملفات المتقدمين | admin |
| `setup_admin` | مهندس إعدادات القبول | admin |
| `payments_officer` | موظف المدفوعات | admin |
| `auditor` | مراجع النظام | admin |
| `exams_admin` | مدير بنك الأسئلة والاختبارات | exams |
| `applicant` | متقدم | applicant |

### On-prem roles (legacy keys, type-only)

Kept in the `ROLES` tuple so existing mock data, the `transitions.ts` workflow guards, and the architecture page docs keep type-checking. Cloud `apps` + `permissions` are deliberately **empty** — the on-prem deployment owns their RBAC plane and authentication path. They cannot reach cloud surfaces.

`committee_admin` · `committee_user` · `medical_admin` · `medical_doctor` · `investigator` · `board_admin` · `biometric_user` · `records_clerk`

### Cloud permission matrix

[frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts) is the source of truth. 21 modules across 3 sections — `admin` (16), `exams` (4 — bank, exams, proctor, results), `applicant` (2). 12 actions: view, create, edit, delete, manage, transition, approve, export, toggle, import, sync, reset. Cells `module × action` mapped to permission strings via `CELL_PERMISSION_MAP`. Roles list permissions matching these cells.

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

## 6. Backend integration layer + mock fallback

Every feature exposes:
- **`api/<feature>.service.ts`** — typed methods with `INTEGRATION CONTRACT` JSDoc header listing the real REST endpoints. Admin-relevant services now call the shared backend client by default and keep the old `MOCK` + `simulateLatency` bodies only behind explicit local demo mode.
- **`api/<feature>.queries.ts`** — TanStack Query hooks (`useX`, `useXMutation`) with a `keys` factory (e.g. `applicantKeys.list(filters)`).

Shared integration utilities:
- [frontend/src/shared/lib/api-client.ts](frontend/src/shared/lib/api-client.ts) — `apiClient`, token handling, `VITE_API_BASE_URL`, backend error mapping, Blob export support.
- [frontend/src/shared/lib/validation-errors.ts](frontend/src/shared/lib/validation-errors.ts) — normalizes backend 422/field-validation envelopes for forms.
- [frontend/.env.example](frontend/.env.example) — `VITE_API_BASE_URL=` and `VITE_USE_MOCKS=false`.

Backend is **enabled by default**. Set `VITE_USE_MOCKS=true` only for explicit local demo/mock mode; production builds throw if that flag is enabled. When `VITE_API_BASE_URL` is empty, calls use same-origin `/api/...`.

The admin-first backend pass on 2026-05-21 wired Auth/RBAC, users/roles/settings, cycles/categories/admission rules, lookups, admission setup, committees config, applicants, applicant grades, audit, payments, notifications, reports, and workflows to `apiClient` by default. See [docs/ADMIN_BACKEND_INTEGRATION_STATUS.md](docs/ADMIN_BACKEND_INTEGRATION_STATUS.md) for the current service inventory.

Backend implementation instructions from the 2026-05-21 attached handoff live in [docs/BACKEND_IMPLEMENTATION_CONTEXT.md](docs/BACKEND_IMPLEMENTATION_CONTEXT.md). The hard backend rules are: two services (`backend/admin` on `:5101`, `backend/applicant` on `:5102`) over one SQL Server DB; admin owns all migrations; applicant exposes read-only projections where it should not mutate; seed data must copy the full frontend mock dataset verbatim with no invented rows.

When adding or changing backend behavior, **keep pages and query hooks calling the existing service methods**. Add or adjust service methods rather than fetching from components:

```ts
async list(filters) {
  if (isBackendEnabled()) {
    return apiClient.get('/api/applicants', { query: filters });
  }
  await simulateLatency();
  return paginate(MOCK.applicants.filter(...), ...);
}
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

✅ **Done (scope-alignment + admission-setup wizard, 2026-05-12 → 2026-05-16)**

- **Admission-Setup wizard** at `/admin/admission-setup`. Cycle picker landing → top-stepper wizard (`/admin/admission-setup/wizard/:stepKey`). Config-driven step registry in [frontend/src/features/admin/admission-setup/config.ts](frontend/src/features/admin/admission-setup/config.ts) — single source of truth for sidebar/breadcrumb/route order. **Six steps** ship interactive content: `application_settings` → `fees` → `exams` → `committees` (with Add/View sub-tabs labelled 4.1/4.2) → `notifications` → `electronic_declaration`. Earlier age, marital, application_status, and total-grade steps were folded into `application_settings` and dropped. Cycle metadata (name/year/dates) is **not** a wizard step — admins enter the wizard by selecting an already-configured cycle from `/admin/cycles`. New `admission-setup:read|write` typed permissions in [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts).

- **Application Settings (شروط التخصص)** — per-category year-row schema with discriminated-union `gradeKind` ("percentage" vs branched per-track grade), multi-gender, multi-marital, multi-graduation-years (`graduationYears`), max-age (no min). Faculty/specialization conditions where the النوع field is a multi-select; faculty/specialization columns surfaced on the approved-rules grid. Conflict banner for misaligned existing rows. Service-level `GRADE_MODE_MISMATCH` enforcement. Inline pill toggle + chevron-down on expand. Bulk-save bar + unsaved-changes prompt. See [frontend/src/features/admin/admission-setup/components/applicationSettings/](frontend/src/features/admin/admission-setup/components/applicationSettings/).

- **Lookup Management Module** (`/admin/lookups`) — replaces `/admin/reference-data` (which now redirects). 22 typed lookups grouped into 5 sections (kinship · الكليات · التخصصات · process · geography/admin). Each lookup has a typed per-key row shape via `LookupRow<K>`. Drawer-based add/edit ([frontend/src/features/lookups/components/LookupFormDrawer.tsx](frontend/src/features/lookups/components/LookupFormDrawer.tsx)), FK-guarded delete, inline status toggle, sortable columns. Four mapping screens via `MappingMatrix`. `applicant-categories` lookup is locked to the RFP 4-category set; faculties + specializations reseeded from RFP scope list. `submission-types` has an FK guard to `applicant-categories`. English code column hidden from admin UI — Arabic names only. Status labels use "نشط / غير نشط" across all 18+ lookups. See [frontend/src/features/lookups/index.ts](frontend/src/features/lookups/index.ts) and [docs/lookups/](docs/lookups/) migration report.

- **Admin Users NID-driven flow** — new `/admin/users/new` (NID lookup), `/admin/users/:id`, `/admin/users/:id/edit`, and `/admin/users/roles`. Role multi-select, status toggle, role-conflict rules, audit emissions, a11y. RolesPage rebuilt over a new **cloud permission matrix** ([frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts)) — `admin` + `exams` + `applicant` sections (operational on-prem modules — committees, medical, investigations, board, biometric, barcode, workflows — deploy on the Ministry's on-prem cluster with a separate RBAC surface and are intentionally absent). Don't extend this matrix to cover them. super_admin creation pre-enables all permissions; every permission checkbox is selectable.

- **Applicant Grades** (`/admin/applicant-grades`) — per-cycle grades import + adjustments console. Real `FileReader`-driven upload (no `setInterval` simulation) of `.mdb` / `.accdb` / `.xlsx` / `.xls` / `.csv` with per-extension size limits, client-side validation, progress UI with cancel/retry. `mdb-reader` and `xlsx` are lazy-loaded so they don't block prod boot. Drawer-based row details, sortable on every column, search across all fields. See [frontend/src/features/applicant-grades/](frontend/src/features/applicant-grades/).

- **Committee module expansion** — `categoryKey` + `gradeType` domain on `CommitteeRow`. 12 hand-written committees seeded grouped by category. CommitteeListPage groups by category tabs with inline edit dialog. `/admin/committee/schedule` page for per-cycle exam-schedule planning with editable capacity (`features/committees/pages/CommitteeSchedulePage.tsx` + new `examSchedule` service/queries). CommitteeBindingMatrix in admission-setup with **8 conflict codes** (`BINDING_*`) added to [docs/DB_CONSTRAINTS.md](docs/DB_CONSTRAINTS.md). Create form scoped to the active category; gender derived from category; max-percentage instead of fixed capacity; category-driven filters. `specialized_officers` category derives gender from the picked specialization.

- **Cycles** — single-active-cycle invariant. Status-driven create form, capacity input slimmed, dropped notes/dates from create, one-click activation swap, segmented gender toggle. Inline status edit on list. Detail page trimmed to current field set.

- **Categories** — dedicated `/admin/categories/new` page (modal replaced; old `/new` route redirects to list). Locked to RFP 4-category set. Form trimmed to name + description; English code column dropped from list. Edit page mirrors new-page form. Spec categories allow editing `labelAr`. Per-category gender + application window with academic-year validation.

- **Reference-Data dropped → Lookups.** `referenceData` + `referenceDataRoot` keys in `ROUTES.admin` are marked `@deprecated`; routes redirect. Ranks tab dropped; specialties reparented under faculties. Colleges + qualifications tabs dropped.

- **List-Actions** primitives — wired across 20 list pages. See `features/shared/list-actions/` and toolbar buttons matching page-header actions.

- **Sidebar consolidation** — drops dashboard, categories, application-settings, committee-overview, committee-list entries from the admin sidebar in favor of the admission-setup wizard. Unified sidebar pattern across all 7 staff apps with hairline separators and full-viewport height. Collapsible group for admission-setup.

- **AppShell + chrome** — dropped the deprecated `appLabel` pill from `AppShell`. Polished staff header toolbar rhythm. Active cycle in shell flipped to "دورة التقديم 2026".

- **Audit** — expanded detail parsing (each row names section + action + target), status pill column, coherent details.

- **Combobox/MultiSelect popover fixes** — added a `data-radix-popper-content-wrapper`-style marker so a portaled popover doesn't dismiss its host Radix Dialog/Sheet on option click. Manual scroll handling so `react-remove-scroll` can't block wheel events inside the popover when it's nested in a Radix Dialog.

- **Modal / Drawer** — stopped tearing down the focus trap on every parent re-render (was causing flicker + dropped focus).

- **DatePicker / DateRangePicker** — portal popover renders above modals, flips up when viewport is tight, clamps within viewport; weekday-label crowding + 2-digit-date crowding fixed.

- **Dev review pages** — `/_dev/primitives`, `/_dev/lookups`, `/_dev/app-settings` (registered in `routes.tsx`, exported from [frontend/src/features/dev/](frontend/src/features/dev/)).

- **`/admin/admission-rules` entry points hidden** (route still registered for direct URL).

- **Wizard / step naming** — Arabic labels updated: "قواعد عامة" → "الشروط العامة"; "التقدير" → "الحد الأدنى للتقدير"; "نوع التقديم" badge dropped; "الإقرار الإلكتروني" now supports a PDF upload alongside the rich-text mode; graduation year rendered as Eastern Arabic numerals.

✅ **Done (applicant-flow MOI-alignment, 2026-05-16)**

Aligned the applicant portal with the MOI reference flow document (`docs/references/applicant-flow-moi-portal.pdf`). 10 commits, 9 screens rebuilt or refined, two new routes (`/applicant/profile`, `/applicant/verify`), three legacy paths now redirect (`/applicant/profile/{personal,education,marital}`), zero new shared components. See [docs/migration/applicant-flow-moi-alignment/REPORT.md](docs/migration/applicant-flow-moi-alignment/REPORT.md) for the full mapping table + deviation notes.

- **`refactor(applicant): wizard store + route + stepper rewires`** — foundation commit. Wizard store gains `verifiedAt`, `paid`, `paymentMethod`, `paymentReference`, `fawryCode`, `firstExamDate`, `parentsApproved` (with `setPayment` atomic setter). `STAGE_KEYS` collapses 3+4+5 into one `profile` node and inserts `verify` + the summary index — stepper still shows 11 stages. New service methods (`verifyApplicant`, `createPaymentIntent`, `confirmPayment`, `approveParents`, `pickFirstExamDate`) with INTEGRATION CONTRACT JSDoc, plus matching TanStack-Query hooks. New `lib/moi-session.mock.ts` (deterministic MOI SSO payload) and `lib/deterministic-codes.ts` (isolated LCG keyed off applicant id; doesn't touch the global seed-42 LCG).
- **`feat(applicant): rebuild category-selection page per MOI reference`** (`/applicant/start`) — card-grid replaced with the PDF p.3 table: 4 header rows (identity / eligibility / specializations / instructions) each opening a `Drawer` via blue `عرض` button, then per-category rows with primary `التقدم للإلتحاق` button + Tooltip on disabled state. Multi-cycle picker strip kept for the male+female concurrent cohort case.
- **`feat(applicant): collapse stages 3-5 into single applicant-data page`** (`/applicant/profile`) — single scrollable form per PDF p.4: bachelor block (conditional on non-`officers_general`), ثانوية block, read-only personal data from MOI session, address + contact, declaration checkbox + `حفظ`. Marital data moved out (the MOI flow doesn't include it here). Legacy `profile/personal`, `profile/education`, `profile/marital` redirect to the new page.
- **`feat(applicant): add verify step between profile and summary`** (`/applicant/verify`) — PDF p.5 lower. NID + mobile re-entry; mismatch → inline alert; match → `verifiedAt` on store + nav to summary.
- **`feat(applicant): rebuild summary page with payment/edit/instructions actions`** (`/applicant`) — generic wizard hub replaced with the PDF p.5 top summary screen: top-bar action cluster (`الدفع` / `تعديل الطلب` / `عرض إرشادات التقدم`), yellow modification-deadline banner, read-only data + contact sections, primary CTA adapts to draft state (4 states).
- **`feat(applicant): rebuild stage-6 payment with fawry-code and credit-card paths`** (`/applicant/payment`) — three-step state machine: method picker → Fawry-code inline panel _or_ a Fawry-hosted credit-card simulation (3 sub-steps: method / details / summary). Both methods persist a deterministic 10-digit `paymentReference`. The `محاكاة عرض توضيحية` chip is preserved on the panel.
- **`feat(applicant): rebuild stage-7 family with parent tabs and approval`** (`/applicant/profile/family`) — 4-tab strip (father / mother / stepfather conditional / view). Stepfather tab unlocks when applicant ticks الوالدة متزوجة بغير الوالد. View tab shows the summary `DataTable` + `اعتماد` button (disabled until tabs 1+2 are saved). **Drops** the extended family tree (grandparents, siblings, relatives to 4th degree) to match the PDF strictly — investigations app now needs its own intake for that data. See migration report deviation #1.
- **`feat(applicant): refine stage-8 exam-date pick screen`** (`/applicant/exam-schedule`) — day-card grid replaced with PDF p.11: read-only header rows (إسم الطالب / الرقم القومي / اللجنة) + single `Select` بـ "تاريخ الإختبار" + `حفظ`. On submit fires the PDF's confirmation `Modal` ("تنبيه / تم اختيار تاريخ الإختبار بنجاح / موافق"), then on dismiss navigates to print-card.
- **`feat(applicant): refine stage-9 print-card with barcode and exam table`** (`/applicant/print-card`) — top non-print Card carries the accent-coloured notice + top-end `طباعة`/`تحميل`. PrintLayout body matches PDF p.12: barcode column (value = `{nationalId}-{paymentReference}`) + identity column + verification stamp + payment-reference line + prose exam-date sentence + كشف ومواعيد الإختبارات table.
- **`feat(applicant): refine stage-10 follow-up results table`** (`/applicant/follow-up`) — pipeline-tile grid replaced with a single `DataTable` mirroring the Stage 9 exam table columns: م · الإختبار · التاريخ · النتيجة · ملاحظات. Tone-mapped Badge per pipeline state. Detail pipeline cards moved to staff-side surfaces.

✅ **Done (admission-setup category completion badge, 2026-05-18)**

- **`feat(admission-setup): completion-driven category badge in application settings`** — `/admin/cycles/admission-setup/wizard/application_settings`. Replaces the per-category `مفعّل`/`موقوف` switch on each accordion row with a tri-state `Badge` (`مكتمل` ✓ / `جزئي` ⊙ / `فارغ` ○) driven by a new pure selector `selectCategoryCompletion(categoryCode, categoryType, approved, scopedSpecCodes)` exported from `wizardSharedState.ts`. Derives off the same `approved` bucket the expanded panel writes into — university categories pass when every scoped specialization has at least one approved row with all required fields filled (header dates + max-age + marital + gender + grade ramp + score range + degree + committee + grad year); pre-university categories pass on the first complete thanawi row. Activation toggling is no longer surfaced from this position (the service-level `toggleCategoryActive` mutation remains on the contract for backend integration).

✅ **Done (committees-exam-config + applicant admission-form + chrome polish, 2026-05-19 → 2026-05-20)**

A wave of work converging on three threads: the new `/admin/committees-exam-config` management page, applicant-portal print/PDF, and cross-cutting UI hardening.

- **Committees-Exam-Config (`/admin/committees-exam-config`)** — purpose-built management surface for `CommitteeInstance` rows in the active cycle. Day-grouped accordion (sorted ascending, every authored day visible — past included so completed exam days can be audited). Per-day inline actions: **«نقل اليوم»** (reservations-only transfer with all-or-nothing pre-flight; surfaces an upfront capacity-conflict alert that pre-fills `requiredCapacity` per blocking row so admins can override capacity inline before re-submitting), **«حذف اليوم»** (reservation-aware confirmation), inline capacity edit per row, and a global **«تحديث»** that re-syncs reserved counts. Mounted above the accordion: an inline **«إضافة موعد اختبار»** form mirroring the admission-setup wizard step — same multi-category + DatePicker + capacity + fan-out across active committee definitions, same accumulate-vs-insert partitioning. The form lives in [frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeInstanceAddForm.tsx](frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeInstanceAddForm.tsx) and is consumed by both the wizard panel and the management page. `/admin/committees` redirects here. The `CommitteeInstance` seed is intentionally empty in `committeeInstances.ts` (admin authors every row) — when seed data is needed for transfer testing, populate it explicitly.

- **Demo-only dummy reservations** — `committeeInstanceService.addMany` synthesizes a deterministic per-row reservation count (FNV-1a hash of `${definitionCode}|${date}` mapped into [0.45, 0.95) of capacity) so admin-authored rows surface on the management page with realistic numbers instead of empty bookings. Helper carries the integration contract: backend integration must drop `demoReservations` and keep `reserved: 0` at creation — real counts come from the scheduling system via the «تحديث» button.

- **Applicant admission-form unified print** (`/applicant/print-card`, Stage 9) — Stage 9 now renders the بطاقة التردد and the طلب الإلتحاق (admission form) in a single print job. Authoring lives in [frontend/src/features/applicant-portal/components/AdmissionFormSection.tsx](frontend/src/features/applicant-portal/components/AdmissionFormSection.tsx) (on-screen + printable), with a profile snapshot helper in [frontend/src/features/applicant-portal/lib/profileData.ts](frontend/src/features/applicant-portal/lib/profileData.ts). Earlier separate `admissionFormPdf.ts` PDF-generation pathway was superseded — the form is now an inline React section sharing the print stylesheet.

- **Applicant Stage 7 family review step** — a review tab on the family page that surfaces a summary `DataTable` of the entered father / mother / (optional) stepfather data + an «اعتماد» button gated on the parent tabs being saved. Sits at `/applicant/profile/family`. See [frontend/src/features/applicant-portal/pages/Stage7ReviewFamilyPage.tsx](frontend/src/features/applicant-portal/pages/Stage7ReviewFamilyPage.tsx).

- **Applicant category-specific fields** — specialized-officers applicants pick a faculty + specialization in the bachelor block (Stage 3-5 page); law-bachelor applicants get a fixed faculty option; doctorate fields land in the postgraduate section.

- **Lookups معيار التمييز ramp-up** — `معيار التمييز` is always visible across categories (previously hidden for officers_general by default). The legacy spelling `التميز` was renamed across lookups + admission-setup. `officers_general` defaults to `EXC-02`. Committee-rules pair in admission-setup swaps when the معيار التمييز changes.

- **Applicant-grades import hardening** — duplicate validation now keys on `(NID, graduationYear)` instead of `(NID, totalGrade)`: a re-applicant with a different graduation year flows through the diff-review step instead of being silently dropped. Always-on changes-review nav; per-row confirm action + region column on the list; max-total default when picking from duplicates; grade columns moved next to the student-name column; Step 1 dropdowns restyled (h-11, sm shadow, teal hover) with helper text dropped.

- **Cross-cutting UI hardening (`chore(frontend)` + `polish(frontend)` commits, 2026-05-20)**:
  - **Confirmations on shared `AlertDialog`** — replaced remaining `window.confirm()` sites with the shared dialog (consistent tone, focus trap, escape, RTL).
  - **Hardcoded colors → tokens** — the few remaining hex/rgb values in production code routed through `tokens.css` variables.
  - **Sidebar collapse** — staff sidebar now collapses to an icon rail with persisted state. Active-route highlighting + section emphasis preserved in both modes. Improved icon-rail keyboard accessibility.
  - **Unified admin toolbar + dropdown controls** — `Button`, `DataTable`, `MultiSelect`, `RadixMultiSelect`, `RadixSelect`, `SearchSelect`, `Select`, `PageHeader`, and `NotificationCenter` all routed through a new shared [frontend/src/shared/components/dropdownStyles.ts](frontend/src/shared/components/dropdownStyles.ts). Same paint across admin toolbar buttons, list-page action chips, and every dropdown trigger.

✅ **Done (admin backend integration pass, 2026-05-21)**

- **Backend-first admin service layer** — added [frontend/src/shared/lib/api-client.ts](frontend/src/shared/lib/api-client.ts). Admin services call real REST endpoints by default; mock fallback is opt-in via `VITE_USE_MOCKS=true`. Production throws if mock mode is enabled. Tokens are read from `pa-auth` and sent as Bearer auth. CSV/export endpoints can request `Blob`s.
- **Typed backend errors** — backend envelopes now map to `ConflictError`, `DependencyBlockedError`, `AccountInactiveError`, `NotFoundError`, and `ValidationError`. Field-level validation normalization lives in [frontend/src/shared/lib/validation-errors.ts](frontend/src/shared/lib/validation-errors.ts).
- **Admin service coverage** — Auth/RBAC, users, roles, settings, cycles, categories, admission rules, lookups, admission setup, committee instances, admin applicants, applicant grades, audit, payments, notifications, reports, and workflows are wired through `apiClient` by default. See [docs/ADMIN_BACKEND_INTEGRATION_STATUS.md](docs/ADMIN_BACKEND_INTEGRATION_STATUS.md).
- **Admin UI mock-data cleanup** — dashboard, applicants filters, committee overview/detail/form/create, lookup drawer/table/detail now read from query-backed services rather than direct seeded data where touched.
- **Server-side validation surfaced in admin forms** — applicant create/edit, user create/edit, cycle create/edit, category edit, and committee create now map backend field errors into visible form errors.

✅ **Done (RBAC rebuild + Question Bank backend, 2026-05-24)**

- **Cloud RBAC rebuild.** Old 11-role mix (admin + on-prem) collapsed into a clean 8-role cloud set: `super_admin`, `admissions_manager`, `applicants_officer`, `setup_admin`, `payments_officer`, `auditor`, `exams_admin`, `applicant`. Each role's `permissions` array is derived from the cells the role should fire in [frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts). On-prem keys (`committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `biometric_user`, `records_clerk`) stay in the `ROLES` tuple so legacy mock data + `transitions.ts` guards type-check; their cloud `apps` + `permissions` are deliberately empty. See [rbac.ts](frontend/src/features/auth/rbac.ts) and the §5 RBAC table.
- **Permission matrix gained the exams section.** `cloudPermissions.ts` now has 3 sections (`admin`, `exams`, `applicant`) and 21 modules. New exams modules: `exams_bank`, `exams_exams`, `exams_proctor`, `exams_results` — wired to `questions:*` / `exams:*` permission strings.
- **Question Bank wired to backend.** [frontend/src/features/exams/api/exams.service.ts](frontend/src/features/exams/api/exams.service.ts) now calls `apiClient` by default for the full INTEGRATION CONTRACT — listQuestions/getQuestion/createQuestion/updateQuestion/publishQuestion/getCategories/listExams/getExam/createExam/publishExam/startAttempt/submitAttempt/getAttempts/checkConflict/createQuestionBatch/listLiveSessions. Mock fallback only behind `VITE_USE_MOCKS=true`.
- **Backend Exams module** ([backend/admin/PACademy.Admin.Api/Modules/Exams/](backend/admin/PACademy.Admin.Api/Modules/Exams/)) — `ExamsService` + `ExamsSeeder` + `ExamsController`, backed by the shared `admin_records` JSON store (no new migration). Buckets: `questions`, `exams`, `exam-attempts`, `exam-live-sessions`. Grading supports mcq + true-false (`correctIndex` compare) + matching (`matchingPairs` dict compare). 6-month re-take conflict check matches frontend.
- **Exams seed data** ([backend/admin/PACademy.Admin.Api/SeedData/exams.seed.json](backend/admin/PACademy.Admin.Api/SeedData/exams.seed.json)) — 52 questions (50-question MCQ pool + 2 mixed-type samples) and 2 exam configs copied verbatim from the frontend mock per the CLAUDE.md backend rule. Seeder is idempotent (only fills empty buckets so manual edits via the API are preserved).
- **Login fallback for cloud roles** — `auth.service.ts` now tries the requested role first, then retries without a role (backend uses user's stored role), then falls back to `super_admin`. New cloud users like `admissions_manager` can log in through either picker tile without 403.
- **Identity seed** ([backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json](backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json)) — ships the 8 cloud roles as system rows (super_admin is the only seeded user; admin creates the rest via `/admin/users/new`).

🚧 **Next sprints**
- **Sprint 10 — Hardening**: Vitest + Testing Library, Playwright smoke E2E, `eslint-plugin-boundaries`, Husky pre-commit, accessibility audit, print polish.
- **Backend integration continuation**: keep expanding the admin-first `apiClient` pattern and remove remaining production-path mock leaks. Component/query/type contracts stay unchanged.

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
9. **Backend-first admin integration.** Do not fetch from components. Use or extend the relevant `*.service.ts`; admin services call `apiClient` by default and retain mock fallback only for `VITE_USE_MOCKS=true`.
10. **Arabic content is exact** — copy-paste from the legacy demo or existing files; do not retype Arabic strings (rendering edge cases bite).
11. **Per-app surfaces consume `var(--accent-*)`, never hardcoded `bg-teal-*` / `text-gold-*`.** The S1 audit (POLISH_REPORT §3) closed this across 7 of 9 apps. New per-app surfaces must use `var(--accent-500/700/50)` via inline `style` so the `data-app="<key>"` overrides flow through.
12. **§4 two-phase signature canon** (PRODUCT.md §4): any "preliminary save" affordance uses the dashed `border-gold-300 bg-gold-50 text-gold-700` notice shape; any "final / approved / معتمد" Badge carries the `<IconStamp width={12} height={12} />` glyph on the start edge. Don't invent new affordances for the same workflow.
13. **App.tsx auto-seeds a super_admin demo user** (`ensureDemoUser()`). To verify `/staff-login` visually, temporarily disable that block — `LoginPage` redirects authenticated users straight to `/hub`.
14. **Terminology — use "RFP Scope Document" not "karasa"** in code, comments, and user-facing copy. The `Tasks/KARASA_GAPS.md` filename stays for git-history continuity, but the term inside is "RFP Scope Document."
15. **Admission-Setup is config-driven.** Don't hand-edit the sidebar, routes table, or breadcrumbs to add a step — append to `ADMISSION_SETUP_STEPS` in [frontend/src/features/admin/admission-setup/config.ts](frontend/src/features/admin/admission-setup/config.ts) and the rest follows. Cycle metadata is **never** a step; admins pick a cycle from `/admin/cycles` before entering the wizard.
16. **Cloud-vs-on-prem RBAC split.** The cloud permission matrix in [frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts) covers `admin` + `exams` + `applicant` sections. Operational on-prem modules (committees, medical, investigations, board, biometric, barcode, workflows) have a separate RBAC on the on-prem deployment and are intentionally absent from this matrix. Don't add their modules/actions here. The Question Bank joined the cloud plane on 2026-05-24 — see §11 for the rebuild notes.
17. **Lookups replaced reference-data.** Don't add new entries under `/admin/reference-data` — it redirects. New admin-managed reference values become lookups in [frontend/src/features/lookups/](frontend/src/features/lookups/).
18. **Single active cycle.** The admin cycles UI enforces "one active cycle at a time" with a one-click swap when activating a new one. Don't add code that assumes multiple active cycles can coexist.

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
| Add an admission-setup step | Append an entry to `ADMISSION_SETUP_STEPS` in [frontend/src/features/admin/admission-setup/config.ts](frontend/src/features/admin/admission-setup/config.ts) + add the route segment under `ROUTES.admin.admissionSetup` + create the page file. Sidebar/breadcrumbs/wizard nav derive automatically. |
| Add a lookup | Add the key to `LOOKUP_KEYS` in [frontend/src/features/lookups/types.ts](frontend/src/features/lookups/types.ts) + extend `LookupRowMap` with the row shape + seed in [frontend/src/features/lookups/mock/lookups.mock.ts](frontend/src/features/lookups/mock/lookups.mock.ts) + place in a `LOOKUP_SECTIONS` group. CRUD UI is generated by `LookupsHubPage`. |
| Change cloud RBAC | [frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts) — admin + exams + applicant sections only. Mirror role definitions in [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts), [frontend/src/shared/mock-data/roles.ts](frontend/src/shared/mock-data/roles.ts), and [backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json](backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json). Do **not** add on-prem operational modules; they have a separate RBAC. |
| Question Bank backend | [backend/admin/PACademy.Admin.Api/Modules/Exams/](backend/admin/PACademy.Admin.Api/Modules/Exams/) — `ExamsService` over `AdminRecords`. Seeded from [exams.seed.json](backend/admin/PACademy.Admin.Api/SeedData/exams.seed.json). REST surface in [ExamsController.cs](backend/admin/PACademy.Admin.Api/Controllers/ExamsController.cs); frontend client in [exams.service.ts](frontend/src/features/exams/api/exams.service.ts). |
| Add a DB constraint / conflict code | [docs/DB_CONSTRAINTS.md](docs/DB_CONSTRAINTS.md) — frontend mock services throw typed `ConflictError` codes that the backend must mirror at integration time. |
| Per-cycle exam schedule | [frontend/src/features/committees/pages/CommitteeSchedulePage.tsx](frontend/src/features/committees/pages/CommitteeSchedulePage.tsx); service+queries under `features/committees/api/examSchedule.*`. |
| Committee instances management | [frontend/src/features/admin/pages/CommitteeInstancesPage.tsx](frontend/src/features/admin/pages/CommitteeInstancesPage.tsx) (`/admin/committees-exam-config`). Service+queries under `features/committees/api/committeeInstance.*`. Shared add form: [CommitteeInstanceAddForm.tsx](frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeInstanceAddForm.tsx) — mounted on both the management page and the admission-setup wizard committees step. |
| Toolbar / dropdown chrome | [frontend/src/shared/components/dropdownStyles.ts](frontend/src/shared/components/dropdownStyles.ts) — single source for admin-toolbar buttons, dropdown triggers, action chips. Touch this, not per-component overrides. |
| Live demo URL | https://appenzademo.com (`pa-cademy.vercel.app` is dead — don't link it). |
| Smoke-test routes | `npm --prefix frontend run test:routes` (against localhost) or `:prod` (deployed). Driven by [frontend/scripts/test-routes.mjs](frontend/scripts/test-routes.mjs) — confirms SPA rewrite catches every direct-URL hit. |
| Deploy config | [vercel.json](vercel.json) — `installCommand` + `buildCommand` scoped to `frontend/`; SPA rewrite + asset cache headers. |
| Park tech-debt | [TODO.md](TODO.md) at repo root — durable record of deferred items, including the two intentional `: any` exceptions. |

---

## 14. Context-document index

### Live (read these before working in their area)

| Doc | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | This file — operating context for Claude Code (always read first) |
| [PRODUCT.md](docs/PRODUCT.md) | Strategic context: users, brand, anti-references, §4 two-phase canon |
| [DESIGN.md](docs/DESIGN.md) → [Tasks/DESIGN_SYSTEM.md](Tasks/DESIGN_SYSTEM.md) | Visual constitution — tokens, type, motion (read before any visual work) |
| [docs/DB_CONSTRAINTS.md](docs/DB_CONSTRAINTS.md) | DB invariants + typed `ConflictError` codes the backend must mirror — read before opening any mutating service file |
| [docs/INTEGRATION_HANDOFF.md](docs/INTEGRATION_HANDOFF.md) | Backend integration bible — every `*.service.ts` contract mapped to its real REST endpoint, every typed error mapped to its required response shape (baseline tag: `admin-gaps-verified`) |
| [docs/BACKEND_IMPLEMENTATION_CONTEXT.md](docs/BACKEND_IMPLEMENTATION_CONTEXT.md) | Backend implementation instructions from attached handoff docs: two-service topology, seed-data rule, conventions, build order, verification |
| [docs/ADMIN_BACKEND_INTEGRATION_STATUS.md](docs/ADMIN_BACKEND_INTEGRATION_STATUS.md) | Current 2026-05-21 admin backend integration status: api client, env flags, wired services, validation mapping, remaining notes |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | The script for the 2026-05-29 evaluator demo — the customer-facing narrative |
| [Tasks/KARASA_GAPS.md](Tasks/KARASA_GAPS.md) | RFP Scope Document coverage map (filename retained; term inside is "RFP Scope Document") |
| [Tasks/RADIX_ADOPTION_REPORT.md](Tasks/RADIX_ADOPTION_REPORT.md) | Inventory of sanctioned Radix primitives + composition patterns (referenced by §2.5) |
| [TODO.md](TODO.md) | Durable tech-debt record — documented `: any` exceptions, parked follow-ups |
| [docs/README.md](docs/README.md) | Public-facing README + quick-start |
| [docs/INDEX.md](docs/INDEX.md) | Index of the `docs/` folder |

### Snapshots (point-in-time records — useful for context, not for the current code state)

| Doc | What it captured | Tag baseline |
|---|---|---|
| [docs/POLISH_REPORT.md](docs/POLISH_REPORT.md) | Closeout of the 4-phase polish program | `polish-complete` (2026-05-03) |
| [docs/polish/SHAPE_BRIEFS.md](docs/polish/SHAPE_BRIEFS.md) | Per-screen briefs for all 16 flagship screens | `polish-complete` |
| [docs/polish/POLISH_PROGRESS.md](docs/polish/POLISH_PROGRESS.md) | Append-only live log of the polish program | `polish-complete` |
| [Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md](Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md) | 13 admin gaps A–M — scope + plan + closeout | `admin-gaps-complete` |
| [docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) | Verification pass over the 13 admin gaps | `admin-gaps-verified` |
| [docs/PA_ADMIN_SCOPE_CHECKPOINTS.md](docs/PA_ADMIN_SCOPE_CHECKPOINTS.md) | 20 PA-Academy admin scope checkpoints CP1–CP20 mapped to evidence | `admin-gaps-verified` |
| [docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md](docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md) | 17 applicant-flow gaps AF-1 → AF-17 | `applicant-flow-aligned` |
| [docs/APPLICANT_FLOW_VERIFICATION_REPORT.md](docs/APPLICANT_FLOW_VERIFICATION_REPORT.md) | Verification pass over the 17 applicant-flow gaps | `applicant-flow-verified` |
| [docs/FRONTEND_FLOW_CLOSURE.md](docs/FRONTEND_FLOW_CLOSURE.md) | End-to-end admin + applicant user-flow walk-through | post-`applicant-flow-verified` |
| [docs/LIST_ACTIONS_INVENTORY.md](docs/LIST_ACTIONS_INVENTORY.md) | Inventory of the 20 list pages wired to list-actions | — |
| [docs/ADMISSION_SETUP_REVIEW_RESULTS.md](docs/ADMISSION_SETUP_REVIEW_RESULTS.md) | Closeout of admission-setup wizard review | post-admission-setup work |
| [Tasks/ADMISSION_SETUP_REVIEW_CHECKLIST.md](Tasks/ADMISSION_SETUP_REVIEW_CHECKLIST.md) | Checklist used to drive the admission-setup review | — |
| [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | Earlier UX/UI audit findings | Historical |
| [docs/SCOPE_AUDIT.md](docs/SCOPE_AUDIT.md) | Scope audit against the RFP | Historical |
| [docs/PADDING_AUDIT.md](docs/PADDING_AUDIT.md) | Spacing/padding consistency audit | Historical |
| [docs/POLISH_PLAN.md](docs/POLISH_PLAN.md) | Original polish program plan + 10 audit findings (S1–S10) | Superseded by POLISH_REPORT.md |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Session-handoff doc that ran the polish work | Polish complete |
| [docs/PRESENTATION_PROMPT.md](docs/PRESENTATION_PROMPT.md) | Presentation-prep prompt for the demo | Reference for DEMO_SCRIPT.md |
| [docs/migration/](docs/migration/) [docs/wizard-cleanup/](docs/wizard-cleanup/) [docs/exam-schedule/](docs/exam-schedule/) [docs/committee-grade-types/](docs/committee-grade-types/) [docs/changes/](docs/changes/) | Per-mini-project closeout folders with screenshots | Various |
| [Tasks/tasks.md](Tasks/tasks.md) | Original sprint task plan | Reference |
| [Tasks/CLAUDE_CODE_BRIEF.md](Tasks/CLAUDE_CODE_BRIEF.md) | Original Claude-Code project brief | Historical (kickoff context) |
| [Tasks/ADMISSION_SETUP_PROMPT.md](Tasks/ADMISSION_SETUP_PROMPT.md) [Tasks/LIST_ACTIONS_PROMPT.md](Tasks/LIST_ACTIONS_PROMPT.md) | Drive-prompts used to deliver those workstreams | Historical |
