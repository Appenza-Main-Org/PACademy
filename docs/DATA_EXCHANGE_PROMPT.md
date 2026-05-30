# Claude Code Execution Prompt — Data Exchange (آليات تبادل البيانات)

> **Mode:** full-stack, single bounded task with internal commit checkpoints.
> **You MUST pause at every `⏸ PAUSE` gate** and wait for explicit "continue"
> before starting the next checkpoint. Do not batch checkpoints.

---

## 0. Mission

Build a centralized admin Data Exchange hub at `/admin/data-exchange` that
exports and imports Excel for all exchangeable domains, with a **dedicated
change-detection + preview pipeline** and a **row-level timestamp /
version / checksum mechanism** so that every export and import is tracked
and **no key is ever duplicated**.

This is the load-bearing requirement, stated once, enforced everywhere:

> **Every** exchangeable row — across all 8 domains, no exceptions — carries
> creation + modification tracking (`created_at`, `updated_at`, `row_version`,
> `checksum`), and every export/import sheet surfaces `created_at` + `updated_at`.
> On import, rows are matched by **`business_key`** (fallback `id`); a key that
> already exists is **never inserted twice** — it is classified Changed /
> Skipped / Outdated / Conflict and routed through preview, never blind-written.

Two export behaviours are mandatory and explicit:

1. **One workbook, fixed sheet names.** The default export is a single `.xlsx`
   with one sheet per domain under a **locked sheet-name registry** (§ below).
   The same registry is the contract the importer validates against — fixed
   names are how export and import stay coupled.
2. **"Updated-only" exports.** The admin can export only rows that have changed,
   selected by either a **since-date** (`updated_at >= date`) **or** a
   **modified-since-creation** filter (`updated_at <> created_at`, i.e. the row
   has been touched at least once after it was first created).

---

## 0a. Locked sheet-name registry (single source of truth)

Implement this as **one shared constant** used by both the export writer and
the import validator — never duplicate the strings. Sheet names are fixed,
ASCII, and ≤31 chars (Excel limit); Arabic is carried in a header/title row and
column labels, not the tab name, so matching stays deterministic and RTL/
encoding-safe.

| Domain | Sheet name |
|---|---|
| Applicants | `Applicants` |
| Exams | `Exams` |
| Initial relatives | `Relatives` |
| Acquaintance documents | `AcquaintanceDocs` |
| Committees | `Committees` |
| Admission conditions | `AdmissionConditions` |
| System codes / lookups | `SystemCodes` |
| Exam results | `ExamResults` |
| Exam schedules | `ExamSchedules` |

Confirm these exact strings during Checkpoint 0 (alongside the per-domain
`business_key` / `national_id` / `applicant_code` presence audit). Once locked,
the importer rejects any workbook whose sheet names don't match the registry
(reported as an Invalid-class, file-level error, not a silent skip).

---

## 1. Authoritative references — read before writing code

Read these in order. They are the source of truth; this prompt does not
restate their rules, it binds to them.

| File | Why |
|---|---|
| `CLAUDE.md` | Frontend guardrails. Non-negotiable. |
| `docs/BACKEND_IMPLEMENTATION_CONTEXT.md` | Backend topology, .NET/EF conventions, seed rule, build order, Faculties slice pattern. |
| `docs/DB_CONSTRAINTS.md` | The 9 invariants + SQL Server expressions. **§9 = audit_entries append-only trigger** — reuse it, do not invent a new audit path. |
| `docs/INTEGRATION_HANDOFF.md` | Endpoint catalog, error-envelope shape, `emitAudit` dual-emission decision, list-actions `ImportResult` note (§12 / item 13). |
| `backend/admin/README.md` → "How to add a new endpoint — recipe" | The exact admin endpoint recipe. Follow it verbatim. |

---

## 2. Hard guardrails (do not violate)

**Frontend (from `CLAUDE.md`):**
- No `useEffect` for data fetching — TanStack Query only.
- No default exports. Named exports only; JSDoc on anything shared.
- No `any`.
- No third-party chart libraries (none needed here).
- No hardcoded hex outside `tokens.css`.
- RTL-first, logical properties only (`ps-*` / `pe-*` / `start-*` / `end-*`).
- Radix primitives only for interactive components.
- Excel via **SheetJS** (already in use).
- **Do not** promote anything to `shared/` — the 3-consumer rule is not met.

**Backend (from `BACKEND_IMPLEMENTATION_CONTEXT.md`):**
- .NET 10 / EF Core 10 / FluentValidation 11.
- **Admin backend owns ALL migrations.** Never migrate from the applicant backend.
- snake_case columns; `sealed record` DTOs; `sealed class` use cases with
  primary-constructor DI and `ExecuteAsync(..., CancellationToken ct = default)`.
- FluentValidation `AbstractValidator<TRequest>` per write endpoint.
- Concurrency: SQL Server `rowversion`; expose base64 `RowVersion` in admin DTOs.
- Error envelope `{ code, conflictCode?, errors?, message, detail? }` via the
  shared `GlobalExceptionHandler`. Use `PACademy.Shared.Contracts.ErrorCodes.*`
  constants — **add** new ones, never rename existing.
- Module DI: `AddDataExchangeAdminModule(IConfiguration)`, called once from `Program.cs`.

**Scope fence — touch ONLY:**
- `frontend/src/features/data-exchange/**` (new)
- `frontend/src/app/routes.tsx` (register one route)
- the admin sidebar config (one entry)
- `backend/admin/.../Modules/DataExchangeAdmin/**` (new)
- `backend/shared/.../ChangeTracking/**` (new shared concern, additive)
- one new admin EF migration
- `PACademy.Shared.Contracts.ErrorCodes` (append constants only)

Do **not** refactor unrelated modules, the existing list-actions stack, or
any other feature directory. No architecture proposals, no unrelated UX changes.

---

## 3. ⏸ CHECKPOINT 0 — Discovery & backend-presence gate (no code yet)

`backend/` may be `.gitkeep` only in this checkout — the .NET solution is an
external handoff that may not be physically present. **Do not write .NET code
until you have confirmed it exists.**

Do:
1. Inspect `backend/`. Report: is the admin solution present and buildable, or
   is it `.gitkeep`/absent?
2. Inventory the **exchangeable tables** for the 8 domains (applicants, exams,
   initial relatives, acquaintance documents, committees, admission conditions,
   system codes/lookups, exam results + schedules). For each, report which of
   `created_at` / `updated_at` / `row_version` / `last_modified_by` /
   `source_system` / `checksum` **already exist** (many already carry the first
   three per conventions — the migration must be additive only).
3. Read `DB_CONSTRAINTS §9` and the Faculties slice; restate the audit-append
   path and the rowversion pattern you will reuse.
4. Confirm the `business_key` you'll use per domain (e.g. applicants →
   `(national_id, cycle_id)`; lookups → `(key, code)`; etc.) and where a real
   unique constraint already enforces it.

**⏸ PAUSE.** Output the discovery report and your per-table migration plan.
If the backend is absent, propose either (a) reconcile the documented topology
to create the minimal admin slice, or (b) deliver Checkpoints 3–5 frontend-only
now and the .NET portion as an INTEGRATION CONTRACT spec. Wait for my decision.

---

## 4. ⏸ CHECKPOINT 1 — Backend: change-tracking columns + integrity

Goal: make every exchangeable row self-describing and key-unique.

1. **Shared concern** `backend/shared/.../ChangeTracking/`:
   - An EF `IChangeTracked` interface / base config adding `created_at`,
     `updated_at`, `row_version (rowversion)`, `last_modified_by`,
     `source_system`, `checksum`.
   - A `SaveChanges` interceptor (or override) that, on Added/Modified:
     - stamps `created_at` once, refreshes `updated_at = SYSUTCDATETIME()`,
     - sets `last_modified_by` from the current principal,
     - sets `source_system` (default `"appenza-admin"`, overridable by import),
     - recomputes `checksum` = stable hash of the row's **data columns only**,
       explicitly **excluding** `created_at/updated_at/row_version/
       last_modified_by/source_system/checksum`. Document the column order +
       hash algorithm so frontend/import can reproduce it deterministically.
   - `row_version` is the DB `rowversion` — never set in app code.
2. **One additive admin migration** applying the columns ONLY where the
   discovery report said they're missing. Idempotent. Per the no-duplicate-keys
   rule, ensure each domain's `business_key` has a real `UNIQUE` index/constraint
   (add where missing). Unique violations must surface as the existing
   SQL 2627/2601 → `409 CONFLICT` path.
3. Build the admin solution; apply the migration against an in-memory/local DB
   only (no throwaway rows in any live DB).

**⏸ PAUSE.** Report: migration name, exact columns added per table, new unique
constraints, the checksum spec (column order + algorithm), build result.

---

## 5. ⏸ CHECKPOINT 2 — Backend: DataExchange module + endpoints

Create `Modules/DataExchangeAdmin/` following the admin endpoint recipe.

Endpoints (admin `:5101`):
| Verb | Route |
|---|---|
| GET  | `/api/admin/data-exchange/export` |
| POST | `/api/admin/data-exchange/import/preview` |
| POST | `/api/admin/data-exchange/import/apply` |
| GET  | `/api/admin/data-exchange/history` |
| GET  | `/api/admin/data-exchange/templates/:type` |

**Export** — params: `type` (one of the 8 domains, or `all`), `layout`
(**`single-workbook` is the default** — one `.xlsx` with the §0a fixed sheet
names; `file-per-type` is secondary), and a `filter` discriminator:
- `all` — every row
- `changedAfter=<datetime>` — `updated_at >= datetime` (the "since date" path)
- `modifiedSinceCreation` — `updated_at <> created_at` (rows touched at least
  once after creation; no date input needed)
- `sinceLastExport` — rows changed since the last recorded export watermark
- `cycleId` / `categoryKey` — scoped subsets

Each sheet emits, in this order: `id, business_key, national_id?,
applicant_code?, <data fields…>, created_at, updated_at, row_version,
last_modified_by, source_system, checksum` — so `created_at` and `updated_at`
are always present on every exported row. Record the export op in `history`
so `sinceLastExport` has a watermark.

**Change-detection engine** (used by `import/preview`): for each imported row,
match by `business_key` (fallback `id`) and classify — this is the dedicated
matrix the frontend renders:

| Class | Condition | Apply behaviour |
|---|---|---|
| **New** | no matching key in DB | Insert |
| **Changed** | key matches; imported `updated_at` newer OR `row_version` higher OR `checksum` differs | Update |
| **Skipped** | key matches; `checksum` equal | No-op |
| **Outdated** | key matches; DB row is newer than imported | Do **not** overwrite unless `forceUpdate` |
| **Conflict** | key resolves to >1 DB row, or `row_version` moved under a "Changed" row mid-flight | Held; never auto-applied |
| **Invalid** | required column missing, bad type, bad national-ID format, intra-file duplicate key | Excluded from apply |

`import/preview` returns counts per class + per-row outcomes + a downloadable
validation-error payload. **Stateless / read-only** — it must not mutate.

**Apply** — body: `mode` (`new-only` | `new-and-changed`),
`skipConflicts: bool`, `forceUpdate: bool`. Commit in a transaction; intra-file
and DB key uniqueness must hold. Return per-row results (`ImportResult` shape,
aligned with the existing list-actions contract).

**Audit** — every export and apply writes one `audit_entries` row via the
existing append-only path (§9): user, action, file name, data type, total /
inserted / updated / skipped / failed counts, timestamp. Add `ErrorCodes`
constants as needed (e.g. `DATA_EXCHANGE_KEY_DUPLICATE`,
`DATA_EXCHANGE_ROW_OUTDATED`, `DATA_EXCHANGE_VERSION_CONFLICT`) — append only.

Build + verify `/scalar` and `/openapi/v1.json`. Confirm the applicant backend
is untouched (audience isolation intact).

**⏸ PAUSE.** Report endpoint shapes, the conflict codes added, and verification.

---

## 6. ⏸ CHECKPOINT 3 — Frontend: mock service + query layer

`frontend/src/features/data-exchange/`:
- `api/dataExchange.service.ts` — mock implementing every endpoint above,
  with a full **`INTEGRATION CONTRACT`** JSDoc header copying the real routes
  verbatim. Deterministic output via the **LCG seed-42** pattern. The mock must
  reproduce the **same checksum algorithm** as the backend so preview
  classification is faithful. Named exports only; no `any`.
- `api/queries.ts` — TanStack Query hooks (queries for history/templates,
  mutations for preview/apply/export). No `useEffect` fetching.
- `types.ts` — `ExchangeDomain`, `ExportLayout` (`single-workbook` |
  `file-per-type`), `ExportFilter` (`all` | `{ changedAfter: string }` |
  `modifiedSinceCreation` | `sinceLastExport` | `{ cycleId }` | `{ categoryKey }`),
  `SHEET_NAMES` (the §0a registry constant),
  `ImportRowClass` (`new|changed|skipped|outdated|conflict|invalid`),
  `ImportPreview`, `ImportApplyMode`, `DataExchangeHistoryEntry`.

**⏸ PAUSE.** Report the service surface and confirm seed-42 determinism.

---

## 7. ⏸ CHECKPOINT 4 — Frontend: page + dedicated preview

`/admin/data-exchange`, Arabic title **آليات تبادل البيانات**, RTL.
Compose from existing `AdminLayout, DataTable, FileUpload, Button, Card,
Badge, Toast` (+ Radix primitives). Four sections:

- **تصدير البيانات (Export):** domain multi-select, layout toggle defaulting to
  **single workbook (fixed §0a sheet names)** with file-per-type as the
  alternate, filter row (all / since-date / **modified-since-creation** /
  since-last-export / by-cycle / by-category), export button → SheetJS download.
  When single-workbook is chosen, sheets are written under the locked registry
  names; the title row / column headers carry the Arabic labels.
- **استيراد البيانات (Import):** `FileUpload` → calls `import/preview`.
- **معاينة الاستيراد (dedicated `DataExchangePreview`):** count chips for
  New / Changed / Skipped / **Outdated** / **Conflict** / Invalid; a filterable
  table by class; an explicit **force-update** affordance gated to Outdated rows
  (super-admin confirm); apply controls (`new-only` | `new-and-changed`,
  skip-conflicts toggle); "تنزيل أخطاء التحقق" Excel download. This is a
  purpose-built preview — do **not** reuse the list-actions `ImportPreviewTable`.
- **سجل التبادل (History):** `DataTable` of past export/import ops with the
  audit counts.

After a successful apply, optimistically `emitAudit` (matching the established
dual-emission pattern) so the audit log refreshes without a round-trip.

**⏸ PAUSE.** Screenshot/markup of the page + preview states.

---

## 8. ⏸ CHECKPOINT 5 — Wiring, verification, report

- Register the single route in `routes.tsx`; add one admin sidebar entry.
- Run typecheck, build, lint — all green, zero new `any`, zero default exports.
- Final report: files added per layer, the migration, the conflict codes, and
  an explicit confirmation that (a) creation + modification timestamps are
  stamped on every write, refreshed on every export/import, and (b) no key can
  be duplicated (intra-file + DB unique constraint + preview Conflict/Outdated
  routing). Note anything deferred in `TODO.md`.

**Stop. Final pause for review.**
