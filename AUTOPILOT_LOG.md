# AUTOPILOT_LOG.md

> Append-only log of sprint completions during PROMPT_AUTOPILOT.md execution.
> Each new sprint adds a new section at the bottom.

## Sprint 1: Admin Portal — 2026-05-02 06:30
- Milestones:
  1. Domain types + reference data + cycles + rules mock data
  2. Reference Data 8-tab CRUD page (governorates, specializations, ranks, colleges, qualifications, nationalities, relationships, case-types) — DataTable + Drawer add/edit + Modal delete confirm
  3. Admission rules editor (versioned, per-cycle, history panel) + Cycles list + Cycle detail with status transition + clone
  4. System users CRUD with drawer form, activity log drawer, multi-select bulk role assignment, deactivate / 2FA reset actions
  5. Audit page with date-range + entity-type + user filters, before/after diff drawer, CSV export with UTF-8 BOM
  6. Reports page with 9 templates × 3 export paths (PDF via PrintLayout/print, Excel via UTF-8 CSV, Word via RTF), template selector, cycle filter
  7. Dashboard polish: cycle selector header action, real-time activity ticker, "إجراءات مطلوبة" panel, hour×day Heatmap (7×24), KPI sparklines
- New routes: 5 (`/admin/reference-data`, `/admin/reference-data/:tab`, `/admin/admission-rules`, `/admin/cycles`, `/admin/cycles/:id`)
- New services: referenceDataService, cyclesService, admissionRulesService, usersService (admin-feature-local), reportsService; auditService extended with date-range/entity/user filters + diff + CSV export
- New components: 6 admin-local pages (ReferenceDataPage, CyclesPage, CycleDetailPage, AdmissionRulesPage, refreshed UsersPage / AuditPage / ReportsPage / DashboardPage); shared utility `downloadBlob` in `src/shared/lib/download.ts`
- Karasa items resolved (KARASA_GAPS §1.2): B (8 reference tabs), C (admission rules versioned), D (cycles + clone + transition), E (users CRUD + activity + bulk + 2FA + deactivate), F (reports + 3 export paths + 9 templates), G (audit filters + diff drawer + CSV export), H (cycle selector + ticker + actions panel + heatmap)
- Typecheck: ✅  Build: ✅ (0 errors, 0 warnings · 488.62 kB JS / 54.46 kB CSS)
- Notable decisions:
  - **Heavy export libs (xlsx/docx/react-pdf) deferred to Sprint 10 hardening.** Browser print + UTF-8 BOM CSV + RTF stubs satisfy the contract today; the service shape stays the same when those libs land. Documented in-page with a Sprint 10 banner.
  - MOIPASS-backed login (§1.2.A) deferred to Sprint 9 cross-cutting since auth is shared across all 9 apps.
  - Reference data tabs use a discriminated union (`ReferenceRowMap`) typed per tab; service erases generic to `unknown[]` internally to avoid TS variance pitfalls, casts at the boundary so consumers stay fully typed.
- Skipped/deferred: MOIPASS login screen, real xlsx/docx/PDF libs, Excel bulk-import parsing for reference data (drag-and-drop UI placeholder shows "Sprint 10" toast).

## Sprint 2: Applicant Portal — 2026-05-02 07:30
- Milestones: types · mock data · service+queries · 11 zod schemas · ApplicantPortalLayout (Wizard wrapper + suspended-applicant guard + help dock) · 11 stage pages
- New routes: 11 stages under `/applicant/*` (auth/step-1, auth/step-2, profile/personal, profile/education, profile/marital, payment, profile/family, exam-schedule, print-card, follow-up, acquaintance-doc)
- New services: applicantPortalService with all 12 INTEGRATION CONTRACT methods
- Karasa items resolved (KARASA_GAPS §2): all 11 stages from §2.2, plus §2.3 cross-cutting (suspended-applicant guard banner, support FAB)
- Typecheck: ✅  Build: ✅ (chunk-size warning at 625 kB JS — Sprint 10 will introduce React.lazy code-splitting)
- Notable decisions:
  - Inline `zodResolver` (40 LoC) instead of installing `@hookform/resolvers` to keep dependency cost zero
  - Camera capture via `getUserMedia()` deferred to Sprint 8 (Biometric)
  - Real `JsBarcode` Code 128 deferred to Sprint 8 (Barcode)
- Skipped/deferred: real camera + real barcode generation, mobile-only layout polish, notification center
