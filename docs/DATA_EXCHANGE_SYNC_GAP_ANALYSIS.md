# Data Exchange — External ↔ Internal Synchronization Gap Analysis & Design

> **Status:** Review complete · 2026-06-15
> **Scope:** Bidirectional Excel package sync between the **External Admin** (cloud, this repo) and the **Internal Admin** (`PACademy.Internal`, operational processing).
> **Method:** Source-traced both codebases. Citations are `file:line`. No code changed — this is an implementation-ready analysis.

External repo: `/Users/mohamedghareeb/Projects/PACademy/PACademy`
Internal repo: `/Users/mohamedghareeb/Projects/PACademy.Internal/PACademy.Internal`

---

## 0. Executive summary

The round-trip is **real but narrow**. Both systems share a curated-snapshot Excel contract over the **same 11 sheets**, and both can export and import them. The forward path (External → Internal, Phases 1–3) is **substantially complete**: the Internal system can rebuild a cycle's applicant population, exam plan, schedules, committees, conditions, and lookups, then operate on them (schedule, attendance, results).

The **return path (Phases 4–5) is the bottleneck**, and it breaks on exactly the data the return sync exists to carry:

1. **The External side only accepts 3 writable sheets on a return workbook** — `Applicants`, `ExamReservations`, `ExamResults`. Everything else is silently skipped (External `DataExchangeService.cs` `ReturnWorkbookWritableDomains`, ~line 55–61; skip gate ~1005–1009).
2. **The producing side (Internal) never exports medical results, committee decisions, or admission decisions** — there is no sheet, loader, or source query for them in `DataExchangeSnapshotService`. The Medical module exists but has **zero** data-exchange wiring.
3. **Applicant final status / admission decision has no dedicated sheet** — it rides as a single `status` string on the `Applicants` sheet, so a board/medical outcome cannot be expressed as its own auditable record.

**Net:** examination results round-trip; **medical clearance, committee decisions, and final admission decisions do not.** That is the headline gap for the business workflow ("Produces final admission outcomes" → "External reflects final admission decisions").

Secondary gaps: no dedicated Cycle / Categories / Specializations / Committees / Documents / Barcode / Biometric sheets in the curated export; cycle metadata is reconstructed only as a side-effect of `AdmissionConditions` / `ApplicationSettings`.

Audit trail is **good on both sides** (export/import/reconcile rows with actor, counts, watermark, history endpoint).

---

## 1. Systems & architecture (as built)

| | External Admin (cloud) | Internal Admin (operational) |
|---|---|---|
| Repo path | `PACademy/PACademy` | `PACademy.Internal/PACademy.Internal` |
| Backend style | Module-in-API (`Modules/DataExchangeAdmin/`) | Clean Arch + modules (`Api/Modules/DataExchange/`, `Application`, `Domain`, `Contracts`, `Infrastructure`) |
| Export service | `DataExchangeService.cs` (`CuratedSheets`, ~2906–2961) | `Export/DataExchangeSnapshotService.cs` (`CuratedSheets`, ~75–127) |
| Import service | `DataExchangeService.cs` (`PreviewAsync` ~782, `ApplyAsync` ~990) | `DataExchangeImportService.cs` (`PreviewAsync` ~170, `ApplyAsync` ~203) |
| Excel engine | Frontend SheetJS (`xlsx`) — `frontend/.../lib/workbook.ts` | Frontend SheetJS (`xlsx` 0.18.5); backend has **ClosedXML 0.104.2 installed but unused** (`PACademy.Infrastructure.csproj:25`) |
| Storage model | Normalized operational tables + `AdminRecords` JSON for doc-shaped buckets | EF tables + `applicant_management_records` (per-module JSON payloads) |
| Audit | `audit_rows` via `EmitAuditAsync` (~2856–2860); history `GET /history` | `DataExchangeLog` aggregate; history `GET /admin/data-exchange/history` |

**Key architectural fact:** the Excel **contract is owned by the cloud (External) side**, and the Internal side mirrors it (per the internal-data-exchange-port memory). Both `CuratedSheets` registries describe the same 11 sheets with the same columns and stable-id strategy — this is what makes the round-trip possible at all.

---

## 2. The shared sheet contract (11 curated sheets)

Both sides export/parse these. Columns and stable ids match by design.

| Sheet | Stable id | Scope | Parent link |
|---|---|---|---|
| `Applicants` | `applicant_id`, `national_id` | cycle + person | — (root) |
| `Relatives` | `relative_id` (`{nid}:{seq}`) | cycle + person | `applicant_id` → Applicants |
| `Exams` | `exam_id` | cycle | — (config) |
| `ExamSchedules` | `slot_id` | cycle | `exam_id` → Exams |
| `ExamReservations` | `applicant_national_id` + `exam_id` | cycle + person | NID → Applicants, `slot_id`/`exam_id` |
| `ExamResults` | `result_id` (`{nid}:{exam_code}`) | cycle + person | NID + `exam_id` |
| `AcquaintanceDocs` | `record_id`, `applicant_national_id` | cycle + person | NID → Applicants |
| `AdmissionConditions` | `condition_id` (per grad-year fanout) | cycle | category/spec → lookups |
| `LookupRows` | `lookup_row_id` (`{key}:{code}`) | system | — (reference) |
| `GeneralSettings` | `settings_id` | system | — |
| `Payments` | `payment_id` (`PAY-{fawry_ref}`) | cycle + person | `national_id` → Applicants |

Internal export adds two **internal-only opt-in** sheets: `CivilStatus` (`civil_status`) and `DeletedTests` (`applicant_deleted_tests`) — these flow Internal → External as enrichment/audit, not part of the forward contract.

**Dropped from curated export, still importable for old workbooks (both sides):** `Committees`, `ApplicantCategories`, `Faculties`, `Notifications`, `WorkflowRecords`, `AuditEntries`, `SystemCodes` (External `DataExchangeService.cs:2901–2905`, `DataExchangeContracts.cs:90–101`).

---

## 3. Deliverable 1 — Gap Analysis Matrix

Priority: **P0** = blocks the stated business round-trip; **P1** = correctness/integrity risk; **P2** = completeness/nice-to-have.

| # | Area | Current implementation | Required behavior | Gap | Pri | Files impacted |
|---|---|---|---|---|---|---|
| G1 | **Return-import allow-list** | External accepts only `Applicants`, `ExamReservations`, `ExamResults` as writable on a return workbook; all else skipped (`ReturnWorkbookWritableDomains` ~55–61, gate ~1005–1009) | Return must also apply medical results, committee decisions, admission decisions, status transitions | Final-outcome data cannot be written back | **P0** | Ext `DataExchangeService.cs` |
| G2 | **Medical results sheet** | No `MedicalResults` sheet on either side; Internal Medical module not wired to DataExchange (Internal export agent: "zero DataExchange integration") | A `MedicalResults` sheet exported by Internal, imported by External | Entire entity missing from contract | **P0** | Both: `CuratedSheets`, snapshot loaders, import builders, `types.ts` |
| G3 | **Committee / admission decisions sheet** | None. `AdmissionConditions` is *rules*, not per-applicant decisions. `condition_status` hardcoded "معتمد" (Internal snapshot ~977). Internal has no decision-writing endpoint (Phase-3 agent: "MISSING") | A `Decisions` (or `AdmissionDecisions`) sheet: per-applicant committee/board/final decision with id, outcome, reason, decided_by, decided_at | Entire entity missing | **P0** | Both backends + frontend |
| G4 | **Applicant status as first-class record** | Status is one `status` column on `Applicants`; no transition history, no source attribution | Status changes need their own auditable rows (or at least be writable on return) | Status changes don't round-trip with provenance | **P0** | Both: Applicants writeback / new sheet |
| G5 | **Cycle metadata sheet** | No `Cycle` sheet. Cycle name/dates reconstructed only as side-effect of `AdmissionConditions`/`ApplicationSettings` (Internal `EnsureCycleFromApplicationSettingsAsync` ~289) | Dedicated `Cycle` sheet (id, name, year, status, windows) for clean reconstruction | Cycle identity is implicit; fragile multi-cycle handling | **P1** | Both |
| G6 | **Categories / Specializations sheets** | Only as `category`/`specialization` codes inside other sheets + `LookupRows`. No dedicated sheets; Internal import requires categories to pre-exist or arrive via `SystemCodes` (Phase-2 agent) | Dedicated `Categories` + `Specializations` sheets so a blank Internal DB can rebuild FKs deterministically | Cross-import ordering dependency; FK fragility on full rebuild | **P1** | Both |
| G7 | **Uploaded documents** | Not exported by either (only `AcquaintanceDocs` form data) | Document references/metadata (and a file-transfer channel) | Documents never sync | **P1** | Both + storage/file channel |
| G8 | **Barcode** | Not exported. External generates permanent barcode at payment (`PortalService` / `AddBarcodeSequences`). Internal only scans at attendance | Barcode value on `Applicants` (or `Barcode` sheet) so Internal attendance scans the real code, not NID fallback | Internal demotes to national_id fallback at check-in (Internal `AdminAttendanceController` ~37–46) | **P1** | Ext export, Int import |
| G9 | **Biometric references** | Not exported by either | Biometric template/reference id sync (if Internal does biometric verify) | Missing | **P2** | Both |
| G10 | **Committees as curated sheet** | Dropped from curated export (importable legacy). Internal re-derives committee names via `ExamSchedules` | Re-include `Committees` in curated export so committee identity/capacity round-trips explicitly | Committee identity is implicit via schedules | **P2** | Both |
| G11 | **Workflow config** | Dropped from export; Internal has no workflow-config import (Phase-2 agent: "NOT SUPPORTED") | If workflow config must mirror, add sheet; else document as out-of-scope (on-prem owns workflow) | Decide scope | **P2** | Both / docs |
| G12 | **Optimistic-concurrency / stale-update guard on return** | External import uses row checksum + `rowVersion`/timestamp "Outdated" class (~868–879). Internal upsert is UPDATE-else-INSERT by business key, **no version compare** noted | Both sides reject/flag stale writes (version or updated_at compare) so a late return doesn't clobber newer local edits | Internal side lacks explicit stale-write guard | **P1** | Int `DataExchangeImportService.cs` |
| G13 | **GeneralSettings round-trip** | External exports it; Internal exports it as **empty/header-only** (Internal snapshot ~305) and import **ignores** it (`ignored sheets` ~78–86) | Decide: sync or formally exclude. Currently silently half-wired | Silent no-op; confusing | **P2** | Both |
| G14 | **Reconciliation symmetry** | External has rich applicant reconciliation (preview/commit, field-diff, writeback). Internal import is straight upsert (no operator reconciliation UI noted) | Internal should offer the same preview/conflict UI on inbound packages for trust | Asymmetric operator control | **P1** | Int frontend + service |

---

## 4. Deliverable 2 — Missing Entities Matrix

Legend: ✔ present · ✖ absent · ◐ partial.

| Entity | Ext export | Ext import (return) | Int import (forward) | Int export (return) | Round-trips? | Verdict |
|---|---|---|---|---|---|---|
| Applicants (core) | ✔ | ✔ | ✔ | ✔ | ✔ | **OK** |
| Personal/contact/address | ✔ (on Applicants) | ✔ | ✔ (mgmt records) | ✔ | ✔ | OK |
| Relatives / family | ✔ | ◐ (skipped on return) | ✔ | ✔ | ◐ | **Forward only** |
| Qualifications / education | ✔ (on Applicants) | ✔ | ✔ | ✔ | ✔ | OK |
| Grades | ◐ (grade/% on Applicants) | ◐ | ◐ (mgmt `results`, not `applicant_grades`) | ◐ | ◐ | Partial — no dedicated grades sheet |
| Exams / exam plan / order | ✔ | ✖ (read-only return) | ✔ | ✔ | forward | Config: forward-only by design |
| Exam schedules | ✔ | ✖ return | ✔ | ✔ | forward | Config: forward-only by design |
| Exam reservations | ✔ | ✔ | ✔ | ✔ | ✔ | **OK** (the working return delta) |
| Exam results | ✔ | ✔ | ✔ | ✔ | ✔ | **OK** (the working return delta) |
| Acquaintance docs | ✔ | ✖ return-skip | ✔ | ✔ | forward | Return-skip; revisit if Internal edits |
| Admission conditions | ✔ | ✖ return-skip | ✔ | ✔ | forward | Config: forward-only by design |
| Lookups / reference | ✔ | ✖ return read-only | ✔ | ✔ | forward | Config: forward-only by design |
| Payments | ✔ | ✖ return read-only | ✔ | ✔ | forward | Forward-only |
| **Medical results** | ✖ | ✖ | ✖ | ✖ | ✖ | **MISSING entirely** (G2) |
| **Committee decisions** | ✖ | ✖ | ✖ | ✖ | ✖ | **MISSING entirely** (G3) |
| **Admission decision (final)** | ✖ | ✖ | ◐ (read-only field) | ✖ | ✖ | **MISSING** (G3/G4) |
| **Applicant status (as record)** | ◐ (string) | ◐ | ◐ | ◐ | ◐ | **Partial** (G4) |
| Uploaded documents | ✖ | ✖ | ✖ | ✖ | ✖ | MISSING (G7) |
| Barcode | ✖ | — | ✖ | ◐ (DeletedTests aside) | ✖ | MISSING (G8) |
| Biometric | ✖ | ✖ | ✖ | ✖ | ✖ | MISSING (G9) |
| Cycle metadata | ✖ (implicit) | — | ◐ (side-effect) | ✖ | ◐ | Implicit only (G5) |
| Categories / specializations | ◐ (codes/lookups) | ✖ | ◐ (must pre-exist) | ◐ | ◐ | No dedicated sheet (G6) |
| Civil status / civil registry | — | — | ✔ (Internal-only) | ✔ (opt-in) | Int→Ext | Internal enrichment |
| Deleted tests | — | — | — | ✔ (opt-in) | Int→Ext | Internal audit |

**Exists only in External:** barcode generation, biometric refs, uploaded documents (source), payments ledger origin.
**Exists only in Internal:** civil status / civil registry, deleted-tests audit, attendance records, committee-decision *capability gap* (data slot exists but no producer).
**Exported but not importable (return):** Relatives, AcquaintanceDocs, Exams, Schedules, Conditions, Lookups, Payments (all read-only on External return).
**Imported but never exported:** Medical/Decisions — *neither* (both missing on both sides).

---

## 5. Deliverable 3 — Implementation plan

Sequenced by priority. Reuse the existing curated-sheet + plan/builder + reconciliation machinery; do **not** redesign.

### Phase A — Close the outcome return loop (P0, unblocks the business workflow)

**A1. `MedicalResults` sheet (G2)**
- **Excel schema:** `medical_result_id, applicant_national_id, applicant_id, station, exam_date, outcome, score, notes, decided_by, decided_at, cycle_id`. Stable id `{nid}:{station}` or station UUID.
- **Backend (Internal export):** add a `CuratedSheets` entry + loader in `Export/DataExchangeSnapshotService.cs` reading the Medical module tables (person-scoped, cycle-scoped, supports `ChangedAfter`).
- **Backend (External import):** add domain to `DataExchangeContracts.cs` registry; add to `ReturnWorkbookWritableDomains`; add an `UpsertMedicalResultAsync` dispatch in `DataExchangeService.cs` mirroring `ApplyExamResultFollowUpAsync`. Resolve applicant by NID.
- **Frontend (both):** add to `EXPORT_DOMAINS` / `SHEET_NAMES` in `types.ts`; surface in reconciliation preview.

**A2. `Decisions` sheet (G3)** — committee + board + final admission decisions
- **Excel schema:** `decision_id, applicant_national_id, applicant_id, decision_type (committee|board|medical|final), outcome, reason, committee, decided_by, decided_at, cycle_id`.
- **Internal side:** first build a decision-writing surface (Phase-3 audit found this "MISSING"). Persist decisions, then add the export loader.
- **External side:** add writable domain + `UpsertDecisionAsync`; map `final` outcome onto the applicant's `status` and `applicantFlowStatus` (respect existing milestone taxonomy).

**A3. Status writeback on return (G4)**
- Add `status` (+ `applicant_flow_status`, `status_changed_at`, `status_source`) to the **writable** field set for `Applicants` on return import (today only field-diffs in `EditableApplicantFields` are merged).
- Drive admin status from incoming `Decisions`/`MedicalResults` rather than free-typed strings where possible.

**A4. Remove the silent return skip for outcome sheets (G1)**
- Extend `ReturnWorkbookWritableDomains` to include the new outcome domains. Keep config sheets (Exams/Schedules/Conditions/Lookups/Payments) read-only on return **by design** (External owns config) — but **surface a skipped-count notice** instead of silent skip.

### Phase B — Deterministic full-cycle rebuild (P1)

**B1. `Cycle` sheet (G5):** id, name, year, status, application windows. External export loader + Internal import that creates/updates the cycle by stable id (not just by name).
**B2. `Categories` + `Specializations` sheets (G6):** explicit FK parents so a blank Internal DB rebuilds without cross-sheet ordering luck. Import these **before** Applicants/Exams in the plan dispatcher.
**B3. Re-include `Committees` in curated export (G10):** committee id, name (carries gender per existing convention), category, capacity.

### Phase C — Integrity & trust (P1)

**C1. Stale-write guard on Internal import (G12):** compare incoming `updated_at`/`row_version` against local; classify as `Outdated` and require operator override — mirror External's existing "Outdated" class (~868–879).
**C2. Internal inbound reconciliation UI (G14):** reuse the External `ApplicantReconciliationTable` pattern for the Internal import preview so operators see diffs/conflicts before apply.
**C3. Resolve `GeneralSettings` (G13):** either wire Internal export to emit real rows + import to apply, or formally drop it from the contract and document it.

### Phase D — Completeness (P2)

**D1. Documents (G7):** add a `Documents` sheet of metadata + a separate binary transfer channel (Excel can't carry blobs). Likely a side packaging step, not an Excel sheet alone.
**D2. Barcode (G8):** add `barcode` column to `Applicants` export so Internal attendance scans the real value.
**D3. Biometric (G9), Workflow (G11):** decide scope; likely out-of-band (on-prem owns these) — document the decision either way.

### Cross-cutting: validation, reconciliation, audit

- **Validation:** extend the existing preview classifier (structural/column/type/FK/duplicate/outdated) to the new sheets. Reuse the FK-resolution-against-same-file pattern (Internal ~1414–1422). Honor the existing **reservation import gate** (first-planned exam needs a committee instance; later stages key on `appointment_date`) — see reservation-import-gate memory; apply the same two-site enforcement to any new appointment-bearing sheet.
- **Reconciliation:** extend `ApplicantReconciliationPreview` counts/rows to include medical/decision writebacks (mirror the existing `withWriteback` flow).
- **Audit:** already records action/actor/cycle/counts/timestamp + history on both sides. Add per-sheet counts for the new domains; surface `skipped` reasons in the history detail.

---

## 6. Deliverable 4 — Round-trip synchronization design

**Record matching strategy (keep current, extend):**
- **Applicant** = `national_id` (14-digit, validated) — universal join key for all child records.
- **Composite business keys** for children: `ExamReservations` = `nid|exam_id`; `ExamResults` = `nid:exam_code`; new `MedicalResults` = `nid:station`; new `Decisions` = `nid:decision_type` (or stable UUID).
- **Config/reference** by their own stable ids: `slot_id`, `exam_id`, `condition_id`, `lookup_row_id`, `cycle_id`, `category`, `specialization`.

**Stable identifiers:** every row already carries a stable id and `created_at`/`updated_at`. Internal preserves the **upstream `applicant_id`** when re-exporting (Internal snapshot ~529) so deltas map back to the original External record. Keep this discipline for all new sheets.

**Update rules:** UPDATE-else-INSERT by business key (idempotent). Re-importing an unchanged row (identical `RowChecksum`) is a no-op (External ~840–847; Internal ~2099–2101).

**Insert rules:** new business key + (on return) domain in the writable allow-list ⇒ insert. Config sheets on return: read-only (External owns config).

**Conflict resolution:**
- *Within file:* duplicate business key ⇒ row marked invalid (External ~832; Internal ~2080–2083).
- *Against DB:* >1 match ⇒ `Conflict` class, operator decides.
- *Stale:* newer local `updated_at`/version ⇒ `Outdated` class, require override (extend to Internal — G12).

**Duplicate prevention:** business-key dedup per import + checksum skip + applicant-level dedup for draft-only payments (External ~4026–4096). No deletes on import (soft-delete only) ⇒ safe reruns.

**Directionality contract (make explicit in code + docs):**

| Direction | Writable sheets | Read-only sheets |
|---|---|---|
| **Forward** (Ext→Int) | all (full cycle rebuild) | — |
| **Return** (Int→Ext) | Applicants(+status), ExamReservations, ExamResults, **MedicalResults, Decisions** *(new)* | Exams, ExamSchedules, AdmissionConditions, LookupRows, Payments, Cycle, Categories (External owns config) |

---

## 7. Deliverable 5 — Acceptance criteria

The synchronization is complete when:

1. **Export (Ext):** a selected cycle produces a curated workbook with all forward sheets, stable ids, preserved parent-child links, cycle-scoped, unique filename + watermark. *(Today: ✔ for 11 sheets; add Cycle/Categories/Specializations/Committees/MedicalResults/Decisions.)*
2. **Import (Int):** the package validates (structure/columns/types/FK/duplicate/stale) and rebuilds the full cycle — config + applicants + children — on a blank DB without cross-sheet ordering luck. *(Today: ◐ — works but categories/cycle are side-effects; add G5/G6 + stale guard.)*
3. **Process (Int):** edit applicants, schedule exams, assign dates/locations/committees, record attendance, record exam results, **record medical results, record committee/board decisions, set final admission decision**. *(Today: exams ✔; medical/decisions MISSING — build in Phase A.)*
4. **Export updates (Int):** a return workbook carries updated applicants+status, reservations, results, **medical results, decisions**, with stable ids preserved for delta mapping. *(Today: ◐ — reservations/results ✔; medical/decisions MISSING.)*
5. **Import updates (Ext):** the return workbook updates the matching records by stable id, applies outcome/status/decision writeback, prevents duplicates, preserves references, and **flags stale/conflicting rows** for operator resolution. *(Today: ◐ — only 3 writable sheets; widen allow-list + add reconciliation for new domains.)*
6. **Integrity:** no duplicate records; no data loss; all relationships intact across repeated and incremental exchanges in the same cycle.
7. **Audit:** every export/import/reconcile on both sides records actor, cycle, action, per-sheet counts, validation failures, and timestamp, queryable via history. *(Today: ✔ — extend counts to new sheets.)*

---

## 8. What is already done vs. what to build (quick reference)

**Already implemented (reuse, don't rebuild):**
- 11-sheet curated contract, both directions, with stable ids + checksums + watermark + unique filenames.
- Forward full-ish cycle rebuild (applicants, exams, schedules, committees, conditions, lookups, payments, acquaintance docs).
- Exam reservation + exam result return round-trip (the proven delta path).
- Reconciliation (External, applicant-level: preview/commit, field-diff, writeback).
- Reservation import gate (committee-instance for first exam, date-keyed for later stages).
- Audit + history on both sides; delta filters (`ChangedAfter`, `SinceLastExport`).

**Must build (in priority order):**
- **P0:** MedicalResults sheet + Decisions sheet (incl. Internal decision-writing surface) + status writeback + widen return allow-list (G1–G4).
- **P1:** Cycle/Categories/Specializations sheets, Internal stale-write guard, Internal inbound reconciliation UI, GeneralSettings decision (G5, G6, G12, G14, G13).
- **P2:** Documents channel, Barcode column, Biometric/Workflow scope decision, re-include Committees in curated export (G7–G11).

---

*Citations throughout reference the External `Modules/DataExchangeAdmin/DataExchangeService.cs` & `DataExchangeContracts.cs`, and the Internal `Api/Modules/DataExchange/DataExchangeImportService.cs` & `Export/DataExchangeSnapshotService.cs`. Line numbers are approximate to the 2026-06-15 working tree.*
