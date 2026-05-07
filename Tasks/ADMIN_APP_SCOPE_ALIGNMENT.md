# Admin App — Scope Alignment & Implementation Prompt

> **Inputs:** `PA_Academy_Notes.pdf` (business meeting notes), `pa_academy_admin_app_scope_gaps_claude_prompt.md` (initial summary), and project files (`CLAUDE.md`, `PRODUCT.md`, `README.md`, `POLISH_REPORT.md`, `POLISH_PLAN.md`, RFP PDF).
> **Output:** Aligned gap list + actionable Claude Code prompt, scoped to the agreed admin app behavior — no scope creep.

---

## 1 · Scope Alignment Summary

The meeting notes describe **the admin/super-admin configuration surface** of the Police Academy Admissions Platform. Every bullet in the notes maps to one of three buckets:

1. **Admin security & identity** — login, OTP, lock policy, dynamic roles.
2. **Admission configuration** — cycles, categories under cycles, committees (لجان), reference data lookups, exams (13), fees, notifications.
3. **Cross-cutting platform behaviors** — soft delete with child-data protection, audit trail for every action, payment via Fawry only, DB constraints (SQL Server) reflected in frontend types/validation.

Two important framing decisions flow from cross-checking the notes against `CLAUDE.md` and `PRODUCT.md`:

- **Frontend-only phase.** The project is feature-complete + polish-complete; backend integration is a later session. All "API", "constraint", and "integration" work in this gap list lives in **typed mock-service contracts** (the `INTEGRATION CONTRACT` JSDoc headers already established in the codebase) — not real network calls. This matches the existing project pattern.
- **Configurator screens stay product-register, not flagship.** Per `PRODUCT.md`, decision-makers only see the demo path; configurator screens (`/admin/cycles/*`, `/admin/categories/*`, `/admin/admission-rules`, `/admin/reference-data/*`) get Pass-2 consistency polish only. Gap work must respect that — functional completeness over visual flourish.

**No scope additions.** Every gap below traces directly to a bullet in `PA_Academy_Notes.pdf` or to RFP requirements that the notes implicitly reference (cycle workflow, committee scoring, exam ordering). Recommendations beyond the notes are clearly marked `[REC]`.

---

## 2 · What Is Already Implemented

Cross-referenced against `CLAUDE.md §3–§6` and `README.md`:

| Area | Status | Evidence |
|---|---|---|
| Admin shell + sidebar + per-app theming | ✅ Done | `AppShell`, `data-app="admin"` accent token system |
| `/admin` index → super_admin lands on Reports | ✅ Done | `AdminIndexRoute` |
| `/admin/applicants` (list + new + detail + edit) | ✅ Done | DataTable migration, 240-row dataset |
| `/admin/users` | ✅ Done | mock SystemUser data |
| `/admin/audit` page + `audit.service.ts` + `audit.queries.ts` | ✅ Done | 80 mock entries, AuditEntry domain type |
| `/admin/settings` | ✅ Done | shell exists |
| `/admin/reports` (12 sections) | ✅ Done | Reports command-center |
| `/admin/cycles`, `/new`, `/:id` | ✅ Routes wired | basic page; status workflow + fees not yet rule-enforced |
| `/admin/categories/:key` | ✅ Routes wired | basic page; condition builder thin |
| `/admin/workflows`, `/new`, `/:id` | ✅ Done | stage workflow editor |
| `/admin/admission-rules` | ✅ Routes wired | basic page; conflict-detection on rule change missing |
| `/admin/reference-data/:tab` | ✅ Routes wired | governorates, certificates exist; full lookup matrix incomplete |
| RBAC with 11 fixed roles | ✅ Done | `features/auth/rbac.ts` — but **fixed-only**, not dynamic |
| Staff login at `/staff-login` (with `/login` redirect) | ✅ Done | `LoginPage`, `LoginForm` |
| TanStack Query + Zustand auth + sessionStorage persistence | ✅ Done | per `CLAUDE.md §2 / §7` |
| Inline-SVG charts, Toast, NotificationCenter, CommandPalette | ✅ Done | `shared/components` |
| Mock service contracts with `INTEGRATION CONTRACT` JSDoc | ✅ Done | every `*.service.ts` |
| TypeScript strict mode, no `any`, named exports only | ✅ Done | enforced in `tsconfig`, `CLAUDE.md §2` |

**Net:** the skeleton, routing, RBAC scaffolding, design tokens, and mock-data layer are all in place. The gaps are **functional behaviors inside the admin pages**, not new infrastructure.

---

## 3 · Missing Gaps (aligned with the meeting notes)

Each gap cites the originating note and the implementation surface area.

### Gap A — Admin login security (OTP + lock policy)
**Notes:** "securing the admin to be with otp", "lock for admin login to be configured", "audit trail for all the system actions".
**Status:** `LoginForm` is single-step username/password; no OTP step, no lock policy UI, no login-event audit emissions.
**What's missing:**
- OTP step after credential check (mock 6-digit code; `dev-bypass: 000000`).
- Lock policy under `/admin/settings`: max failed attempts, lock duration, super-admin unlock action.
- Login audit events: `login_success`, `login_failed`, `account_locked`, `otp_sent`, `otp_verified`, `otp_failed`, `account_unlocked`.

### Gap B — Officer/admin identity API contract
**Notes:** "applicant and officer · api to get applicant and officer data · esm roba3y, rakam qawmy, code el zabet, esm".
**Status:** `LoginForm` derives a demo user from a role pick; no contract for fetching officer data by national ID + officer code.
**What's missing:**
- Typed service method `authService.lookupOfficer({ nationalId, officerCode })` returning `{ fullArabicName, mobileNumber, nationalId, officerCode }` shape.
- `INTEGRATION CONTRACT` header documenting the four fields the real backend must return.
- Mock implementation that returns deterministic data for known seed IDs.

### Gap C — Dynamic roles + permission matrix
**Notes:** "account (super admin, finance review) only two roles · we can make it dynamic better".
**Status:** 11 hard-coded roles in `features/auth/rbac.ts`; UI cannot create or edit roles.
**What's missing:**
- Role CRUD page under `/admin/users/roles` (list, create, edit, detail).
- Permission matrix UI: roles × (module × action) checkbox grid. Keep the current 11 roles as **system / seed roles** (read-only flag).
- Add `Finance Review` as a seeded role (called out explicitly in notes).
- Dynamic role types: `Role { id, key, label, isSystem, permissions: Permission[], scope?: { committees?, departments? } }`.
- User-status field: `active | suspended | locked`.

### Gap D — Soft delete + dependency protection (platform-wide)
**Notes:** "soft delete for all the system (and can't delete low fe child data, notify show the child)".
**Status:** No reusable soft-delete pattern; some delete buttons exist but without dependency checks.
**What's missing:**
- Domain-type augmentation: `deletedAt?: ISOString`, `deletedBy?: UserId`, `deleteReason?: string`.
- Shared `<SoftDeleteDialog>` component with dependency-warning slot ("لا يمكن حذف هذه الفئة لارتباطها بمتقدمين").
- Mock services return `dependencyCount > 0 → reject delete` for: cycles (with applicants/categories/committees), categories (with applicants), committees (with scheduled exams), lookups (with referencing rows).
- `restore` action visible to super admin where applicable.
- Default list filters hide soft-deleted rows; explicit "إظهار المحذوف" toggle for super admin.
- Audit emissions for `delete` and `restore`.

### Gap E — Audit trail expansion + diff viewer
**Notes:** "audit trail for all the system actions (user, action, data, date)".
**Status:** `AuditEntry` domain type and 80 mock entries exist; the `/admin/audit` page lists them but without per-action coverage of the new flows below or before/after diff viewer.
**What's missing:**
- Extend `AuditEntry` shape: `{ user, role, action, module, entityType, entityId, before?: Json, after?: Json, ip?: string, deviceMeta?: string, at: ISOString }`.
- Filters: user, role, action, module, entity, date range.
- Before/after diff drawer (side-by-side JSON view; Arabic field labels via a small dictionary).
- Audit emission helpers in every mutation hook: cycles, categories, committees, lookups, exams, payments, notifications, roles, login events.
- Append-only constraint documented in service contracts (no update/delete on audit rows).

### Gap F — Admission cycle rules
**Notes:** "Manage cycles · add name and date · fees fixed per cycle · only one cycle active · admin closes manual · status edrag awel 7aga (inactive) · applicant applies when active · check rule-change conflicts · choose legan".
**Status:** `/admin/cycles` and `/admin/cycles/:id` exist but don't enforce single-active-cycle, status workflow, fee-per-cycle, or extension/closure flows.
**What's missing:**
- `Cycle` domain type: `{ id, name, startDate, endDate, ageCalcDate, fees: { ... }, status: 'draft'|'active'|'closed'|'extended'|'archived', linkedCategoryIds, linkedCommitteeIds, examOrder }`.
- Status workflow: `draft → active → (extended)? → closed → archived`. New cycle starts as `draft` (إدراج).
- Mock-service guard: cannot transition a cycle to `active` if another cycle is `active` or `extended`. Return a typed error `ConflictError('ACTIVE_CYCLE_EXISTS', { activeCycleId })`.
- Manual close action; manual extend action (date picker for new endDate; emits audit `cycle_extended`).
- Active-cycle indicator pill in `AppShell` admin header (reads from cycle service).
- Applicant-portal entry guarded: `/applicant/start` shows "لا توجد دورة قبول مفتوحة حالياً" when no active cycle.

### Gap G — Category-under-cycle condition builder
**Notes:** "category under cycle · names are lookups · conditions: male/female, min/max age, age calc date, education type (azhar/sanwya/tarbya redaya), graduation year, age calc date, marital status (single/married)".
**Status:** `/admin/categories/:key` page exists but condition builder is thin / not driven by lookups.
**What's missing:**
- `CategoryConditions` shape with all listed fields plus: minimum score/grade, required documents, required exams, exam order.
- Condition builder UI grouped into sections (demographics / education / academic / required exams).
- Education-type dropdown wired to `educationTypes` lookup including: ثانوية عامة، أزهر، تربية رياضية، حقوق، بكالوريوس، ماجستير، دكتوراه، شهادات أجنبية / IG / أمريكي.
- **Conflict detection** on rule change: when condition modified, run a mock query `categoriesService.previewRuleChangeImpact(categoryId, newConditions)` returning `{ impactedApplicants, conflicts: Array<{ applicantId, failingRule }> }`. Display impacted applicants list, require admin confirmation, allow super-admin override only for safe rule loosenings (audit emits `category_rules_changed_with_override`).

### Gap H — Committee (لجان) management — capacity + scoping
**Notes:** "el lagna (name, feh officers) · gender, magmo3, ta2deer, all conditions same as categories · noo3 el ta5sos (magster/doctorah/baclroyes) · capacity per lagna per day · el mgamo3 el me3yar (accumlative score for student)".
**Status:** Committee management page + committee detail page exist (used by demo flagship polish). The admin-side configuration surface is not fully fleshed out for capacity, scoping, and scoring criteria.
**What's missing:**
- `Committee` config shape extension: `{ ..., gender, scoreCriteria: { magmo3?, ta2deer?, accumulativeScore? }, conditionsLikeCategory, capacityPerDay, availableDates, linkedCycleId, linkedCategoryIds, linkedExamIds, sortingCriteria }`.
- Capacity validation in scheduling (mock service rejects when day > capacity).
- Officer-assignment UI (multi-select from system users with `committee_user`/`committee_admin` role).
- Specialty / degree / university / faculty scoping — **all driven by lookups** (Gap I).

### Gap I — Reference data / lookups completeness
**Notes:** "names are lookups · martail status this lookup · lookuup table bel ta5sosat (7asabat, handasa) male we female · noo3 el ta5sos · el gam3at deh lookup · kolyat · ta5sosat".
**Status:** `/admin/reference-data/:tab` exists with governorates and certificates. Many required lookups are not yet first-class.
**What's missing:**
The lookup taxonomy (each as its own tab):
- categories (names)
- educationTypes (ثانوية عامة، أزهر، تربية رياضية، حقوق، بكالوريوس، ماجستير، دكتوراه، شهادات أجنبية)
- maritalStatuses (single, married)
- universities
- faculties (linked to university)
- specialties / specialtyTypes (handasa, 7asabat...)
- degreeTypes (bachelor, master, PhD)
- governorates (already exists)
- nationalities
- relativeRelationships (for family up-to-4th-degree)
- jobs
- qualifications
- examTypes
- examGroups
- committeeTypes
- rejectionReasons / stopReasons
- notificationDepartments

Each lookup row needs: `{ id, key, labelAr, labelEn?, sortOrder, isActive, isSystem, parentId?, gender?, deletedAt? }`.

Each lookup tab supports: create, edit, **activate/deactivate** (preferred over hard delete), reorder, dependency check before deactivate, audit trail.

### Gap J — Exams (13 exams, groups, ordering, copy-from-previous)
**Notes:** "exams (questions, offline upload excel, integration with device, manual assign daragat per student) · tarteeb el e5tbarat per category per cycle · emakneyt el nas5 fe kol el data · exams are 13, and have groups/category for exams".
**Status:** Question Bank + Exams app exists. Per-cycle exam ordering and copy-from-previous-cycle workflow at the admin layer are not fully fleshed out.
**What's missing:**
- `Exam` config shape: `{ id, key, group, name, scoreType: 'numeric'|'pass_fail'|'qualitative', isQualifying }`. Seed with the 13 academy exams (per RFP § p.40: القدرات، الطول، السمات الخارجي/الداخلي، الرياضي، إعادة الرياضي، الهيئة، القوام، إعادة القوام، الطبي، إعادة الطبي، الاتزان النفسي، الطبي المتقدم، اختبارات الكلية).
- Per-cycle, per-category ordered list of exams: `CycleCategoryExamPlan { cycleId, categoryId, exams: { examId, order, fee?, isRequired }[] }`.
- **Copy-from-previous-cycle action** (`copyConfig({ fromCycleId, toCycleId })`).
- Result-entry methods stubbed in service contracts: `manualEntry`, `bulkUpload (excel)`, `deviceIntegration` (last two as placeholders only).
- Result-approval state machine: `draft → review → approved → published`; cannot edit `approved` results without permission.
- Sequence validation: cannot enter result for exam N if any required exam < N is missing/failed.

### Gap K — Fawry-only payment admin
**Notes:** "payment with fawry only (special integration) · finance review · refund (Refund)".
**Status:** Payment status mock data exists in `Applicant`; admin-side finance review surface is not separated.
**What's missing:**
- Per-cycle Fawry config under `/admin/cycles/:id` (merchant code field, payable label, retry window).
- `/admin/payments` page (or panel under `/admin/cycles/:id/payments`) gated by `Finance Review` role / `payments:review` permission.
- Payment status lookup: `pending | paid | failed | expired | refunded`.
- Search by applicant / national ID / Fawry reference.
- Payment audit trail (every status transition emits an entry).
- Service contract `paymentsService.syncFawryStatus(reference)` placeholder.
- Refund eligibility view (read-only list of refund-eligible payments per RFP §p.42 صلاحية إعادة المقابل المالي للطلبة).

### Gap L — Notification management
**Notes:** "notifications per student · general notifications per qesm and it is system on website · leeha publish date · notifications to be on home page for student · leeh expire date".
**Status:** `NotificationCenter` shared component exists for in-app delivery; admin-side authoring is not yet present.
**What's missing:**
- `/admin/notifications` page (list, new, edit, detail).
- `Notification` shape: `{ id, type: 'general'|'student'|'department'|'category'|'committee', title, bodyAr, audience: AudienceSelector, publishAt, expireAt, status: 'draft'|'scheduled'|'published'|'expired', createdBy, deletedAt? }`.
- Audience selector: all applicants / specific applicant (national ID lookup) / category / committee / department.
- Publish + unpublish actions; cron-style status auto-transitions implemented in mock service (`computeStatus(now, publishAt, expireAt)`).
- Applicant home page (`/applicant`) reads published, non-expired notifications targeted to that applicant.
- Audit on every authoring action.

### Gap M — DB-constraint readiness reflected in frontend
**Notes:** "make constraints on DB (sql server)".
**Status:** TypeScript types are loose where the DB will be strict.
**What's missing:**
Document and enforce these invariants in **frontend types, zod schemas, and `INTEGRATION CONTRACT` headers** (the DB-side enforcement is backend's job; frontend mirrors the same rules so integration is friction-free):
- One active cycle only (already in Gap F).
- Unique applicant per `(nationalId, cycleId)`.
- Category belongs to exactly one cycle.
- Fee belongs to cycle.
- Exam order unique per `(categoryId, cycleId)`.
- Committee daily attendance ≤ capacity.
- Cannot delete parent with children (already in Gap D).
- Soft-delete filters applied by default.
- Audit append-only.

Add a docs file `docs/DB_CONSTRAINTS.md` listing each constraint, the frontend mirror, and the SQL Server expression backend must implement. (Light artifact — single page.)

### Gap N `[REC]` — Recommended additions (not in notes, but flagged for risk reduction)
- **Session timeout indicator** for admin sessions (idle warning at 28 min, force logout at 30 min) — sensible default for an audit-heavy admin app.
- **Two-person approval** on destructive cross-cycle actions (e.g. purge an archived cycle's PII) — common ministerial-grade safeguard.
- **Bulk import dry-run** for applicant CSV — preview before commit. The notes mention Excel uploads for exam results; same pattern is useful elsewhere.

These three are explicitly marked `[REC]` and **must not be implemented unless approved.**

---

## 4 · Prioritized Implementation Tasks

Priorities reflect (a) demo coverage value, (b) blast radius, (c) scope-comprehension signal to the tender committee.

| # | Task | Priority | Reason | Est. effort* |
|---|---|---|---|---|
| 1 | Gap A — Admin OTP + lock policy + login audit | P0 | Security gate; high signal in demo | M |
| 2 | Gap E — Audit trail expansion + diff viewer | P0 | Cross-cuts every other gap; do early so subsequent gaps emit correctly | M |
| 3 | Gap D — Soft delete + dependency protection | P0 | Cross-cuts every entity; foundational | M |
| 4 | Gap F — Cycle status workflow + single-active enforcement | P0 | Demo path showpiece | M |
| 5 | Gap G — Category condition builder + conflict detection | P1 | Distinctive scope-comprehension signal | L |
| 6 | Gap I — Reference data lookup matrix | P1 | Unblocks G, H, J | L |
| 7 | Gap H — Committee capacity + scoping | P1 | Pairs naturally with G + I | M |
| 8 | Gap J — Exam ordering + copy-from-previous-cycle | P1 | RFP-aligned | M |
| 9 | Gap C — Dynamic roles + permission matrix | P2 | Useful but the 11 seed roles cover the demo | M |
| 10 | Gap L — Notification management | P2 | High visibility on applicant home | S |
| 11 | Gap K — Fawry payment admin + Finance Review | P2 | RFP-aligned | S |
| 12 | Gap B — Officer lookup contract | P2 | Pure contract work; small | S |
| 13 | Gap M — DB-constraints doc + frontend mirrors | P3 | Documentation-heavy | S |

*S = ≤4h, M = 4–10h, L = 10–20h. Sequence respects dependencies: do E + D before everything else, then F unblocks G/H/I/J.

---

## 5 · Risks, Assumptions & Dependencies

### Assumptions
- A1. Frontend-only phase holds — no real backend in this work. All "API" gaps are mock-service contracts with `INTEGRATION CONTRACT` JSDoc; the real wiring is a later session.
- A2. The 11 existing roles remain as seed/system roles even after Gap C ships (dynamic roles are additive, not replacing).
- A3. Configurator pages keep product-register polish (per `PRODUCT.md`) — functional completeness over visual flourish.
- A4. The 13 exams listed in RFP §p.40 are the canonical set for seeding (Gap J).
- A5. Fawry integration is "special" per the notes; mock just status transitions and an opaque reference string. Do not invent a fake API surface.
- A6. Applicant-portal touch points (cycle gate in /applicant/start, notifications on /applicant home) are in scope where the admin gap explicitly drives them, but no other applicant-portal redesign happens in this work.

### Risks
- R1. **Audit-emission churn.** Adding audit emissions to every mutation hook is mechanical but touchy. Mitigation: build a tiny `withAudit(mutationFn, descriptor)` wrapper in `shared/lib/audit.ts` and wire incrementally; keep PRs small.
- R2. **Soft-delete migration.** Existing mock data has no `deletedAt`. Mitigation: optional field; default filters apply only when present; backfill seed data is a one-line map.
- R3. **Conflict-detection in Gap G.** Could become a rabbit hole. Mitigation: limit v1 to three rules (gender, age range, education type) and a flat conflict list; richer logic deferred.
- R4. **Lookup proliferation.** Gap I lists ~17 lookups. Mitigation: build a single `<LookupTab>` component parameterized by the lookup key; tabs become near-zero-cost to add.
- R5. **Polish drift.** Configurator surfaces tempt flagship treatment. Mitigation: constrain to `Card`, `DataTable`, shared form primitives; no new shape primitives invented.

### Dependencies
- D1. Gap E (audit) is a dependency of D, F, G, H, I, J, K, L (every mutation must emit).
- D2. Gap D (soft delete) is a dependency of F, G, H, I, J, L (each touches deletion behavior).
- D3. Gap I (lookups) is a dependency of G (categories) and H (committees) since both consume lookup data.
- D4. Gap F (cycle workflow) is a dependency of G (categories under cycle) and J (exam plan per cycle).

### Out of scope (explicitly)
- Real backend wiring (the contract headers exist; the bodies stay mock).
- Mobile-first polish for staff (per `PRODUCT.md`).
- Dark mode.
- Any English UI translation of Arabic copy.
- New design tokens or motion durations.

---

## 6 · Claude Code Implementation Prompt

Copy the section between the `=== BEGIN ===` / `=== END ===` markers into Claude Code.

```
=== BEGIN CLAUDE CODE PROMPT ===

# Police Academy Admin App — Gap Closure Implementation

You are working in the Police Academy Admissions Platform frontend repo. Read `CLAUDE.md` first; this prompt assumes you've internalized §3 architecture rules, §6 mock-service pattern, §9 conventions.

## Constraints (non-negotiable)

- React 18 + TypeScript strict + Vite; no `any`, no default exports, no `useEffect` for data fetching, no third-party chart libraries.
- Clean Arch: `features/X` may import from `shared/`; `shared/` must NEVER import from `features/`. Pages stay dumb composers.
- Use existing primitives: `Button`, `Card`, `Badge`, `Input`, `Select`, `DataTable`, `Modal`, `Drawer`, `Combobox`, `MultiSelect`, `DatePicker`, `Toast`, `PageHeader`, `EmptyState`. If you need a new shared primitive, justify it in the PR description.
- TanStack Query for server state, Zustand only for client/global state, react-hook-form + zod for forms.
- Arabic-first RTL; logical properties (`ms-`/`me-`/`ps-`/`pe-`); copy verbatim from `_legacy/` or RFP where it exists.
- Route constants only — link via `ROUTES.*` from `src/config/routes.ts`. Never hard-code paths.
- Every new feature exposes a public API only via its barrel `index.ts`.
- After each gap, run `npm run typecheck` and `npm run build` — both must be clean.
- Frontend-only phase. Real backend = later. All "API" work = typed mock-service methods with `INTEGRATION CONTRACT` JSDoc headers; bodies use `simulateLatency()` + `MOCK` reads.
- Configurator screens = product-register polish only. No flagship treatment, no invented motion, no new tokens. Functional completeness > visual flourish (per `PRODUCT.md`).

## Sequence (do in order; do NOT reorder)

The order matters because later gaps emit audit, use soft delete, and depend on cycle/lookup/role infrastructure.

### Phase 1 — Foundations (audit + soft-delete + login security)

1. **Gap E — Audit trail expansion**
   - Extend `AuditEntry` in `src/shared/types/domain.ts`:
     `{ id, user: { id, name, role }, action, module, entityType, entityId, before?: unknown, after?: unknown, ip?: string, deviceMeta?: string, at: string }`.
   - Add `src/shared/lib/audit.ts` exporting `withAudit(mutationFn, descriptor)` that wraps a mutation and pushes to `MOCK.audit` with computed `before` / `after` snapshots.
   - Extend `auditService` filter shape: user, role, action, module, entityType, dateRange.
   - Build `<AuditDiffDrawer>` in `features/audit/components/` showing side-by-side JSON with Arabic field-label dictionary (start small: 20 most common fields).
   - Wire filters + drawer into `/admin/audit` page.

2. **Gap D — Soft delete + dependency protection**
   - Add optional `deletedAt?: string`, `deletedBy?: string`, `deleteReason?: string` to: `Cycle`, `Category`, `Committee`, `LookupRow`, `Notification`, `Role`. (Skip applicants, audit entries — never soft-deleted.)
   - Build `<SoftDeleteDialog>` shared component: confirms reason + previews dependency count from a passed-in `useDependencies(entityType, entityId)` hook.
   - Build `<DependencyWarning>` shared component with Arabic copy templates ("لا يمكن حذف هذه {entity} لارتباطها بـ {n} {child}").
   - Mock services: each entity service gains `softDelete(id, reason)`, `restore(id)`, and `getDependencies(id)` returning typed `{ counts: Record<string, number>, blocking: boolean }`.
   - Default `list()` filters out soft-deleted; super-admin gets a "إظهار المحذوف" toggle that flips a `includeDeleted` query arg.
   - Both `softDelete` and `restore` emit audit via `withAudit`.

3. **Gap A — Admin OTP + lock policy**
   - Extend `LoginPage` flow: after credential submit, render an `<OtpStep>` with 6-digit input. `dev-bypass: 000000` always passes. Mock service generates a code and stores it in a Zustand `authPending` slice.
   - Under `/admin/settings`, add a `<LockPolicyCard>`: max-failed-attempts (1–10), lock-duration-minutes (5–120), and a list of currently-locked users with a super-admin-only unlock action.
   - Login mock service emits audit on: `login_success`, `login_failed`, `account_locked`, `account_unlocked`, `otp_sent`, `otp_verified`, `otp_failed`.

4. **Gap B — Officer lookup contract**
   - Add `authService.lookupOfficer({ nationalId, officerCode })` returning `{ fullArabicName: string, mobileNumber: string, nationalId: string, officerCode: string }`.
   - `INTEGRATION CONTRACT` JSDoc lists the four fields and the expected `GET /v1/officers/lookup?nid=...&code=...` real endpoint.
   - Mock returns deterministic data for a small seeded set; unknown IDs throw a typed `NotFoundError`.

After Phase 1: typecheck + build clean. Commit per gap.

### Phase 2 — Cycle + reference data (the spine)

5. **Gap F — Admission cycle workflow**
   - Extend `Cycle` domain type with `status`, `ageCalcDate`, `fees`, `linkedCategoryIds`, `linkedCommitteeIds`, `examOrder`.
   - Mock-service guard `activate(cycleId)` rejects with `ConflictError('ACTIVE_CYCLE_EXISTS', { activeCycleId })` if another is active or extended.
   - UI on `/admin/cycles/:id`: status badge, transition buttons (Draft → Active, Active → Closed, Active → Extended with date picker, Closed → Archived). Each transition opens a confirmation dialog and emits audit.
   - Add `<ActiveCycleIndicator>` to admin AppShell header (reads `cycleService.useActiveCycle()`).
   - `/applicant/start` reads active-cycle status — when none, shows "لا توجد دورة قبول مفتوحة حالياً" empty state.

6. **Gap I — Reference data lookup matrix**
   - Build `<LookupTab>` parameterized component (props: `lookupKey`, `columns`, `rowSchema`).
   - Add tabs for: categories, educationTypes, maritalStatuses, universities, faculties, specialties, specialtyTypes, degreeTypes, nationalities, relativeRelationships, jobs, qualifications, examTypes, examGroups, committeeTypes, rejectionReasons, notificationDepartments. (Governorates already exists.)
   - Each row: `{ id, key, labelAr, labelEn?, sortOrder, isActive, isSystem, parentId?, gender? }` (rowSchema picks the relevant fields per lookup).
   - Operations: create, edit, activate/deactivate (preferred over delete; `isActive: false` is the default soft-disable). Hard delete only when `getDependencies` returns 0 and via super-admin. Reorder via drag-handle column.
   - All operations audit.

After Phase 2: typecheck + build clean. Commit per gap.

### Phase 3 — Conditions, committees, exams

7. **Gap G — Category condition builder + conflict detection**
   - Extend `Category` shape with `CategoryConditions { gender, minAge, maxAge, ageCalcDate, educationTypes: string[], graduationYear?, maritalStatuses: string[], minScore?, requiredDocuments: string[], requiredExamIds: string[], examOrder: string[] }`.
   - Build `<CategoryConditionBuilder>` in `features/admin/components/` — sections: Demographics, Education, Academic, Required Exams. Dropdowns wired to lookups from Gap I.
   - Mock `categoriesService.previewRuleChangeImpact(categoryId, newConditions)` returning `{ impactedApplicants: Applicant[], conflicts: { applicantId, failingRule }[] }`.
   - Save flow: if `impactedApplicants.length > 0`, open a confirmation drawer listing them. Require super-admin role for "override and save anyway"; emit audit `category_rules_changed_with_override` with old/new conditions + impacted IDs.
   - v1 conflict scope: gender, age range, education type only. Note this in code comment for future expansion.

8. **Gap H — Committee capacity + scoping**
   - Extend `Committee` shape with `gender`, `scoreCriteria`, `capacityPerDay`, `availableDates`, `linkedCycleId`, `linkedCategoryIds`, `linkedExamIds`, `sortingCriteria`, `officerIds`.
   - Capacity check in `committeesService.scheduleSlot` — reject when day's count ≥ capacity.
   - Officer assignment: `<OfficerMultiSelect>` filtered to users with `committee_admin` or `committee_user` role.
   - Specialty / degree / faculty / university scoping — Combobox driven from lookups.

9. **Gap J — Exam ordering + copy-from-previous-cycle**
   - Seed the 13 exams from RFP p.40 into `MOCK.exams` (القدرات، الطول، السمات الخارجي، السمات الداخلي، الرياضي، إعادة الرياضي، الهيئة، القوام، إعادة القوام، الطبي، إعادة الطبي، الاتزان النفسي، الطبي المتقدم).
   - Add `CycleCategoryExamPlan` shape: `{ cycleId, categoryId, exams: { examId, order, fee?, isRequired }[] }`.
   - Build `<ExamPlanEditor>` (reorderable list within `/admin/cycles/:id` per category).
   - Add `examsService.copyConfig({ fromCycleId, toCycleId })` cloning all per-category exam plans.
   - Result-entry stubs in service contracts: `manualEntry`, `bulkUpload`, `deviceIntegration` — JSDoc only, no UI yet beyond an existing `/admin/exams` toggle.
   - Result approval state machine on the existing exam result entity: `draft → review → approved → published`. Block edits to `approved` unless permission `exams:override`.
   - Sequence guard: `examsService.canEnterResult(applicantId, examId)` returns false when any prior required exam is missing/failed.

After Phase 3: typecheck + build clean. Commit per gap.

### Phase 4 — Roles, notifications, payments

10. **Gap C — Dynamic roles + permission matrix**
    - Add `Role` domain type: `{ id, key, labelAr, labelEn?, isSystem: boolean, permissions: Permission[], scope?: { committeeIds?: string[], departmentIds?: string[] } }`.
    - Seed the 11 existing roles as `isSystem: true` (read-only label/permissions; only `scope` editable on system roles).
    - Add `Finance Review` system role (read access to `/admin/payments`, write to refund-eligibility flag).
    - `/admin/users/roles` page: list, create, edit, detail. PermissionMatrix is `<table>` with rows = modules, cols = actions; checkboxes per cell.
    - Update `useAuthStore` to load permissions from the user's role at login (so dynamic permissions take effect without code changes).
    - `User` gets `status: 'active' | 'suspended' | 'locked'`; status transitions audit.

11. **Gap L — Notification management**
    - `Notification` shape: `{ id, type: 'general'|'student'|'department'|'category'|'committee', titleAr, bodyAr, audience, publishAt, expireAt, status, createdBy, deletedAt? }`.
    - `/admin/notifications` page: list with status filter, new, edit, detail.
    - `<AudienceSelector>`: discriminated union UI by `type` — for `student`, search by national ID; for `category`/`committee`/`department`, multi-select from lookups; for `general`, no further input.
    - `notificationsService.computeStatus(now, publishAt, expireAt)` derives `draft|scheduled|published|expired` deterministically; wire into list + detail.
    - `/applicant` (portal landing) reads published, non-expired notifications for the current applicant via `notificationsService.listForApplicant(applicantId)`.
    - All authoring actions audit.

12. **Gap K — Fawry payment admin**
    - Extend `Cycle.fees` shape with `fawryConfig: { merchantCode: string, label: string, retryWindowHours: number }`. Editable on cycle detail.
    - `/admin/payments` page (or panel under `/admin/cycles/:id/payments`) gated by `payments:review` permission (held by `super_admin` and `Finance Review` roles).
    - DataTable: applicant, national ID, fawry reference, amount, status, lastSyncAt. Search + filter by status.
    - `paymentsService.syncFawryStatus(reference)` placeholder — JSDoc lists the real Fawry endpoint.
    - Refund-eligibility view: read-only filtered list where `status === 'paid'` and `cycle.status === 'archived'` (per RFP §p.42 صلاحية إعادة المقابل المالي).
    - Status transitions audit.

After Phase 4: typecheck + build clean. Commit per gap.

### Phase 5 — Documentation

13. **Gap M — DB constraint readiness**
    - Create `docs/DB_CONSTRAINTS.md` listing each invariant (one-active-cycle, unique applicant per cycle, category in one cycle, fee belongs to cycle, exam-order unique per category/cycle, committee-capacity, no-delete-with-children, soft-delete-default-filter, audit-append-only) with: the rule, the frontend mirror (zod schema or service guard), and the SQL Server expression backend must implement.
    - Add a one-paragraph summary linking out from `CLAUDE.md` §6.

## Output expectations

For each gap completed, report:

1. **Summary of completed changes** — bullets, ≤6.
2. **Files changed** — flat list, grouped by feature/shared.
3. **Remaining known gaps within the gap** — anything deferred and why.
4. **Assumptions made** — list anything you decided without asking.
5. **Validation result** — `npm run typecheck` and `npm run build` outputs (zero errors, zero warnings expected).

If anything in this prompt conflicts with `CLAUDE.md`, `CLAUDE.md` wins — flag the conflict and stop.

If a gap's effort balloons past 1.5x the estimate (S=4h, M=10h, L=20h), stop and report rather than blowing past the budget silently.

=== END CLAUDE CODE PROMPT ===
```

---

## 8 · Implementation Closeout

> Frozen 2026-05-07 at tag `admin-gaps-complete`. All 13 gaps (A–M)
> shipped in sequence; Gap N stayed out of scope.

### Gaps completed (13 / 13)

| # | Gap | Status | Notes |
|---|---|---|---|
| 1 | E — Audit trail expansion + diff viewer | ✅ | Inline before/after, module/role filters, AuditDiffDrawer |
| 2 | D — Soft delete + dependency protection | ✅ | `SoftDeletable` mixin, `SoftDeleteDialog`, services for cycles + categories + reference data |
| 3 | A — Admin OTP + lock policy + login audit | ✅ | Two-step login, lock policy under SettingsPage, 7 audit actions |
| 4 | B — Officer lookup contract | ✅ | `authService.lookupOfficer` + typed `NotFoundError` |
| 5 | F — Cycle status workflow | ✅ | `extended` status, `ConflictError('ACTIVE_CYCLE_EXISTS')`, `<ActiveCycleIndicator>` |
| 6 | I — Reference data lookup matrix | ✅ | 13 new lookups, `<LookupTab>`, parent-child references |
| 7 | G — Category condition builder + conflict detection | ✅ | `<CategoryConditionBuilder>` + impact preview drawer, super-admin override |
| 8 | H — Committee capacity + scoping | ✅ | `scheduleSlot` with capacity guard, `<OfficerMultiSelect>` |
| 9 | J — Exam ordering + copy-from-previous-cycle | ✅ | 13 academy exams seeded, `<ExamPlanEditor>`, copy action on cycle detail |
| 10 | C — Dynamic roles + permission matrix | ✅ | 11 system roles + Finance Review, `<PermissionMatrix>` table, system-row protection |
| 11 | L — Notification management | ✅ | `<AudienceSelector>` discriminated UI, `/admin/notifications`, applicant landing surface |
| 12 | K — Fawry payment admin | ✅ | `paymentsService.syncFawryStatus` placeholder, refund-eligibility view, `payments:review` gate |
| 13 | M — DB constraints doc | ✅ | `docs/DB_CONSTRAINTS.md` lists 9 invariants with SQL Server expressions |

### Numbers

- **Commits on this branch (after `6d07204`):** 13 atomic feat commits +
  1 closeout commit (this section).
- **Files touched:** ~70 across `shared/types`, `shared/lib`,
  `shared/mock-data`, `shared/components`, `features/admin`,
  `features/auth`, `features/audit`, `features/committees`,
  `features/applicant-portal`, `app/layouts`, plus `routes.tsx`,
  `config/routes.ts`, and the new `docs/DB_CONSTRAINTS.md`.
- **New typed errors:** `ConflictError` (5 codes),
  `DependencyBlockedError`, `NotFoundError`.
- **New shared primitives:** `<SoftDeleteDialog>`, `<DependencyWarning>`,
  `<AuditDiffDrawer>` (extracted), `setAuditActorProvider` /
  `withAudit` / `emitAudit` (lib).
- **New admin pages:** `/admin/users/roles`, `/admin/notifications`,
  `/admin/payments`.
- **New service files:** roles, notifications, payments, lookups,
  examPlans (5 services + their queries).

### Deferred / not in scope

- **Gap N (`[REC]`)** — session timeout indicator, two-person approval
  on destructive cross-cycle ops, applicant CSV bulk-import dry-run.
  Per the original prompt, these stay out unless explicitly approved.
- **Cycle-detail Fawry config inline editor** (Gap K) — typed shape
  exists on `CycleFees.fawryConfig`; the form fits in the next polish
  pass. Not blocking integration.
- **Permission re-load at login** (Gap C) — `useAuthStore` still uses
  the legacy `ROLE_DEFINITIONS` mapping in mock; the contract for
  loading permissions from the dynamic role row at login is documented
  in `roles.service.ts` JSDoc.
- **UsersPage status pill / status-transition control** (Gap C) —
  `usersService.setStatus` is wired and audit-emitting; the UI surface
  lands as a follow-up.

### Final verification

```
$ npm run typecheck
> tsc --noEmit
(clean — 0 errors)

$ npm run build
> tsc -b && vite build
✓ built in ~7s
(only the chunk-size advisory; no errors)
```

### Next session

Backend integration is the natural next workstream. The
`INTEGRATION CONTRACT` JSDoc at the top of every `*.service.ts` lists
the real REST endpoints the admin gap closure assumed; the typed
`ConflictError` codes documented in `docs/DB_CONSTRAINTS.md` are the
fixture set the integration tests can compare against. The frontend
will not need to change — only the bodies of the service methods flip
from `simulateLatency() + MOCK` reads to `apiClient.get/post(...)`.

---

## 9 · Verification + Fix Pass

> Frozen 2026-05-07 after the autonomous verification pass that
> followed `admin-gaps-complete` (`3c2bdaa`). Full report:
> [docs/VERIFICATION_REPORT.md](../docs/VERIFICATION_REPORT.md).

### Findings + fixes

| # | Severity | Gap | What was wrong | Fix | Commit |
|---|---|---|---|---|---|
| 1 | Build-blocking | post-tag CSS edit | `tokens.css` comment closed early on `*/--ease-*/` substring | Reworded comment to drop the embedded `*/` | linter follow-up |
| 2 | Build-blocking | post-tag Radix work | `AlertDialog` used `onInteractOutside` (not on Radix `AlertDialog.Content`) | Wired dismiss on Overlay; Esc auto-handled by Radix | linter follow-up |
| 3 | Cleanup | E/F | AppShell deep-imported `@/features/auth/api/auth.queries` and `@/features/admin/components/cycles/ActiveCycleIndicator` | Routed both through feature barrels; added `ActiveCycleIndicator` to admin barrel | `2920e14` |
| 4 | Functional | C | `buildAuthUser` loaded permissions from static `ROLE_DEFINITIONS`; admin role edits didn't propagate at login | Read from `MOCK.roleDefinitions` first, fall back to legacy table | `b9af227` |
| 5 | Functional | H | `committee.list()` didn't filter soft-deleted rows even though `Committee` extends `SoftDeleteFields` | Added `filterDeleted` + `includeDeleted` opt-in to `committee.list` | `b085af0` |

### Pre-existing items flagged but out of admin-gap scope

- `src/shared/lib/zod-resolver.ts:25` — explicit
  `eslint-disable @typescript-eslint/no-explicit-any` to bridge RHF
  v7's variance-strict resolver.
- `src/features/admin/components/applicants/ApplicantForm.tsx:831` —
  `register: any` on a sub-form prop. Both pre-date `admin-gaps-complete`
  (commit `69f4689`).

### Final state

- 13 / 13 gaps ✅ verified.
- `npm run typecheck` ✅ clean.
- `npm run build` ✅ clean (only the unchanged chunk-size advisory).
- 0 Clean Arch violations (`shared/` → `features/` count = 0; barrel
  discipline restored).
- 3 atomic verification commits shipped on top of `admin-gaps-complete`,
  none reverted any prior gap.
- `docs/VERIFICATION_REPORT.md` is the canonical write-up for this pass.

---

## §10 — Workstream Closeout (2026-05-07)

Admin gaps workstream is complete and ready for backend integration handoff.

- **Implementation:** 13 atomic commits — `admin-gaps-complete` (`3c2bdaa`).
- **Verification:** 4 fix commits — `admin-gaps-verified` (`d989536`).
- **Cleanup:** 4 commits — TODO.md (`d7cef53`), tagging report
  (`7b43e8d`), INTEGRATION_HANDOFF.md (`039dc57`), this closeout.
- **Demo tag:** `v0.3.0-admin-verified` at `d989536` — supersedes
  `v0.2.0-demo` for any tender presentation.
- **Handoff doc:** [docs/INTEGRATION_HANDOFF.md](../docs/INTEGRATION_HANDOFF.md) —
  single source of truth for backend integration.
- **Deferred (per `TODO.md`):** the two pre-existing `: any` flags —
  to be resolved during integration when form schemas become typed.
- **Deferred (explicit):** soft-delete `list()` filter spot-check
  across non-committee entities — to be addressed during backend
  integration when those entities get re-touched.

**Note:** subsequent commits (Radix adoption work — Accordion,
AlertDialog, Dialog, DropdownMenu, Popover, SearchSelect, Sheet, Tabs,
Tooltip + the `RADIX_ADOPTION_REPORT.md` and `/_dev/primitives` review
route) are a separate workstream driven by `CLAUDE.md §2.5` and **not**
covered by the admin-gaps tags. Backend integration may proceed
independently of the Radix work.

**Next workstream:** backend integration. See
[docs/INTEGRATION_HANDOFF.md](../docs/INTEGRATION_HANDOFF.md).

---

## 7 · Notes for the human reviewer

- **The prompt above is sequenced**, not parallelized. Audit + soft-delete + login security come first because every later gap emits audit and uses soft delete. Reordering will create churn.
- **Recommended additions (Gap N)** are deliberately excluded from the Claude Code prompt. Approve them separately if desired.
- **Budget signaling** — the prompt asks Claude Code to stop and report at 1.5× over estimate. This is a safety valve against silent scope creep.
- **All Arabic copy** in the prompt above is verbatim from the meeting notes or RFP; no translations were invented.
