# PACademy BRD Gap Analysis — Consolidated Report

**Prepared:** 2026-05-29
**Scope:** BRD Sections 3 (Admin), 4 (Applicant), 5 (Biometric), 6 (Exams), plus Section 7 global requirements (audit, export, data exchange).
**Method:** 4 per-area analyst agents audited backend (.NET/EF Core) and frontend (React/TS) against the BRD; every claimed gap was adversarially re-verified against the actual code before inclusion.

---

## 1. Executive Summary

PACademy is roughly **45–55% complete against the BRD**, but that headline average hides a sharp split: the system is bimodal. Two of the four areas have genuine, persistent .NET backends wired to polished React frontends; the other two are largely or entirely frontend illusions backed by in-browser mocks.

**Strong areas:**
- **Admin (Section 3) — ~65%.** The most mature module. Real EF Core backend with migrations, a durable audit trail, working administrator/role management, admission-cycle config, a versioned eligibility rules engine, 25-type reference-data management, and real reporting aggregations. Several capabilities first flagged as gaps turned out to be *built* (NID-lookup autofill on admin creation, exam-stage responsibility config, payment monitoring, client-side .xlsx export, exam-results/committee import) — corrected during verification.
- **Exams (Section 6) — ~55%.** The most complete *backend* of the internal apps: normalized question/exam tables, bulk import (real XLSX), exam build/publish, attempt start/submit with server-side auto-scoring, and a 6-month conflict guard all genuinely persist.

**Weak areas:**
- **Applicant (Section 4) — ~45%.** A convincing end-to-end wizard, but the security- and integrity-critical gates are fake: OTP is hardcoded to `123456`, payment auto-succeeds after 30 seconds with hash-generated Fawry codes, educational verification is a one-line stub, and the acquaintance document persists only to `sessionStorage`. Applicant-side audit trail is entirely absent.
- **Biometric (Section 5) — ~5–10% (frontend only).** No backend exists at all — no module, controller, entity, migration, or endpoint. Every capability runs on in-memory mock arrays with `Math.random()` match scores. The only backend trace of "biometric" is an RBAC permission string.

**Biggest risks (in priority order):**
1. **Authentication is bypassable.** Applicant OTP is a hardcoded constant over a passwordless NID+mobile lookup; anyone with a valid NID/mobile pair can log in.
2. **No money is actually collected.** The entire payment flow is a 30-second auto-success simulation. Applicants advance through the admissions gate having paid nothing.
3. **No real identity/eligibility/credential verification on the applicant path.** Educational verification is a stub; the page-level eligibility recap is a client-side NID-hash mock (though category gating *does* hit the real backend engine upstream).
4. **Biometric is vaporware against the BRD.** An entire BRD section has zero server implementation; biometric templates, verification logs, and gate entry/exit are unpersisted.
5. **Compliance gaps in a government system.** Applicant and biometric actions are unaudited; "PDF/Word export" across the platform is HTML files renamed `.pdf`/`.doc`.
6. **No National Verification Platform integration.** The defining admin auth/sync requirement is faked against a local directory seeded with one bootstrap admin.

---

## 2. Coverage Table

| Area | Implemented (real backend + frontend) | Open Gaps | Rough Completion |
|------|----------------------------------------|-----------|------------------|
| **Admin (Sec 3)** | Admin/role mgmt, cycles, eligibility engine, per-category config, 25 lookups, inquiry, audit trail, real report aggregations, NID-autofill admin create, payment monitoring, grades & committee/exam-results import | National Verification Platform integration; 8-category model (only 4); real PDF/Word export; full data-exchange module; barcode inquiry; independent acquaintance-doc CRUD flags | **~65%** |
| **Applicant (Sec 4)** | Auth (NID+mobile/JWT), MOI-prefill, personal/family/relatives data, exam-slot reservation, results follow-up; real backend eligibility category-gating upstream | Real OTP/SMS; real payment gateway; educational verification; server-generated admission card PDF; acquaintance-doc persistence + issuance; applicant audit trail; PDF/Excel/Word export; true MOI re-auth | **~45%** |
| **Biometric (Sec 5)** | *(nothing — frontend mocks only)* | Entire backend: search, fingerprint/face enrollment, verification matching, security-gate logs, verification history, reports, audit, real export | **~5–10%** |
| **Exams (Sec 6)** | Question CRUD + bulk import, exam build/publish, attempt start/submit + auto-scoring, 6-month conflict guard; attempt events do hit the generic audit table | Committee-user/device mgmt; pre-exam access validation; results approve/publish workflow; live proctor telemetry; exam report queries; dedicated exam audit + retrieval route; real PDF/Word export | **~55%** |

---

## 3. Per-Area Breakdown

### 3.1 Admin (BRD Section 3)

**What's built (real backend + frontend):** Administrator CRUD with bulk import/assign and activity logging; role/permission management with soft-delete and dependency checks; admission-cycle lifecycle with single-active enforcement; a versioned per-cycle eligibility rules engine (age/gender/stage/grades); per-category configuration via a multi-step wizard; 25-type reference-data management with referential-integrity guards; applicant inquiry by name/NID with timeline; a durable `AuditRows` audit trail with filters/diff/CSV; real EF-backed report aggregations (aggregate/detail/stage-dropoff/funnel); committee/workflow/exam-schedule operational control; and a working grades import/export pipeline. Verification confirmed NID-lookup-on-create, exam-stage responsibility config, educational-data override, and a full payments ledger were genuinely built (originally mis-flagged as gaps).

| Requirement | Status | Current State | Implementation Approach | Impact | Effort |
|---|---|---|---|---|---|
| National Verification Platform integration (BRD 1.1.1 / 3, 1.1.2.A) | Missing (real external API) | NID-retrieve-and-autofill admin-create flow IS built end-to-end via `GET /v1/officers/lookup`, but against a **local** `Officers` table seeded with one bootstrap admin — not the external platform. No HttpClient/external client exists in the admin backend. | Add shared `INationalVerificationClient` (typed contract + config-driven HttpClient adapter + noop stub), wire into `AuthController` login and `UsersService.CreateAsync`; add `POST /api/users/{id}/sync`. The autofill UX already exists — only the data source needs swapping. | Auth security model; external gov't API dependency (spec/credentials). No new tables required. | L |
| 8 admission categories with create capability (BRD 1.1.2.B) | Partial | `CategoriesService` hardcodes 4 `SpecKeys`; no create endpoint; Update/SoftDelete 404 outside the 4. Masters, PhD, Special Section, Female, Sports absent. The 4-category reduction was an *intentional* RFP scope cut that contradicts the BRD. | Extend seeded categories to 8 (or consolidate onto the lookup that already has full CRUD), add `POST /api/admin/categories`, drop the allowlist, add gender/degree-based eligibility handling, restore the add-category UI. | Migration; ripples into cycle category mapping, eligibility resolution, and report grouping (4 hardcoded Arabic labels). | M |
| Real PDF/Excel/Word report export (BRD 1.1.4 / Sec 7) | Partial | **Excel is real** on the normal path: frontend `ReportsExportButtons` uses SheetJS for valid `.xlsx` (≤5000 rows). The backend handler and the >5000-row fallback emit HTML renamed `.xls`/`.doc`/`.html` — **PDF and Word remain fake** in both layers. | Add QuestPDF (PDF) and OpenXML/DocX (Word); replace `HtmlTable()` stubs with format-specific writers + correct MIME types; handle RTL/Arabic fonts. | New NuGet deps; localized to reports/audit export path. | M |
| Data Exchange module (BRD 1.1.5) | Partial | No dedicated data-exchange controller. **Working:** exam-results import (`bulk-upload`), committee import, Al-Azhar grades (school-kind "azhar"). **Absent:** bulk export of applicants/colleges/categories/system-codes, and a unified module. | Create `DataExchangeController` + service with per-entity export (reusing the new Office libs) and import endpoints reusing the proven staged-import/preflight/commit pattern from `GradesController`. | Largest net-new admin surface; reuses existing import infra. | L |
| Inquiry by Barcode (BRD 1.1.3) | Partial | `ApplicantsController` supports name + NID but no barcode lookup; applicant records carry no barcode field. The only barcode lookup is a frontend mock. | Add `GET /api/applicants/by-barcode`; persist/resolve the barcode→applicant mapping; add a barcode field to the inquiry UI. | Small endpoint + query + minor UI. | S |
| Independent acquaintance-doc insert/edit/delete flags (BRD 1.1.2.D) | Partial | Three of four 1.1.2.D sub-requirements are fully built (educational override, exam-stage responsibility, payment monitoring). Only the acquaintance-doc capability is thin — a single combined `mutationLockTiming` control instead of three independent toggles. | Add three independent enable flags + endpoints under the existing settings singleton; surface as toggles in the admin settings card. | Narrow; reuses settings infra. | S |

> **Verification note:** the "reports return mock numbers" concern is real but narrow — core statistical aggregation (by committee/specialization/category/gender, paid/unpaid, dropoff) **is** computed from real data. Only the command-center dashboards (test pass rates, operational queues, governorate heatmap, prev-cycle comparisons, integration health) return synthetic values. This is a cosmetic/dashboard gap, deprioritized accordingly.

### 3.2 Applicant (BRD Section 4 + Section 7 globals)

**What's built (real backend + frontend):** Applicant auth via NID+mobile with JWT and MOI-backed auto-provisioning; MOI identity prefill for personal data; family and relatives data entry persisted to `PortalRecords`; exam-slot reservation with real capacity check/decrement; results follow-up across pipeline stages. The admin-side eligibility engine is real and **is** invoked from the applicant portal for category gating and ineligible-redirect (via `useEligibleCategories`).

| Requirement | Status | Current State | Implementation Approach | Impact | Effort |
|---|---|---|---|---|---|
| Real OTP / SMS verification | Partial (stub facade) | `auth/verify` hardcodes OTP to `123456`; frontend auto-submits it. No SMS provider, no random code, no rate limiting. Real auth is a passwordless NID+mobile lookup. | Generate random OTP on initiate, store in cache/table with expiry, send via SMS gateway, verify with throttling; remove `123456` on both ends. | Security-sensitive; SMS integration + code storage. | M |
| Real payment gateway (Fawry/Paymob) | Partial (fully mocked) | `GenerateFawryCode` uses `applicantId.GetHashCode()`; status auto-flips pending→success after 30s ("demo mode"). No gateway, webhook, receipt, or charged amount. | Integrate a real PSP: provider client + config, intent/code generation, secure webhook to mark paid, real receipt entity, idempotency, status reconciliation. | No money collected today; new integration, webhook, secrets, likely a Payment table. | L |
| Educational data verification | Partial (stub) | `POST /applicant/verify-certificate` returns `match=false` only when seat ends in `0`. The real grades read (`FindGradeByNidReadUseCase`) exists but is admin-namespaced and not called here. | Inject the grades read into the portal controller, compare submitted seat/score/qualification against the stored row, return real match + mismatches, persist a verification flag. | Controller glue + comparison; module already present in the applicant API. | M |
| Acquaintance document (وثيقة تعارف) persistence + issuance | Frontend-only | Rich 35-page form persists ONLY to `sessionStorage`; 24h lock lives in the client store; backend endpoint just echoes the draft. No server document, no authoritative record. | Add a backend entity/endpoint (`PUT .../acquaintance-doc/:id`) with server-enforced `submittedAt` + 24h lock; add server-side PDF/Word generation; replace sessionStorage with the backend API. | Session loss wipes the entire document; large document model. | XL |
| Admission card (downloadable) | Partial | Client-rendered card with Code128 barcode + `window.print()`. Backend endpoint returns only draft JSON. No server PDF, no signed/verifiable artifact. | Server-side PDF (QuestPDF) with barcode/QR + verifiable token; `GET .../attendance-card/:id` returning `application/pdf`; gate-validatable reference. | BRD requires "downloadable"; adds PDF dep + endpoint. | M |
| Applicant audit trail (Sec 7) | Missing | `IAuditSink`/`NullAuditSink` defined in shared but never referenced or registered in the applicant API; the README's "every write emits audit" claim is false. No applicant action is audited. | Implement a DB-backed `IAuditSink`, register in `Program.cs`, emit on every state-changing action; expose admin query/export. The admin side proves the pattern. | Compliance gap; mechanical but cross-cutting. | M |
| PDF/Excel/Word export + data exchange (Sec 7) | Missing | No export libraries in the applicant API; artifacts are `window.print()` only; the sole integration is the MOI mock (`MoiHttpClient` is explicitly unimplemented). | Add a shared document/export service; applicant export endpoints; define real MOI/education contracts and swap `MoiMockClient`→`MoiHttpClient` via the existing `IMoiClient` seam. | New deps + templates; the seam eases the swap. | L |
| Eligibility self-check page | Frontend-only (this screen) | `EligibilityCheckPage` synthesizes data from an FNV hash of the NID against `MOCK` — no backend call. **However**, the real backend eligibility engine is already wired into upstream category gating/redirect. This page is a redundant divergent recap. | Point `useEligibilityMutation` at the existing `eligibleCategories()` backend call (already used elsewhere) with the mock as fallback. | Lower than originally rated — real engine already integrated upstream. | M→S |
| Re-identity verification after profile | Partial | `/applicant/verify` compares draft-stored fields (or falls back to `applicantId==nationalId`); `confirm-identity` only regex-validates format. Not a true re-auth; `IMoiClient` not consulted. | Re-verify against the `Applicants` row / MOI client; fail closed on mismatch. | Tightens existing endpoints; no new infra. | S |

### 3.3 Biometric (BRD Section 5)

**What's built:** Nothing on the server. The React module is complete and polished (search, fingerprint/face enrollment, verification, security gate, history, reports, monitoring), but the entire `biometric.service.ts` is hard-wired to `@/shared/mock-data` with `simulateLatency()` and `Math.random()` match scores persisting to in-memory arrays. There is no biometric module, controller, entity, migration, or `/api/biometric` route anywhere in the backend. (Biometric *devices* are out of BRD scope; the *software backend* — template storage, verification/audit logs, matching orchestration, exports — is in scope and entirely absent.)

| Requirement | Status | Current State | Implementation Approach | Impact | Effort |
|---|---|---|---|---|---|
| Applicant search for biometric ops | Frontend-only | `searchApplicants()` filters `MOCK.applicants` client-side; no endpoint. | New Biometric module + `GET /api/biometric/applicants/search` joining existing applicant/barcode/cycle tables. | Reuses existing tables; frontend swap to apiClient. | S |
| Fingerprint registration | Frontend-only | Capture simulated by `setTimeout`; `enroll()` fabricates a `templateRef` into an in-memory array. No persistence. | `BiometricEnrollment` entity + migration (ApplicantId/NID/Barcode/CycleId/template refs/status), `POST /api/biometric/enroll`, emit audit via existing `DbAuditSink`. | New table + endpoint + audit; template-ref storage contract. | M |
| Face registration | Frontend-only | Same pattern; `livenessConfirmed` echoes a boolean; quality badges hardcoded. | Shares the enrollment entity/endpoint (FaceTemplateRef/FaceCaptured/LivenessConfirmed columns). | Incremental columns on the shared table. | S |
| Identity verification (match + gate proceed) | Frontend-only | `verify()` computes a `Math.random()`-based score and applies thresholds in the browser; proceed gate is client-side only. | `POST /api/biometric/verify`: look up enrollment, persist device-returned score/decision to a `VerificationLog`, emit audit, return canContinue; thresholds in config/lookup. | New table + endpoint + audit. | M |
| Security-gate verification (entry/exit) | Frontend-only | `recordGateLog()` pushes to in-memory `GATE_STATE`; no gate-log table or endpoint. | `GateLog` entity + migration, `POST /api/biometric/gate-log` + `GET .../gate-logs`; verify-then-log; gate_entry/exit audit. | New table + 2 endpoints; possible overlap with barcode scans. | M |
| Verification history | Frontend-only | Reads in-memory `VERIFY_STATE`/`AUDIT_STATE`; lost on reload; no server filtering. | `GET /api/biometric/verifications` (filter/page) over the verification table; audit from the shared `DbAuditSink` filtered by module. | Reuses tables; one endpoint. | S |
| Reports (ops/failed/attendance/enrollment) | Frontend-only | Computed in-browser over mock arrays; `exportReport()` returns a fake filename. | `GET /api/biometric/reports` + `/monitoring` aggregations; export via the (to-be-real) shared export infra. | New aggregation endpoints + export wiring. | M |
| Biometric audit trail (Sec 7) | Frontend-only | In-memory `AUDIT_STATE`; backend audit subsystem exists but biometric is not connected (no backend). | Inject `IAuditSink` into the new Biometric services; emit on enroll/verify/gate/review — mirroring `UsersService`. No new infra. | High compliance value; minimal code once backend exists. | S |
| Real PDF/Excel/Word export + data exchange (Sec 7) | Missing | `exportReport()` is a no-op; shared handler emits HTML renamed `.xls`/`.doc`/`.html`. | Real export library in shared/reports; register a biometric producer; `GET .../reports/export?format=`. | Cross-cutting export refactor benefits all modules. | L |

### 3.4 Exams (BRD Section 6 + Section 7 globals)

**What's built (real backend + frontend):** Question-bank CRUD with categorization and publish; bulk question import (real XLSX parsing, up to 1000 rows); exam creation/publish persisting rules, question links, and assignments; applicant take-exam experience (timer/navigation/flagging) backed by real attempt start/submit; server-side auto-scoring (MCQ/true-false/matching, ≥60% pass); and a 6-month re-take conflict guard. Attempt start/submit events **do** write to the generic audit table.

| Requirement | Status | Current State | Implementation Approach | Impact | Effort |
|---|---|---|---|---|---|
| Exam-admin/proctor user & authorized-device management | Frontend-only | Full UI + service (`listCommitteeUsers`/`listDevices`) over in-memory `USER_STATE`/`DEVICE_STATE`; no `/api/exams/committee-users` or `/devices` routes; no entities. | Add `ExamCommitteeUser` + `ExamAuthorizedDevice` entities + migration + CRUD routes; hash proctor creds, store MAC/IP allow-list; integrate existing RBAC. | New tables; prerequisite for real access validation. | M |
| Exam assignment + pre-exam access validation | Frontend-only (validation gate) | Assignment fields **are** persisted (`ExamAssignmentEntity` + table). The 7-check access gate is mock-only against `MOCK.applicants`; `POST /api/exams/access/validate` has no route. `reopen`/`stop` endpoints also missing. | Add `POST /api/exams/access/validate` joining real applicant/eligibility + device allow-list + access window + prior attempts; add reopen/stop endpoints. | Heaviest integration (cross-app applicant/eligibility boundary); blocks trustworthy execution. | L |
| Results management (preliminary→approved→published) | Frontend-only | Full UI with approve/publish mutations over mock `RESULT_STATE`; no list/approve/publish routes. `SubmitAttemptAsync` scores but creates no result record; a divergent `ExamPlansController` "examResults" bucket exists but isn't wired to this UI. | Add `ExamResultEntity` populated by `SubmitAttemptAsync`; add list/approve/publish routes enforcing the state machine + approver identity; unify the two result models. | New table + migration; must reconcile two divergent models. | M |
| Proctor / live monitoring telemetry | Partial (inert) | `GET .../sessions/live` route exists but reads a record bucket never written, so it returns empty sessions and a hardcoded zero `answersPerMinute`. Route has no auth attribute. | Emit session heartbeats on start/answer-save/submit to a normalized `ExamLiveSession`; compute rates from heartbeats; add proctor auth. | Needs an autosave/heartbeat endpoint (answers currently sent only at submit). | M |
| Exam reports (results/execution/attendance/difficulty/print) | Partial | KPIs/distribution/donut render off mock data; the 10 report buttons have no `onClick` (dead). No exam-specific report endpoints. CSV export + print buttons do work. | Add exam-scoped report endpoints (by-applicant, execution, attendance, pass/fail, question-difficulty); wire the 10 buttons. Difficulty needs per-question answer persistence (currently a JSON blob). | Depends on results + answer normalization first. | L |
| Exam audit trail + retrieval (Sec 7) | Frontend-only (mostly) | `GET /api/exams/audit` has no route; question/exam/results write paths emit no audit. **However**, attempt start/submit *do* persist audit rows (queryable via `/api/audit`). | Inject the audit sink into `ExamsService` for question/exam/result write paths; add `GET /api/exams/audit` filtered on `AuditRows`. | Audit table/sink already exist; touches write paths. | M |
| True PDF/Excel/Word export + data exchange (Sec 7) | Partial | "Excel" and "Word" buttons both call CSV; "PDF" calls `window.print()`. Shared handler emits HTML renamed `.xls`/`.doc`/`.html`. Import side (XLSX) is genuine. | Real document library in a shared export service; replace handler stubs; add exam-results/answers export endpoint; wire buttons. | Cross-cutting (all report exports); well-isolated. | L |

---

## 4. Cross-Cutting Gaps (Section 7 Globals)

These appear in every area and are best solved once, centrally:

- **Audit trail.** The pattern is real and durable (`AuditRows` + `DbAuditSink`, used by admin Identity/Admissions/AdminRecords and exam attempt events). But it is **not applied** to: the entire applicant API (no sink registered), the biometric area (no backend), and exam question/exam/results authorship. For a government admissions system this is a material compliance gap. *Fix: register the existing sink in the applicant API and emit from every state-changing action; do the same as biometric/exam backends are built. The infrastructure already exists — mechanical work.*

- **Real PDF / Excel / Word export.** Platform-wide, "export" is misleading: the shared `ReportsExportHandler` emits HTML renamed `.xls`/`.doc`/`.html`, and frontends call CSV or `window.print()` for PDF/Word. **The one genuine exception** is admin/reports Excel via SheetJS (`.xlsx`) and the genuine XLSX *import* paths. *Fix once: introduce ClosedXML/EPPlus (XLSX), QuestPDF (PDF), OpenXML/DocX (Word) in a shared export service, replace the handler stubs, handle RTL/Arabic fonts. Benefits admin reports, biometric reports, exam results, and applicant artifacts simultaneously.*

- **Data exchange / external integrations.** Working: MoE/Al-Azhar grades import, exam-results import, committee import. Absent or faked: the National Verification Platform (faked against a local directory), the MOI HTTP client (explicitly unimplemented; mock only), bulk export of applicants/colleges/categories/system-codes, and a unified data-exchange module. *Fix: build a `DataExchange` module reusing the proven staged-import/preflight/commit pattern, and implement the real `INationalVerificationClient`/`MoiHttpClient` behind their existing seams once gov't API specs/credentials are available.*

---

## 5. Prioritized Recommendation

Phasing is driven by **integrity and compliance risk first**, then by unblocking dependencies, then by completeness. Dependency chain: biometric/exam features depend on a real export library and the audit sink; exam results/reports depend on result+answer normalization; applicant trust depends on auth/payment/verification.

### Phase 1 — Stop the bleeding: integrity & security (highest risk, must precede any pilot)
*Today the system collects no money, authenticates no one, and verifies no credentials. These are facades that make the platform unsafe to run against real applicants.*
1. **Real payment gateway** (Applicant, L) — replace the 30s auto-success; add webhook, receipt, idempotency.
2. **Real OTP/SMS** (Applicant, M) — remove the `123456` constant; random code + expiry + throttling.
3. **Educational verification** (Applicant, M) — wire the existing grades read into `verify-certificate`.
4. **Re-identity verification** (Applicant, S) — fail closed against the authoritative record.

### Phase 2 — Compliance & shared platform (unblocks everything downstream)
*Cheap because the patterns already exist, and prerequisites for the biometric/exam/report work later.*
5. **Applicant audit trail** (M) — register and emit from the existing sink.
6. **Shared real export service** (L) — PDF/Excel/Word done once, platform-wide; also closes admin PDF/Word and exam export gaps.
7. **Exam question/exam/results audit + `GET /api/exams/audit`** (M).

### Phase 3 — Exams hardening (real exam administration)
*The exam backend is the strongest internal module, so finishing it has the best effort-to-value ratio; results/reports depend on Phase 2 export work.*
8. **Pre-exam access validation + reopen/stop endpoints** (L) — the integrity gate for exam execution.
9. **Results management workflow** (M) — `ExamResultEntity` + approve/publish state machine; unify the two result models.
10. **Committee-user/device management** (M) — prerequisite for proctor access control.
11. **Live proctor telemetry** (M) and **exam report endpoints** (L) — wire the dead report buttons.

### Phase 4 — Biometric backend (an entire BRD section, on Phase 2 foundations)
*Largest net-new surface, but cleanly reuses the audit sink and export service from Phase 2, and the frontend is already complete.*
12. Biometric module: **applicant search (S) → enrollment fingerprint+face (M/S) → verification (M) → gate logs (M) → history (S) → reports (M) → audit (S)**, built in that dependency order.

### Phase 5 — Admin completeness & applicant artifacts
*Correctness/completeness items, not safety blockers.*
13. **8 admission categories + create** (M) and **National Verification Platform integration** (L — gated on external gov't API availability).
14. **Acquaintance-document persistence + issuance** (XL) and **server-generated admission card PDF** (M) — both now cheap on the Phase 2 export/audit foundation.
15. **Data-exchange module** (L), **barcode inquiry** (S), **eligibility self-check page wiring** (S), **independent acquaintance-doc flags** (S).

**Rationale summary:** Phase 1 makes the platform *safe to use*; Phase 2 makes it *compliant and gives every later phase its tooling*; Phases 3–4 complete the two large feature areas in dependency order (exams first because its backend is nearly there, biometric second because it is net-new); Phase 5 closes the remaining correctness gaps. The single highest-leverage investment is **Phase 2's shared export service and audit registration** — small, low-risk, and it retires cross-cutting gaps in all four areas at once.
