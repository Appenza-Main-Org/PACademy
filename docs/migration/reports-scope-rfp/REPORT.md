# Reports RFP Scope Implementation Report

Date: 2026-05-27

## Scope Covered

This pass implements the RFP reports surface for comprehensive applicant statistics, aggregate/detail applicant reports, stage drop-off reporting, export actions, data-availability probing, and real admin-backend endpoints under `/api/admin/reports`.

The custom reports tab is intentionally a placeholder for the RFP catch-all item because no approved report templates exist yet.

## Frontend Changes

- Added shared contracts and a non-persisted Zustand filter store under `frontend/src/features/admin/reports/`.
- Added `ReportsFiltersBar`, `ReportsExportButtons`, and `ReportsAvailabilityGate`.
- Refactored `/admin/reports` into URL-synced tabs: overview, applicants, drop-off, custom.
- Added `ApplicantsReportTab` and `StageDropoffTab`.
- Extended `reports.service.ts` and `reports.queries.ts` with real-backend-only report methods.
- Extended `api-client.ts` with POST blob support for server exports.

## Backend Changes

- Added `Modules/Reports` with DTOs, validator, query service, export handler, and DI registration.
- Added endpoints:
  - `GET /api/admin/reports/applicants/aggregate`
  - `GET /api/admin/reports/applicants/detail`
  - `GET /api/admin/reports/stage-dropoff`
  - `GET /api/admin/reports/data-availability`
  - `POST /api/admin/reports/export`
- Implemented against the current backend setup: `AdminRecordsService` JSON rows.
- Added validator tests for age/date/stage validation and sort whitelist.

## Deviations

- The explicit SQL Server `Applicants(cycle_id, current_stage, ...)` index migration was not added because the current admin backend report data lives in `admin_records` JSON; those columns do not exist in the active schema.
- Server-side xlsx/docx/pdf generation uses dependency-free CSV/HTML-compatible output instead of adding ClosedXML/OpenXML/QuestPDF. The endpoint contract is stable, so richer renderers can replace the handler later.
- Per-widget export remains covered by the existing consolidated overview export; the new RFP tabs have dedicated export buttons.

## Verification

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `dotnet build backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj`
- `dotnet test backend/admin/PACademy.Admin.Api.Tests/PACademy.Admin.Api.Tests.csproj`

Known warnings: existing NuGet `System.Security.Cryptography.Xml` vulnerability warnings from external admin modules, plus existing Vite chunk-size/dynamic-import warnings.
