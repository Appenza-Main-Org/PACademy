# Admin Backend Integration Status

**Date:** 2026-05-21  
**Scope:** admin-first backend integration pass for `/admin/*`, `/admin/committee/*`, and admin-owned support features.

This note is the current context snapshot for the backend workstream. It updates the older `admin-gaps-verified` handoff: the frontend is no longer purely mock-first for the admin surface.

For backend implementation instructions ingested from the attached handoff files, also read [BACKEND_IMPLEMENTATION_CONTEXT.md](BACKEND_IMPLEMENTATION_CONTEXT.md). That document records the two-service backend topology, the non-negotiable seed-data rule, .NET/EF conventions, auth split, build order, and verification expectations.

## Current State

- A shared backend client now lives at `frontend/src/shared/lib/api-client.ts`.
- Backend calls are enabled by default. `VITE_USE_MOCKS=true` is now explicit local demo mode only.
- Production builds throw if `VITE_USE_MOCKS=true` is set.
- `VITE_API_BASE_URL` points at the backend origin; when empty, requests use same-origin `/api/...`.
- Auth tokens are read from persisted `pa-auth` session state and sent as `Authorization: Bearer <token>`.
- Backend error envelopes map into shared typed errors:
  - `ConflictError`
  - `DependencyBlockedError`
  - `AccountInactiveError`
  - `NotFoundError`
  - `ValidationError`
- Field-level backend validation is normalized by `frontend/src/shared/lib/validation-errors.ts` and currently surfaced in the high-risk admin forms: applicant create/edit, user create/edit, cycle create/edit, category edit, and committee create.

## Admin Services Wired

The following admin-relevant service groups now call real endpoints by default and keep mock bodies only behind `VITE_USE_MOCKS=true`:

- `features/auth/api/auth.service.ts`
- `features/admin/api/users.service.ts`
- `features/admin/api/roles.service.ts`
- `features/admin/api/settings.service.ts`
- `features/admin/api/cycles.service.ts`
- `features/admin/api/categories.service.ts`
- `features/admin/api/admissionRules.service.ts`
- `features/admin/api/examPlans.service.ts`
- `features/admin/api/nid-lookup.service.ts`
- `features/admin/api/notifications.service.ts`
- `features/admin/api/payments.service.ts`
- `features/admin/api/reports.service.ts`
- `features/admin/api/workflows.service.ts`
- `features/admin/admission-setup/api/admission-setup.service.ts`
- `features/admin/admission-setup/api/applicationSettings.service.ts`
- `features/admin/admission-setup/api/committeeBinding.service.ts`
- `features/admin/admission-setup/api/examSchedule.service.ts`
- `features/applicants/api/applicant.service.ts` for admin applicant pages
- `features/audit/api/audit.service.ts`
- `features/lookups/api/lookups.service.ts`
- `features/committees/api/committee.service.ts` for `/admin/committee/*`
- `features/committees/api/committeeInstance.service.ts` for `/admin/committees-exam-config`
- `features/applicant-grades/api/grades.service.ts`

## Admin UI Mock-Data Cleanup

Admin-facing pages/components that previously read seeded lookup or committee data directly now use query-backed data sources where touched in this pass:

- `DashboardPage`
- `ApplicantsPage`
- `CommitteeOverviewPage`
- `CommitteeDetailPage`
- `CommitteeForm`
- `CommitteeCreatePage`
- `ApplicantCategoryDetailPage`
- `LookupRowDrawer`
- `LookupTabPanel`

Mock imports may still exist inside service files as local demo fallback code. They must not be used in production/admin integration mode.

## Environment

`frontend/.env.example`:

```bash
VITE_API_BASE_URL=
VITE_USE_MOCKS=false
```

## Verification

Latest verified commands:

```bash
node frontend/node_modules/typescript/lib/tsc.js -p frontend/tsconfig.json --noEmit
node node_modules/typescript/lib/tsc.js -b tsconfig.json && node node_modules/vite/bin/vite.js build
```

Both passed. Existing Vite warnings remain for large chunks and dynamic/static `xlsx` and applicant-portal mock imports; they are not admin backend blockers.

## Remaining Notes

- The admin backend contract is now implemented as frontend calls, not just JSDoc intent.
- Keep query hooks and page components calling existing `*.service.ts` methods.
- Do not rewrite admin pages around `fetch`; add or adjust service methods instead.
- Applicant and non-admin operational surfaces are not part of this admin backend pass unless an admin page depends on their shared types or admin-owned configuration service.
- Backend implementation must follow the attached handoff context: admin/applicant split over one SQL Server DB, admin-owned migrations, applicant read-only projections where required, and frontend mock data copied verbatim for every seed.
