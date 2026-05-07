# منظومة القبول · أكاديمية الشرطة — Frontend

> **React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind**
> Production-grade rebuild of the Police Academy Admissions Platform — 3 surfaces (PUBLIC / APPLICANT / STAFF), 11 RBAC roles, 9 connected applications, fully RTL Arabic-first.
>
> **Status:** feature-complete + polish-complete (tag `polish-complete`, 2026-05-03). Demo cut tagged `v0.2.0-demo`. Backend integration is a later phase. See [POLISH_REPORT.md](POLISH_REPORT.md) for the polish closeout, [CLAUDE.md](CLAUDE.md) for full operating context.

---

## Repo layout

This is a monorepo with two top-level workspaces and shared docs at the root:

```
frontend/    React 18 + TS + Vite — this README is primarily about this workspace
backend/     empty placeholder; backend team starts here next
Tasks/  docs/  CLAUDE.md  PRODUCT.md  POLISH_REPORT.md  …  (project-level)
```

## Quick start

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
npm run typecheck    # → 0 errors
npm run build        # → dist/ static bundle
npm run preview      # → serve the built bundle
```

(Or from the repo root: `npm --prefix frontend install && npm --prefix frontend run dev`.)

Login with any credentials — pick a role from the role grid; the demo derives the user from the role you pick.

Login is at `/staff-login` (root `/` is now the public landing page; `/login` is a back-compat redirect).

| Role picker (staff-login screen) | Lands on |
|---|---|
| مدير النظام (`super_admin`) | `/admin/reports` (admissions command-center; can navigate to `/hub` for all 9 apps) |
| مدير لجنة (`committee_admin`) | `/hub` (sees: admin, committee, barcode, biometric) |
| القومسيون الطبي (`medical_admin`) | `/hub` (sees: medical, barcode, biometric) |
| إدارة التحريات (`investigator`) | `/hub` (sees: investigations only) |
| متقدم (`applicant`) | `/applicant` |
| … 6 more roles | per RBAC matrix |

---

## What's included

### Routes — 3 surfaces

```
─── PUBLIC ───────────────────────────────────────────────────────────────
/                                   PublicLandingPage — marketing landing for the platform
/apply                              Pre-wizard gate; routes into /applicant/start
/staff-login                        Role-aware login + 2-column heritage art panel
/login                              → redirects to /staff-login (legacy alias)
/terms                              Terms & conditions
/help                               HelpPage — public support / contact

─── STAFF (AuthGuard) ────────────────────────────────────────────────────
/hub                                Hub — KPIs, 9 app cards, RTL footer
/profile                            Authenticated user profile
/architecture                       9-section English-LTR technical reference + system diagram
/design-revamp                      Internal before/after viewer

/admin                              super_admin → ReportsPage; others → DashboardPage
/admin/reports                      Reports command-center — 12 sections (CycleOverview, Tempo, Funnel, …)
/admin/applicants  /new  /:id  /:id/edit
/admin/users  /audit  /settings
/admin/cycles  /new  /:id           Admission cycles management
/admin/categories  /:key            Custom category creation + edit
/admin/workflows  /new  /:id        Stage workflow editor
/admin/admission-rules              Per-cycle admission requirements
/admin/reference-data  /:tab        Lookups (governorates, certificates, etc.)

/committee  /list  /schedule  /create  /:id
/board  /sessions  /sessions/create  /sessions/:id/live  /decisions  /members
/investigations  /incoming  /outgoing  /distribution  /create  /cases/:id
/medical  /queue  /results  /station/:key  /certificate
/barcode  /lookup  /batch  /scan  /replace  /scans
/biometric  /enroll  /history  /verify-ops  /monitoring
/question-bank  /manage  /exams  /exams/create  /exams/:examId  /take  /proctor  /results

─── APPLICANT (own auth via Stage 1+2) ──────────────────────────────────
/applicant/start                    CategorySelectionPage  ┐
/applicant/eligibility              EligibilityCheckPage   │ pre-wizard slim layout
/applicant/tests                    TestScheduleAndResults ┘
/applicant                          11-stage Wizard hub
/applicant/auth/step-1 /step-2      Stage 1 + 2 (phone + SMS)
/applicant/profile/personal /education /marital /family
/applicant/payment                  Stage 6
/applicant/exam-schedule            Stage 8
/applicant/print-card               Stage 9 (Code 128 barcode + LogoMark)
/applicant/follow-up                Stage 10
/applicant/acquaintance-doc        Stage 11

*                                   → / (PublicLandingPage)
```

### Real architecture, not a render-only port

- **Clean Arch boundaries**: `features/X/` may import from `shared/` only — never from another feature. `shared/` never imports from `features/`. The whole app respects this rule.
- **TanStack Query for server state** — every `*.queries.ts` wraps the typed `*.service.ts`. When the real backend ships, only the service files change; query hooks, components, and types are stable.
- **Zustand + sessionStorage persistence** for auth state. Refresh keeps you logged in.
- **RBAC with 11 roles, granular permissions, wildcard matching** (`*`, `applicants:*`). `AuthGuard` enforces app-level access at the route level.
- **Inline-SVG charts** (Bar, Line, Donut) — zero chart libs, full control of animation and styling.
- **Deterministic mock data** — same seed → same 240 applicants / 80 audit entries / 10 users / 8 medical stations / 5 committees / 14-day timeseries on every render.

### Design system

The legacy demo's `tokens.css` + `base.css` + `components.css` + `layout.css` + `apps.css` are **ported 1:1** into `frontend/src/styles/`. React components emit the same class names the original CSS targets, so visual fidelity is guaranteed. Tailwind is layered on top for utility composition.

| Token | Value |
|---|---|
| `--brand-primary` | `#1B3A6B` (police navy) |
| `--brand-accent`  | `#C9A961` (Egyptian heritage gold) |
| `--font-ar`       | Noto Sans Arabic |
| `--font-en`       | Inter |
| `--font-mono`     | SF Mono / Menlo |

Per-app accent colors are applied via `<div data-app="medical">` — see `frontend/src/styles/tokens.css` for the 9-app palette.

---

## Project structure

```
frontend/src/
├── main.tsx                          App entry
├── App.tsx                           BrowserRouter + Query/Toast providers
├── routes.tsx                        Route registry (every URL → component)
│
├── app/
│   ├── providers/
│   │   ├── QueryProvider.tsx         TanStack Query client
│   │   └── AuthGuard.tsx             Route protection + RBAC enforcement
│   └── layouts/
│       ├── AppShell.tsx              Header + sidebar + main (per-app theming)
│       ├── Sidebar.tsx               Navigation primitive
│       ├── PublicShell.tsx           For login
│       └── CenteredShell.tsx         Centered max-width container
│
├── features/                         ⭐ Self-contained feature modules
│   ├── auth/                         RBAC + login flow + Zustand store
│   ├── hub/                          Landing page with 9 app cards
│   ├── admin/                        7 sub-routes (dashboard, applicants, users…)
│   ├── applicant-portal/             Public 11-stage portal
│   ├── applicants/                   Shared service+queries (used by admin)
│   ├── committees/                   3 sub-routes
│   ├── board/                        3 sub-routes
│   ├── investigations/               3 sub-routes
│   ├── medical/                      3 sub-routes
│   ├── barcode/                      3 sub-routes
│   ├── biometric/                    3 sub-routes
│   ├── exams/                        3 sub-routes (question bank)
│   ├── audit/                        Service + query hook
│   └── architecture/                 System architecture page
│
├── shared/                           ⭐ Cross-cutting code (never imports from features/)
│   ├── components/
│   │   ├── Button, Card, Badge, Input, Select, Avatar, Skeleton…
│   │   ├── PageHeader, EmptyState, StageStepper, StatCard
│   │   ├── StatusBadge / PaymentBadge / ResultBadge / InvestigationBadge
│   │   ├── Toast (Zustand-backed mini-system)
│   │   └── charts/   BarChart · LineChart · DonutChart (inline SVG)
│   ├── lib/
│   │   ├── cn.ts             clsx + tailwind-merge
│   │   ├── format.ts         num · date · relativeTime · maskNationalId · initials
│   │   ├── arabic.ts         normalizeArabic · stripRank · truncateName
│   │   ├── national-id.ts    Egyptian National ID validator (typed)
│   │   ├── mock-helpers.ts   simulateLatency · paginate
│   │   └── constants.ts      App keys, stage labels, names
│   ├── types/
│   │   ├── api.ts            Pagination<T>, ApiError
│   │   └── domain.ts         Applicant, AuditEntry, Committee, Question, …
│   └── mock-data/
│       ├── seed.ts           Deterministic LCG (seed 42)
│       ├── dictionaries.ts   Arabic names, governorates, certificates, statuses
│       └── index.ts          Generates 240 applicants + audit + KPIs at module load
│
├── config/
│   └── routes.ts             URL constants for safe linking
│
└── styles/
    ├── globals.css           Tailwind + token imports
    ├── tokens.css            ← ported 1:1 from legacy
    ├── base.css              ← ported 1:1 from legacy
    ├── components.css        ← ported 1:1 from legacy
    ├── layout.css            ← ported 1:1 from legacy
    └── apps.css              ← ported 1:1 from legacy
```

---

## RBAC matrix

11 roles, defined in `frontend/src/features/auth/rbac.ts`:

| Role | Apps |
|---|---|
| `super_admin` | all 9 + architecture |
| `committee_admin` | admin, committee, barcode, biometric |
| `committee_user` | committee, barcode, biometric |
| `medical_admin` | medical, barcode, biometric |
| `medical_doctor` | medical |
| `investigator` | investigations |
| `board_admin` | board |
| `exams_admin` | exams |
| `biometric_user` | biometric |
| `records_clerk` | medical, exams |
| `applicant` | applicant |

`hasPermission()` supports wildcard matching: `*` (all) and `resource:*` (any action on a resource). `canAccessApp()` is enforced at the route level by `<AuthGuard app="...">`.

---

## Mock service layer → real API in one line per service

Every service file exposes typed methods with documented `INTEGRATION CONTRACT` headers. To switch from mock to real backend, replace the body of each method:

```ts
// Before — mock
async list(filters) {
  await simulateLatency();
  return paginate(MOCK.applicants.filter(...), filters.page, filters.pageSize);
}

// After — real
async list(filters) {
  return apiClient.get('/applicants', { params: filters }).then((r) => r.data);
}
```

Query hooks (`*.queries.ts`), components, and types stay unchanged. This is the bridge to the backend that's coming in a later session.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18.3 |
| Language | TypeScript 5.6 (strict) |
| Build | Vite 5.4 |
| Routing | react-router-dom 6.26 |
| Server state | @tanstack/react-query 5 |
| Client state | zustand 4.5 (with persist middleware) |
| Styling | Tailwind 3.4 + ported design tokens |
| Forms | react-hook-form + zod (installed; HookForm wired in LoginForm) |
| Icons | lucide-react |
| Dates | date-fns |
| Class merge | clsx + tailwind-merge |

---

## Reference: the original demo

The original vanilla HTML/JS demo is preserved under `frontend/_legacy/` for visual reference. Run it standalone with:

```bash
cd frontend/_legacy
python3 -m http.server 8000
# → http://localhost:8000
```

The new React app reads from the same data shapes and renders the same screens — visit any route in this app and the legacy demo to compare.

---

## Status & roadmap

✅ **Done**
- Project foundation (Vite + TS + Tailwind + strict mode)
- Design token port (1:1 from demo)
- 240 applicants + 80 audit entries + KPIs + 50-question Arabic MCQ pool (deterministic seed)
- 11-role RBAC + AuthGuard + persistent auth store
- 3-surface route model (PUBLIC / APPLICANT / STAFF), all routes wired
- PublicLandingPage, /apply pre-wizard gate, /staff-login, /terms, /help
- Hub, Admin (Reports command-center + 17+ sub-routes), Applicant portal (pre-wizard gate + 11-stage Wizard), Committee, Board, Investigations, Medical, Barcode, Biometric, Question Bank + Exams, Architecture, Profile
- Inline-SVG Bar / Line / Donut / Heatmap / HeatmapChart / Sparkline / Gauge / Funnel charts
- Toast system, NotificationCenter, CommandPalette, skeletons, status badges, stage stepper
- LogoMark (real ministerial crest), Code128Barcode (scannable)
- Zero TypeScript errors, zero build warnings

🚧 **Next iterations** (Sprint 10 — Hardening)
- Vitest + Testing Library setup
- Playwright smoke E2E (login → hub → click each app)
- ESLint + boundaries plugin to enforce Clean Arch imports
- Husky pre-commit gate
- Accessibility audit, print polish
- Backend integration (post-demo): swap `simulateLatency()` + `MOCK` reads for `apiClient.get/post(...)` in every `*.service.ts`; queries/components/types stay unchanged

---

## Author

Built by **Appenza Studio** — Engineering Manager: Mortada.
This is the production frontend for the Police Academy Admissions Platform; backend integration is scheduled for a later session.
