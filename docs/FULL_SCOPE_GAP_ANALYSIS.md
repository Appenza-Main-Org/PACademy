# PACademy — Full-Scope Gap Analysis vs. Original كراسة (9 Applications)

**Prepared:** 2026-05-30
**Source of truth:** `تطوير المنظومة المعلوماتية بأكاديمية الشرطة - الكراسة والمواصفات الفنية 28-2-26 شركة ترابط.pdf` (108 pages, Arabic technical specification)
**Supersedes:** `BRD_GAP_ANALYSIS.md` (which covered only 4 of the 9 applications)

---

## 0. The headline correction

The earlier gap analysis was built from a condensed `BRD_TestSprite` doc that described **4 applications**. The real كراسة defines **9 applications**. My earlier plan **completely missed 5 entire applications** — all of them admission *gates* or the *identity backbone*, none peripheral:

| # | Application | In earlier plan? | Real coverage |
|---|---|---|---|
| 1-1 | Administrator Site | ✅ | **58%** |
| 1-2 | Applicant Site | ✅ | **55%** |
| 2-7 | Question Bank & Electronic Exams | ✅ | **38%** |
| 2-1 | **Admission Committees Management** | ❌ missed | **18%** |
| 2-5 | **Barcode generation & printing** | ❌ missed | **~15%** |
| 2-6 | Biometric Registration & Inquiry | ✅ (understated) | **15%** |
| 2-2 | **Board & Board Secretariat (الهيئة)** | ❌ missed | **~12%** |
| 2-3 | **Investigations (التحريات)** | ❌ missed | **12%** |
| 2-4 | **Medical Services Commission (قوميسيون)** | ❌ missed | **12%** |

**Bottom line: the earlier plan captured roughly one-third of the real scope.** The 5 missed apps are all **frontend mocks with no backend** (board, investigations, medical, barcode) or a JSON-blob facade (committees). The real effort is **~3–4× larger**: ~8–9 new backend modules and ~35–45 new DB tables, of which **5 are XL greenfield modules** (Committees, Medical, Investigations, Biometric, Board).

---

## 1. Full 9-app coverage table

| App | Coverage | Backend | Frontend |
|---|---|---|---|
| (1-1) Administrator | **58%** | Real .NET API (Identity, Lookups, Grades, Admissions, AdminRecords, Audit, Reports, Notifications, Payments, Committees facade) | Real, dual-mode |
| (1-2) Applicant | **55%** | Real dedicated .NET API (drafts, eligibility, slots, JWT) — but OTP/MOI/Fawry/family/doc/card **simulated** | Real, some prod pages still hit mocks |
| (2-7) Exams | **38%** | Real exam attempt/scoring + question import; **no** stop/open/validate-access, committee-users/devices, results lifecycle, audit endpoints | Real, dual-mode |
| (2-1) Committees Mgmt | **18%** | JSON-blob facade over `AdminRecordsService`; **no committee domain module/entities** | Real UI over mock/dual |
| (2-5) Barcode | **~15%** | **None** — client-fabricated Code128, no server record | Frontend/print-only |
| (2-6) Biometric | **15%** | **None** — matches via `Math.random()` | Frontend-only mock |
| (2-2) Board & Secretariat | **~12%** | **None** — `board.service.ts` mock-only | Frontend-only mock |
| (2-3) Investigations | **12%** | **None** — "investigations" is only a permission string | Frontend-only mock |
| (2-4) Medical Commission | **12%** | **None** — grep returns zero backend matches | Frontend-only mock |

---

## 2. The 5 missed applications — what the كراسة actually requires

### (2-1) Admission Committees Management — 18%
The **operational spine** of the whole cycle. Defines the committee framework (Reception/استلام, Exam/اختبار, Physical-Sports Fitness, Medical, Security Gate/بوابة الأمن, Academic Presidency/رئاسة الأكاديمية) with **9+ roles**: system manager, student-committee manager, student-committee data-entry, exam-committee manager, exam-results enterer, security-gate, refund (إعادة المقابل المالي), inquiries, academy-presidency inquiries.

| Gap | Status | Approach | Effort |
|---|---|---|---|
| Real committee domain model (definitions/instances/results/membership as EF entities, not JSON blobs) | partial | New `Committees` module + migrations + FKs; route controllers off `AdminRecordsService` | **XL** |
| Distinct committee types with real workflow | frontend-only | Backend module+controller+entities per type; remove MOCK | **XL** |
| Two-phase result lifecycle (preliminary→approved) + post-approval edit lock + admin escalation | partial | Phase state machine + authz policy; block edits at final | M |
| Per-committee data scoping (user sees only their committee's applicants) | missing | Membership claims, server-derived scope on every query | M |
| Inquiry/Reports/Statistics/Audit per committee | frontend-only | Aggregate report endpoints + audit-trail surfacing | L |
| Intake + field-level verification (portal/civil-records/NID) | missing | Intake-verification service; flag mismatches | L |
| Refund workflow | missing | Refund entity + endpoint + audited admin screen | S |
| Sports/physical-fitness scoring formulas + device integration (2 methods) | missing | Configurable formula tables + manual + device-ingestion endpoint | L |
| Second-round (الدور الثاني) recomputation + Ministry/Al-Azhar reporting | missing | Round handling on result entities + export | M |
| Real RBAC + MAC/IP device binding | backend-only | DB-backed roles/policies + device binding at login | L |

### (2-2) Board & Board Secretariat (الهيئة وأمانة سر الهيئة) — ~12%
The **final ratification body**. Aggregates ALL evaluation criteria/results (capability, posture, weight/height, medical, psychological, sports events — 100m/1000m run, pull-ups, trunk-bend, jump, confidence jump, skill test, traits, language, specialization, IT, "info about Egypt") plus investigations, presents them to board members & chair who record opinions, and computes a **board result via a configurable formula** (member opinions + chair opinion). Roles: مدير النظام, مدير لجنة أمانة سر الهيئة, عضو جلسة الهيئة, رئيس جلسة الهيئة.

| Gap | Status | Approach | Effort |
|---|---|---|---|
| Backend board module (sessions, members, opinion-codes, result formula, decisions, minutes/ثبت الهيئة) | missing | `Board` module: BoardSession, BoardMember, OpinionCode, ResultFormula, Decision, Minute entities + controller | **XL** |
| Member↔entity↔year↔session linkage + decision-maker assignment per session | missing | Linkage entities + assignment endpoints | M |
| Secretariat: upload investigation-result file linked to student code | frontend-only | Document store + endpoint keyed by applicant code | M |
| Result formula engine (member opinions + chair final opinion) | missing | Configurable formula evaluation service | M |
| Decision propagation → applicant admission status | missing | On chair final opinion, persist verdict to admission record; audit | L |
| Aggregate inquiry by NID/code/name and by committee/category/specialization/nationality | frontend-only | Query endpoints + board register (ثبت الهيئة) view | M |
| Printable minutes/register (Word/PDF) | frontend-only | Server-render via shared export service | M |
| RBAC for 4 board roles + audit trail | missing | DB roles/policies + audit events | M |

### (2-3) Investigations (التحريات) — 12%
Background-check / security-vetting with **parallel committees (تحريات أ، تحريات ج)** and security directorates (وطني/أمن، جنائي/جيش/مباحث) scoped by محافظة; outgoing/incoming correspondence tracking (الصادر/الوارد) keyed by barcode; quota-based auto-distribution by فئة/نوع/جنس/تخصص × academic year; results that **gate admission**.

| Gap | Status | Approach | Effort |
|---|---|---|---|
| Backend Investigations module (cases, correspondence, results) | missing | `Investigations` module: InvestigationCase, Outgoing/IncomingLetter, InvestigationResult + controller | **XL** |
| إدراج الصادر/الوارد (letter no.+dates+جهة, محافظة/مديرية for security; delete-erroneous-outgoing) | frontend-only | Entities keyed by barcode; create/list/send/delete + build incoming screen | L |
| إدراج نتائج التحريات (enter/approve by code + notes; apply to admission) | frontend-only | Persist result; manager approval; propagate to admission | L |
| Per-committee user mgmt (name/username/password/role/status/device IP) | missing | Committee-scoped CRUD + device-IP attribute | M |
| Advanced staff config + quota-based auto-distribution | frontend-only | Staff entities (category/type/gender/specialty/quota/year) + real distribution engine + tiers | L |
| Inquiry/reports/statistics by NID/barcode/governorate/date/result + Excel | frontend-only | Filtered report+inquiry endpoints + export | M |
| Multiple committees (أ/ج) + directorates scoped by محافظة | missing | Committee/Entity dimension on cases+letters; scope everywhere | L |
| Audit trail | missing | Audit events on all operations | M |

### (2-4) Medical Services Commission (قوميسيون الخدمات الطبية) — 12%
Multi-clinic medical battery with **configurable pass criteria** (BMI, height-to-muscle ratio, balance test) per category/type/gender/specialty, device-fed measurements (IP/MAC scales), a **two-pass lifecycle (initial + appeal/إعادة)**, and a master verdict. Roles: 5 medical roles (system manager, exam clinic, exam-committee chair, results enterer, etc.).

| Gap | Status | Approach | Effort |
|---|---|---|---|
| Backend medical module (clinics/stations, tests, results preliminary+final, master verdict) | missing | `Medical` module: MedicalClinic, MedicalTest, ClinicTestLink, MedicalExamResult, ClinicCycleLink + controller + aggregation rule | **XL** |
| Configurable pass criteria/weights + min-clinics-completed + special-detection flag | missing | MedicalCriteria entity + rules-evaluation service | L |
| Insert screens: barcode/NID linkage, batch barcode-reader entry, device integration | frontend-only | Device-registration entities + measurement ingestion + barcode-scan/bulk-upload | L |
| Re-examination/appeal (committee re-decision vs device re-measurement, with eligibility) | missing | ReExamRequest entity + endpoints; new result linked to original | M |
| Inquiry/reports + Word/Excel/PDF + statistics + printable certificates | frontend-only | Report query endpoints (reuse export infra); server-backed certificate | L |
| RBAC for 5 medical roles + audit trail | missing | DB roles/policies + audit | M |
| System-admin setup (user admin w/ device IP/MAC; clinic CRUD; clinic-test/clinic-cycle links; hide/show tests) | missing | Admin CRUD screens+endpoints | L |

### (2-5) Barcode generation & printing — ~15%
A **server-issued, verifiable identity token** that biometric, committee, medical, and exam apps all key off. The كراسة specifies print specs (size, orientation, laser/thermal, label sizes, **copy-count control**, margins, text-below-barcode like student-name/committee/exam-date, show/hide user code, **code validity timing**), per-role inquiry+print (by category/exam-date/round/gender/specialty/branch), and batch printing.

| Gap | Status | Approach | Effort |
|---|---|---|---|
| Server-issued unique verifiable barcode/QR record | frontend-only | `Barcode` module: BarcodeRecord entity (applicant, cycle, code, issuedAt, status, validity) + issuance endpoint returning printable PDF | L |
| Barcode lookup/verify API consumed by other stations | missing | `GET /barcode/verify/{code}` → applicant + validity; integrate into committee/medical/biometric/exam intake | M |
| Reprint + copy-count control | partial | Reprint endpoint enforcing copy count + audit | S |
| Print config (size/orientation/label/text-below/show-hide user code/validity timing) bound to user group | frontend-only | Print-profile entity per committee user group + admin screens | M |
| Group/batch print by exam-date/committee/category/gender/year | frontend-only | Batch endpoint generating barcode sheets | M |

---

## 3. Delta notes — the 4 apps that were in the plan

- **(1-1) Administrator (58%):** real backend is broad. New gaps the كراسة reveals: **MOI digital-platform API at login** (currently local officers table only); **per-exam screen-set control** (which screens show preliminary-relatives / doc-upload / doc-print-close per exam phase, linked to responsible officer) — missing; per-applicant grade-edit screen (total/overall + sports distinction) — partial; inquiry from educational-institution data — missing; reports filtered by school-type/gender/committee/age/specialty + absent/violating applicants + Word/Excel/PDF — partial; relationship-tree & job-category hierarchy lookups — partial; notifications with publish schedule — partial. Must also own config/roles/device-binding for **all 9 apps**.
- **(1-2) Applicant (55%):** launch blockers (not polish): OTP hardcoded `123456`; MOI = mock with 7 NIDs (prod page still mock); Fawry auto-succeeds after 30s (fee hardcoded 1500); family tree = sessionStorage with no server validation/lock; وثيقة تعارف + barcode card = frontend-only; `verify-certificate` is a stub despite a real GradesRead module.
- **(2-7) Exams (38%):** real attempt/scoring/import, but missing stop/open-attempt/validate-access, committee-users/authorized-devices, results lifecycle (preliminary→approved→published) + audit endpoints, RBAC, real reports (per-candidate printout/attendance/difficulty + Word/PDF), proctor real-time controls (currently fire-and-forget toasts), and applicant-side biometric pre-check + lockdown. Must flow through (2-1) lifecycle and (2-6) biometric gate.
- **(2-6) Biometric (15%):** not a "verification utility" — it's the **6-station security backbone** (Security Gate, Exam, Admissions/Board, Medical, …) with a central matcher (AFIS + face SDK), 7 roles, same-day-verification audible alerts, and a **~200k-applicant / sub-2s SLA**. No backend exists.

---

## 4. Revised end-to-end task list (phased, all 9 apps)

**Shared infrastructure must land first** — nearly every new app depends on it.

### Phase 0 — Shared foundations (BLOCKING)
- **0.1** Harden central **Audit module** into a queryable per-permission Audit Trail with a standard event contract. *(unblocks 2-1/2-3/2-4/2-6/2-2)*
- **0.2** Build shared **Export service** (Word/Excel/PDF, RTL/Arabic) generalizing Reports. *(unblocks every reporting gap; also fixes admin/exam PDF/Word)*
- **0.3** Build **(2-5) Barcode service**: `BarcodeRecord` + issuance (anti-dup) + `GET /barcode/verify/{code}` + reprint/copy-count + batch + print-profiles. *(unblocks 1-2 card, 2-1 intake, 2-4 insert, 2-6 enrollment, exam gate)*
- **0.4** Central **RBAC + device IP/MAC binding** in Identity: migrate frontend `roles.ts` for committee/medical/investigation/biometric/board into DB-backed policies. *(unblocks scoping + role gaps everywhere)*

### Phase 1 — Applicant launch blockers (parallel; API already exists)
- **1.1** Real SMS OTP (hashed, expiry, rate-limit) + `MoiHttpClient`; server-enforce door-open/duplicate-NID. *(L)*
- **1.2** Real Fawry Web Service + webhook; fee from admin settings. *(L)*
- **1.3** Wire data-entry to backend MOI/study endpoints; remove prod mocks. *(M)*
- **1.4** Back `verify-certificate` with `FindGradeByNidReadUseCase`. *(S)*
- **1.5** Family tree server-side: entities + validation (NID/age/sex) + اعتماد lock. *(M)*
- **1.6** وثيقة تعارف persisted + signed PDF (uses 0.2). *(L)*
- **1.7** Barcode card via 0.3. *(M)*
- **1.8** Admin-sourced fee/door/notifications; real follow-up fed by committee/medical/investigation results. *(M, depends on Phase 2/3)*

### Phase 2 — Committees domain core (2-1) — highest-leverage backend
- **2.1** Committees module: normalized entities + migrations + FKs (replace JSON blobs). *(XL)*
- **2.2** Two-phase result lifecycle + post-approval lock + escalation. *(M)*
- **2.3** Per-committee data scoping via membership claims (uses 0.4). *(M)*
- **2.4** Intake + field-level verification (portal/civil-records/NID). *(L)*
- **2.5** Refund workflow. *(S)*
- **2.6** Committee inquiry/reports/statistics + audit (uses 0.1/0.2). *(L)*
- **2.7** Second-round recomputation + Ministry/Al-Azhar export (uses 0.2). *(M)*

### Phase 3 — Specialized committees & gates
- **3.1** **Medical Commission (2-4)**: clinics/tests/results/verdict + criteria engine (BMI etc.) + barcode/device ingestion + re-exam + reports/certificates + RBAC/audit. *(XL)*
- **3.2** **Investigations (2-3)**: cases + صادر/وارد + results→admission + quota auto-distribution + multi-committee (أ/ج/directorates) scoped by محافظة + per-committee users + inquiry/reports/Excel + audit. *(XL)*
- **3.3** **Physical-Sports Fitness** (within 2-1, device-heavy): scoring-formula tables + manual + device ingestion. *(L)*
- **3.4** **Security Gate**: biometric/barcode entry-exit timestamping (depends on 0.3 + Phase 4). *(L)*

### Phase 4 — Biometric backbone (2-6) (depends on 0.3/0.4)
- **4.1** Central biometric module + matcher (AFIS + face SDK behind abstraction); template store (no images). *(XL)*
- **4.2** Enrollment by applicant+barcode+cycle + same-year re-enroll reuse. *(L)*
- **4.3** Multi-station verification gating (Gate/Exam/Board/Medical). *(L)*
- **4.4** Same-day audible alert + station-chair notification. *(M)*
- **4.5** Attendance/headcount reports + export (uses 0.2). *(M)*
- **4.6** Scale/perf hardening to 200k / sub-2s SLA. *(L)*

### Phase 5 — Board & Secretariat (2-2) (depends on 2-1/2-3/2-4 verdicts)
- **5.1** Board module: sessions/members/opinion-codes/result-formula/decisions/minutes. *(XL)*
- **5.2** Result-formula engine (members + chair). *(M)*
- **5.3** Decision propagation → applicant admission status. *(L)*
- **5.4** Minutes/register persistence + printable Word/PDF (uses 0.2). *(M)*
- **5.5** Board RBAC + audit (uses 0.1/0.4). *(M)*

### Phase 6 — Exams integration & hardening (2-7)
- **6.1** Stop/open-attempt/validate-access + committee-users/authorized-devices + results lifecycle + audit endpoints + RBAC. *(L)*
- **6.2** Route exam results through 2-1 lifecycle + scoping; exam-room entry calls 4.3 biometric. *(M)*
- **6.3** Real reports (per-candidate/attendance/difficulty + export) + real proctor controls. *(L)*

### Phase 7 — Administrator config surface for all 9 apps (1-1 deltas)
- **7.1** MOI digital-platform login integration. *(M)*
- **7.2** Per-exam screen-set control + responsible-officer binding. *(M)*
- **7.3** Per-applicant grade-edit screen; educational-institution inquiry. *(S/M)*
- **7.4** Full filtered reports (absent/violating, by all dimensions) + Word/Excel/PDF (uses 0.2). *(L)*
- **7.5** Unified per-app config console (committees, medical clinics/tests, investigation committees, biometric stations, barcode windows, lookups, roles, device binding). *(L)*

**Critical-path:** `0.1–0.4` → `2.1 committees core` + `4.1 biometric core` → `3.x` → `5.x` → `6.x` → `1.8` + `7.x`. Applicant blockers 1.1–1.7 run in parallel.

---

## 5. Impact summary

- **Effort multiplier: ~3–4× the earlier 4-app plan.**
- **New backend modules: ~8–9** — Committees, Medical, Investigations, Biometric, Board (all **XL** greenfield), Barcode (shared), expanded Audit, shared Export, Sports-Fitness scoring + Security-Gate logging.
- **New DB tables: ~35–45.** Committees ~7, Medical ~8, Investigations ~6, Biometric ~6, Board ~5, Barcode ~2, RBAC/Audit/DeviceBinding ~3, Applicant hardening ~5.
- **XL backend count: 5** (vs 0–1 in the earlier plan) — the single biggest driver.
- The missing apps are the **admission gates** (Committees, Investigations, Medical, Board) and the **identity/security backbone** (Biometric, Barcode). Without them the platform cannot legally or operationally run a real admission cycle.

> Verification caveats: coverage % are from agent analysis of spec pages + code grep; the Board and Barcode sections were read page-by-page from the كراسة (pp.61-63, 78-82) directly. Confirm exact table/role counts against the كراسة before final sprint sizing.
