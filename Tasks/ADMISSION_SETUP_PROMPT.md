# التقديم — Sidebar Section + 15-Step Admission Setup

> **Claude Code Implementation Prompt**
> Police Academy Admissions Platform — Frontend
> Composes over admin-gaps shipped work (Gaps F/G/H/I/J/K/L); ships net-new pages for steps 9, 11, 13, 15 (and 10 if absent).

---

## 1 · Goal

Add a new collapsible sidebar section labeled **التقديم** with 15 ordered submenu items. Each submenu item routes to its own page under `/admin/admission-setup/*`. All 15 pages exist, are routable, gated by RBAC, and ship with at least scaffolded content.

Several of the 15 steps overlap with what already shipped in admin-gaps (cycles, categories, conditions, committees, exam plan, payments, notifications) — those **reuse** existing services and pages where possible; only genuinely new surfaces get net-new code.

**Frontend only.** Scalable: new steps can be added by appending a config entry — no per-step routing/sidebar code change.

---

## 2 · Required Reading (in order, before any code change)

1. `CLAUDE.md` — full read. §3 Clean Arch, §5 RBAC, §6 mock service pattern, §9 conventions. Non-negotiable.
2. `README.md` — current routes, RBAC matrix.
3. `src/app/layouts/AppShell.tsx` and `src/app/layouts/Sidebar.tsx` — current sidebar pattern. The new التقديم section must integrate cleanly.
4. `src/features/auth/rbac.ts` — role definitions, permission helpers. Reuse, don't fork.
5. `src/config/routes.ts` — route constants pattern. New routes must be added here, never hardcoded.
6. `src/routes.tsx` — route registry.
7. `src/features/admin/pages/CycleDetailPage.tsx`, `CategoriesPage`, `CategoryConditionBuilder`, `CommitteeDetailPage`, `AdmissionRulesPage`, exam-plan editor, `NotificationsPage`, `PaymentsPage` — what already exists from admin Gaps F/G/H/I/J/K/L.
8. `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md` — context for shipped admin work; this section composes with it, doesn't replace it.
9. `docs/INTEGRATION_HANDOFF.md` §2 — service inventory; new admission-setup services must be added here.

If anything in this prompt conflicts with `CLAUDE.md`, `CLAUDE.md` wins. Stop and flag.

---

## 3 · Working Directory

All `npm` invocations from `/Users/mac/Projects/PACademy/PACademy/frontend`.

---

## 4 · The 15 Steps (canonical list)

| # | Key | Arabic Label | Composes Over | Strategy |
|---|---|---|---|---|
| 1 | `cycle_metadata` | بيانات سنة التقديم | `CycleDetailPage` (Gap F) | **Compose** |
| 2 | `application_settings` | إعدادات التقديم | Gap F + `CategoryConditionBuilder` (Gap G) | **Compose** |
| 3 | `application_status` | حالة التقديم | Cycle status workflow (Gap F) | **Compose** |
| 4 | `age_rules` | شروط السن | `CategoryConditionBuilder` age fields (Gap G) | **Compose** |
| 5 | `marital_status_rules` | الحالة الاجتماعية | `CategoryConditionBuilder` marital field (Gap G) | **Compose** |
| 6 | `fees` | الرسوم المالية | `Cycle.fees` + Fawry config (Gap K) | **Compose** |
| 7 | `exams` | إدارة الاختبارات | Exam plan editor (Gap J) | **Compose** |
| 8 | `committees` | إدارة اللجان | `CommitteeDetailPage` (Gap H) | **Compose** |
| 9 | `committee_merge_split` | دمج وفصل اللجان | — | **NEW** |
| 10 | `score_thresholds` | درجات القبول | Maybe partial in Gap H | **Compose if present, NEW if not** |
| 11 | `exam_dates` | مواعيد الاختبارات | — | **NEW** |
| 12 | `date_committee_binding` | ربط المواعيد باللجان | Committee `availableDates` + `capacityPerDay` (Gap H) | **Compose** |
| 13 | `total_score` | المجموع الكلي | — | **NEW** |
| 14 | `notifications` | التنبيهات | `/admin/notifications` (Gap L) | **Compose** |
| 15 | `electronic_declaration` | الإقرار الإلكتروني | — | **NEW** |

> **Compose** = the new admission-setup page imports the existing components and re-renders them within `<AdmissionSetupShell>` (with breadcrumb and step header). The existing route stays; the admission-setup route becomes a second entry point. **Do NOT duplicate logic.**
>
> **NEW** = build the page, components, service methods, types from scratch.

---

## 5 · Architecture Guidance

### 5.1 Single source of truth for the 15 steps

Build a config-driven sidebar + router. Adding a 16th step is a config-entry append, not a code refactor.

```ts
// src/features/admin/admission-setup/config.ts
export interface AdmissionSetupStep {
  key: AdmissionSetupStepKey;          // discriminated union of 15 string literals
  order: number;                        // 1..15, drives sort
  labelAr: string;                      // sidebar label, page header
  routeSegment: string;                 // URL segment after /admin/admission-setup/
  icon: LucideIcon;                     // for sidebar
  permission: Permission;               // RBAC gate
  reuses?: string;                      // path to existing page/component if step composes over admin-gaps work
  isImplemented: boolean;               // false → page renders a "قيد التطوير" placeholder shell
}
```

This config is consumed by:
- `<AdmissionSetupSidebar>` — renders the submenu in order.
- `routes.tsx` — registers all 15 routes.
- `<AdmissionSetupBreadcrumbs>` — shows step N of 15.

### 5.2 Boundaries

```
src/
├── config/routes.ts                                   ← add ROUTES.admin.admissionSetup.{...}
├── features/admin/
│   ├── admission-setup/                               ← NEW feature subfolder
│   │   ├── config.ts                                  ← the 15-step config
│   │   ├── types.ts                                   ← AdmissionSetupStepKey union + net-new entity types
│   │   ├── components/
│   │   │   ├── AdmissionSetupShell.tsx                ← layout wrapper (sidebar + breadcrumb + content)
│   │   │   ├── AdmissionSetupBreadcrumbs.tsx
│   │   │   ├── StepPlaceholder.tsx                    ← "قيد التطوير" shell
│   │   │   └── StepHeader.tsx                         ← shared header (title + step N/15 + cycle context)
│   │   ├── pages/
│   │   │   ├── AdmissionSetupIndexPage.tsx            ← landing — picks active cycle, lists 15 steps
│   │   │   ├── CycleMetadataPage.tsx                  ← step 1
│   │   │   ├── ApplicationSettingsPage.tsx            ← step 2
│   │   │   ├── ApplicationStatusPage.tsx              ← step 3
│   │   │   ├── AgeRulesPage.tsx                       ← step 4
│   │   │   ├── MaritalStatusRulesPage.tsx             ← step 5
│   │   │   ├── FeesPage.tsx                           ← step 6
│   │   │   ├── ExamsManagementPage.tsx                ← step 7
│   │   │   ├── CommitteesManagementPage.tsx           ← step 8
│   │   │   ├── CommitteeMergeSplitPage.tsx            ← step 9 (NEW)
│   │   │   ├── ScoreThresholdsPage.tsx                ← step 10
│   │   │   ├── ExamDatesPage.tsx                      ← step 11 (NEW)
│   │   │   ├── DateCommitteeBindingPage.tsx           ← step 12
│   │   │   ├── TotalScorePage.tsx                     ← step 13 (NEW)
│   │   │   ├── NotificationsPage.tsx                  ← step 14
│   │   │   └── ElectronicDeclarationPage.tsx          ← step 15 (NEW)
│   │   ├── api/
│   │   │   ├── admission-setup.service.ts             ← NEW — for genuinely new fields
│   │   │   └── admission-setup.queries.ts             ← TanStack Query hooks
│   │   └── hooks/
│   │       └── useAdmissionSetupCycle.ts              ← which cycle's setup are we editing?
│   └── (existing pages stay; admission-setup pages compose over them where applicable)
└── app/layouts/
    └── Sidebar.tsx                                    ← extend with collapsible التقديم section
```

### 5.3 Sidebar pattern

Extend `Sidebar.tsx` to support a collapsible group:

```tsx
<SidebarGroup
  label="التقديم"
  icon={ClipboardList}
  defaultExpanded={isOnAdmissionSetupRoute}
  permission="admission-setup:read"
>
  {ADMISSION_SETUP_STEPS.map(step => (
    <SidebarLink key={step.key} to={ROUTES.admin.admissionSetup[step.key]} icon={step.icon}>
      {step.labelAr}
    </SidebarLink>
  ))}
</SidebarGroup>
```

If `<SidebarGroup>` doesn't exist, build it as a minimal extension of the existing `Sidebar` primitive — same visual language: per-app accent on active item, indent for nested items, RTL preserved. **Don't roll a new sidebar; extend.**

The group:
- Auto-expands when the current route is under `/admin/admission-setup/*`.
- Collapses otherwise.
- User can manually toggle.
- Toggle state persists in `localStorage` under `pa-sidebar-groups` so it survives refresh.

---

## 6 · TypeScript Constraints (non-negotiable)

- Strict mode. No `any`. Use `unknown` and narrow.
- No default exports.
- Discriminated unions for step config keys.
- Forms use `react-hook-form + zod`.
- TanStack Query for server state; service files use the existing mock pattern with `INTEGRATION CONTRACT` JSDoc.
- All Permission strings type-checked against the RBAC permission union.

### 6.1 Required type shapes

```ts
// src/features/admin/admission-setup/types.ts
export type AdmissionSetupStepKey =
  | 'cycle_metadata'
  | 'application_settings'
  | 'application_status'
  | 'age_rules'
  | 'marital_status_rules'
  | 'fees'
  | 'exams'
  | 'committees'
  | 'committee_merge_split'
  | 'score_thresholds'
  | 'exam_dates'
  | 'date_committee_binding'
  | 'total_score'
  | 'notifications'
  | 'electronic_declaration';

// Net-new entities (steps 9, 11, 13, 15)
export interface CommitteeMergeSplitRule {
  id: string;
  cycleId: string;
  type: 'merge' | 'split';
  sourceCommitteeIds: string[];
  targetCommitteeIds: string[];
  reason?: string;
  effectiveAt: string;             // ISO
  createdAt: string;
  createdBy: string;
  deletedAt?: string;
}

export interface ExamDateConfig {
  id: string;
  cycleId: string;
  firstAvailableDate: string;       // ISO
  bookableDays: string[];           // ISO date strings
  blackoutDates?: string[];
  updatedAt: string;
}

export interface TotalScoreConfig {
  id: string;
  cycleId: string;
  applicantStream: 'general' | 'special' | 'law' | 'sports_female';
  components: Array<{
    examKey: string;
    weight: number;                 // 0..100, sum to 100 per stream
    minimumPassingScore?: number;
  }>;
  totalScoreOutOf: number;
  updatedAt: string;
}

export interface ElectronicDeclaration {
  id: string;
  cycleId: string;
  bodyAr: string;                   // long Arabic text
  version: number;
  effectiveFrom: string;
  publishedAt?: string;
  deletedAt?: string;
}
```

Add to `src/shared/types/domain.ts` if cross-cutting; keep step-local types in `admission-setup/types.ts` if internal.

---

## 7 · Implementation Phases

Five phases. After each: `npm run typecheck` and `npm run build` clean from `frontend/`. Atomic commits.

### Phase 1 — Foundations: config, types, routes, RBAC

1. Audit each step against existing surfaces. Save audit notes in a code comment at top of `config.ts` for traceability.
2. Create `src/features/admin/admission-setup/types.ts` with the union and net-new entity types.
3. Create `src/features/admin/admission-setup/config.ts` exporting `ADMISSION_SETUP_STEPS: AdmissionSetupStep[]` with all 15 entries. Mark `isImplemented: false` on every step except those that genuinely compose 1:1 over existing pages.
4. Update `src/config/routes.ts`:
   ```ts
   ROUTES.admin.admissionSetup = {
     index: '/admin/admission-setup',
     cycleMetadata: '/admin/admission-setup/cycle-metadata',
     applicationSettings: '/admin/admission-setup/application-settings',
     // ... all 15
   };
   ```
   Use `routeSegment` from each config entry; don't hardcode strings twice.
5. Add permissions to `rbac.ts` if absent: `'admission-setup:read'`, `'admission-setup:write'`. Grant to `super_admin` and any cycle-management role per Gap C's role matrix. **Verify against existing roles; do NOT add a new role.**
6. Register all 15 routes in `routes.tsx` with `<AuthGuard app="admin">` + permission check. Each route initially renders a `<StepPlaceholder>` shell with the correct step header.

**Commit:** `feat(admin/admission-setup): config-driven step registry + types + routes + RBAC`

### Phase 2 — Sidebar integration

1. Build `<SidebarGroup>` if absent in `Sidebar.tsx` — minimal extension. Props: `label`, `icon`, `defaultExpanded`, `permission`. Children are `<SidebarLink>`.
2. Wire التقديم section:
   - Reads `ADMISSION_SETUP_STEPS` from config.
   - Renders one `<SidebarLink>` per step in `order` ascending.
   - Auto-expands when `useLocation().pathname.startsWith('/admin/admission-setup')`.
   - Manual toggle persisted in `localStorage` key `pa-sidebar-groups`.
3. Hide entire section if user lacks `admission-setup:read`.
4. Visual: respects per-app accent (`var(--accent-*)`), RTL logical properties (`ms-`/`me-`/`ps-`/`pe-`), reduced-motion respected. Active link highlight matches existing pattern.

**Commit:** `feat(admin/admission-setup): collapsible sidebar section`

### Phase 3 — Shell, breadcrumb, placeholder, index page

1. Build `<AdmissionSetupShell>`:
   - Wraps page content.
   - Top: `<AdmissionSetupBreadcrumbs>` showing "التقديم → {step.labelAr}" + "الخطوة N من ١٥" badge.
   - Reads current step from route segment via the config (no hardcoding step number).
   - Cycle context: shows the active cycle name; super_admin can swap via Combobox in the breadcrumb area.
2. Build `useAdmissionSetupCycle()`:
   - Returns `{ cycle, setCycle, availableCycles }`.
   - Defaults to active cycle (from Gap F's cycle service).
   - Selection persists in `sessionStorage` under `pa-admission-setup-cycle`.
3. Build `<StepPlaceholder>`:
   - Centered content: step icon, "{labelAr}" heading, paragraph "هذه الخطوة قيد التطوير حالياً." with a "العودة إلى لوحة الإعدادات" link.
4. Build `<AdmissionSetupIndexPage>` at `/admin/admission-setup`:
   - Lists all 15 steps as cards in a 3-col grid (RTL).
   - Each card: step number (Arabic numeral), labelAr, brief subtitle, status pill (`مكتمل` / `قيد التطوير` / `لم يبدأ`), click → navigates to step's route.
   - Status pill logic: lightweight `isComplete(cycleId)` checker functions in `admission-setup/lib/step-status.ts`.

**Commit:** `feat(admin/admission-setup): shell + breadcrumbs + cycle context + index page`

### Phase 4 — Compose existing surfaces

For steps **1, 2, 3, 4, 5, 6, 7, 8, 12, 14**:

1. Page imports the existing form/component and renders inside `<AdmissionSetupShell>`.
2. Use `useAdmissionSetupCycle()` to know which cycle to load.
3. Existing form's submit handler is reused; **admission-setup doesn't fork the mutation** — same `withAudit` wrapping, same service call, same Toast.
4. If a form is too big to share, refactor the existing page into smaller components first, then both pages reuse the relevant components. **Refactor commit lands separately from the admission-setup commit.**
5. Edge cases:
   - No active cycle → empty state "يجب إنشاء دورة قبول أولاً" + link to `/admin/cycles/new`.
   - User lacks `admission-setup:write` → form is read-only.
6. Mark `isImplemented: true` in `config.ts` once composed.

**Suggested commits:**
- `feat(admin/admission-setup): compose cycle + status + age + marital steps over Gap F/G`
- `feat(admin/admission-setup): compose fees + exams + committees + binding steps over Gap H/J/K`
- `feat(admin/admission-setup): compose notifications step over Gap L`

### Phase 5 — Net-new pages

For steps **9, 11, 13, 15** (and 10 if Gap H didn't ship score thresholds):

#### Step 9 — دمج وفصل اللجان (`CommitteeMergeSplitPage`)
- Form: pick source committee(s), pick target committee(s), choose merge/split type, optional reason, effective date.
- List existing rules for the cycle.
- `admissionSetupService.mergeOrSplit({ cycleId, type, sourceIds, targetIds, reason, effectiveAt })`.
- Validation: merge requires ≥2 source / 1 target; split requires 1 source / ≥2 target.
- Audit: `committees_merged` / `committees_split`.
- Soft-delete pattern from Gap D respected.

#### Step 10 — درجات القبول (`ScoreThresholdsPage`) — only if Gap H didn't ship
- Per-committee form: minimum score, maximum score, validation `min < max`.
- Auto-loads committees for the active cycle.
- `admissionSetupService.setCommitteeScoreThresholds({ committeeId, min, max })`.
- Audit: `committee_score_thresholds_changed`.

#### Step 11 — مواعيد الاختبارات (`ExamDatesPage`)
- Date picker for `firstAvailableDate`.
- Multi-date picker or calendar for `bookableDays`.
- Optional `blackoutDates`.
- `admissionSetupService.setExamDateConfig({ cycleId, firstAvailableDate, bookableDays, blackoutDates })`.
- Validation: `firstAvailableDate ≥ cycle.startDate`; all `bookableDays ≥ firstAvailableDate`; blackouts must be subset of bookable.

#### Step 13 — المجموع الكلي (`TotalScorePage`)
- Per applicant-stream: `'general' | 'special' | 'law' | 'sports_female'`.
- Pick exam keys (from Gap J's exam list), assign weight 0..100, validate `sum === 100`.
- Optional minimum passing score per component.
- Total score out-of input (e.g. 100, 1000).
- `admissionSetupService.setTotalScoreConfig(...)` — audit emission.

#### Step 15 — الإقرار الإلكتروني (`ElectronicDeclarationPage`)
- Long-text editor for `bodyAr` (textarea or simple rich-text if existing pattern has one).
- Version number auto-increments on save.
- `effectiveFrom` date picker.
- "Publish" action separate from "Save" — publish makes the declaration visible to applicants.
- Preview pane showing the declaration as the applicant will see it on Stage 9.
- `admissionSetupService.setDeclaration(...)` and `publishDeclaration(id)` — both audited.

**Per net-new step:**
- One service file section with `INTEGRATION CONTRACT` JSDoc.
- TanStack Query hooks in `admission-setup.queries.ts`.
- Form with `react-hook-form + zod`.
- Audit emissions on every mutation via `withAudit`.
- Soft-delete where applicable.
- `isImplemented: true` in config.

**Commit per step:** `feat(admin/admission-setup/step-N): {step name}`

---

## 8 · Validation Requirements

After every phase:

```bash
cd /Users/mac/Projects/PACademy/PACademy/frontend
npm run typecheck
npm run build
npm run lint   # if exists
```

After Phase 5:

```bash
# No `any` in new code
grep -rn ": any" src/features/admin/admission-setup/ src/app/layouts/Sidebar.tsx
# No default exports in new code
grep -rn "export default" src/features/admin/admission-setup/
# Clean Arch — shared doesn't import features
grep -rn "from '@/features/" src/shared/
# Routes are constants
grep -rn "navigate('/admin/admission\|to=\"/admin/admission" src/features/admin/admission-setup/
```

All four must return zero. Any violation: fix before declaring done.

---

## 9 · UX Expectations

- **Sidebar group feels like a normal collapsible nav.** Click chevron to toggle; click any child to navigate (group auto-expands if collapsed).
- **Step pages share a consistent shell.** Every page has the same breadcrumb + step header + cycle indicator; only content area changes. The user always knows where they are in the 15-step flow.
- **Index page gives at-a-glance setup completion.** Three pills (`مكتمل` / `قيد التطوير` / `لم يبدأ`) color-coded green / gold / muted using existing token palette.
- **No forced ordering.** Steps are listed in order but not sequentially gated. An admin can jump to step 12 even if step 7 isn't done.
- **Cycle context is sticky.** Picking a cycle once persists across the 15 steps until the session ends. Switching cycles re-fetches all step status pills.
- **Permission boundaries silent.** Users without `admission-setup:read` don't see the section at all. Users with read but not write see read-only forms with a calm "ليس لديك صلاحية التعديل" footer line, not error toasts.
- **Composed pages don't leak the original.** A user clicking "بيانات سنة التقديم" lands on a coherent step 1 page, not a redirect to `/admin/cycles/:id`. The reused form is embedded; the URL stays in the admission-setup namespace.
- **All Arabic.** No English UI strings.
- **RTL preserved.** Logical properties only.

---

## 10 · Acceptance Criteria

The feature is done when:

- [ ] التقديم section is visible in sidebar for users with `admission-setup:read`.
- [ ] Section is collapsible; toggle state persists across refreshes.
- [ ] Auto-expands when on any `/admin/admission-setup/*` route.
- [ ] All 15 submenu items are listed in order with Arabic labels matching the spec.
- [ ] Each item routes to its own page at `/admin/admission-setup/{segment}`.
- [ ] All 15 routes registered in `ROUTES.admin.admissionSetup.*` and used as constants (no hardcoded paths).
- [ ] Every page renders inside `<AdmissionSetupShell>` with breadcrumb + step header + cycle indicator.
- [ ] Index page at `/admin/admission-setup` lists all 15 steps with status pills.
- [ ] Steps 1–8, 12, 14 compose existing admin-gaps surfaces (Gap F/G/H/I/J/K/L) — no logic duplication.
- [ ] Steps 9, 11, 13, 15 (and 10 if needed) are net-new with full CRUD, audit, soft-delete.
- [ ] New service `admissionSetupService` exists with `INTEGRATION CONTRACT` JSDoc on every method.
- [ ] New types added to `domain.ts` or `admission-setup/types.ts` per cross-cutting heuristic.
- [ ] RBAC: `admission-setup:read` and `admission-setup:write` permissions exist and gate the section + write actions.
- [ ] Cycle context (`useAdmissionSetupCycle`) reused across all 15 step pages.
- [ ] Adding a 16th step is a single config-entry append plus one new page file — no Sidebar / routes.tsx / shell changes required.
- [ ] Zero `any`, zero default exports in new code.
- [ ] `npm run typecheck` and `npm run build` clean.
- [ ] Clean Arch boundaries intact.
- [ ] Every mutation in net-new steps emits audit via `withAudit`.
- [ ] `docs/INTEGRATION_HANDOFF.md` §2 updated with `admissionSetupService` methods.

---

## 11 · Final Verification Checklist

Run before declaring done:

- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — clean.
- [ ] `npm run lint` — clean (or note absence).
- [ ] All four `grep` violation checks return zero.
- [ ] Sidebar smoke-test:
  - [ ] التقديم visible for super_admin, hidden for `applicant`.
  - [ ] Toggle persists across reload.
  - [ ] Auto-expands when on any admission-setup route.
- [ ] Index page renders 15 cards with correct status pills.
- [ ] Each of the 15 step routes renders the correct page.
- [ ] Composed steps load existing forms without forking logic — verify the same service method fires that the existing standalone page would.
- [ ] Net-new steps (9, 11, 13, 15) ship with full CRUD: create, edit, list, soft-delete, audit.
- [ ] Cycle context survives navigation between steps.
- [ ] Adding a fake "16th step" config entry takes <30 seconds: append to `ADMISSION_SETUP_STEPS`, add the route segment to `ROUTES`, write the page file — sidebar and breadcrumb pick it up automatically. **(Don't actually ship the 16th step; just verify the path exists.)**
- [ ] `docs/INTEGRATION_HANDOFF.md` §2 row added per net-new service method.

---

## 12 · Closeout

After all acceptance criteria pass:

1. Tag: `git tag admission-setup-shipped`.
2. Push tags if origin exists (`git remote -v` to check).
3. Append a section to `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md` titled "Admission Setup Section (post-closeout enhancement)" with: scope summary, composition strategy, net-new vs composed step list, commits.
4. Append to `docs/INTEGRATION_HANDOFF.md` §8 (open questions): "Should net-new admission-setup entities (declaration, total-score config, exam-date config, merge-split rules) be backed by the cycle-as-aggregate-root model in SQL Server, or as separate tables with FK to cycle? Affects audit retention strategy."
5. Report final summary: phases shipped, commits, files touched, validation status, tag.

---

## 13 · Stopping Conditions

Stop and ask only if:

- More than one of the "compose" steps requires refactoring the existing page beyond a simple component extraction (e.g. the existing form has tightly-coupled state that resists splitting).
- Step 10 score thresholds turn out to be already shipped in Gap H — confirm and update the strategy table; don't bulldoze.
- The active-cycle requirement (every step needs a cycle context) breaks for the index page (no cycle exists yet) — surface and decide: empty-state-driven UX or block the section entirely until a cycle exists.
- Adding `admission-setup:read` and `admission-setup:write` permissions to `rbac.ts` requires modifying Gap C's role definitions in a way that conflicts with shipped seed data.
- Total fixes/refactors exceed 25 — that's bigger than this scope.

Otherwise: ship phase by phase.

---

**Begin Phase 1 now.**
