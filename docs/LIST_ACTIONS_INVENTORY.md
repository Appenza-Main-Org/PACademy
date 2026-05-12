# List Actions Inventory

> Canonical map of every admin/staff list page in `frontend/src/features/` and
> the three universal actions (Export / Import / Duplicate) each one
> opts into. Driven by `Tasks/LIST_ACTIONS_PROMPT.md`.

The list of pages was extracted from `CLAUDE.md §4` and verified against the
live `routes.tsx` plus a `grep -rln "DataTable\\b" src/features/`. Composite
surfaces (wizards, dashboards, schedule timelines) are excluded — they are
not row-list pages.

`xlsx` package is **already a dependency** (`xlsx@^0.18.5` per
`frontend/package.json`), so the XLSX format is enabled wherever CSV is.

## Conventions

- **Export (تصدير)** — current filtered view → CSV (always) + XLSX (when
  format requested). UTF-8 with BOM for Excel-friendly Arabic. Audit-emit
  `entity_exported` per call.
- **Import (استيراد)** — CSV/XLSX upload → mandatory dry-run preview dialog
  with per-row validation → explicit confirm. Audit-emit `entity_imported`
  with `successCount`/`failedCount`/`attemptedCount`.
- **Duplicate (نسخ)** — single-row action that calls `transform(row)` then
  `onCommit`, redirects to the edit page for an explicit save (PRODUCT.md §4
  preliminary-save canon). Audit-emit `entity_duplicated`.

## Inventory

| Surface | Route | Page component | Entity | Export | Import | Duplicate | Notes |
|---|---|---|---|:---:|:---:|:---:|---|
| Admin | `/admin/applicants` | `ApplicantsPage` | Applicant | ✅ | ❌ | ❌ | Self-registering. Bulk insert would break audit chain + NID-cycle uniqueness. |
| Admin | `/admin/users` | `UsersPage` | SystemUser | ✅ | ✅ | ✅ | NID-driven import via existing officer-lookup; duplicate clones role-set with a fresh NID required at save. |
| Admin | `/admin/audit` | `AuditPage` | AuditEntry | ✅ | ❌ | ❌ | Append-only — `auditService` ships no mutators. Export-only by design. |
| Admin | `/admin/reference-data/:tab` | `ReferenceDataPage` | (per-tab row) | ✅ | ✅ | ❌ | Each tab's row shape differs; bulk lookup load is the core use case. |
| Admin | `/admin/cycles` | `CyclesPage` | AdmissionCycle | ✅ | ❌ | ✅ | Duplicate reuses existing `cyclesService.clone`; must respect `ACTIVE_CYCLE_EXISTS` (new clone always lands in `draft`). |
| Admin | `/admin/categories` | `CategoriesListPage` | ApplicantCategory | ✅ | ❌ | ✅ | Duplicate clones rules + procedures; key collisions are blocked. |
| Admin | `/admin/workflows` | `WorkflowsListPage` | DepartmentWorkflow | ✅ | ❌ | ✅ | Duplicate clones stages + tests but flips `isActive=false`. |
| Admin | `/admin/admission-rules` | `AdmissionRulesPage` | — | — | — | — | Single config page, no row list — skipped. |
| Admin | `/admin/reports` | `ReportsPage` | — | — | — | — | Composite dashboard — skipped. Section-level export already exists. |
| Admin | `/admin/admission-setup/*` | wizard | — | — | — | — | Composite wizard — skipped per prompt §4. |
| Admin | `/admin/payments` | `PaymentsPage` | AdminPaymentRow | ✅ | ❌ | ❌ | Fawry-issued; bulk import would corrupt reconciliation. |
| Admin | `/admin/notifications` | `NotificationsPage` | AdminNotification | ✅ | ❌ | ✅ | Duplicate is the canonical "re-use last notice" workflow. |
| Admin | `/admin/users/roles` | `RolesPage` | RoleDefinitionRow | ✅ | ❌ | ✅ | Duplicate clones permission set; flag as non-system. |
| Committee | `/admin/committee/list` | `CommitteeListPage` | Committee | ✅ | ❌ | ✅ | Duplicate clones officers + capacity + score criteria, **not** linked scheduled exams or applicant assignments. |
| Committee | `/admin/committee/schedule` | timeline | — | — | — | — | Timeline view, not a list — skipped. |
| Board | `/board/sessions` | `BoardSessionsPage` | BoardSession | ✅ | ❌ | ✅ | Duplicate clones agenda + members + applicantIds, **not** decisions. New session lands in `scheduled` state. |
| Board | `/board/decisions` | `BoardDecisionsPage` | BoardDecision | ✅ | ❌ | ❌ | Signed artefacts. Export-only. |
| Board | `/board/members` | `BoardMembersPage` | BoardMember | ✅ | ✅ | ❌ | Bulk roster import is the core use case. |
| Investigations | `/investigations/cases` | `CasesPage` | InvestigationCase | ✅ | ❌ | ❌ | One case per applicant — duplicate would violate uniqueness. |
| Investigations | `/investigations/incoming` | `IncomingPage` | inbox item | ✅ | ❌ | ❌ | Read-only inbox. |
| Investigations | `/investigations/outgoing` | `OutgoingLettersPage` | OutgoingLetter | ✅ | ❌ | ❌ | Sent artefacts. |
| Investigations | `/investigations/distribution` | `DistributionPage` | distribution row | ✅ | ❌ | ❌ | Read-only assignment view. |
| Medical | `/medical/queue` | `MedicalQueuePage` | queue entry | ✅ | ❌ | ❌ | — |
| Medical | `/medical/results` | `MedicalResultsPage` | MedicalExamResult | ✅ | ✅ | ❌ | Bulk result entry from external station devices. |
| Barcode | `/barcode/scans` | `BarcodeScansPage` | BarcodeScan | ✅ | ❌ | ❌ | Read-only log. |
| Barcode | `/barcode/batch` | `BarcodeBatchPage` | batch row | ✅ | ❌ | ✅ | Duplicate batch config for reissue. |
| Biometric | `/biometric/history` | `BiometricHistoryPage` | BiometricVerification | ✅ | ❌ | ❌ | Read-only log. |
| Biometric | `/biometric/monitoring` | `BiometricMonitoringPage` | monitor event | ✅ | ❌ | ❌ | Read-only log. |
| Exams | `/question-bank/manage` | `QuestionBankCrudPage` | BankQuestion | ✅ | ✅ | ✅ | Bulk question import (existing `ImportWizard` to be folded under the new dialog); duplicate-then-edit pattern. |
| Exams | `/question-bank/exams` | `ExamsPage` | ExamConfig | ✅ | ❌ | ✅ | Duplicate exam config; new copy lands in `draft`. |
| Exams | `/question-bank/results` | `ExamResultsPage` | ExamAttempt | ✅ | ✅ | ❌ | Bulk result entry from external scoring devices. |

## High-level wiring decisions

1. **Inception preview** — `ImportPreviewTable` itself uses `DataTable<PreviewRow<T>>` with success/error row styling driven by tokens.
2. **Per-tab configs for reference-data** — `ReferenceDataPage` is tab-driven; each tab's `LookupTab` instance owns its own `listActions` config so the export columns + import schema match the live row shape.
3. **Cycle duplicate** — reuses existing `cyclesService.clone(id)`. The new `listActions` path runs through `cyclesService.duplicateRow` (a thin alias) so the audit emission is uniform with other entities.
4. **Question import** — the legacy `ImportWizard` (`features/exams/components/ImportWizard.tsx`) is retained for now; the new `listActions.import` route wraps `examsService.createQuestionBatch` so both surfaces co-exist. Once the new dialog is canon, the legacy wizard can be retired.
5. **Permissions** — derived defaults in §3 of the prompt:
   - `{entity}:export` → satisfied by any actor with `{entity}:view` or `*:read` (and by `*`).
   - `{entity}:import` / `{entity}:duplicate` → satisfied by any actor with `{entity}:write` or `{entity}:manage` (and by `*`).
   The `canPerformListAction` helper in `shared/lib/list-action-permissions.ts` implements this mapping so we don't need to mutate `rbac.ts`'s seed role definitions.

## Out of scope for this pass

- **Backend bulk-import error-retry strategy** — open question parked in `docs/INTEGRATION_HANDOFF.md §8`.
- **Atomic vs. partial commit semantics for `bulkImport`** — frontend treats the call as atomic (commits valid rows, returns failures). Real backend may differ.
- **>10k-row export chunking past CSV** — current ceiling is "warn + still go". If the user requests background-job semantics, that's a separate work item.
