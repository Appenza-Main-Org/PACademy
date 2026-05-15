# Admin Sidebar — Step 0 Inventory

> Pre-work for restructuring the admin sidebar into four explicit sections with fixed child ordering.
> Date: 2026-05-12 · Branch: `main` (working tree clean apart from `frontend/src/app/layouts/AppShell.tsx`).

---

## 1. Source of truth

The admin sidebar is **not** its own component. The shape is declared as a `SidebarSection[]` constant inside the admin layout, then handed to the shared `<AppShell sidebar={…}>` which renders it through the shared `<Sidebar>` primitive:

| Concern | File |
|---|---|
| Section list for `data-app="admin"` | [frontend/src/features/admin/AdminLayout.tsx](frontend/src/features/admin/AdminLayout.tsx) (`SIDEBAR` constant, lines 23–87) |
| Sidebar primitive (rendering, RBAC filter, collapsible groups, active-link styling) | [frontend/src/app/layouts/Sidebar.tsx](frontend/src/app/layouts/Sidebar.tsx) |
| URL constants | [frontend/src/config/routes.ts](frontend/src/config/routes.ts) |

There is **no** `frontend/src/features/admin/components/AdminSidebar.tsx`. All edits go in `AdminLayout.tsx`. No new file needed.

## 2. Current admin sidebar items — in source order

Reading top-to-bottom from `AdminLayout.tsx:23–87` (RTL → visually right column):

### Section 1 — `التنقل` (plain, no permission gate)
| # | Key | Arabic label | Route (ROUTES.*) | Icon | In a section? |
|---|---|---|---|---|---|
| 1 | `hub` | كل التطبيقات | `ROUTES.hub` → `/hub` | `Grid3x3` | yes |

### Section 2 — `الإدارة` (plain, no permission gate)
| # | Key | Arabic label | Route | Icon | In a section? |
|---|---|---|---|---|---|
| 2 | `dashboard` | لوحة التحكم | `admin.dashboard` → `/admin` (end) | `LayoutDashboard` | yes |
| 3 | `applicants` | المتقدمون | `admin.applicants` → `/admin/applicants` | `ClipboardList` | yes |
| 4 | `users` | مستخدمو المنظومة | `admin.users` → `/admin/users` | `Users` | yes |
| 5 | `roles` | الأدوار والصلاحيات | `admin.roles` → `/admin/users/roles` | `Shield` | yes |
| 6 | `audit` | سجل النشاط | `admin.audit` → `/admin/audit` | `Shield` (duplicate of roles — likely intentional but worth flagging) | yes |

### Section 3 — `التقديم` (plain, `permission: 'admission-setup:read'`)
| # | Key | Arabic label | Route | Icon | In a section? |
|---|---|---|---|---|---|
| 7 | `categories` | فئات التقديم | `admin.categories` → `/admin/categories` | `Layers` | yes |
| 8 | `cycles` | الدورات | `admin.cycles` → `/admin/cycles` | `CalendarDays` | yes |
| 9 | `admission-setup` | إعداد التقديم | `admin.admissionSetup.index` → `/admin/admission-setup` | `ClipboardCheck` | yes |

### Section 4 — `لجان القبول` (plain, no permission gate — AuthGuard on the `/admin/committee/*` routes uses `app="committee"`)
| # | Key | Arabic label | Route | Icon | In a section? |
|---|---|---|---|---|---|
| 10 | `committee-overview` | نظرة عامة | `committee.overview` → `/admin/committee` (end) | `LayoutDashboard` | yes |
| 11 | `committee-list` | قائمة اللجان | `committee.list` → `/admin/committee/list` | `Users` | yes |
| 12 | `committee-schedule` | الجدول الزمني | `committee.schedule` → `/admin/committee/schedule` | `Calendar` | yes |

### Section 5 — `البيانات المرجعية والإعدادات` (plain, no permission gate)
| # | Key | Arabic label | Route | Icon | In a section? |
|---|---|---|---|---|---|
| 13 | `lookups` | الأكواد المرجعية | `admin.adminLookups` → `/admin/lookups` | `Database` | yes |
| 14 | `workflows` | سير العمل | `admin.workflows` → `/admin/workflows` | `Workflow` | yes |
| 15 | `notifications` | الإشعارات | `admin.notifications` → `/admin/notifications` | `Bell` | yes |
| 16 | `payments` | المدفوعات | `admin.payments` → `/admin/payments` | `Banknote` | yes |
| 17 | `settings` | الإعدادات العامة | `admin.settings` → `/admin/settings` | `Settings` | yes |

### Section 6 — `التقارير` (plain, no permission gate)
| # | Key | Arabic label | Route | Icon | In a section? |
|---|---|---|---|---|---|
| 18 | `reports` | التقارير | `admin.reports` → `/admin/reports` | `BarChart3` | yes |

**Net counts:** 6 sections, 18 items. Every item is in a section — there are no flat top-level links outside a section header.

## 3. Sectioning / grouping primitives

The shared `Sidebar` already supports sections plus optional collapsible groups. The API on `SidebarSection` (defined at [frontend/src/app/layouts/Sidebar.tsx:43–58](frontend/src/app/layouts/Sidebar.tsx#L43-L58)):

```ts
interface SidebarSection {
  label?: string;
  items: SidebarItem[];
  collapsible?: boolean;          // chevron toggle on the label
  permission?: string;            // hide entire section if user lacks it (supports '*')
  defaultExpanded?: boolean;      // initial state when no localStorage entry
  groupKey?: string;              // persistence key under `pa-sidebar-groups`. Required when collapsible.
  icon?: ReactNode;               // decorative glyph rendered next to the label on collapsible groups only
  expandWhenPathStartsWith?: string;  // auto-expand when route lands inside the group
}
```

Visual contract (`Sidebar.tsx:99–211`):
- `PlainSection` — label rendered as `text-2xs font-bold uppercase tracking-wide text-ink-500`, items in a flat `<nav>`. No chevron, no group guide.
- `CollapsibleSection` — label is a toggle button (chevron right of label), persisted state via `localStorage['pa-sidebar-groups'][groupKey]`. When expanded, children render with a vertical guide line at `start-3` and each `SidebarLink` is `indented` (`ps-7`). Active item still gets the 3px accent bar — it shifts to `before:start-3` so it overlays the guide.
- Non-first section gets a top hairline + extra padding. RBAC-hidden sections do **not** consume the "first" slot (filter happens before indexing).
- Active state on `SidebarLink`: `bg-[var(--accent-50)]` + `text-[var(--accent-600)]` + 3px `var(--accent-500)` start bar. This works identically inside collapsible groups (the `indented` flag only shifts the bar offset).

**Implication for this restructure:** the primitive is ready. The four target sections can each be a `PlainSection` (current style — no chevrons) **or** a `CollapsibleSection` (groupable, persists across sessions). No new shared component is needed either way.

The `icon` field on `SidebarSection` is currently only rendered inside `CollapsibleSection` (see `Sidebar.tsx:175–181`). If we want section-header icons on a plain section, we'd need to either:
1. Use collapsible sections and accept the chevron, **or**
2. Extend `PlainSection` to render `section.icon` next to the label (5-line change), **or**
3. Skip section-header icons (matches the current visual language — none of today's six section labels carry icons).

## 4. Deep-link health for the admission-settings wizard step

- Route registration ([frontend/src/routes.tsx:255–256](frontend/src/routes.tsx#L255-L256)):
  ```tsx
  { path: 'admission-setup/wizard',          element: <Navigate to={ROUTES.admin.admissionSetup.wizard('application_settings')} replace /> },
  { path: 'admission-setup/wizard/:stepKey', element: <AdmissionSetupWizardPage /> },
  ```
  `application_settings` is the natural default — `/admin/admission-setup/wizard` redirects to it, and unknown `:stepKey` values fall back to the same first step via `<Navigate>` at [AdmissionSetupWizardPage.tsx:150–152](frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx#L150-L152).
- The URL constant exists: there's no dedicated `wizardApplicationSettings` key, but `ROUTES.admin.admissionSetup.wizard('application_settings')` produces `/admin/admission-setup/wizard/application_settings`. Safe to use from the sidebar link.
- Cycle context fallback ([useAdmissionSetupCycle.ts:42–77](frontend/src/features/admin/admission-setup/hooks/useAdmissionSetupCycle.ts#L42-L77)):
  - Reads `sessionStorage['pa-admission-setup-cycle']` first.
  - Else picks the active cycle (`useActiveCycle`).
  - Else picks the most recent cycle from `useCycles` list (`available[0]`).
  - Else `cycle = null` — the wizard still mounts; the breadcrumb shows "لم يتم اختيار دورة"; the step components render their forms in a degraded state but **the wizard does not redirect to the cycle list**. So a deep link from the sidebar to `/admin/admission-setup/wizard/application_settings` always lands the user on the wizard's first step regardless of cycle state.
- Permission check: `admission-setup:read` is enforced in-page; users without it see an Arabic EmptyState. This matches the current `التقديم` section's `permission: 'admission-setup:read'` gate, so the link should sit under a section that carries the same permission to keep the chrome consistent.

**Verdict:** `/admin/admission-setup/wizard/application_settings` is a safe, deep-linkable sidebar target. No special fallback needed in the sidebar declaration beyond the existing permission gate.

## 5. Active-route highlighting in nested sections

Confirmed working: `SidebarLink` uses `NavLink` with `isActive` driving the accent bar + bg + color. Inside a `CollapsibleSection`, the `indented` flag shifts the bar to `before:start-3` so it overlays the group's vertical guide. The auto-expand path is `expandWhenPathStartsWith`, which kicks the section open whenever the current pathname starts with the configured prefix — this is what guarantees the active row stays visible after navigation, even if the user previously collapsed the group.

For the four target sections, the relevant prefixes if we go collapsible:
- Admin core → `/admin` (would always be true under admin chrome — too broad; use a narrower prefix like the per-section route family, see below).
- Applications/Cycles → `/admin/admission-setup` (covers index + wizard) plus `/admin/cycles` plus `/admin/categories`. The current API only supports a **single** `expandWhenPathStartsWith` per section. If sections fan out across non-contiguous URL families, we'd need to either:
  - Extend the API to accept `string | string[]` (small change in `CollapsibleSection`), or
  - Live with auto-expand only when the user enters the section through the most common route, and rely on `defaultExpanded` for the rest.

Worth confirming once the target structure is final.

## 6. Existing iconography — proposed assignments for section headers + iconless items

Every item in the current sidebar already has an icon. There are **no iconless items**. The only icon-related question is whether to give the four target section headers icons.

Available lucide icons already imported in `AdminLayout.tsx`:
`Banknote · BarChart3 · Bell · Calendar · CalendarDays · ClipboardCheck · ClipboardList · Database · Grid3x3 · Layers · LayoutDashboard · Settings · Shield · Users · Workflow`.

Candidate header-icon mappings (using already-imported lucide glyphs, no new dependencies) — pending the final four-section choices in Step 1:

| Likely target section | Suggested header icon | Rationale |
|---|---|---|
| Administration / إدارة المنظومة | `Shield` (or `Users`) | Already in use for roles + audit; reads as "system administration" |
| Applications & cycles / التقديم والدورات | `ClipboardCheck` | Already in use for `admission-setup`; reads as "intake configuration" |
| Committees / لجان القبول | `Users` (or new `ShieldCheck` already used inside admission-setup config) | Mirrors the committee-list item icon |
| Reference data & settings / البيانات المرجعية والإعدادات | `Settings` (or `Database`) | Already in use; reads as "configuration" |
| Reports / التقارير | `BarChart3` | Already in use for the only item in the section |

**Note:** if we keep plain (non-collapsible) sections, header icons are not rendered by the primitive today — see §3, option 2 — and the simplest path is to skip header icons. If we adopt collapsible groups, the `icon` field on `SidebarSection` is already wired and works for free.

## 7. Risks / things to confirm before Step 1

1. **Duplicate icon between `roles` and `audit`** (both `Shield`). Worth distinguishing — e.g. `ScrollText` for audit. Not strictly part of this restructure but trivial to fix in the same patch.
2. **`التقارير` is a single-item section.** If the four-section target consolidates this into another group, the `BarChart3` item key + label survive verbatim under a different parent.
3. **`التقديم` permission gate (`admission-setup:read`)** currently shadows `categories` and `cycles` too. If the four-section target splits cycles/categories away from admission-setup, the permission gate must move with the wizard link only — otherwise records_clerk-style roles without `admission-setup:read` will lose access to `/admin/cycles` and `/admin/categories` in the sidebar even though they may have separate permissions for those (verify against [frontend/src/features/auth/rbac.ts](frontend/src/features/auth/rbac.ts) before relocating).
4. **`expandWhenPathStartsWith` is single-string.** If the four-section model needs multi-prefix auto-expand, plan for a tiny `Sidebar.tsx` extension (≤5 lines) — call out explicitly in Step 1 so it's a deliberate part of the change.
5. **`/admin/committee/*` AuthGuard is `app="committee"`, not `app="admin"`.** The current sidebar already shows committee items to admins because they hold both `admin` and `committee` app keys for super_admin / committee_admin. If the four-section model places committee items under an admin-only header, no behavioural change — but if records_clerk or similar admin-only roles appear, they'd see the committee header without being able to click through. Mention in the Step 1 ordering decision.

---

## Stop gate

Ready for Step 1 — the target four-section structure with fixed child ordering.

---

## Step 1 — Decided & implemented (2026-05-12)

User delegated the call ("u decide the best as per ur understading and go"). Implemented in [frontend/src/features/admin/AdminLayout.tsx](frontend/src/features/admin/AdminLayout.tsx).

**Final shape** (top → bottom, RTL → visual right column):

```
── (no label) ─────────────────────────────────
   كل التطبيقات              /hub                                  Grid3x3

── العمليات ───────────────────────────────────  (3)
   لوحة التحكم               /admin             (end: true)        LayoutDashboard
   المتقدمون                 /admin/applicants                     ClipboardList
   التقارير                  /admin/reports                        BarChart3

── التقديم والدورات ──────────────────────────  (7, permission: admission-setup:read)
   فئات التقديم              /admin/categories                     Layers
   الدورات                   /admin/cycles                         CalendarDays
   إعداد التقديم             /admin/admission-setup (end: true)    ClipboardCheck
   إعدادات التقديم            /admin/admission-setup/wizard/application_settings   Settings2  ⟵ NEW deep link
   نظرة عامة على اللجان       /admin/committee (end: true)         LayoutDashboard
   قائمة اللجان              /admin/committee/list                 Users
   الجدول الزمني             /admin/committee/schedule             Calendar

── البيانات المرجعية والإعدادات ─────────────  (5)
   الأكواد المرجعية           /admin/lookups                       Database
   سير العمل                 /admin/workflows                      Workflow
   الإشعارات                  /admin/notifications                  Bell
   المدفوعات                 /admin/payments                       Banknote
   الإعدادات العامة           /admin/settings                       Settings

── الأمان والمستخدمون ────────────────────────  (3)
   مستخدمو المنظومة          /admin/users                          Users
   الأدوار والصلاحيات         /admin/users/roles                    Shield
   سجل النشاط                /admin/audit                          Shield  (duplicate flagged, not fixed in scope)
```

Total: 4 named sections + 1 unlabelled hub link, 19 items (18 existing + 1 new deep link).

**Rationale**
- Order = access frequency, not authoring chain: operations first, governance last.
- Committees moved under "التقديم والدورات" because each committee is a per-cycle artifact in the authoring chain (categories → cycle → setup → committees). Safe because both `app="admin"` roles (super_admin, committee_admin) carry `admission-setup:read`.
- Audit moved to "الأمان والمستخدمون" because it answers WHO did what, not what's happening today.
- New deep link "إعدادات التقديم" → wizard's first step. Wizard auto-resolves cycle, so deep-link is safe even with no cycle selected.
- `end: true` added to `إعداد التقديم` so the umbrella row doesn't co-highlight with the deep link.

**Changes vs. previous sidebar**
- Removed: `التنقل` label (hub now header-less).
- Removed: `الإدارة` label (split into "العمليات" + "الأمان والمستخدمون").
- Removed: `التقارير` standalone section (folded into "العمليات").
- Removed: `لجان القبول` standalone section (folded into "التقديم والدورات").
- Added: `إعدادات التقديم` deep-link item (new — wires `application_settings` wizard step into the sidebar).
- Added: `end: true` to `إعداد التقديم`.
- Added: `Settings2` import from lucide-react (same icon the wizard's internal stepper uses for this step).

**Verified on dev server (2026-05-12)**
- All four sections render in the designed order; hub appears header-less above section 1.
- Active state on `/admin/reports` → only "التقارير" highlights.
- Active state on `/admin/admission-setup` → only "إعداد التقديم" highlights.
- Active state on `/admin/admission-setup/wizard/application_settings` → only "إعدادات التقديم" highlights (umbrella does NOT co-highlight, confirming `end: true` works).
- Console clean — only pre-existing RR v6→v7 future-flag warnings.
- `npm run typecheck` clean.

Screenshot: [after.png](./after.png).

