# Roles-Matrix Migration — Step 0 Inventory

**Date:** 2026-05-13
**Author:** Claude
**Status:** ⛔ **STOP-AND-ASK GATE — escalation required before Step 1.**

Several spec assumptions disagree with the live codebase. Surfacing them at
the top so we can resolve before any code is written.

---

## ⛔ Escalations — please resolve before I proceed

### 1. `/admin/payments` and `/admin/notifications` routes are **present**, not absent

The prompt says: *"Confirm `payments` and `notifications` admin routes are
absent. If present, escalate before proceeding."*

Both routes are live, fully built, and navigable from the admin sidebar:

| Spec row             | Live route               | Live page                                                                                                               |
|----------------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `payments_config`    | `/admin/payments`        | [PaymentsPage.tsx](frontend/src/features/admin/pages/PaymentsPage.tsx) — 331 lines. Gap K. Fawry ledger + refund-eligibility, gated by `payments:review`. |
| `notifications`      | `/admin/notifications`   | [NotificationsPage.tsx](frontend/src/features/admin/pages/NotificationsPage.tsx) — 389 lines. Gap L. List + create/edit drawer, publish/unpublish/soft-delete. |

Both pages are linked from [AdminLayout.tsx:76-77](frontend/src/features/admin/AdminLayout.tsx#L76-L77).

**Possible interpretations — please pick one:**

- **(A) Live routes ARE these rows.** Mark them `state: 'active'`. The spec's
  capability map needs revision because the existing pages already do
  publishing/refund/etc. (`notifications.approve` is on in the spec, which
  matches publish-approval; `payments_config.approve` is on, which matches
  refund-approval. So the capability map is probably right — only the
  `state: 'disabled'` flag is wrong.)
- **(B) Spec rows are different from the live pages.** E.g. `payments_config`
  is *settings* (gateway keys, webhook URL) and the live `/admin/payments` is
  the *ledger*. In that case the spec needs to add ledger rows and rename to
  clarify which is which.
- **(C) Defer.** Keep rows disabled per spec, accept the inconsistency that
  the routes exist but the matrix doesn't grant them.

My read: **(A) is the right call** — keep them active; the matrix governs
both surfaces. But it's your call.

### 2. Removing 7 of 11 system roles has reach beyond this screen

Per the classification (§5 below), 7 system roles are on-prem-only and would
be removed from cloud seed. That cascade touches more than the roles screen:

| Consumer                                                                 | Impact                                                                                                                   |
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| [features/auth/rbac.ts](frontend/src/features/auth/rbac.ts) `ROLES` tuple | Closed `const`-tuple. Must shrink. Affects `Role` type union across the entire codebase.                                 |
| [features/auth/components/RoleSelector.tsx](frontend/src/features/auth/components/RoleSelector.tsx) | Drops from 8 buttons → 3 (super_admin, applicant, finance_review). Login demo UI changes shape.                          |
| [shared/mock-data/index.ts:204-212](frontend/src/shared/mock-data/index.ts#L204-L212) MOCK.users | 7 seeded officers (U-003 … U-010) reference removed roles. Must be removed or remapped. Used across many features.        |
| [features/auth/api/auth.service.ts:109-124](frontend/src/features/auth/api/auth.service.ts#L109-L124) `buildAuthUser` | Falls back to `ROLE_DEFINITIONS` for missing seed keys. Removing seeds + tuple entries collapses cleanly.                |
| Committee officer lookup, investigations service, etc.                   | Several services filter `MOCK.users` by removed roles (e.g. `'investigator'`). Will return empty arrays. Need a sweep.    |

**Question:** is this in scope, or should I keep the on-prem roles in
`ROLES` tuple + `MOCK.users` and only remove them from the **cloud RBAC
seed** (`ROLE_DEFINITION_SEED`)? The second is a tighter blast radius and
might be the prompt's intent — "remove from cloud seed entirely" could mean
*from the seed that feeds the matrix*, not *from the codebase*.

My read: **scope to seed-only**. The `Role` union, `MOCK.users`, and
`RoleSelector` describe the *demo login surface* (it lets you preview any
app, including on-prem ones, in the browser). Leaving them intact keeps the
demo working; the cloud RBAC seed is a separate concern.

### 3. Several active admin sections don't map to any new matrix row

Live navigable admin routes that have no corresponding row in the spec:

| Live route                                | Sidebar label             | Closest spec row?                                                                                                |
|-------------------------------------------|---------------------------|------------------------------------------------------------------------------------------------------------------|
| `/admin/workflows`                        | سير العمل                  | None — `workflows` is currently a permission module (`workflows:read/write`). Drop the perm on migration?         |
| `/admin/audit`                            | سجل النشاط                | None — current `audit` module has its own row in the legacy matrix.                                              |
| `/admin/settings`                         | الإعدادات العامة          | Closest is `application_setup`, but settings is broader.                                                          |
| `/admin/categories`, `/admin/admission-rules`, `/admin/admission-setup/*` | إعداد التقديم steps | Fold under `application_setup`?                                                                                  |

**Questions:**
- Should `workflows`/`audit`/`settings` get their own rows in the matrix?
- Or fold them under existing rows (e.g. audit → users_roles, workflows → application_setup)?
- Or accept gaps and just drop the corresponding perms on migration?

### 4. `applicant` role has zero matrix-mapped capabilities

The seeded `applicant` role carries `applicant:view` and `applicant:apply` —
neither maps to any row in the new matrix. Three options:

- **(A) Keep the role**, migrate its permissions to `null` (= empty
  permissions array, `apps: ['applicant']`). Applicants still log in; their
  RBAC is enforced elsewhere (the wizard itself).
- **(B) Remove the role.** Applicants would need a different auth path.
- **(C) Hide it from the admin RolesPage** but keep it in the seed so login
  still works. (Treats it as a "system reserved" role like a service
  account.)

My read: **(C)**. Admins shouldn't be assigning the `applicant` role to
officers, and the role's permissions are governed by code (wizard gates),
not the matrix.

### 5. `finance_review` role permission mapping

Current: `permissions: ['payments:review', 'payments:refund_eligibility', 'reports:view']`.

Spec matrix has `applicant_payments` row with these actions: view, create,
delete, manage, transition (but NOT review — the spec says
"`applicant_payments.edit` is off — payment records are immutable; only
refund/approve via `approve`"). The capability map shows
`applicant_payments`: view ✓, edit ✗, create ✗, delete ✗, manage ✓,
transition ✗, approve ✓.

Proposed mapping:
- `payments:review` → `applicant_payments:approve`
- `payments:refund_eligibility` → `applicant_payments:approve` (same?) or `applicant_payments:view`?
- `reports:view` → `dashboard:view`

Confirm or correct?

---

## 1. Roles screen entry point

- URL: `/admin/users/roles`
- Route registration: [frontend/src/routes.tsx:215](frontend/src/routes.tsx#L215)
- Component: [frontend/src/features/admin/pages/RolesPage.tsx](frontend/src/features/admin/pages/RolesPage.tsx)
- Sidebar link: [AdminLayout.tsx:86](frontend/src/features/admin/AdminLayout.tsx#L86) (الأدوار والصلاحيات)
- AuthGuard: inherited from parent `/admin` route (`app="admin"`). No
  super-admin gate at the route layer — the page checks `isSuperAdmin`
  inline to gate the "include deleted" toggle, but renders for any admin.

## 2. Role add/edit drawer

- Location: inline in [RolesPage.tsx:247-295](frontend/src/features/admin/pages/RolesPage.tsx#L247-L295)
- Wrapper: shared `<Drawer size="lg">` from `@/shared/components`
- Body renders an `<Input>` for `labelAr` (disabled for system rows) and the
  `<PermissionMatrix>` for the permission grid
- Save dispatches `useUpdateRole` or `useCreateRole` from
  [roles.queries.ts](frontend/src/features/admin/api/roles.queries.ts)

## 3. Permission-matrix component

- Path: [frontend/src/features/admin/components/roles/PermissionMatrix.tsx](frontend/src/features/admin/components/roles/PermissionMatrix.tsx) (80 lines)
- **In-feature, not promoted to `shared/`.** Per the prompt's guardrail
  about not adding new shared components, this stays in-feature.
- Renders a raw `<table>` (not the shared `<DataTable>`). 18 rows × 7
  columns; row label start-aligned, action columns center-aligned.
- Drives off `PERMISSION_MODULES` and `PERMISSION_ACTIONS` from
  [shared/mock-data/roles.ts](frontend/src/shared/mock-data/roles.ts).
- Read-only for system rows; full `*` wildcard renders a banner above the
  table and disables all checkboxes.

**Note on the prompt's "reuse existing permission matrix UI primitive
(DataTable + checkbox cells)" instruction:** the current matrix is a raw
`<table>`, not a DataTable. DataTable is a generic data-grid component with
sorting, pagination, density, multi-select, export — none of which the
matrix needs. The cleanest path is to keep the in-feature
`<PermissionMatrix>` component and refactor its internals — *not* migrate
to DataTable. Flag this as a deviation if you'd rather force DataTable.

## 4. Current 12-row data source

The matrix currently has **18 rows × 7 columns**, not 12. Source:

- Module list: `PERMISSION_MODULES` const-tuple in [shared/mock-data/roles.ts:62-81](frontend/src/shared/mock-data/roles.ts#L62-L81)
- Action list: `PERMISSION_ACTIONS` const-tuple in [shared/mock-data/roles.ts:85](frontend/src/shared/mock-data/roles.ts#L85)
- Arabic labels: `MODULE_LABELS_AR` / `ACTION_LABELS_AR` in same file (88–117)
- All hardcoded in shared/mock-data. Not in `rbac.ts`. Not in the seed —
  these define the **UI taxonomy**; the seed defines per-role permission
  strings.

Current 18 modules:
```
applicants · committees · medical · investigations · board · exams
questions · biometric · barcode · workflows · reports · audit · settings
users · roles · lookups · notifications · payments
```

Of these, **11 are on-prem operational** and must be removed per spec:
committees · medical · investigations · board · exams · questions ·
biometric · barcode · workflows · (and arguably) `roles` if we're tighter.

## 5. Permission-bit storage shape

- **Shape:** `permissions: string[]` on `RoleDefinitionRow` ([domain.ts:351-360](frontend/src/shared/types/domain.ts#L351-L360))
- **Format:** `'<module>:<action>'` (e.g. `'applicants:view'`)
- **Special tokens:**
  - `'*'` — wildcard (super_admin)
  - `'<module>:*'` — module-wide wildcard (handled by `hasPermission` in [rbac.ts:113-120](frontend/src/features/auth/rbac.ts#L113-L120))
- Migration target: `CloudPermission = { module, action }` is structurally
  different. We'll need a string→struct migrator (`migrateLegacyPermission`)
  and serialization back to strings for API parity. Confirm whether storage
  shape should stay string-based (no API contract change) or switch to
  struct.

My read: **stay string-based on the wire.** The struct is an internal
matrix-rendering helper. Service contracts in `roles.service.ts` are typed
as `string[]` and the `INTEGRATION CONTRACT` JSDoc commits to that shape
for the real backend.

## 6. Seeded roles — classification

System roles defined in [shared/mock-data/roles.ts:22-33](frontend/src/shared/mock-data/roles.ts#L22-L33). Plus `finance_review` at line 46.

| Key                | Apps (current)                                       | Permissions (current)                                                                                                  | Classification                                                                                              |
|--------------------|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `super_admin`      | all 10                                               | `['*']`                                                                                                                  | **Cloud-only** (wildcard works on any matrix). Keep, migrate by collapsing `apps` to `['admin','applicant']`. |
| `committee_admin`  | admin, committee, barcode, biometric                  | applicants:view/edit/transition, committees:manage, barcode:print, biometric:verify, workflows:read/write              | **Mixed.** Strip on-prem (committees, barcode, biometric, workflows). Keeps `applicants:*`.                  |
| `committee_user`   | committee, barcode, biometric                         | applicants:view, barcode:print, biometric:verify                                                                         | **Mixed.** Strip on-prem. Keeps `applicants:view`. *But:* `apps` becomes empty (no cloud apps). Remove?     |
| `medical_admin`    | medical, barcode, biometric                           | medical:manage, results:enter, biometric:verify                                                                          | **On-prem-only.** Remove from cloud seed.                                                                   |
| `medical_doctor`   | medical                                              | medical:examine, results:enter                                                                                          | **On-prem-only.** Remove.                                                                                   |
| `investigator`     | investigations                                       | investigations:view, investigations:edit                                                                                | **On-prem-only.** Remove.                                                                                   |
| `board_admin`      | board                                                | board:manage                                                                                                            | **On-prem-only.** Remove.                                                                                   |
| `exams_admin`      | exams                                                | exams:manage, questions:manage, results:view                                                                            | **On-prem-only.** Remove.                                                                                   |
| `biometric_user`   | biometric                                            | biometric:verify                                                                                                        | **On-prem-only.** Remove.                                                                                   |
| `records_clerk`    | medical, exams                                       | results:enter                                                                                                           | **On-prem-only.** Remove.                                                                                   |
| `applicant`        | applicant                                            | applicant:view, applicant:apply                                                                                         | **Cloud-only** but unmappable. See §4 escalation above.                                                     |
| `finance_review`   | admin                                                | payments:review, payments:refund_eligibility, reports:view                                                              | **Cloud-only.** Keep, migrate per §5 escalation above.                                                     |

## 7. Other notes

- Cycles, lookups, application-setup, users, dashboard rows in the spec
  cleanly match existing routes — no surprises there.
- `application_setup` capabilities in spec are unusual: edit ✓ but create ✗
  and delete ✗ and transition ✗. This treats admission-setup as a "one
  global record you tune" rather than a CRUD list — matches reality
  ([AdmissionSetupIndexPage.tsx](frontend/src/features/admin/admission-setup/pages/AdmissionSetupIndexPage.tsx)). Good.
- `applicant_documents.delete` ✓ with `create` ✗ — admins purge uploaded
  documents (e.g. data-protection) but don't upload. Matches the
  applicant-portal upload flow.
- The DataTable export columns in `RolesPage` ([line 218-243](frontend/src/features/admin/pages/RolesPage.tsx#L218-L243)) include `apps` and `permissions` — both will reshape. Need to update the export config too.

---

## Files I will touch in Step 1+ (subject to your confirmation)

**Step 1 — permission definition**
- New: `frontend/src/features/admin/users/lib/cloudPermissions.ts`
  (in-feature; per spec)

**Step 2 — matrix UI refactor**
- [frontend/src/features/admin/components/roles/PermissionMatrix.tsx](frontend/src/features/admin/components/roles/PermissionMatrix.tsx)
  — replace module list with sectioned cloud matrix, add disabled-row guard
- [frontend/src/features/admin/pages/RolesPage.tsx](frontend/src/features/admin/pages/RolesPage.tsx)
  — adjust DataTable export columns if shape changes

**Step 3 — seed migration**
- [frontend/src/shared/mock-data/roles.ts](frontend/src/shared/mock-data/roles.ts)
  — depending on §2 escalation outcome, either:
  - **(narrow)** drop on-prem permission strings from `committee_admin`/`committee_user`, leave `super_admin` alone, drop seed rows for medical/investigator/board/exams/biometric/records_clerk, remap finance_review per §5
  - **(wide)** also shrink `ROLES` tuple in `rbac.ts`, prune `MOCK.users`, simplify `RoleSelector`

**Step 4 — dev review**
- Add RolesPage to `/_dev/primitives` if not already
- Screenshots into `docs/migration/roles-matrix/`

**Step 5 — REPORT.md**

---

## What I need from you to unblock

A reply on each of the five escalations above. If you'd rather I assume my
reads and let you course-correct, just say "go with your reads" and I'll
proceed.
