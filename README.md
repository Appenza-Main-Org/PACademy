# منظومة القبول · أكاديمية الشرطة — Frontend

> **React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind**
> Production-grade rebuild of the Police Academy Admissions Platform — 12 routes, 11 RBAC roles, 9 connected applications, fully RTL Arabic-first.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:5173
npm run typecheck    # → 0 errors
npm run build        # → dist/ static bundle
npm run preview      # → serve the built bundle
```

Login with any credentials — pick a role from the role grid; the demo derives the user from the role you pick.

| Role picker (login screen) | Lands on |
|---|---|
| مدير النظام (`super_admin`) | `/` (Hub — sees all 9 apps) |
| مدير لجنة (`committee_admin`) | `/` (sees: admin, committee, barcode, biometric) |
| القومسيون الطبي (`medical_admin`) | `/` (sees: medical, barcode, biometric) |
| إدارة التحريات (`investigator`) | `/` (sees: investigations only) |
| متقدم (`applicant`) | `/applicant` |
| … 6 more roles | per RBAC matrix |

---

## What's included

### 12 routes, all wired

```
/login                              Role-aware login + 2-column gradient art panel
/                                   Hub — KPIs, 9 app cards, RTL footer
/architecture                       6-tier diagram + integrations table + tech stack
/admin                              Dashboard: stats + line + donut + recent + audit + geo bars
/admin/applicants                   Filterable table (240 applicants, search, status, gov, cert)
/admin/applicants/:id               Detail: personal, academic, results, investigation, timeline
/admin/users                        10 system users with role badges
/admin/audit                        80 audit entries, action filter
/admin/settings                     Admission requirements + integration status
/admin/reports                      Charts (line, donut, bar) with export
/applicant                          Public portal — 11-stage stepper + 6 doc cards + support
/committee + /list + /schedule      Overview cards + table + weekly schedule grid
/board + /sessions + /decisions     Members + sessions table + decisions feed
/investigations + /incoming + …     Cases table with secrecy alert + status filter
/medical + /queue + /results        8 station cards + per-station queue + results table
/barcode + /lookup + /batch         Generator with visual card + lookup + batch print
/biometric + /enroll + /history     Face/fingerprint scan + 4-step enroll wizard + history
/question-bank + /exams + /results  Categories + question cards + exam list + results charts
```

### Real architecture, not a render-only port

- **Clean Arch boundaries**: `features/X/` may import from `shared/` only — never from another feature. `shared/` never imports from `features/`. The whole app respects this rule.
- **TanStack Query for server state** — every `*.queries.ts` wraps the typed `*.service.ts`. When the real backend ships, only the service files change; query hooks, components, and types are stable.
- **Zustand + sessionStorage persistence** for auth state. Refresh keeps you logged in.
- **RBAC with 11 roles, granular permissions, wildcard matching** (`*`, `applicants:*`). `AuthGuard` enforces app-level access at the route level.
- **Inline-SVG charts** (Bar, Line, Donut) — zero chart libs, full control of animation and styling.
- **Deterministic mock data** — same seed → same 240 applicants / 80 audit entries / 10 users / 8 medical stations / 5 committees / 14-day timeseries on every render.

### Design system

The legacy demo's `tokens.css` + `base.css` + `components.css` + `layout.css` + `apps.css` are **ported 1:1** into `src/styles/`. React components emit the same class names the original CSS targets, so visual fidelity is guaranteed. Tailwind is layered on top for utility composition.

| Token | Value |
|---|---|
| `--brand-primary` | `#1B3A6B` (police navy) |
| `--brand-accent`  | `#C9A961` (Egyptian heritage gold) |
| `--font-ar`       | Noto Sans Arabic |
| `--font-en`       | Inter |
| `--font-mono`     | SF Mono / Menlo |

Per-app accent colors are applied via `<div data-app="medical">` — see `src/styles/tokens.css` for the 9-app palette.

---

## Project structure

```
src/
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

11 roles, defined in `src/features/auth/rbac.ts`:

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

The original vanilla HTML/JS demo is preserved under `_legacy/` for visual reference. Run it standalone with:

```bash
cd _legacy
python3 -m http.server 8000
# → http://localhost:8000
```

The new React app reads from the same data shapes and renders the same screens — visit any route in this app and the legacy demo to compare.

---

## Status & roadmap

✅ **Done**
- Project foundation (Vite + TS + Tailwind + strict mode)
- Design token port (1:1 from demo)
- 240 applicants + 80 audit entries + KPIs (deterministic seed)
- 11-role RBAC + AuthGuard + persistent auth store
- All 12 top-level routes + 22 sub-routes wired
- Hub, Admin (×7), Applicant portal, Committee (×3), Board (×3), Investigations (×3), Medical (×3), Barcode (×3), Biometric (×3), Question Bank (×3), Architecture
- Inline-SVG Bar / Line / Donut charts
- Toast system, skeletons, status badges, stage stepper
- Zero TypeScript errors, zero build warnings (CSS ordering fixed)

🚧 **Next iterations**
- Heatmap chart component
- Form validation throughout (zod schemas inferred → component types)
- Vitest + Testing Library setup
- Playwright smoke E2E (login → hub → click each app)
- ESLint + boundaries plugin to enforce Clean Arch imports
- Husky pre-commit gate

---

## Author

Built by **Appenza Studio** — Engineering Manager: Mortada.
This is the production frontend for the Police Academy Admissions Platform; backend integration is scheduled for a later session.
