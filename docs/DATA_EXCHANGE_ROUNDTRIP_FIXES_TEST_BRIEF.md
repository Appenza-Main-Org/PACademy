# Test Brief — Data-Exchange External→Internal Round-Trip Fixes

**Date:** 2026-06-14 · **For:** QA / Testing team
**Cycle under test:** External `CYC-1779723788558` ("2027") · its internal counterpart (GUID-keyed)

## The flow being validated

```
External (cloud) admin: create cycle + applicants  →  EXPORT workbook
        →  Internal (on-prem) admin: IMPORT workbook  (seed cycle + applicants)
        →  Internal: book exams + record results
        →  Internal: EXPORT workbook   (→ optionally re-imported on the cloud)
```

Booking and exam results happen on the **internal** plane. Applicant + cycle creation happen on the **external** plane. The workbook contract (sheet names, columns, per-row keys) is owned by the cloud.

## Environments

| Plane | URL | Login |
|---|---|---|
| External (cloud) | https://admin-staging.appenzademo.com/admin/data-exchange?cycleId=CYC-1779723788558 | staff NID + mobile |
| Internal (on-prem) | `<internal data-exchange URL>` (fill in) | internal admin (System Manager) |

Download file name pattern: `data-exchange-{cycle}-{yyyyMMdd-HHmmss}.xlsx`.

---

## Fix 1 — External export now includes pre-booking applicants  *(cloud / external)*

**What was wrong:** the external export withheld every applicant who had not booked a first exam *on the cloud*. Because booking happens on the **internal** plane, the external export returned **0 applicants** — nothing to seed the internal side with. (Also affected Relatives and the export roster.)

**What changed:** the export now includes every **registered** applicant (any status past `draft`), booked or not. Only bare `draft` rows (registration begun, no submitted data) are withheld.

**Test cases**
1. On external, a cycle that has registered-but-unbooked applicants (status `personal_data_completed` / `awaiting_payment` / `fees_paid` / `awaiting_exam_booking`) → **Export** → the `Applicants` sheet **contains them** (was empty before).
2. A pure `draft` applicant → **NOT** in the export.
3. A booked applicant (`exam_scheduled`) → still in the export.
4. `Relatives` sheet contains relatives of pre-booking applicants.
5. The roster/selection panel on the export screen lists pre-booking applicants (selectable; default = all selected).
6. Import that workbook into internal → applicant count landed == count exported.

---

## Fix 2 — Internal exam committee resolves from real data  *(internal)*

**What was wrong:** `ExamReservations.committee_name` and `ExamResults.committee` were enriched only from the demo/legacy `exam_attempts` table, which is empty in production → committee came back blank for ~every row even when a committee was assigned. (Confirmed in sample: 598/604 reservations and 482/485 results blank.)

**What changed:** committee now resolves from the applicant's management record — the **same source the `Applicants` sheet uses** (`committee_name`, with category fallback).

**Test cases**
1. An internal applicant **assigned to a committee** → Export → `ExamReservations.committee_name` and `ExamResults.committee` show that committee, and it **matches** `Applicants.committee_name` for the same NID.
2. An unassigned (`Pending`) applicant → committee blank (this is correct — no committee yet).
3. Consistency check: for any given applicant, the committee value is identical across the `Applicants`, `ExamReservations`, and `ExamResults` sheets.

---

## Fix 3 — Internal payments keep the internal cycle  *(internal)*

**What was wrong:** after import, `Payments` rows kept the original **cloud** cycle slug (`CYC-…`, `cloud-cycle-x`, or blank), while applicants were correctly re-stamped to the internal cycle. On re-export the foreign cycle id leaked back out.

**What changed:** payments are re-stamped to the resolved internal cycle on import (like applicants), and the export now reads the durable ledger cycle rather than the workbook-only payload.

**Test cases**
1. Import an external workbook whose `Payments` rows carry cloud cycle slugs → internal **Export** → `Payments.cycle_id` == the **internal cycle GUID** (not `CYC-…`), matching `Applicants.cycle_id`.
2. Re-import the internal export → payments stay scoped to the internal cycle (no drift across round trips).

---

## Core scenario — exams + results round-trip (the main test)

1. **External:** create cycle + applicants (include some registered-but-unbooked) → Export **workbook A**.
2. **Internal:** import A → confirm every applicant + cycle setting landed (count + spot-check fields).
3. **Internal:** book exams and record results (cover all outcomes: passed / failed / in-progress / withdrawn) for several applicants.
4. **Internal:** Export **workbook B**.
5. **Verify B:**
   - `ExamReservations` has rows for booked applicants; `reservation_status` = «محجوز».
   - `ExamResults` outcomes are correct; `committee` populated for assigned applicants (Fix 2).
   - `result_id` = `{national_id}:{TST-xx}`, **unique** (no duplicate keys).
   - `Payments.cycle_id` = internal cycle (Fix 3).
6. **Idempotency:** re-import B → no duplicate `applicant_tests` / `applicant_tests_results` rows; changed results **update** (do not duplicate); unchanged rows are skipped.

---

## Not yet changed — exclude from "fixed" testing, log as known gaps

- **GeneralSettings does not round-trip.** The external `GeneralSettings` sheet (exam-day count, booking-window days, acquaintance-doc open/close timing) is still **not imported** by internal (no internal settings table) and the internal export emits it **empty**. *Pending:* requires a new internal table + migration — awaiting go-ahead.
- **Applicant columns 23 vs 41.** External exports 23 applicant columns; internal stores/exports 41. The 18 extra fields (file_number, phones, social, religion, residence, secondary details, …) will **not** seed from external. Deferred (those fields are ~empty in practice).

---

## Status of each fix

| Fix | Plane | Code | Automated test |
|---|---|---|---|
| 1 — pre-booking applicants export | cloud | ✅ done | ✅ unit tests pass (68/68 data-exchange) |
| 2 — committee from real source | internal | ✅ done (compiles) | ⏳ needs Docker round-trip suite — validate manually per above |
| 3 — payment cycle re-stamp | internal | ✅ done (compiles) | ⏳ needs Docker round-trip suite — validate manually per above |
| GeneralSettings round-trip | internal | ⛔ pending decision (new table) | — |
| 23→41 column parity | cloud | ⏸ deferred | — |
