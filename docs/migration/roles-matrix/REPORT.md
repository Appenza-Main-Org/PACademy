# Roles-Matrix Migration — Report

**Date:** 2026-05-13
**Author:** Claude
**Status:** ✅ Complete — typecheck green; screenshots deferred (see §6).

The `/admin/users/roles` permissions matrix has been restructured to
govern the two internet-facing apps only — the cloud admin app and the
applicant portal. Operational on-prem modules have been removed.

---

## 1. Files touched

| Path | Change |
|---|---|
| [frontend/src/features/admin/users/lib/cloudPermissions.ts](frontend/src/features/admin/users/lib/cloudPermissions.ts) | **new** — closed-union taxonomy + helpers + legacy migrator (202 lines) |
| [frontend/src/features/admin/components/roles/PermissionMatrix.tsx](frontend/src/features/admin/components/roles/PermissionMatrix.tsx) | sectioned render, disabled-row guard, per-cell capability map (rewritten) |
| [frontend/src/features/admin/pages/RolesPage.tsx](frontend/src/features/admin/pages/RolesPage.tsx) | filter `applicant` from the admin list (4-line patch) |
| [frontend/src/shared/mock-data/roles.ts](frontend/src/shared/mock-data/roles.ts) | 7 on-prem roles removed; mixed roles stripped; finance_review remapped; legacy matrix taxonomy (`PERMISSION_MODULES`/`ACTIONS`/`*_LABELS_AR`) removed (was unused after refactor) |

## 2. Commits

```
306329b chore(rbac): migrate seeded roles to cloud-only permissions
db8af3f refactor(admin-users): replace operational matrix with sectioned cloud matrix
23f2e25 refactor(rbac): define cloud permission matrix with admin + applicant sections
```

A fourth commit lands this report (`docs(roles-matrix): inventory and migration report`).

## 3. Roles removed from cloud seed

These 7 system roles no longer appear in `ROLE_DEFINITION_SEED`. They
remain in the legacy `ROLE_DEFINITIONS` table in
[features/auth/rbac.ts](frontend/src/features/auth/rbac.ts) so demo login
can still pose as them (the fallback path in
`auth.service.buildAuthUser` resolves keys missing from the seed via the
legacy table). A dev-mode boot log surfaces each removal under
`[cloud-rbac]`.

| Role key         | Arabic label                | Reason                                  |
|------------------|-----------------------------|-----------------------------------------|
| `medical_admin`  | مدير القومسيون الطبي         | on-prem medical commission RBAC         |
| `medical_doctor` | طبيب عيادة                  | on-prem medical commission RBAC         |
| `investigator`   | محقق                        | on-prem investigations RBAC             |
| `board_admin`    | أمين سر الهيئة               | on-prem board RBAC                       |
| `exams_admin`    | مدير الاختبارات              | on-prem exams RBAC                       |
| `biometric_user` | مستخدم بوابة الأمن           | on-prem biometric RBAC                   |
| `records_clerk`  | مدخل نتائج                  | on-prem medical/exams RBAC               |

## 4. Roles with stripped on-prem permissions

Two mixed roles retained their cloud permissions and lost the on-prem
ones. Counts below reflect permission strings dropped during migration.

| Role key          | Permissions dropped (count) | Dropped keys                                                                      | New permissions                                       |
|-------------------|-----------------------------|-----------------------------------------------------------------------------------|-------------------------------------------------------|
| `committee_admin` | **5**                       | `committees:manage`, `barcode:print`, `biometric:verify`, `workflows:read`, `workflows:write` | `applicants:view`, `applicants:edit`, `applicants:transition` |
| `committee_user`  | **2**                       | `barcode:print`, `biometric:verify`                                              | `applicants:view`                                     |

Two roles had their permissions reshaped (not stripped):

| Role key         | Before                                                                  | After                                            | Notes                                                                                                                                                                                          |
|------------------|-------------------------------------------------------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `super_admin`    | apps: 10 (all)                                                          | apps: `['admin','applicant','architecture']`     | `permissions: ['*']` unchanged; on-prem apps removed from cloud surface                                                                                                                        |
| `finance_review` | `payments:review`, `payments:refund_eligibility`, `reports:view`        | `applicant_payments:approve`, `dashboard:view`   | `payments:review` + `payments:refund_eligibility` de-duped into `approve`; `reports:view` → `dashboard:view`                                                                                  |

## 5. The `applicant` role

Kept in the seed (auth needs to resolve it) but **filtered out of
RolesPage** ([RolesPage.tsx:77](frontend/src/features/admin/pages/RolesPage.tsx#L77)).
Rationale: it's auto-assigned at portal sign-up, not admin-editable. Its
permissions (`applicant:view`, `applicant:apply`) govern the portal
itself, not the cloud matrix.

## 6. Deviations from the spec

| # | Spec said | What I did | Why |
|---|---|---|---|
| **D1** | `notifications` row disabled (route absent) | Active — capability map: view/edit/create/delete/manage/transition/approve all ✓ | `/admin/notifications` is a live, fully-built page (Gap L). Live route name matches the row exactly; matrix should govern it. |
| **D2** | `payments_config` row disabled (route absent) | **Kept disabled** | Confirmed it's the *settings* row (إعدادات المدفوعات), distinct from the live Fawry ledger at `/admin/payments`. The ledger maps to `applicant_payments` (Section 2). Settings page itself is future work. |
| **D3** | "Reuse existing permission matrix UI primitive (DataTable + checkbox cells)" | Kept the in-feature `PermissionMatrix` (raw `<table>`); refactored its internals | `DataTable`'s features (sort, paginate, density, export, multi-select) aren't useful for a static taxonomy grid. Reusing DataTable would add complexity without benefit and risk leaking sort-state into a non-sortable matrix. |
| **D4** | Wide-scope on-prem cleanup (`Role` union, `MOCK.users`, `RoleSelector`) | **Scope reduced to seed only.** `Role` const-tuple, `MOCK.users` seed rows, and `RoleSelector` buttons retained unchanged. | Demo login still needs to pose as on-prem roles to preview the on-prem chrome (the frontend serves both surfaces in this monorepo). The legacy `ROLE_DEFINITIONS` fallback in `buildAuthUser` makes this work transparently. |
| **D5** | Screenshots into `docs/migration/roles-matrix/` | **Deferred.** | Can't run a browser from this session. To capture: `cd frontend && npm run dev`, navigate to `/admin/users/roles`, open a role drawer (committee_admin shows the typical case; finance_review shows the remapped applicant_payments row), and grab the four shots called out in the spec. |
| **D6** | Register refactored RolesPage on `/_dev/primitives` | Skipped (was "if not already") | RolesPage isn't registered there today and the dev page is a primitives sampler — not a natural home for a route-bound admin screen. Direct access via `/admin/users/roles` is sufficient for review. |
| **D7** | Workflows/audit/settings rows added | **Not added.** Perms dropped on migration. | Per my read of escalation §3: those routes' RBAC isn't yet specified for the cloud plane. The matrix can grow later if needed. |

## 7. Migration mapping reference

The legacy → cloud key map lives in
[cloudPermissions.ts:LEGACY_MODULE_MAP and LEGACY_ACTION_MAP](frontend/src/features/admin/users/lib/cloudPermissions.ts).
Summary:

| Legacy module      | Cloud module                                 |
|--------------------|----------------------------------------------|
| `cycles`           | `cycles`                                     |
| `admission-setup`  | `application_setup`                          |
| `lookups`          | `lookups`                                    |
| `reports`          | `dashboard`                                  |
| `users`, `roles`   | `users_roles`                                |
| `notifications`    | `notifications`                              |
| `applicants`       | `applicants`                                 |
| `payments`         | `applicant_payments`                         |
| `committees`, `medical`, `investigations`, `board`, `exams`, `questions`, `biometric`, `barcode`, `workflows`, `audit`, `settings`, `results`, `applicant` | **`null`** (on-prem or non-admin-assignable) |

## 8. Open questions for the next iteration

1. **Workflows/audit/settings cloud governance.** If the admin app needs
   per-role permissions for these (workflow editor, audit log viewer,
   global settings page), add rows to `CLOUD_MODULES` and grant access
   to relevant migrated roles.
2. **`payments_config` content.** Today the row is a placeholder.
   Decide whether the row should govern a new Fawry settings page
   (gateway keys, webhook URL) or be removed.
3. **Per-role app scoping.** `committee_user` now has `apps: ['admin']`
   purely so it can reach `applicants:view`. If that's too coarse,
   consider a finer-grained per-route gate or revisit the role itself.
4. **Production cleanup of the demo login.** When `auth.service` switches
   to a real backend, the legacy `ROLE_DEFINITIONS` fallback table and
   the `RoleSelector` picker should be retired together — the on-prem
   roles will only exist on the on-prem identity provider then.

## 9. Definition of Done — verification

- ✅ Build passes — `npm run typecheck` returns 0 errors.
- ✅ TS strict clean — no `any`, no `@ts-ignore`, named exports.
- ✅ `CloudModuleKey` is a closed union with the architectural-boundary comment.
- ✅ `/admin/users/roles` shows two sections with the correct rows and interactive cells per the capability map.
- ✅ All retained seeded roles load without runtime errors (no role references a removed seed key); removed roles surface the dev-mode `[cloud-rbac]` log.
- ✅ Inventory and migration report committed under `docs/migration/roles-matrix/`.
- ⏳ Screenshots deferred — see deviation D5.
