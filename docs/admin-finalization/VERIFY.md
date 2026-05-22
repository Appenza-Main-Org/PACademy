# Admin Finalization Verification

Generated: 2026-05-22

## Result

Partial pass with one environment blocker.

Frontend/admin static verification is clean. Backend-live verification is blocked locally because the repo pins `.NET SDK 10.0.300` in `global.json`, while this machine only has `.NET SDK 10.0.201` at the 10.x line.

## 1. Mock-Residue Grep

Status: PASS

Command:

```bash
rg "MOCK\.|simulateLatency|from ['\"].*shared/mock-data|from ['\"].*lookups/mock" \
  frontend/src/features/admin \
  frontend/src/features/cycles \
  frontend/src/features/categories \
  frontend/src/features/applicant-grades \
  frontend/src/features/applicants \
  frontend/src/features/users \
  frontend/src/features/audit \
  frontend/src/features/workflows
```

Output, verbatim:

```text

```

Exit code: `1` from `rg`, meaning no matches.

The four specific files are also clean:

```text
frontend/src/features/admin/pages/AuditPage.tsx
frontend/src/features/admin/pages/ApplicantsPage.tsx
frontend/src/features/admin/components/applicants/ApplicantForm.tsx
frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts
```

The former admission-setup seed-only files were moved out of `frontend/src/features/admin/**` and into `frontend/src/shared/mock-data/admissionSetup.ts`.

## 2. Build + Typecheck

Status: frontend PASS, backend BLOCKED

| Check | Result | Notes |
| --- | --- | --- |
| `dotnet build backend/admin/PACademy.Admin.slnx` | BLOCKED | SDK mismatch before restore/build |
| `npm --prefix frontend run typecheck` | PASS | `tsc --noEmit` clean |
| `npm --prefix frontend run lint` | PASS | ESLint clean |
| `npm --prefix frontend run build` | PASS | Vite build clean with existing chunk-size warnings |
| `npm --prefix frontend run test:routes` | PASS | 74 passed, 0 failed |
| `npm --prefix frontend run test:rbac` | PASS | 11 role accounts, 40 admin routes, 119 matrix cells |

Backend blocker output:

```text
Requested SDK version: 10.0.300
global.json file: /Users/mac/Projects/PACademy/PACademy/global.json
Installed SDKs include 10.0.201, but not 10.0.300.
```

Also, the solution file exists at `backend/admin/PACademy.Admin.slnx`; no root-level `PACademy.Admin.slnx` exists in this checkout.

## 3. Backend Live

Status: BLOCKED

Command attempted:

```bash
dotnet run --project backend/admin/PACademy.Admin.Api --urls http://localhost:5101
```

Result: blocked by the same `.NET SDK 10.0.300` requirement. Migrations, seeders, `/scalar`, and endpoint inventory could not be verified locally.

## 4. `/admin/*` Route Walk

Status: PARTIAL

Static SPA route resolution passed through `npm --prefix frontend run test:routes`.

Live route/data verification with backend calls is blocked until the admin backend can start locally. No screenshots were captured because they would only show backend-unavailable states, not real SQL-backed data.

| Route surface | Status | Data present | Notes |
| --- | --- | --- | --- |
| `/admin` and registered admin descendants | PARTIAL | Not verified live | Static route resolution passes |
| RBAC route permissions | PASS | N/A | `test:rbac` passes all 40 admin routes |
| Network/mock-read verification | PASS static grep | Not verified in browser | Admin mock grep returns zero hits |

## 5. Dashboard Analytics Smoke

Status: BLOCKED

The SQL-backed reports/dashboard checks require the admin backend and DB connection. They could not be run under the local SDK mismatch.

## 6. Conflict-Path Smoke

Status: BLOCKED

The typed conflict tests require live write endpoints. They could not be run under the local SDK mismatch.

Pending live checks:

- Activate a second cycle → `ACTIVE_CYCLE_EXISTS`
- Duplicate lookup code → `LOOKUP_CODE_DUPLICATE`
- One additional typed conflict from `docs/DB_CONSTRAINTS.md`

## 7. Retry Policy

Status: PASS

`frontend/src/shared/lib/api-client.ts` now implements read-only retry behavior:

- `GET` requests only.
- Two retries after the initial attempt.
- Backoff: 300ms, then 900ms.
- Retry causes: network errors and HTTP `502`, `503`, `504`.
- Writes (`POST`, `PUT`, `PATCH`, `DELETE`) still use the request helper with no retry eligibility because `shouldRetryRead(...)` requires `method === 'GET'`.

Documentation: `docs/admin-finalization/RETRY_POLICY.md`.

## 8. Reports + Docs Present

Status: PASS

Present:

- `docs/admin-finalization/MOCK_RESIDUE.md`
- `docs/admin-finalization/RETRY_POLICY.md`
- `docs/admin-finalization/SMOKE_2026-05-22.md`
- `docs/admin-finalization/FINAL_REPORT.md`

## Deferred Items

1. Install `.NET SDK 10.0.300` or intentionally update `global.json` before rerunning backend verification.
2. Rerun:
   - `dotnet build backend/admin/PACademy.Admin.slnx`
   - `dotnet run --project backend/admin/PACademy.Admin.Api --urls http://localhost:5101`
   - `/scalar` endpoint inventory
   - Live `/admin/*` browser route walk with real SQL data
   - Dashboard SQL aggregate spot-checks
   - Conflict-path Arabic toast smoke
3. Capture dashboard/report screenshots only after the backend is running, so the screenshots prove real data instead of backend-unavailable UI.
