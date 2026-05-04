# RFP Scope Document — Coverage Audit

> Generated 2026-05-04 by Claude Code (read-only audit; no source code modified).
> **Source:** `تطوير المنظومة المعلوماتية بأكاديمية الشرطة - الكراسة والمواصفات الفنية 28-2-26 شركة ترابط.pdf`
> (108 pages, dated 2026-03-01, located at `/Users/mac/Downloads/`).
> **Codebase commit:** `67e4f49` (2026-05-04, branch `main`).
> **Supersedes:** [Tasks/KARASA_GAPS.md](../Tasks/KARASA_GAPS.md) (now historical / draft).
>
> The RFP filename in the original audit prompt assumed underscores and a copy at the
> repo root; the actual file is at `~/Downloads/` with spaces. Same document.

---

## 1 · Executive summary

- Total requirements counted: **126** (across 4 RFP top-level sections + cross-cutting).
- `done`: **52** (41%)
- `partial`: **38** (30%)
- `mocked_only`: **6** (5%)
- `missing`: **20** (16%)
- `out_of_scope`: **8** (6%)
- `evidence_unavailable`: **2** (2%)

**Headline gaps (must-fix before demo):**

1. **§4(2-1) `صلاحية إعادة المقابل المالي للطلبة (Refund)`** — `missing`. No UI page, no role in [src/features/auth/rbac.ts](../src/features/auth/rbac.ts), no service, no menu entry. Add `refund_admin` role + `/admin/refunds` (or `/committee/refunds`) page + `refundsService`. Currently the entire refund permission/screen-set described on RFP p.58 is absent from the codebase.
2. **§4(2-1) `صلاحية استعلامات رئاسة الأكاديمية`** — `missing`. No role, no menu entry, no dedicated query screens. Spec describes a separate Academy-Leadership inquiries surface (p.60); none exists.
3. **§4(1-2) Stage 4 `التحقق من مطابقة المتقدم للشروط الخاصة بالفئات الأخرى`** — `partial`. [EligibilityCheckPage.tsx:71-202](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx#L71-L202) checks one chosen category's eligibility. The spec (p.18 §"المرحلة 4") additionally requires: when the applicant fails the chosen category but matches OTHER categories, present those alternatives and let them switch. The "switch to a matching alternative category" branch is not implemented.
4. **§4(1-2) Stage 7 `إدراج بيانات الأسرة الأساسية`** — `partial`. [Stage7FamilyPage.tsx:30-289](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L30-L289) collects father/mother/4 grandparents + free-form siblings + 4th-degree relatives. Missing per RFP p.19–20 §"المرحلة 7" sub-list: `أزواج الجدة (إن وجدوا)` / `زوجات الجد (إن وجدوا)` / `زوجات الأب (إن وجدوا)` / `أزواج الأم (إن وجدوا)` / `أولاد الجد (إن وجدوا)` — five named "if applicable" arrays the RFP enumerates; none are in the form schema.
5. **§4(1-2) Stage 12 `دورة العمل الخاصة بوثائق التعارف`** — `partial`. [Stage11AcquaintanceDocPage.tsx:24-170](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx#L24-L170) renders housing + travel + social accounts only. Missing per RFP p.34–36: `بيانات دخل الأسرة` (family income), `بيانات مسكن الأسرة` full breakdown, `الأقارب الذين يعملون بجهات أجنبية`, `الأقارب المتجنسين بجنسيات أجنبية`, `الخبرات والوظائف السابقة للمتقدم`, `قضايا متعلقة بالمتقدم أو أقاربه`. PRODUCT.md "Bucket A" deliberately deleted political/religious affiliations; the other six sub-screens never shipped.
6. **§4(1-2) RFP-vs-impl stage numbering drift** — `partial` (architectural). RFP defines 12 stages (1–12); the wizard implements 11 (Stage1–Stage11). The two pre-wizard "gates" (`CategorySelectionPage`, `EligibilityCheckPage`) implement RFP Stages 1–4. Impl-Stage7 merges RFP Stages 7 + 8. Impl-Stages 8/9/10/11 = RFP Stages 9/10/11/12. Demo-safe but a Ministry reviewer ctrl-F'ing for "المرحلة 8" (preliminary relatives) will see "حجز موعد الاختبار" — needs at minimum a stage-mapping note in [POLISH_REPORT.md](../POLISH_REPORT.md) §5.
7. **§4(1-2) Stage 9 `إصدار كارت التردد` — Code 128 barcode** — `mocked_only`. [Stage9PrintCardPage.tsx:196-208](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx#L196-L208) renders a deterministic `BarcodeBars` SVG that is **not** a scannable Code 128 barcode. The RFP requires a real barcode that the security gate / committee scanner can decode; the mock will fail at any real scan. Either ship `JsBarcode` or document that the demo-day scanner is also mocked.
8. **§4(1-1) Admin `إدارة شروط التقدم` advanced fields** — `partial`. The RFP p.10–12 enumerates many condition dimensions (e.g. `تاريف الجامعات للقسم الخاص`, `الجنسيات المسموح بها`, `الأكواد بالكليات`). The implementation [admissionRules.service.ts:17-19](../src/features/admin/api/admissionRules.service.ts#L17-L19) covers age, height, BMI, eyesight, marital, criminal, max-applications. Several RFP rule dimensions (per-college codes, foreign-cert mappings, allowed nationalities list) are not in the editable schema — only in static reference tables.
9. **§3 `تكامل وتبادل البيانات` Excel import for بيانات الطلبة + بيانات الاختبارات** — `partial`. Cross-feature spec on RFP p.8–9 §3 requires Excel import of internal-network result data. Implemented as a stub in `committee-results-bulk-upload` modal and `barcode/batch` page; the actual `xlsx` parser is deferred (KARASA_GAPS.md notes "Sprint 10"). Marked `partial` because the UI exists but the import is non-functional.
10. **§4(2-3) `Investigations — view-level audit logging`** — `partial`. RFP §3 + §4(2-3) state that investigations entries (which carry secret data) require **per-view** audit, not just CUD. Implementation logs CUD via `auditService` but no view-level hook exists in [InvestigationDetailPage.tsx](../src/features/investigations/pages/InvestigationDetailPage.tsx). KARASA_GAPS.md confirms this as deferred (AUD-010).

**Headline strengths:**

- 11-role RBAC matrix in [rbac.ts:8-20](../src/features/auth/rbac.ts#L8-L20) maps to 9 of the 11 RFP-mentioned permissions cleanly. `super_admin`, `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user` and `applicant` all match named RFP roles. Only `refund` and `academy_leadership_inquiries` are missing.
- 9-app architectural split is faithful to RFP §2 "مكونات المنظومة" (`§4(1-1)` admin, `§4(1-2)` applicant, `§4(2-1)` committees, `§4(2-2)` board, `§4(2-3)` investigations, `§4(2-4)` medical, `§4(2-5)` barcode, `§4(2-6)` biometric, `§4(2-7)` exams) with a corresponding `AppKey` enum in [src/shared/lib/constants.ts](../src/shared/lib/constants.ts) and per-app theming via `data-app="..."`.
- 8 medical stations match RFP §4(2-4) p.70 enumeration exactly: `eye`, `ent`, `internal`, `orthopedic`, `neuro`, `psychology` (`الاتزان النفسي`), `surgery`, `bmi` — see [medical.service.ts:28-41](../src/features/medical/api/medical.service.ts#L28-L41).
- Two-phase signature canon (preliminary `قيد المراجعة` → final `معتمد` with `IconStamp`) is faithfully implemented in [CommitteeDetailPage.tsx:120-221](../src/features/committees/pages/CommitteeDetailPage.tsx#L120-L221) and mirrored in medical/exams; this matches the RFP's "العضو يدخل / الرئيس يعتمد" pattern in §4(2-1) p.49–53.
- Restricted-access investigations UI (`<PrintLayout restricted>`, terra «سرّي» banner) honours RFP §4(2-3) p.65–69 secrecy requirements — see [InvestigationsLayout](../src/features/investigations/InvestigationsLayout.tsx).

**Posture vs. PRODUCT.md's "~95%" claim:**

The audit **partially refutes** the 95% headline. Counted at the requirement-bullet level (126 items), the actual coverage is:

- Fully shipped: 41% (52/126)
- Shipped + partially shipped + out-of-scope-deferral: **77%** (98/126)
- True gap (`missing` + `mocked_only`): 21% (26/126)

KARASA_GAPS.md's 95% reads coverage at the section level (§1 admin, §2 applicant, …) where each section is "✅" if its primary screens exist. That's a fair "demo will look complete" measure but underweights bullet-level gaps. The two flat-out missing RBAC roles (refund, academy-leadership inquiries) and six missing acquaintance-document sub-screens are visible to a determined reviewer. **A more defensible headline is: "~90% of in-scope requirements at section level; ~77% at bullet level"** — still a strong showing for the demo, but not 95%.

---

## 2 · Methodology

This audit was produced by:

1. **Reading the existing context** — `CLAUDE.md`, `PRODUCT.md`, `POLISH_REPORT.md` §1–§3, `Tasks/KARASA_GAPS.md` (the prior coverage map; treated as a starting hypothesis).
2. **Confirming the codebase baseline** — `npm run typecheck` ran clean at HEAD `67e4f49`. `git status` showed pre-existing uncommitted work in 8 files (exams polish in progress); audit proceeded against committed state since the audit cites file:line that may or may not survive that polish.
3. **Extracting the RFP** — PyMuPDF (`fitz` 1.27) was used to extract text per page into `/tmp/rfp_audit/sec_*.txt`. `poppler-utils` was attempted but a brew install of cmake-from-source would have run >30 min; PyMuPDF was sufficient. Arabic in the TOC and section headings extracts cleanly; body prose has font-cmap substitution artefacts (some letters mapped to wrong codepoints — e.g. ظ→و, ة→ذإ — across roughly half the body lines). For this audit, **verbatim Arabic is taken from TOC entries and h2/h3 headings**, which extract cleanly; body text was used for guidance only. Where the body was unreadable, the row is marked `evidence_unavailable`.
4. **Building the bullet inventory** — every TOC leaf bullet (pp. 1–4 of the PDF) was treated as one row in §3 below. Sub-screens enumerated under each application were each a row.
5. **Per-bullet code search** — `grep -rn` against `src/`, `find` for filenames, then read of the most-relevant file end-to-end. RBAC roles were checked against [rbac.ts](../src/features/auth/rbac.ts). Routes were checked against [routes.tsx](../src/routes.tsx) and [config/routes.ts](../src/config/routes.ts). Data fields were checked against schemas under `src/features/applicant-portal/schemas/` and `src/shared/types/domain.ts`.
6. **Time-box decisions:**
   - §4(1-2) Applicant Site (RFP pp. 15–36) — **read in full** (the demo's headline path).
   - §4(1-1) Admin Site (RFP pp. 10–14) — read in full.
   - §4(2-1) Committees (RFP pp. 41–60) — section headers + sub-role lists read in full; per-screen field-level body skimmed.
   - §4(2-2) Board, §4(2-3) Investigations, §4(2-4) Medical, §4(2-5) Barcode, §4(2-6) Biometric, §4(2-7) Exams — section headers read in full; per-bullet evaluation against KARASA_GAPS.md and feature `index.ts` barrels.
   - §3 cross-cutting and General Conditions/SLA — section headers read; SLA sub-clauses (RFP pp. 91+) not exhaustively classified at clause level (logged as `out_of_scope` since they're contractual, not screen-level).
7. **Classification rule** — `done` requires file+line evidence of the spec behaviour, not just a route. A page rendering a placeholder counts as `partial`. A page that exists but doesn't implement spec field/validation is `partial`. No matches in `grep` → `missing` (verified for refund + academy-leadership-inquiries).
8. A reviewer reproducing this audit should: open the PDF in Preview at the cited page, ctrl-F the Arabic verbatim from the row, and open the cited file:line range to validate. The PyMuPDF extraction is reproducible by any Python 3 environment with PyMuPDF — the script is in §7 appendix.

---

## 3 · Section-by-section findings

### 3.1 RFP §3 — `آليات عمل التطبيقات` (Cross-cutting work mechanisms, pp. 7–9)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §3.1 | تطبيقات شبكة المعلومات الدولية (الإنترنت) | Internet-application mechanisms | `done` | [src/routes.tsx:117-188](../src/routes.tsx#L117-L188) (public + applicant + staff surfaces); [PublicLandingPage.tsx](../src/features/landing/pages/PublicLandingPage.tsx) | Public/private split shipped per ARCH-01. |
| §3.1 | إدراج وتحديث شروط التقدم لمختلف فئات المتقدمين | Insert/update admission conditions per category | `done` | [admissionRules.service.ts:17-90](../src/features/admin/api/admissionRules.service.ts#L17-L90); [AdmissionRulesPage.tsx](../src/features/admin/pages/AdmissionRulesPage.tsx) | — |
| §3.1 | إدراج مواعيد فتح وقفل باب التقدم | Insert open/close dates for application period | `done` | [cycles.service.ts:61-130](../src/features/admin/api/cycles.service.ts#L61-L130); CycleNewPage; CycleDetailPage. | — |
| §3.1 | إدراج اللجان والاختبارات الخاصة بالتقدم | Insert committees and exams for applications | `done` | [committee.service.ts](../src/features/committees/api/committee.service.ts); CommitteeCreatePage; ExamCreatePage. | — |
| §3.1 | رفع بيانات متقدمي القسم العام الواردة من (وزارة التربية والتعليم – الأزهر الشريف) لتسهيل اليدوي والأدوار السابقة | Upload general-section applicants from MoE/Azhar | `partial` | [applicantPortal.service.ts:68-90](../src/features/applicant-portal/api/applicantPortal.service.ts#L68-L90) (verifyCertificate is mocked) | API endpoint stubbed; no admin "bulk upload" UI for ministry data. |
| §3.1 | الإحصائيات والتقارير الخاصة بالتقدم | Statistics + reports on applicants | `done` | [reports.service.ts](../src/features/admin/api/reports.service.ts); [ReportsPage.tsx](../src/features/admin/pages/ReportsPage.tsx) | 9 report templates implemented per KARASA_GAPS §1.2.F. |
| §3.1 | إتاحة إدراج وطباعة وثيقة التعارف طبقاً لآليات اختبارات محددة، وبموعد يتم التحكم به من قبل مديري النظام | Print acquaintance doc with admin-controlled scheduling | `partial` | [Stage11AcquaintanceDocPage.tsx](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx); printable layout exists | Admin-side schedule-control UI is not exposed; the doc is always available to the applicant. |
| §3.1 | تمكين المتقدمين المستوفين لشروط التقدم: التسجيل الإلكتروني وإدراج البيانات الشخصية والدراسية | Enable eligible applicants to register + insert personal/academic data | `done` | [Stage1AuthPhonePage.tsx](../src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx)..[Stage5MaritalPage.tsx](../src/features/applicant-portal/pages/Stage5MaritalPage.tsx) | — |
| §3.1 | سداد مقابل الخدمة إلكترونياً | Pay service fee electronically | `done` (mocked) | [Stage6PaymentPage.tsx](../src/features/applicant-portal/pages/Stage6PaymentPage.tsx) | Fawry + card mock; real gateway integration deferred. |
| §3.1 | إدراج بيانات الأقارب الأولية | Insert preliminary relatives data | `partial` | Merged into [Stage7FamilyPage.tsx](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx); not a separate stage 8 as RFP defines. | RFP separates this from Stage 7. |
| §3.1 | اختيار موعد الاختبار الأول | Choose first exam appointment | `done` | [Stage8ExamSchedulePage.tsx:24-119](../src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx#L24-L119) | — |
| §3.1 | طباعة وثيقة التقدم متضمنة الباركود | Print application card incl. barcode | `done` (visual) / `mocked_only` (scannability) | [Stage9PrintCardPage.tsx:122-170](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx#L122-L170) | `BarcodeBars` is a visual placeholder, not Code 128. |
| §3.1 | متابعة الحجز الاختبارات والمواعيد والتنبيهات | Follow exam stages, schedules, notifications | `done` | [Stage10FollowUpPage.tsx](../src/features/applicant-portal/pages/Stage10FollowUpPage.tsx); [TestScheduleAndResultsPage.tsx](../src/features/applicant-portal/pages/TestScheduleAndResultsPage.tsx) | — |
| §3.1 | اعداد وثيقة التعارف وطباعتها | Prepare and print acquaintance doc | `partial` | [Stage11AcquaintanceDocPage.tsx](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx) | See headline gap #5: many sub-screens missing. |
| §3.2 | تطبيقات الشبكة الداخلية بالكلية: الطلبة | Internal-network committees for students | `done` | [committees feature index.ts](../src/features/committees/index.ts); 5 pages | — |
| §3.2 | تطبيقات الشبكة الداخلية: الاختبارات | Internal exams committees | `done` | [exams feature](../src/features/exams/) | — |
| §3.2 | تطبيقات الشبكة الداخلية: القومسيون الطبي | Internal medical commission | `done` | [medical feature](../src/features/medical/) | — |
| §3.2 | تطبيقات الشبكة الداخلية: التحريات الخاصة بلجان الواردة المختلفة | Investigations sub-apps for various incoming requests | `done` | [investigations feature](../src/features/investigations/); 7 pages | — |
| §3.2 | إدارة تقييمات الاختبارات | Exam-result management | `done` | [Sprint7Pages.tsx](../src/features/exams/pages/Sprint7Pages.tsx) (ProctorViewPage, ExamResultsPage in [ExamsPages.tsx](../src/features/exams/pages/ExamsPages.tsx)) | — |
| §3.3 | تكامل وتبادل البيانات بين تطبيقات الإنترنت وتطبيقات الشبكة الداخلية لتأمين سلامة المعلومات المتنقلة | Integration / data exchange across internet + internal apps with information-flow safety | `partial` | INTEGRATION CONTRACT JSDoc on each `*.service.ts` (e.g. [committee.service.ts:1-15](../src/features/committees/api/committee.service.ts)). | Service contracts documented; no single integration-bus implementation since no backend. Acceptable for frontend phase. |
| §3.3 | استخدام حسابات المستخدمين والصلاحيات المختلفة داخل تطبيقات الشبكة الداخلية بدون تكرار إنشاء حسابات المستخدمين | Use shared user accounts + permissions across all internal apps without duplicating account creation | `done` | [auth.store.ts](../src/features/auth/store/auth.store.ts); [AuthGuard.tsx](../src/app/providers/AuthGuard.tsx); [ROLE_DEFINITIONS](../src/features/auth/rbac.ts) | Single auth store + role.apps drives access across all 9. |
| §3.4 | الضوابط العامة: عرض الإجراءات لنتائج الاختبارات تتم بطريقة ملحوظة، ويجب أن تخضع لإجراء أولي (مراجعة وتحرير) ولاعتماد نهائي (نقب المراجعة) | Two-phase result entry: officer enters → chair approves | `done` | [CommitteeDetailPage.tsx:120-221](../src/features/committees/pages/CommitteeDetailPage.tsx#L120-L221); [StationExamPage.tsx](../src/features/medical/pages/StationExamPage.tsx) | Canonical pattern shipped; matches POLISH_REPORT §5. |
| §3.4 | إيقاف الإدراج أو التعديل أو الحذف لبيانات المتقدمين الموقوفين | Block CRUD on suspended applicants | `done` | [CommitteeDetailPage.tsx:72-98](../src/features/committees/pages/CommitteeDetailPage.tsx#L72-L98) (`SuspendedBadge` + disabled entry button) | — |
| §3.4 | إمكانية تعديل أو حذف نتائج الاختبارات قبل أو بعد اعتمادها، إلا من خلال الصلاحيات المقررة | Edit/delete results only via authorised permissions | `partial` | RBAC enforced via `permissions: ['results:enter']` in [rbac.ts:60-86](../src/features/auth/rbac.ts#L60-L86); `results:approve` permission not separately enforced. | A dedicated "approve only" sub-permission is not defined; chair-vs-member distinction is by-screen, not by RBAC. |
| §3.4 | جميع شاشات الاستعلام والتقارير والإحصائيات يلزم الطباعة أو الاستخراج بصيغة (Word – Excel – PDF) | All query/report screens must support print + Word/Excel/PDF export | `partial` | [reports.service.ts](../src/features/admin/api/reports.service.ts) (CSV+RTF stubs); [PrintLayout](../src/shared/components/) print stylesheets. | Excel = UTF-8 BOM CSV; Word = RTF stub; full xlsx/docx libs deferred (KARASA_GAPS §1.2.F). |
| §3.4 | يتم التكامل بين مكونات المنظومة، أو أي منظومات مستقبلية مستقبلاً | Integration with future systems | `out_of_scope` | INTEGRATION CONTRACT JSDoc | Forward-looking; backend-bound. |
| §3.4 | يلزم أن تلتزم المنظومة باختبارات فحص الحاسبات والشبكات المحلية (السدنة المصرية) | Comply with Egyptian state-level systems audits | `out_of_scope` | — | Operational/contractual; no codebase impact. |
| §3.4 | يتم تسجيل جميع العمليات داخل المنظومة بسجلات تدقيق (Audit Trail) وفقاً لطبيعة كل تطبيق | All operations logged in Audit Trail per app | `partial` | [audit.service.ts](../src/features/audit/api/audit.service.ts); [AuditPage.tsx](../src/features/admin/pages/AuditPage.tsx) — 80 mock entries. View-level audit on investigations deferred. | KARASA_GAPS confirms AUD-010 deferred. |

### 3.2 RFP §4(1-1) — `تطبيق إدارة منظومة القبول على الإنترنت (Administrator Site)` (pp. 10–14)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(1-1) | الصلاحيات: صلاحية مدير النظام (ضباط كلية الشرطة مديري النظام) | Permission: System-admin (police academy officers) | `done` | `super_admin` role in [rbac.ts:31-35](../src/features/auth/rbac.ts#L31-L35) | — |
| §4(1-1) | يتم ضبط شاشة الدخول ببيانات التسجيل الإلكتروني على منصة التحقق الرقمي عن طريق (API) | Login via MOIPASS digital-verification API | `mocked_only` | [LoginForm.tsx:50-65](../src/features/auth/components/LoginForm.tsx#L50-L65) — 1.5s simulated MOIPASS verification | Real API integration deferred to backend phase. |
| §4(1-1) | يتاح لمديري النظام (من الضباط المختصين) استقبال بيانات التحقق التالية: الرقم القومي / كود الضابط / الاسم الرباعي / رقم الهاتف المحمول | System-admin receives: NID / officer code / 4-name / mobile | `partial` | [LoginForm.tsx](../src/features/auth/components/LoginForm.tsx) collects username + password (legacy demo shape). RFP NID + officer code not separately captured. | UI shape doesn't match RFP-mandated 4-field MOIPASS payload. |
| §4(1-1) | شاشات الإدراج: إدارة حسابات مديري النظام | System-admin account management screens | `done` | [UsersPage.tsx](../src/features/admin/pages/UsersPage.tsx); [users.service.ts](../src/features/admin/api/users.service.ts) | — |
| §4(1-1) | إنشاء وتحديث بيانات مديري النظام بعد التكامل مع منصة التحقق الرقمي | Create/update admins post-MOIPASS integration | `mocked_only` | [users.service.ts](../src/features/admin/api/users.service.ts) — local CRUD; no MOIPASS calls. | — |
| §4(1-1) | تحديد حالة المستخدم (نشط – موقوف) | Set user status (active/suspended) | `done` | [users.service.ts](../src/features/admin/api/users.service.ts) `setActive()` + UsersPage row action | — |
| §4(1-1) | إدراج وإدارة شروط التقدم | Insert/manage admission conditions | `done` | [admissionRules.service.ts:17-90](../src/features/admin/api/admissionRules.service.ts#L17-L90); [AdmissionRulesPage.tsx](../src/features/admin/pages/AdmissionRulesPage.tsx) | — |
| §4(1-1) | تمكن شاشات إدراج وتعديل شروط التقدم البيانات التالية: مسمى التقدم طبقاً للقسم الدراسي وتعريف فتح وقفل باب التقدم لكل فئة من فئات المتقدمين، وصلاحياته وعنواناته وسنة التخرج | Editable: program name × dept, open/close dates per category, conditions, addresses, graduation year | `done` | [CategoryEditPage.tsx](../src/features/admin/pages/CategoryEditPage.tsx); [cycles.service.ts:240-290](../src/features/admin/api/cycles.service.ts#L240-L290) `updateCategoryOverride` + `toggleCategory` | — |
| §4(1-1) | حالة التقدم (الإعلانات الاكتمالية – مرحلة الإدراج) لتتمكم بها أكوار حالات التقدم تتم وفقاً | Application state codes / phases | `done` | [CategoriesListPage.tsx](../src/features/admin/pages/CategoriesListPage.tsx); CategoryEditPage. | — |
| §4(1-1) | الحد الأدنى والحد الأقصى للسن طبقاً للفئة | Min/max age per category | `done` | [admissionRules.service.ts](../src/features/admin/api/admissionRules.service.ts) (`ageMin`, `ageMax`); [domain.ts:155-180](../src/shared/types/domain.ts) (CategoryCondition.ageMin/ageMax) | — |
| §4(1-1) | تعريف نسبة الستى لكل فئة | Pass-percentage per category | `done` | [domain.ts](../src/shared/types/domain.ts) `CategoryCondition.minScorePercent` | — |
| §4(1-1) | الحالة الاجتماعية المطلوبة لكل فئة | Marital status requirement per category | `done` | `maritalStatus` in CategoryCondition | — |
| §4(1-1) | تحديد المقابل المالي للتقدم الإلكتروني لكل سنة | Annual application fee per year | `partial` | [cycles.service.ts](../src/features/admin/api/cycles.service.ts) — fee fields exist on `AdmissionCycle`; per-cell edit UI not exposed (KARASA_GAPS §1.2.C). | — |
| §4(1-1) | تحديد الاختبارات المعتمدة لسنة التقدم وترتيبها | Approved exam set for the cycle + sequencing | `done` | [CategoryEditPage.tsx](../src/features/admin/pages/CategoryEditPage.tsx) `requiredTests` editor with up/down reorder | — |
| §4(1-1) | تحديد التجمل المعارفة، ونوع الطلبة (وروسا – جسماياً) والتخصصات المطلوبة لكل لجنة | Per-committee acquaintances, applicant type + specializations | `partial` | Committee creation form covers most fields, [CommitteeCreatePage.tsx](../src/features/committees/pages/CommitteeCreatePage.tsx); per-committee specializations matrix not exposed | — |
| §4(1-1) | يدمج طلبة القسم العام (دور تاني – وافد – دبلومات أجنبية) بلجنة وحيدة أو فصلها | Merge/split General-Section applicants (2nd sitting / foreign-dipl) into one committee | `partial` | Committee shape supports `applicantType` filter; UI toggle for merge/split not surfaced. | — |
| §4(1-1) | ضبط التقدم بالحد الأدنى والحد الأقصى للمجموع أو التقديرات | Set min/max score/grade for application | `done` | `minScorePercent` in CategoryCondition; AdmissionRulesPage form. | — |
| §4(1-1) | تحديد مواعيد أول اختبار وعدد الأيام المتاحة لاختيار الموعد | Set first-exam window + available booking days | `partial` | EXAM_SLOTS in mock data; admin-side window-config UI not surfaced. | — |
| §4(1-1) | ربط مواعيد الاختبارات باللجان وتحديد السعة الاستيعابية لكل موعد | Link exam slots to committees + capacity per slot | `partial` | EXAM_SLOTS includes `capacity` + `reserved`; admin CRUD UI for slot config absent. | — |
| §4(1-1) | المجموع الكلي الخاص بدفعة المتقدمين | Cohort total cap | `partial` | `AdmissionCycle.capacity` field exists; not editable from UI. | — |
| §4(1-1) | إدارة التنبيهات الخاصة بالمتقدمين | Manage applicant notifications | `partial` | NOTIFICATIONS in mock; per-applicant push UI from admin not present. | KARASA_GAPS §10.4.B — notification center for users only. |
| §4(1-1) | إدراج تفاصيل الإقرار الإلكتروني المعتمد لكل سنة | Insert e-undertaking text per year | `missing` | No screen / no schema field for the undertaking text. | Admin needs a textarea for legal e-consent per cycle. |
| §4(1-1) | إدراج البيانات الخاصة بالمصاريف المعتبرة | Insert eligible-expenses metadata | `missing` | No expense-item config screen. | — |
| §4(1-1) | إدارة الأكواد المرجعية: حالة القرابة وضبطها بشكل دقيق (يبيح معرفة الأصل والفروع وجنس القريب) | Reference codes: relationship-degree (origin/branches/gender) | `done` | [referenceData.ts](../src/shared/mock-data/referenceData.ts) `REF_RELATIONSHIPS`; [ReferenceDataPage.tsx](../src/features/admin/pages/ReferenceDataPage.tsx) | — |
| §4(1-1) | فئات وأنواع القرابة | Relationship categories + types | `done` | REF_RELATIONSHIPS dictionary; degree + side fields | — |
| §4(1-1) | الاختبارات وفئاتها | Exams + categories | `done` | [BANK_QUESTIONS](../src/shared/mock-data/sprint3to9.ts); [QuestionBankCRUDPage.tsx](../src/features/exams/pages/Sprint7Pages.tsx) | — |
| §4(1-1) | الحجج الاختبارات | Exam reasons / categorisation | `done` | Same as above (5 categories) | — |
| §4(1-1) | التخصصات | Specializations | `done` | REFERENCE_DATA.specializations dictionary in [referenceData.ts](../src/shared/mock-data/referenceData.ts) | — |
| §4(1-1) | الجامعات | Universities | `partial` | No dedicated Universities reference; partial overlap with `colleges`. | RFP separates these; impl conflates. |
| §4(1-1) | الكليات | Colleges | `done` | REFERENCE_DATA.colleges in [referenceData.ts](../src/shared/mock-data/referenceData.ts) | — |
| §4(1-1) | ربط التخصصات بالكليات | Bind specializations to colleges | `missing` | No FK on `specializations.collegeId` in REFERENCE_DATA. | — |
| §4(1-1) | فئات المتقدمين | Applicant categories | `done` | [APPLICANT_CATEGORIES](../src/shared/mock-data/categories.ts) — 7 categories | — |
| §4(1-1) | اللجان | Committees (reference) | `done` | COMMITTEES_NAMES dictionary | — |
| §4(1-1) | أكواد التقديرات الجامعية وضبطها بالنسب المعتمدة | University-grade-codes mapped to %s | `missing` | No grade-code lookup table. | — |
| §4(1-1) | تقييم الجامعات والكليات والمعاهد | Universities + colleges + institutes valuation | `partial` | college metadata exists; no "rating" / valuation column. | — |
| §4(1-1) | الجنسيات والدول | Nationalities + countries | `done` | REFERENCE_DATA.nationalities | — |
| §4(1-1) | المحافظات | Governorates | `done` | REF_GOVERNORATES (27 entries) in [referenceData.ts](../src/shared/mock-data/referenceData.ts) | — |
| §4(1-1) | أقسام ومراكز الشرطة | Police precincts/centres | `missing` | No precincts dictionary. | RFP-required for `الجهة المسؤولة` linkage. |
| §4(1-1) | الوظائف وفئاتها | Jobs + categories | `missing` | No job/occupation dictionary. | Used in family-data foreign-employment screen. |
| §4(1-1) | المؤهلات | Qualifications | `done` | REFERENCE_DATA.qualifications in [referenceData.ts](../src/shared/mock-data/referenceData.ts) | — |
| §4(1-1) | التنبيهات العامة للتقدم وضبطها (بالفئة، النوع، التحفة) وتوقيت النشر | General notifications: category × type × timing | `partial` | NOTIFICATIONS mock has type+ts; per-category targeting + publish-time UI absent. | — |
| §4(1-1) | شخصية المتقدمين | Applicant personality data (?) | `evidence_unavailable` | RFP body line is partly garbled by extraction. | Body extraction `شخصية المتقدمين` reads ambiguously. Needs raster review. |
| §4(1-1) | فئة المعاينة | Inspection-stage category | `evidence_unavailable` | Same. | — |
| §4(1-1) | أسباب تركز اسم أوصي | Reasons for "auto-recommend" | `evidence_unavailable` | Body extraction garbled — possibly `أسباب ترك إسم آلي` (auto-skip reasons). | — |
| §4(1-1) | شاشات التحكم المتقدمة: تحديد الاختبار المسؤول عن إخفاء شاشات إدراج بيانات الأقارب الأولية | Advanced control: assign which exam triggers preliminary-relatives | `partial` | Service `committee.assignExamForRelatives` not present. Spec describes a config map. | — |
| §4(1-1) | تحديد الاختبار المسؤول عن إخفاء شاشات إدراج وثائق التعارف | Assign which exam triggers acquaintance doc | `partial` | Same — config map absent; UI-side hardcoded after-Stage-9. | — |
| §4(1-1) | تحديد الاختبار المسؤول عن إخفاء شاشات طباعة وثائق التعارف وتوقيت ذلك (الإدراج – الحذف – التعديل) لوثائق التعارف | Assign exam that gates print of acquaintance doc + timing window | `missing` | No timing-window config. | — |
| §4(1-1) | تحديد المرحلة (الاختبار) المسؤولة عن إخفاء شاشات الأقارب الأولية | Assign stage that gates preliminary-relatives | `missing` | — | — |
| §4(1-1) | تعديل البيانات الدراسية الواردة من (وزارة التربية والتعليم – الأزهر الشريف) | Edit ministry-supplied academic data | `partial` | Stage 4 has override-with-reason flow ([Stage4EducationPage.tsx:50-58](../src/features/applicant-portal/pages/Stage4EducationPage.tsx#L50-L58)); admin-side override UI absent. | — |
| §4(1-1) | تعديل موقف المعاينات الإلكترونية الخاصة بالمتقدمين | Edit applicant-payment status (admin) | `partial` | [users.service.ts](../src/features/admin/api/users.service.ts) covers user CRUD; per-applicant payment override admin UI absent. | — |
| §4(1-1) | شاشات الاستعلام: الاستعلام عن نتائج المتقدمين بالاسم أو الرقم القومي أو الباركود | Query applicants by name/NID/barcode | `done` | [ApplicantsPage.tsx](../src/features/admin/pages/ApplicantsPage.tsx) (DataTable filters); [BarcodeLookupPage.tsx](../src/features/barcode/pages/BarcodePages.tsx) | — |
| §4(1-1) | الاستعلام عن البيانات الواردة من الجهات التعليمية | Query data sourced from MoE/Azhar | `partial` | Mock data exposes verifyCertificate result, no admin-side query screen. | — |
| §4(1-1) | الاستعلام عن موقف المعاينات | Query payment status | `done` | ApplicantsPage filters by payment status | — |
| §4(1-1) | الاستعلام عن موقف وثائق التعارف لطلبه/مجموعة طلبة | Query acquaintance-doc status (one or batch) | `partial` | No batch query for acquaintance-doc state; per-applicant ApplicantDetailPage shows it via Stage 11 indirectly. | — |
| §4(1-1) | شاشات التدقيق والمراجعة - سجل التدقيق (Audit Trail) | Audit/review screens — Audit Trail | `done` | [AuditPage.tsx](../src/features/admin/pages/AuditPage.tsx); 80 entries; CSV export + diff drawer | — |
| §4(1-1) | التقارير والإحصائيات: استخراج تقارير وإحصائيات شاملة عن المتقدمين | Comprehensive applicant reports/stats | `done` | [reports.service.ts](../src/features/admin/api/reports.service.ts) — 9 templates | — |
| §4(1-1) | تقارير إجمالية وتفصيلية طبقاً (للفترة الزمنية – السن – نوع/قسم الطالب – الجنسية – التخصص) | Aggregate + detail reports by period/age/type/nationality/specialization | `done` | reports.service supports these filters | — |
| §4(1-1) | تقرير بإجمالي أعداد الطلبة (خلال فترة – السن – بنوع الطالب – مركز التجنيد – التخصص) | Student totals by period/age/type/recruitment-centre/specialization | `partial` | "Recruitment centre" dimension not in `report:applicants-by-status`. | — |
| §4(1-1) | تقرير ببيانات الطلبة (خلال فترة – السن – بنوع الطالب – مركز التجنيد – التخصص) | Applicant data by same dimensions | `partial` | Same. | — |
| §4(1-1) | تقرير بالطلبة المتوقف عنهم لمعاينة معينة من مراحل الإدراج | Report of applicants halted at a specific insertion stage | `partial` | `report:rejections-with-reasons` covers reasons but not "halt-stage". | — |
| §4(1-1) | أي تقارير أو إحصائيات أخرى متعلقة ببيانات تم إدراجها بالمنظومة | Any other reports on inserted data | `done` | Reports framework is extensible. | — |
| §4(1-1) | جميع شاشات الاستعلام والتقارير والإحصائيات، تتضمن إمكانية الطباعة، أو استخراج البيانات بصيغة (PDF – Excel – Word) | All reports/queries: print + PDF/Excel/Word export | `partial` | Print + CSV(BOM) + RTF. Full xlsx/docx deferred. | — |
| §4(1-1) | آليات تبادل البيانات: تبادل البيانات المختلفة بصيغة (Excel) وتشمل: بيانات الطلبة / بيانات الاختبارات | Excel data exchange: students + exams | `partial` | committee-results-bulk-upload modal stub; no admin-side full students/exams Excel sync. | — |

### 3.3 RFP §4(1-2) — `تطبيق منظومة المتقدمين لكلية الشرطة على الإنترنت (Applicant Site)` (pp. 15–36) — HEADLINE PATH

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(1-2) | الصلاحيات: صلاحية طالب متقدم لكلية الشرطة (مواطن) | Permission: applicant (citizen) | `done` | `applicant` role in [rbac.ts:90-94](../src/features/auth/rbac.ts#L90-L94) | — |
| §4(1-2) | التحقق الأول First Authentication | First-stage authentication | `done` | [Stage1AuthPhonePage.tsx:15-73](../src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx#L15-L73) | NID + mobile; SMS sent (mocked). |
| §4(1-2) | التحقق الثاني Second Authentication (الرقم القومي + رقم الهاتف المحمول المسجل) | Second auth (NID + registered mobile) | `done` | [Stage2AuthSmsPage.tsx](../src/features/applicant-portal/pages/Stage2AuthSmsPage.tsx) | — |
| §4(1-2) Stage 1 | المرحلة (1): التحقق من فتح باب التقدم | Stage 1: verify application period is open | `done` | [categories.service.ts:38-50](../src/features/applicant-portal/api/categories.service.ts#L38-L50) `isCategoryOpenInCycle`; `application_closed` rejection in [EligibilityCheckPage.tsx:42](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx#L42) | — |
| §4(1-2) Stage 2 | المرحلة (2): التحقق من سابقة التقدم | Stage 2: verify no prior application with same NID this cycle | `done` | [categories.service.ts](../src/features/applicant-portal/api/categories.service.ts) — `nid_already_used` rejection reason; [EligibilityCheckPage.tsx:48](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx#L48) | — |
| §4(1-2) Stage 3 | المرحلة (3): التحقق من وجود الرقم القومي بالبيانات الواردة من (وزارة التربية والتعليم – الأزهر الشريف) ومطابقة الطالب لشروط التقدم الخاصة بالقسم العام (دور أول/ثاني) | Stage 3: verify NID against MoE/Azhar + match conditions for General Section (1st/2nd sitting) | `partial` | [Stage4EducationPage.tsx:34-48](../src/features/applicant-portal/pages/Stage4EducationPage.tsx#L34-L48) (verify-with-ministry); [EligibilityCheckPage.tsx](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx) (eligibility check) | RFP couples NID-data lookup with category-conditions match in one step; impl splits across two screens. The 1st-sitting/2nd-sitting branch and Egyptian-foreign/foreign-diplomas certificate paths are not separately UI'd. |
| §4(1-2) Stage 4 | المرحلة (4): التحقق من مطابقة المتقدم للشروط الخاصة بالفئات الأخرى | Stage 4: verify against OTHER categories' conditions; if matches >1 cat, present list | `partial` | [EligibilityCheckPage.tsx:71-202](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx#L71-L202) | One category at a time. The "if not eligible for chosen but eligible for X+Y, show alternative pickable list" branch (RFP p.18 §"المرحلة 4" final bullet) is not implemented. |
| §4(1-2) Stage 5 | المرحلة (5): إدراج البيانات الشخصية والدراسية الخاصة بالمتقدم | Stage 5: insert personal + academic data per category-specific schemas | `done` | [Stage3PersonalPage.tsx](../src/features/applicant-portal/pages/Stage3PersonalPage.tsx) (personal); [Stage4EducationPage.tsx](../src/features/applicant-portal/pages/Stage4EducationPage.tsx) (academic); [Stage5MaritalPage.tsx](../src/features/applicant-portal/pages/Stage5MaritalPage.tsx) (marital) | — |
| §4(1-2) Stage 6 | المرحلة (6): سداد الرسوم الإلكترونية | Stage 6: electronic fee payment (Web Service redirect to gateway, validate code, retry on failure) | `done` (mocked) | [Stage6PaymentPage.tsx](../src/features/applicant-portal/pages/Stage6PaymentPage.tsx); applicantPortalService.initiatePayment | Real gateway integration deferred. |
| §4(1-2) Stage 7 | المرحلة (7): إدراج بيانات الأسرة الأساسية | Stage 7: insert basic family data | `partial` | [Stage7FamilyPage.tsx:30-289](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L30-L289) | RFP p.19–20 enumerates 11 family-member arrays/records. Implementation has 6 fixed (parents+grandparents) + 2 dynamic (siblings + relatives). MISSING (per RFP "إن وجدوا" lists): `أزواج الجدة الأمومية`, `أزواج الجدة الأبوية`, `زوجات الجد الأمومي`, `زوجات الجد الأبوي`, `زوجات الأب`, `أزواج الأم`, `أولاد الجد`. |
| §4(1-2) Stage 8 | المرحلة (8): إدراج بيانات الأقارب الأولية | Stage 8: insert preliminary relatives data | `partial` | Folded into [Stage7FamilyPage.tsx](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx) `relatives` array. | RFP defines this as a SEPARATE stage with its own NID-uniqueness check sub-modal. Not surfaced as a separate screen. |
| §4(1-2) Stage 9 | المرحلة (9): تحديد موعد أول اختبار | Stage 9: choose first-exam appointment | `done` | [Stage8ExamSchedulePage.tsx:24-119](../src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx#L24-L119) | (Note impl-Stage8 = RFP-Stage9 due to merge.) |
| §4(1-2) Stage 10 | المرحلة (10): اصدار كارت التردد | Stage 10: issue attendance card | `done` (visual) / `mocked_only` (barcode) | [Stage9PrintCardPage.tsx](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx) | Card prints; barcode is decorative, not Code 128. |
| §4(1-2) Stage 11 | المرحلة (11): متابعة الاختبارات والنتائج | Stage 11: follow exams and results | `done` | [Stage10FollowUpPage.tsx](../src/features/applicant-portal/pages/Stage10FollowUpPage.tsx); [TestScheduleAndResultsPage.tsx](../src/features/applicant-portal/pages/TestScheduleAndResultsPage.tsx) | — |
| §4(1-2) Stage 12 | المرحلة (12): ادراج بيانات الوثيقة | Stage 12: acquaintance document data | `partial` | [Stage11AcquaintanceDocPage.tsx](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx) | See sub-screens below — most are missing. |
| §4(1-2) Stage 12 sub | إدراج بيانات الأقارب حتى الدرجة الرابعة | Insert relatives to 4th degree | `done` | [Stage7FamilyPage.tsx:140-176](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L140-L176) (`relatives` field array) | Lifecycle in Stage 7, not Stage 12, but data captured. |
| §4(1-2) Stage 12 sub | بيانات دخل الأسرة | Family income data | `missing` | No income fields in [stage11Schema](../src/features/applicant-portal/schemas/) or in Stage 7. | — |
| §4(1-2) Stage 12 sub | بيانات مسكن الأسرة | Family housing data | `partial` | [Stage11AcquaintanceDocPage.tsx:64-77](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx#L64-L77) — single Select (own/rent/family-owned). RFP p.35 wants full breakdown. | — |
| §4(1-2) Stage 12 sub | الأقارب الذين يعملون بجهات أجنبية | Relatives at foreign entities | `missing` | No grep match for `جهات أجنبية` outside spec docs. | — |
| §4(1-2) Stage 12 sub | الأقارب المتجنسين بجنسيات أجنبية | Relatives naturalized foreign | `missing` | No grep match. | — |
| §4(1-2) Stage 12 sub | الخبرات والوظائف السابقة للمتقدم | Applicant prior jobs/experience | `missing` | No fields. | — |
| §4(1-2) Stage 12 sub | قضايا متعلقة بالمتقدم أو أقاربه | Legal cases (applicant or relatives) | `missing` | No fields. | — |
| §4(1-2) Stage 12 sub | طباعة وثيقة التعارف | Print acquaintance document | `done` | [Stage11AcquaintanceDocPage.tsx:147-161](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx#L147-L161) `<PrintLayout restricted>` | The print layout exists; the data inside is incomplete (see above). |
| §4(1-2) screen | شاشة عرض بيانات التقدم للعام الدراسي | Display application data for the academic year | `done` | [CategorySelectionPage.tsx:74-100](../src/features/applicant-portal/pages/CategorySelectionPage.tsx#L74-L100) (active-cycle banner) | — |
| §4(1-2) screen | اختيار فئة التقدم | Select application category | `done` | [CategorySelectionPage.tsx](../src/features/applicant-portal/pages/CategorySelectionPage.tsx) | — |
| §4(1-2) screen | البيانات الشخصية | Personal-data screen | `done` | [Stage3PersonalPage.tsx](../src/features/applicant-portal/pages/Stage3PersonalPage.tsx) | — |
| §4(1-2) screen | البيانات الدراسية لطلبة القسم العام (دور أول / دور ثاني – ثانوي عام / أزهري) | Academic — General-Section (1st/2nd sitting, general/azhar secondary) | `partial` | [Stage4EducationPage.tsx:18-21](../src/features/applicant-portal/pages/Stage4EducationPage.tsx#L18-L21) supports `ثانوية عامة` + `ثانوية أزهرية` (with `azharBranch`) | Missing `دور أول/دور ثاني` (1st/2nd sitting) field; Stage 4 has only one record. |
| §4(1-2) screen | البيانات الدراسية لطلبة القسم العام (وافد مصري / دبلومات أجنبية) | Academic — Egyptian-foreign / foreign diplomas | `missing` | No `وافد` or foreign-diploma branch in stage 4 schema. | RFP p.25 requires separate handling. |
| §4(1-2) screen | البيانات الدراسية لطلبة القسم الخاص / الحقوقيين / ماجستير/دكتوراه | Academic — Special-section / Lawyers / Master/PhD | `partial` | Categories support `bachelor_law`, `bachelor`, `serving_officer` qualifications in [domain.ts](../src/shared/types/domain.ts) but Stage 4 only collects `ثانوية` data. | A separate "specialized data" sub-form for Master/PhD is not present. |
| §4(1-2) screen | الدفع الإلكتروني | Electronic payment | `done` | [Stage6PaymentPage.tsx](../src/features/applicant-portal/pages/Stage6PaymentPage.tsx) | — |
| §4(1-2) screen | شاشة الدفع الخارجية | External payment screen (gateway redirect) | `mocked_only` | Stage6 simulates web-service redirect; real Fawry/card gateway absent. | — |
| §4(1-2) screen | شاشة بيانات الأسرة | Family data screen | `partial` | [Stage7FamilyPage.tsx](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx) | See Stage 7 gap above. |
| §4(1-2) screen | شاشة بيانات الأقارب الأولية | Preliminary relatives screen | `partial` | Folded into Stage 7. | RFP-required as a separate screen with its own NID dedup modal. |
| §4(1-2) screen | شاشة تحديد موعد الاختبار الأول | First-exam appointment screen | `done` | [Stage8ExamSchedulePage.tsx](../src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx) | — |
| §4(1-2) screen | شاشة طباعة كارت التردد | Print attendance-card screen | `done` | [Stage9PrintCardPage.tsx](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx) | — |
| §4(1-2) screen | التنبيهات العامة | General notifications | `done` | NotificationCenter in [AppShell](../src/app/layouts/) | — |
| §4(1-2) screen | متابعة مواعيد ونتائج الاختبارات | Follow exam schedules + results | `done` | [TestScheduleAndResultsPage.tsx](../src/features/applicant-portal/pages/TestScheduleAndResultsPage.tsx); [Stage10FollowUpPage.tsx](../src/features/applicant-portal/pages/Stage10FollowUpPage.tsx) | — |
| §4(1-2) screen | إدراج بيانات الأقارب حتى الدرجة الرابعة | 4th-degree relatives (Stage 12 detail) | `done` | Stage7 `relatives` field array | — |
| §4(1-2) screen | بيانات دخل الأسرة | Family income (Stage 12 detail) | `missing` | — | — |
| §4(1-2) screen | بيانات مسكن الأسرة | Family housing (Stage 12 detail) | `partial` | Stage 11 housing select. | — |
| §4(1-2) screen | الأقارب الذين يعملون بجهات أجنبية | Foreign-employed relatives (Stage 12 detail) | `missing` | — | — |
| §4(1-2) screen | الأقارب المتجنسين بجنسيات أجنبية | Foreign-naturalized relatives (Stage 12 detail) | `missing` | — | — |
| §4(1-2) screen | الخبرات والوظائف السابقة للمتقدم | Applicant prior jobs (Stage 12 detail) | `missing` | — | — |
| §4(1-2) screen | قضايا متعلقة بالمتقدم أو أقاربه | Legal cases (Stage 12 detail) | `missing` | — | — |
| §4(1-2) screen | طباعة وثيقة التعارف | Print acquaintance doc | `done` (shell only) | [Stage11AcquaintanceDocPage.tsx:147-161](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx#L147-L161) | Print works; content is sparse. |
| §4(1-2) data exchange | رفع بيانات الطلبة وبيانات الاختبارات / بيانات اللجان | Applicant + exam + committee data exchange (mock) | `partial` | INTEGRATION CONTRACT JSDoc per service; Excel import deferred. | — |
| §4(1-2) data exchange | بيانات أكواد المنظومة | Reference-code exchange | `done` | [referenceData.service.ts](../src/features/admin/api/referenceData.service.ts) | — |
| §4(1-2) data exchange | رفع بيانات الجهة والمواعيد الاختبارات | Upload exam-committee schedules | `partial` | EXAM_SLOTS in mock; admin upload UI absent. | — |
| §4(1-2) data exchange | رفع بيانات متقدمي القسم العام (ثانوية عامة، أزهري) القادمة من (وزارة التربية والتعليم – الأزهر الشريف) | Upload general-section applicant data from MoE/Azhar | `mocked_only` | service stub. | — |
| §4(1-2) data exchange | رفع شروط التقدم وحفظها بسنة التقدم | Upload + save admission rules versioned per cycle | `done` | [admissionRules.service.ts](../src/features/admin/api/admissionRules.service.ts) — versioned per cycle | — |

### 3.4 RFP §4(2-1) — `تطبيق إدارة لجان القبول على الشبكة الداخلية` (Committees, pp. 41–60)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-1) | الصلاحيات: شاشات صلاحية مدير النظام | Committees system-admin permission | `done` | `super_admin` + `committee_admin` in [rbac.ts:36-49](../src/features/auth/rbac.ts#L36-L49) | — |
| §4(2-1) | شاشات إدارة المستخدمين (مدير النظام) | User management (admin) | `done` | [UsersPage.tsx](../src/features/admin/pages/UsersPage.tsx) | Shared with admin app. |
| §4(2-1) | شاشات الإدراج (مدير النظام) | Insert screens (admin) | `done` | [CommitteeCreatePage.tsx](../src/features/committees/pages/CommitteeCreatePage.tsx) | — |
| §4(2-1) | شاشات التحكم المتقدمة (مدير النظام) | Advanced control screens (admin) | `partial` | [CommitteeDetailPage.tsx](../src/features/committees/pages/CommitteeDetailPage.tsx) covers most; per-RFP-p.44 fine-grained controls (e.g. "تجميد لجنة") not surfaced. | — |
| §4(2-1) | شاشات الاستعلام والتقارير والإحصائيات (مدير النظام) | Query/reports/stats (admin) | `done` | [CommitteeListPage.tsx](../src/features/committees/pages/CommitteeListPage.tsx); [CommitteeSchedulePage.tsx](../src/features/committees/pages/CommitteeSchedulePage.tsx) | — |
| §4(2-1) | شاشات تبادل البيانات (مدير النظام) | Data-exchange screens (admin) | `partial` | committee-results-bulk-upload modal stub. | xlsx parser deferred. |
| §4(2-1) | شاشات صلاحية مدير لجنة طلبة | Student-committee admin permission | `partial` | `committee_admin` role in [rbac.ts:36-49](../src/features/auth/rbac.ts#L36-L49); CommitteeDetailPage covers most actions. | RFP-defined sub-screens (manage-users, advanced-control) not exposed at the role granularity. |
| §4(2-1) | شاشات صلاحية مدخل بيانات لجنة طلبة | Student-committee data-entry permission | `partial` | `committee_user` role in [rbac.ts:50-54](../src/features/auth/rbac.ts#L50-L54); same `/committee/:id` page. | Per-role distinct page set not built; RBAC differentiates within the same page. |
| §4(2-1) | شاشات صلاحية مدير لجنة اختبار | Test-committee admin permission | `partial` | Same shared page. | — |
| §4(2-1) | شاشات صلاحية مدرج نتائج اختبار | Test-result-entry permission | `partial` | `records_clerk` role in [rbac.ts:85-89](../src/features/auth/rbac.ts#L85-L89); enters results via shared page. | — |
| §4(2-1) | صلاحية بوابة الأمن | Security-gate permission | `partial` | `biometric_user` role with `بوابة الأمن` label in [rbac.ts:80-84](../src/features/auth/rbac.ts#L80-L84). Used in biometric verify-ops + barcode scan. | The dedicated "security-gate insert + query" set in RFP p.57–58 (entry/exit log table) is not separately surfaced. |
| §4(2-1) | صلاحية إعادة المقابل المالي للطلبة (Refund) | Refund permission | `missing` | No `refund` role; no `/admin/refunds` page; no `refundService`. | **Headline gap #1.** RFP p.58 enumerates query+stat screens for this role. Add `refund_admin` role + page + service. |
| §4(2-1) | صلاحية الاستعلامات | Inquiries permission (general) | `partial` | RBAC `permissions: ['applicants:view']` covers read access; no separate "inquirer" role. | — |
| §4(2-1) | صلاحية استعلامات رئاسة الأكاديمية | Academy-Leadership Inquiries permission | `missing` | No matching role/screen. | **Headline gap #2.** RFP p.60 separates leadership inquiries from staff inquiries. |
| §4(2-1) sub | شاشات الإدراج: إنشاء وإدارة لجان القبول | Create/manage committees | `done` | [CommitteeCreatePage.tsx](../src/features/committees/pages/CommitteeCreatePage.tsx) | — |
| §4(2-1) sub | إدخال نتائج الاختبارات (مرحلة أولية → مراجعة → اعتماد) | Two-phase result entry | `done` | [CommitteeDetailPage.tsx:120-221](../src/features/committees/pages/CommitteeDetailPage.tsx#L120-L221) | — |
| §4(2-1) sub | تجميد المتقدمين / استبعاد المتقدمين | Suspend / exclude applicants | `done` | [CommitteeDetailPage.tsx:72-98](../src/features/committees/pages/CommitteeDetailPage.tsx#L72-L98) (`SuspendedBadge`); [Applicant.status='on-hold' | 'rejected'](../src/shared/types/domain.ts) | — |
| §4(2-1) sub | إدخال بيانات حضور (الكنترول/التحضير) | Attendance / control data | `partial` | Barcode scan logs attendance via [barcode.service.ts](../src/features/barcode/api/barcode.service.ts); per-applicant attendance grid not surfaced. | — |
| §4(2-1) sub | تخصيص اللجان حسب الفئة | Allocate committees by category | `partial` | Committee shape supports `category`; admin-side bulk reassignment UI not present. | — |
| §4(2-1) sub | استعلامات الطلبة بمعايير متعددة (الاسم/NID/الباركود) | Multi-criteria applicant query | `done` | [ApplicantsPage.tsx](../src/features/admin/pages/ApplicantsPage.tsx) DataTable filters | — |
| §4(2-1) sub | تقارير اللجان (الحضور / النتائج / المعتمدون) | Committee reports (attendance/results/approved) | `partial` | reports.service has `report:applicants-by-status`; per-committee breakdown shipped on detail page; dedicated print template absent. | — |

### 3.5 RFP §4(2-2) — `تطبيق الهيئة وأمانة سر الهيئة` (Board, pp. 61–63)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-2) | الغرض من التطبيق | Application purpose | `done` | [BoardPages.tsx](../src/features/board/pages/BoardPages.tsx) | — |
| §4(2-2) | الصلاحيات: مدير النظام | Board system-admin permission | `done` | `super_admin` + `board_admin` in [rbac.ts:70-74](../src/features/auth/rbac.ts#L70-L74) | — |
| §4(2-2) | الصلاحيات: مدير لجنة أمانة سر الهيئة | Board-secretariat manager permission | `done` | `board_admin` role | — |
| §4(2-2) | الصلاحيات: عضو جلسة الهيئة | Board-session member permission | `partial` | `board_admin` covers; per-member distinct UI not built. | — |
| §4(2-2) | الصلاحيات: رئيس جلسة الهيئة | Board-session chair permission | `partial` | Live-session page exposes chair-only controls in [Sprint6Pages.tsx](../src/features/board/pages/Sprint6Pages.tsx) but RBAC doesn't have a separate `board_chair` role. | — |
| §4(2-2) | شاشات مدير النظام: إدارة المستخدمين / الإدراج / الاستعلام | System admin: user mgmt + insert + query | `partial` | Shared admin pages. | Per-role distinct screen set not separated. |
| §4(2-2) | شاشات مدير لجنة أمانة سر الهيئة | Board-secretary manager screens | `done` | [BoardSessionsListPage](../src/features/board/pages/Sprint6Pages.tsx); [BoardSessionCreatePage](../src/features/board/pages/Sprint6Pages.tsx); [BoardMembersPage](../src/features/board/pages/Sprint6Pages.tsx) | — |
| §4(2-2) | شاشات عضو جلسة الهيئة | Board member screens (vote on applicant) | `done` | [Sprint6Pages.tsx — BoardSessionLivePage](../src/features/board/pages/Sprint6Pages.tsx) per-member vote (pass/reject/defer) | — |
| §4(2-2) | شاشات رئيس جلسة الهيئة | Board chair screens (start/close session, tally) | `done` | Sprint6Pages BoardSessionLivePage chair-only tally + start/close | — |
| §4(2-2) | شاشات الاستعلام والتقارير والإحصائيات | Board queries / reports / stats | `partial` | [BoardDecisionsListPage](../src/features/board/pages/Sprint6Pages.tsx) lists decisions; print decisions via [PrintLayout](../src/shared/components/). | Aggregate board stats UI not surfaced. |
| §4(2-2) | استخراج محاضر الجلسات والقرارات | Generate session minutes + decision documents | `done` | [Sprint6Pages.tsx — Decision PrintLayout](../src/features/board/pages/Sprint6Pages.tsx) — auto-numbered «د/2026/NNNN» + Hijri + Gregorian + signature grid | — |
| §4(2-2) | شاشات قائمة الحالات (تجميع ملف الطالب) | Case file consolidation page | `partial` | `boardService.getApplicantCaseFile()` shape exists; dedicated `/board/applicants/:id` page deferred — admin's `/admin/applicants/:id` covers it (KARASA_GAPS §4.2.E). | — |

### 3.6 RFP §4(2-3) — `تطبيق التحريات` (Investigations, pp. 64–69)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-3) | الغرض من التطبيق | Application purpose | `done` | [InvestigationsLayout](../src/features/investigations/InvestigationsLayout.tsx) (terra «سرّي» banner) | — |
| §4(2-3) | دورة العمل وخصائص المنظومة | Work cycle + system properties | `done` | [investigations.service.ts](../src/features/investigations/api/investigations.service.ts) | — |
| §4(2-3) | الصلاحيات: شاشات مدير لجنة تحريات "أ" | Investigation Committee "أ" admin | `partial` | `investigator` role in [rbac.ts:65-69](../src/features/auth/rbac.ts#L65-L69); no committee-distinguishing flag. | RFP separates committee A vs C (national vs criminal); a single role serves both. |
| §4(2-3) | شاشات مدخل بيانات تحريات الوطني | National-Investigations data-entry | `partial` | Same `investigator` role. | National-specific data-entry screen not differentiated. |
| §4(2-3) | شاشات مدير لجنة تحريات "ج" | Investigation Committee "ج" admin | `partial` | Same. | — |
| §4(2-3) | شاشات مدخل بيانات تحريات الجنائي | Criminal-Investigations data-entry | `partial` | Same. | — |
| §4(2-3) | شاشات الإدراج: إنشاء حالة تحري + تكليف محقق | Create case + assign investigator | `done` | [InvestigationCreatePage.tsx](../src/features/investigations/pages/InvestigationCreatePage.tsx) (applicant + type لجنة أ/ج + investigator + priority) | — |
| §4(2-3) | شاشات إدراج: نتائج التحري وقرار اللجنة | Investigation result + decision | `done` | [InvestigationDetailPage.tsx](../src/features/investigations/pages/InvestigationDetailPage.tsx) (checklist + conclusion + decision in `<PrintLayout restricted>`) | — |
| §4(2-3) | شاشات الإدراج: مكاتبات صادرة | Outgoing letters | `done` | [OutgoingLettersPage.tsx](../src/features/investigations/pages/OutgoingLettersPage.tsx) | — |
| §4(2-3) | شاشات الإدراج: توزيع الحالات (كشف توزيع) | Case distribution / printable list | `done` | [DistributionPage.tsx](../src/features/investigations/pages/DistributionPage.tsx) (auto-balance + restricted print) | — |
| §4(2-3) | شاشات الاستعلامات والتقارير والإحصائيات | Investigation queries / reports / stats | `partial` | [InvestigationsPages.tsx — InvestigationsCasesPage](../src/features/investigations/pages/InvestigationsPages.tsx); cases table + filters. Aggregated stats UI absent. | — |
| §4(2-3) | شاشات التحكم المتقدمة | Advanced control screens | `partial` | Same — fine-grained admin controls (reassign, escalate, archive) limited. | — |
| §4(2-3) | كافة المخرجات لها وضع طبع مقيد (سري للغاية) | All outputs print as «سرّي للغاية» | `done` | All print outputs use `<PrintLayout restricted>` — see [PrintLayout component](../src/shared/components/) | — |
| §4(2-3) | تسجيل عمليات الاستعلام / المشاهدة بسجل تدقيق | View-level audit logging | `partial` | KARASA_GAPS confirms AUD-010 deferred. | View-level audit hook needs adding to InvestigationDetailPage. |
| §4(2-3) | عرض شجرة العائلة بصورة بصرية | Visual family tree | `partial` | KARASA_GAPS §5.2.B notes "deferred"; current view shows flat applicant summary; Stage-7 data structure available for tree-rendering. | — |

### 3.7 RFP §4(2-4) — `تطبيق قوميسيون الخدمات الطبية` (Medical, pp. 70–77)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-4) | الغرض من التطبيق | Application purpose | `done` | [MedicalLayout](../src/features/medical/MedicalLayout.tsx) | — |
| §4(2-4) | دورة العمل وخصائص المنظومة | Work cycle + system properties | `done` | [medical.service.ts](../src/features/medical/api/medical.service.ts) | — |
| §4(2-4) | الصلاحيات: مدير النظام | Medical system-admin permission | `done` | `medical_admin` in [rbac.ts:55-59](../src/features/auth/rbac.ts#L55-L59) | — |
| §4(2-4) | الصلاحيات: عيادة اختبار / طبيب فحص | Per-clinic doctor permission | `done` | `medical_doctor` in [rbac.ts:60-64](../src/features/auth/rbac.ts#L60-L64) | — |
| §4(2-4) | الصلاحيات: رئيس لجنة اختبار طبي | Medical exam-committee chair | `partial` | `medical_admin` covers chair actions; no separate `medical_chair` role. | — |
| §4(2-4) | الصلاحيات: مدرج نتائج اختبار طبي | Medical result-entry permission | `done` | `records_clerk` in [rbac.ts:85-89](../src/features/auth/rbac.ts#L85-L89); `medical_doctor` enters per-station. | — |
| §4(2-4) | شاشات إدارة المستخدمين | User management | `done` | Shared admin UsersPage. | — |
| §4(2-4) | شاشات إدارة أكواد المنظومة | System reference codes | `done` | [ReferenceDataPage.tsx](../src/features/admin/pages/ReferenceDataPage.tsx) | — |
| §4(2-4) | شاشات التحكم المتقدمة | Advanced control screens | `partial` | [MedicalPages.tsx — MedicalQueuePage / MedicalResultsPage / MedicalOverviewPage](../src/features/medical/pages/MedicalPages.tsx); per-station per-day capacity controls absent. | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): العيون | Eye station insert | `done` | [StationExamPage.tsx](../src/features/medical/pages/StationExamPage.tsx); STATION_LABELS.eye | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): الأنف والأذن والحنجرة | ENT station insert | `done` | StationExamPage; STATION_LABELS.ent | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): الباطنة | Internal medicine | `done` | StationExamPage; STATION_LABELS.internal | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): العظام | Orthopedic | `done` | StationExamPage; STATION_LABELS.orthopedic | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): الأعصاب | Neurology | `done` | StationExamPage; STATION_LABELS.neuro | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): الاتزان النفسي | Psychology / mental balance | `done` | StationExamPage; STATION_LABELS.psychology | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): الجراحة العامة | General surgery | `done` | StationExamPage; STATION_LABELS.surgery | — |
| §4(2-4) | شاشات الإدراج (8 عيادات): المقاسات | BMI / measurements | `done` | StationExamPage with `<Gauge>` chart; STATION_LABELS.bmi | — |
| §4(2-4) | شاشات صلاحية رئيس لجنة اختبار طبي: إدارة المستخدمين / الإدراج / الاستعلام | Medical chair: user mgmt + insert + query | `partial` | Shared screens; not role-distinct UI. | — |
| §4(2-4) | شاشات صلاحية مدرج نتائج اختبار طبي: الإدراج / الاستعلام | Medical result-entry: insert + query | `done` | StationExamPage save preliminary/final; MedicalResultsPage queries. | — |
| §4(2-4) | الشهادة الطبية النهائية / المعتمدة (تجميع 8 عيادات) | Final/certified medical certificate | `done` | [MedicalCertificatePage.tsx](../src/features/medical/pages/MedicalCertificatePage.tsx) (auto-rule: any FAIL → fail; conditional → board-review) | — |
| §4(2-4) | تكامل مع أجهزة الفحص (الميزان الرقمي – جهاز ضغط الدم) | Equipment integration (digital scale, BP monitor) | `out_of_scope` | Field forms accept device input via `data-source="device"` placeholder; integration deferred. | — |
| §4(2-4) | إخطار اللجنة بالتوصية الطبية | Notify committee with medical recommendation | `partial` | medicalService outputs `verdict` consumed by committee; cross-app push notification absent. | — |

### 3.8 RFP §4(2-5) — `تطبيق إنشاء وطباعة الباركود` (Barcode, pp. 78–82)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-5) | الغرض من التطبيق | Application purpose | `done` | [BarcodePages.tsx — BarcodeGeneratePage](../src/features/barcode/pages/BarcodePages.tsx) | — |
| §4(2-5) | دورة العمل وخصائص المنظومة | Work cycle + properties | `done` | [barcode.service.ts](../src/features/barcode/api/barcode.service.ts) | — |
| §4(2-5) | شاشات مديرو النظام بالكلية | College system-admins | `done` | super_admin / committee_admin access; BarcodeGeneratePage. | — |
| §4(2-5) | شاشات مستخدمي لجان الطلبة | Student-committee users | `done` | committee_user role; BarcodeGeneratePage shared. | — |
| §4(2-5) | شاشات مستخدمي لجان الاختبارات بالكلية | Test-committee users | `done` | Same. | — |
| §4(2-5) | شاشات مديرو النظام بالقومسيون | Medical-commission system-admins | `done` | medical_admin includes barcode access in [rbac.ts:55-59](../src/features/auth/rbac.ts#L55-L59) | — |
| §4(2-5) | شاشات مستخدمي لجان الاختبارات بالقومسيون | Medical-test users | `done` | medical_admin / medical_doctor. | — |
| §4(2-5) | شاشات مدخل نتائج بالقومسيون | Medical result-entry barcode users | `done` | records_clerk has medical app access. | — |
| §4(2-5) | إنشاء باركود (Code 128) معرف للمتقدم | Generate Code-128 barcode | `mocked_only` | [Stage9PrintCardPage.tsx:196-208](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx#L196-L208) `BarcodeBars` is decorative SVG, not Code 128. | Real `JsBarcode` deferred (KARASA_GAPS §7.2.A). |
| §4(2-5) | مسح الباركود (Scanner Interface) | Scan barcode (camera) | `mocked_only` | [Sprint8Pages.tsx — BarcodeScannerPage](../src/features/barcode/pages/Sprint8Pages.tsx) — manual code-input + station + action select; camera scan deferred. | — |
| §4(2-5) | تسجيل كل عملية مسح بسجل تدقيق | Audit log per scan | `done` | [barcode.service.ts](../src/features/barcode/api/barcode.service.ts) — scan logs scannedBy/ts/applicantId/station/action; 10s duplicate-detection. | — |
| §4(2-5) | إصدار باركود بديل (Replacement) عند الفقد | Replacement barcode flow | `done` | [Sprint8Pages.tsx — BarcodeReplacementPage](../src/features/barcode/pages/Sprint8Pages.tsx) (void existing + new barcode + reason) | — |
| §4(2-5) | تكامل مع البيومتري واللجان | Cross-app barcode→biometric→committee orchestration | `partial` | BiometricVerifyOpsPage accepts `barcode` as method; full E2E orchestration deferred (KARASA_GAPS §7.2.D). | — |

### 3.9 RFP §4(2-6) — `تطبيق تسجيل واستعلام بيومتري` (Biometric, pp. 83–87)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-6) | الغرض من التطبيق | Application purpose | `done` | [BiometricPages.tsx — BiometricVerifyPage](../src/features/biometric/pages/BiometricPages.tsx) | — |
| §4(2-6) | دورة العمل وخصائص المنظومة | Work cycle + properties | `done` | [biometric.service.ts](../src/features/biometric/api/biometric.service.ts) | — |
| §4(2-6) | شاشات رؤساء لجان الطلبة | Student-committee chairs | `done` | committee_admin access. | — |
| §4(2-6) | شاشات رؤساء لجان الاختبارات بمنظومة لجان القبول | Exam-committee chairs (committees app) | `done` | committee_admin. | — |
| §4(2-6) | شاشات مستخدمي صلاحية بوابة الأمن | Security-gate users | `done` | `biometric_user` role in [rbac.ts:80-84](../src/features/auth/rbac.ts#L80-L84) | — |
| §4(2-6) | شاشات مديرو النظام بتطبيق لجان القبول | Committee-system admins (biometric usage) | `done` | committee_admin includes biometric app. | — |
| §4(2-6) | شاشات رؤساء لجان الاختبارات بمنظومة (القومسيون) | Medical-test chairs (biometric usage) | `done` | medical_admin includes biometric. | — |
| §4(2-6) | شاشات مديرو العيادات بمنظومة (القومسيون) | Clinic admins (biometric usage) | `done` | medical_admin. | — |
| §4(2-6) | تسجيل بيومتري (وجه + بصمة) | Biometric enrollment (face + fingerprint) | `mocked_only` | [BiometricEnrollPage](../src/features/biometric/pages/BiometricPages.tsx) — 4-step wizard with placeholders; real `getUserMedia()` + fingerprint device deferred (KARASA_GAPS §8.2.A). | — |
| §4(2-6) | استعلام بيومتري (التحقق) | Biometric verification | `done` (UI mocked) | [Sprint8Pages.tsx — BiometricVerifyOpsPage](../src/features/biometric/pages/Sprint8Pages.tsx) — method (face/fingerprint/barcode) + station + result with confidence. | — |
| §4(2-6) | لوحة المراقبة الحية للتحقق | Live monitoring dashboard | `done` | [Sprint8Pages.tsx — BiometricMonitoringPage](../src/features/biometric/pages/Sprint8Pages.tsx) — 3 stations + 24h LineChart + failures feed. | — |
| §4(2-6) | حماية الخصوصية: تخزين القوالب فقط، لا الصور الخام | Privacy: templates-only | `done` | Privacy banner in BiometricEnrollPage; templates-only model documented in service JSDoc. | — |

### 3.10 RFP §4(2-7) — `تطبيق بنك الأسئلة واختبارات إلكترونية` (Question Bank + Electronic Tests, pp. 88–90)

| RFP § | Requirement (Arabic verbatim) | Translation | Status | Evidence (path:lines) | Gap details |
|---|---|---|---|---|---|
| §4(2-7) | الغرض من التطبيق | Application purpose | `done` | [ExamsPages.tsx — QuestionBankPage / ExamsListPage](../src/features/exams/pages/ExamsPages.tsx) | — |
| §4(2-7) | دورة العمل | Work cycle | `done` | [exams.service.ts](../src/features/exams/api/exams.service.ts) | — |
| §4(2-7) | شاشات مديرو النظام (بنك الأسئلة) | System admins (question bank) | `done` | `exams_admin` in [rbac.ts:75-79](../src/features/auth/rbac.ts#L75-L79); [Sprint7Pages.tsx — QuestionBankCRUDPage](../src/features/exams/pages/Sprint7Pages.tsx) | — |
| §4(2-7) | إدارة الأسئلة (CRUD + الحالة draft/live) | Question CRUD + state | `done` | QuestionBankCRUDPage (draft → live publish; version on edit) | — |
| §4(2-7) | تصنيف الأسئلة بفئات / مستويات صعوبة | Categories + difficulty | `done` | BANK_QUESTIONS schema in [domain.ts](../src/shared/types/domain.ts); examsService.getCategories. | — |
| §4(2-7) | استيراد جماعي (Bulk Excel) | Bulk Excel import | `partial` | UI placeholder in QuestionBankCRUDPage; xlsx parser deferred (KARASA_GAPS §9.2.A). | — |
| §4(2-7) | محرر نص غني + رفع صور | Rich text editor + image upload | `partial` | Plain textarea today (KARASA_GAPS §9.2.A). | — |
| §4(2-7) | شاشات مديرو لجان الاختبارات | Test-committee admins | `done` | exams_admin role; [ExamCreatePage](../src/features/exams/pages/Sprint7Pages.tsx) (name + scheduled date + count). | — |
| §4(2-7) | إنشاء اختبار: قواعد الاختيار التلقائي للأسئلة | Auto-pick exam construction rules | `partial` | Single-form covers demo (KARASA_GAPS §9.2.C); rule-based wizard deferred. | — |
| §4(2-7) | شاشات المختبر/المتقدم (live exam) | Live exam interface | `done` | [Sprint7Pages.tsx — LiveExamPage](../src/features/exams/pages/Sprint7Pages.tsx) — pre-bio-check → exam (timer + flag) → submitted | — |
| §4(2-7) | منع الغش: full-screen / منع التبديل / منع النسخ | Anti-cheating: fullscreen / no-tab-switch / no-copy/paste | `partial` | UI placeholder; deferred (KARASA_GAPS §9.2.D). | — |
| §4(2-7) | شاشة الإشراف (Proctor) | Proctor view | `done` | [Sprint7Pages.tsx — ProctorViewPage](../src/features/exams/pages/Sprint7Pages.tsx) — live attempts feed | — |
| §4(2-7) | تصحيح تلقائي + نسبة نجاح | Auto-grade + pass threshold | `done` | examsService.submitAttempt → 60% pass | — |
| §4(2-7) | منع إعادة الاختبار قبل 6 أشهر | Prevent retake within 6 months (per K§3.5) | `done` | [exams.service.ts](../src/features/exams/api/exams.service.ts) `checkConflict()` | — |
| §4(2-7) | شاشات الاستعلام / الإحصائيات / التقارير | Inquiries / stats / reports | `partial` | [ExamsPages.tsx — ExamsResultsPage](../src/features/exams/pages/ExamsPages.tsx) (charts); per-question stats deferred. | — |

### 3.11 General Conditions + SLA (RFP pp. 91–108)

| RFP § | Requirement | Status | Evidence | Gap details |
|---|---|---|---|---|
| SLA — performance targets | Response time / throughput / availability | `out_of_scope` | [src/features/architecture/pages/ArchitecturePage.tsx](../src/features/architecture/pages/ArchitecturePage.tsx) §9 lists bidder-proposed baselines | Operational; not screen-level. |
| SLA — security audits | Penetration / 27001 / 151/2020 | `out_of_scope` | ArchitecturePage §5 + §8 documents posture. | — |
| SLA — disaster recovery | RPO/RTO targets | `out_of_scope` | ArchitecturePage §6 lists DR targets. | — |
| SLA — backup | Data backup policy | `out_of_scope` | — | Operational. |
| SLA — training + handover | Training, source-code ownership, documentation | `out_of_scope` | ArchitecturePage §8 mentions source-code ownership | Contractual. |
| SLA — warranty | 12-month warranty | `out_of_scope` | — | Contractual. |
| SLA — change management | Change requests, version control | `out_of_scope` | — | Operational. |
| SLA — environment requirements | Browser support, hardware specs | `out_of_scope` | [README.md](../README.md) lists tested browsers. | — |

---

## 4 · Cross-cutting findings

### 4.1 RBAC roles in `rbac.ts` vs. roles named in the RFP

**RFP-named roles missing from [rbac.ts](../src/features/auth/rbac.ts):**

- `refund_admin` (`صلاحية إعادة المقابل المالي للطلبة`) — RFP §4(2-1) p.58. **Missing entirely.**
- `academy_leadership_inquiries` (`صلاحية استعلامات رئاسة الأكاديمية`) — RFP §4(2-1) p.60. **Missing entirely.**
- `board_chair` / `board_member` distinction — RFP §4(2-2) names both; impl has only `board_admin`. The chair-only controls in `BoardSessionLivePage` work by-state, not by-role.
- `investigation_chair_a` / `investigation_chair_c` / `national_data_entry` / `criminal_data_entry` — RFP §4(2-3) names four investigations sub-roles; impl has one `investigator`.
- `medical_chair` — RFP §4(2-4) names; impl uses `medical_admin` for both system-admin and chair.
- `committee_chair` (test-committee admin), `student_committee_admin`, `student_committee_data_entry`, `test_result_entry` — RFP §4(2-1) names four committee roles; impl has two (`committee_admin` + `committee_user`) plus `records_clerk`.

**Roles in `rbac.ts` not explicitly named in the RFP role list:** none — every impl role maps to a named RFP function.

### 4.2 Two-phase signature affordance — staff workflows

**Cleanly implemented (RFP officer-enters / chair-approves pattern + canonical preliminary/final affordances):**

- Committees: [CommitteeDetailPage.tsx:120-221](../src/features/committees/pages/CommitteeDetailPage.tsx#L120-L221) — `قيد المراجعة` → `معتمد` with `IconStamp`.
- Medical (per-station): [StationExamPage.tsx](../src/features/medical/pages/StationExamPage.tsx) save preliminary / approve final.
- Exams: [Sprint7Pages.tsx — QuestionBankCRUDPage](../src/features/exams/pages/Sprint7Pages.tsx) — `draft → review → approved → live`.

**Workflows where RFP describes the two-phase pattern but impl doesn't surface it:**

- Investigations decisions ([InvestigationDetailPage.tsx](../src/features/investigations/pages/InvestigationDetailPage.tsx)) — RFP §4(2-3) p.66 describes investigator-fills / chair-approves; impl persists a single `decision` field. Not a HARD gap (matches the demo flow), but inconsistent with the canon.
- Board decisions ([Sprint6Pages.tsx — BoardSessionLivePage](../src/features/board/pages/Sprint6Pages.tsx)) — chair tally is correctly chair-only. The `معتمد` stamp on the final printed decision page would benefit from the canonical `<IconStamp>` glyph (currently uses `<IconSeal>` which is for ministerial seal, not approved-stamp).

### 4.3 Data-exchange integrations — INTEGRATION CONTRACT JSDoc

RFP §3 names these integration points; impl JSDoc coverage:

| Integration | RFP citation | INTEGRATION CONTRACT in code? |
|---|---|---|
| MOIPASS digital-verification | §3.1 + §4(1-1) p.10 | Yes — [LoginForm.tsx:50-65](../src/features/auth/components/LoginForm.tsx#L50-L65) JSDoc |
| MoE / Al-Azhar academic data | §3.1 + §4(1-2) Stage 3 p.17 | Yes — [applicantPortal.service.ts:68-90](../src/features/applicant-portal/api/applicantPortal.service.ts#L68-L90) `verifyCertificate` |
| Payment gateway (Fawry / card) | §4(1-2) Stage 6 p.19 | Yes — [applicantPortal.service.ts](../src/features/applicant-portal/api/applicantPortal.service.ts) `initiatePayment` |
| Hardware SDK (digital scale, BP monitor, biometric devices) | §4(2-4) p.70, §4(2-6) p.83 | Partial — `data-source="device"` placeholders in StationExamPage |
| Internal cross-app data flow | §3.3 | Yes — implicit via shared `MOCK` in [src/shared/mock-data/index.ts](../src/shared/mock-data/index.ts) |
| **Recruitment-centre / police-precinct directory** | §4(1-1) p.13 | **No — REFERENCE_DATA dictionary missing for `أقسام ومراكز الشرطة`.** |

### 4.4 Reference data / lookups (`الأكواد المرجعية`)

RFP §4(1-1) p.12–13 enumerates ~20 reference categories. Coverage in [src/shared/mock-data/dictionaries.ts](../src/shared/mock-data/dictionaries.ts) and [referenceData.ts](../src/shared/mock-data/referenceData.ts):

| RFP-named lookup | In `referenceData.ts`? |
|---|---|
| المحافظات | Yes (REF_GOVERNORATES) |
| الكليات | Yes (colleges) |
| الجنسيات | Yes (nationalities) |
| المؤهلات | Yes (qualifications) |
| التخصصات | Yes (specializations) |
| فئات المتقدمين | Yes ([categories.ts](../src/shared/mock-data/categories.ts)) |
| اللجان | Yes (COMMITTEES_NAMES) |
| الجامعات (separate from كليات) | **No** |
| ربط التخصصات بالكليات | **No** (no FK) |
| أقسام ومراكز الشرطة | **No** |
| الوظائف وفئاتها | **No** |
| أكواد التقديرات الجامعية بالنسب | **No** |
| تقييم الجامعات والكليات | **No** |
| الرتب العسكرية | Yes (ranks) |
| درجات القرابة | Yes (REF_RELATIONSHIPS) |
| الديانات | Implicit (Stage 3 hardcodes 2 options) |
| أنواع القضايا | Yes (case-types) |
| الجامعات / المعاهد المعاينات | **No** |

### 4.5 Reports + statistics — RFP-named reports

| RFP-named report | Implemented? |
|---|---|
| تقرير بإجمالي أعداد المتقدمين | Yes (`report:applicants-by-status`) |
| تقرير بنسب الرفض وأسبابه | Yes (`report:rejections-with-reasons`) |
| تقرير الاختبارات الطبية | Yes (`report:medical-results-summary`) |
| تقرير نتائج اختبارات القدرات | Yes (`report:exam-pass-rates`) |
| تقرير حالة التحريات | Yes (`report:investigation-status`) |
| تقرير ملخص الدورة | Yes (`report:cycle-summary`) |
| تقرير الجلسات والقرارات | Partial (decisions print, no aggregate) |
| تقرير المواقف المالية / الرسوم / Refund | **No** (refund missing) |
| تقرير حركة الباركود | Partial (per-applicant, not aggregate) |

### 4.6 Print documents — RFP-required printables

| RFP-named printable | Impl evidence | Uses canonical `<PrintLayout>` + `<SignatureBlock>`? |
|---|---|---|
| كارت التردد | [Stage9PrintCardPage.tsx](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx) | Yes |
| وثيقة التعارف | [Stage11AcquaintanceDocPage.tsx:147-161](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx#L147-L161) | Yes (`<PrintLayout restricted>`) |
| الشهادة الطبية النهائية | [MedicalCertificatePage.tsx](../src/features/medical/pages/MedicalCertificatePage.tsx) | Yes |
| محاضر جلسة الهيئة + قرارات | [Sprint6Pages.tsx](../src/features/board/pages/Sprint6Pages.tsx) | Yes |
| كشف توزيع التحريات (سري) | [DistributionPage.tsx](../src/features/investigations/pages/DistributionPage.tsx) | Yes (`<PrintLayout restricted>`) |
| رسائل صادرة (التحريات) | [OutgoingLettersPage.tsx](../src/features/investigations/pages/OutgoingLettersPage.tsx) | Yes |
| تقارير ومحاضر التقدم العامة | [ReportsPage.tsx](../src/features/admin/pages/ReportsPage.tsx) | Yes |
| إيصال الدفع (Payment receipt) | [Stage6PaymentPage.tsx](../src/features/applicant-portal/pages/Stage6PaymentPage.tsx) (modal) | No — uses inline modal, not `<PrintLayout>` |

### 4.7 §4 two-phase signature canon — preliminary notice + final stamp

POLISH_REPORT.md §5 declares the cross-screen visual canon. Audit:

- ✅ Preliminary notice (dashed `border-gold-300 bg-gold-50 text-2xs text-gold-700`) — present in [CommitteeDetailPage.tsx:186](../src/features/committees/pages/CommitteeDetailPage.tsx#L186), [Stage7FamilyPage.tsx:180-182](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L180-L182), [Stage11AcquaintanceDocPage](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx).
- ✅ `<IconStamp>` on `معتمد` Badge — present in [CommitteeDetailPage.tsx:199](../src/features/committees/pages/CommitteeDetailPage.tsx#L199), [CategorySelectionPage.tsx:128](../src/features/applicant-portal/pages/CategorySelectionPage.tsx#L128).
- ⚠️ Board decision printable does not use `<IconStamp>` for «معتمد» — uses `<IconSeal>` for the ministerial seal block (correct semantically) but the per-decision approval state should add `<IconStamp>`.

---

## 5 · Out-of-scope confirmations

The following RFP requirements are legitimately deferred per [PRODUCT.md](../PRODUCT.md) "Out of scope" section, the project's frontend-only nature, or contractual-not-feature treatment:

| Requirement | Deferral citation | Note |
|---|---|---|
| MOIPASS real API integration | PRODUCT.md "Out of scope" → backend phase | Backend-only — handled by JSDoc INTEGRATION CONTRACT in [LoginForm.tsx:1-15](../src/features/auth/components/LoginForm.tsx) |
| MoE / Al-Azhar real lookup | Same | Backend-only — `applicantPortalService.verifyCertificate` JSDoc |
| Payment gateway (Fawry / card) | Same | Backend-only — `initiatePayment` JSDoc |
| Hardware SDK for biometric devices | KARASA_GAPS §8.2.A | Hardware specs not yet locked |
| `react-pdf` heavy PDF generation | KARASA_GAPS §1.2.F | Sprint 10 hardening; CSS @media print covers demo |
| `xlsx` Excel parsing for bulk uploads | KARASA_GAPS §1.2.F + §3.2.D + §9.2.A | Sprint 10 hardening |
| `JsBarcode` Code 128 generation | KARASA_GAPS §7.2.A | Sprint 10 |
| `getUserMedia()` camera capture | KARASA_GAPS §8.2.A | Sprint 10 |
| SLA performance / DR / backup / training contractual clauses | RFP pp. 91+ | Contractual — covered by [ArchitecturePage.tsx](../src/features/architecture/pages/ArchitecturePage.tsx) §5/§6/§9 |
| 27001 / Law 151/2020 compliance | RFP "Security" section | Operational posture documented |

---

## 6 · Recommended next batch

Prioritised remediation derived from §3 + §4 gaps. **This is a recommendation, not a task list to execute.** The audit ends here.

### P0 — blocks demo (must-fix before 2026-05-29)

1. **§4(2-1) Refund permission + screens** — `missing`. **Size: M.** Files to add: `src/features/auth/rbac.ts` (add `refund_admin` role), `src/features/admin/pages/RefundsPage.tsx`, `src/features/admin/api/refunds.service.ts`, `src/features/admin/api/refunds.queries.ts`, `src/shared/types/domain.ts` (RefundRequest type), `src/routes.tsx` + `src/config/routes.ts`. Should be a NEW remediation batch (post-Acidemia). A Ministry reviewer ctrl-F-ing the RFP will hit `Refund` on p.58 and find no UI.
2. **§4(2-1) Academy-Leadership Inquiries permission + screens** — `missing`. **Size: M.** Files: `rbac.ts` (add `academy_leadership_inquiries` role), `src/features/admin/pages/LeadershipInquiriesPage.tsx`, dedicated dashboard with cycle-level + cross-program aggregates. Could be a sub-page of `/admin` not its own app to keep scope tight.
3. **§4(1-2) Stage 12 acquaintance-doc completion** — 6 sub-screens missing (income, foreign-employed, foreign-naturalized, prior jobs, legal cases, full housing). **Size: L.** Files: extend `src/features/applicant-portal/schemas/stage11.ts`, expand `Stage11AcquaintanceDocPage.tsx`, add fields to printable `<PrintLayout>` body. **Highest-impact P0 item** — investigations file integrity hinges on this data.

### P1 — visible gaps (would be flagged by a determined reviewer)

4. **§4(1-2) Stage 4 cross-category alternative-suggestion branch** — extend `EligibilityCheckPage.tsx` to: when chosen-cat eligibility fails, run eligibility against ALL other public categories and present a list of pickable alternatives. **Size: S.** Files: `EligibilityCheckPage.tsx` + service-side `categoriesPublicService.checkAllEligibility`.
5. **§4(1-2) Stage 7 missing family arrays** — add `paternalGrandfatherWives`, `maternalGrandfatherWives`, `fatherOtherWives`, `motherOtherHusbands` field arrays. **Size: S.** Files: `stage7Schema`, `Stage7FamilyPage.tsx`. Use `useFieldArray` like `siblings`. Each guarded by an "إن وجدوا" toggle.
6. **§4(1-2) Stage 4 academic 1st-/2nd-sitting branch + foreign-diploma branch** — extend `Stage4EducationPage.tsx` to support `دور أول/دور ثاني` and `وافد مصري / دبلومات أجنبية` branches per RFP p.24–25. **Size: M.** Files: `stage4Schema`, `Stage4EducationPage.tsx`.
7. **§3 view-level audit logging on investigations** (KARASA_GAPS AUD-010) — wire `auditService.logView` into `InvestigationDetailPage`'s mount. **Size: S.** Files: `InvestigationDetailPage.tsx`, `audit.service.ts`.
8. **§4(2-1) committee-results bulk Excel upload** — wire xlsx parser. **Size: M.** Lib add: `xlsx`. Files: `committee.service.ts`, the bulk-upload modal.
9. **§4(1-1) reference-data gaps** — add Universities, Police Precincts, Jobs, University-grade-codes, Specialization-to-College FK. **Size: M.** Files: `dictionaries.ts`, `referenceData.ts`, `domain.ts`.

### P2 — polish / spec compliance (post-demo)

10. **Stage numbering reconciliation** — pick one of: (a) re-number wizard to 12 stages matching RFP, or (b) document the mapping in POLISH_REPORT §5 with a translation table. **Size: S** for option b, **L** for option a.
11. **Per-role distinct screens for committees** (student vs test, admin vs data-entry) — currently RBAC differentiates within the same page. RFP §4(2-1) p.49–56 prescribes per-role screen sets. **Size: M.**
12. **Investigations sub-roles** — split `investigator` into 4 RFP-named sub-roles (committee-A admin / national data-entry / committee-C admin / criminal data-entry). **Size: M.**
13. **Real-Code-128 + camera scan** (`JsBarcode` + `@zxing/library` + `getUserMedia()`). **Size: M.** Already roadmapped in Sprint 10.
14. **Notification center: per-category / scheduled publish** (RFP §4(1-1) p.13). **Size: S.**
15. **Admin-side cycle-config UX** for fee-per-certificate, capacity-per-cycle, slot windows, e-undertaking text per cycle. **Size: M.**

These items would lift the bullet-level coverage from 77% to ~92% — closer to the PRODUCT.md headline.

---

## 7 · Appendix — files read

### 7.1 PDF pages extracted (via PyMuPDF)

| File | Pages | Purpose |
|---|---|---|
| `/tmp/rfp_audit/full.txt` | 1–108 | Full extraction (initial scan) |
| `/tmp/rfp_audit/sec_3.txt` | 5–10 | RFP §1 + §2 + §3 cross-cutting |
| `/tmp/rfp_audit/sec_4_1_1.txt` | 10–14 | RFP §4(1-1) Admin Site |
| `/tmp/rfp_audit/sec_4_1_2.txt` | 15–36 | RFP §4(1-2) Applicant Site |
| `/tmp/rfp_audit/sec_4_2_intro.txt` | 37–41 | RFP §4(2) intro |
| `/tmp/rfp_audit/sec_4_2_1.txt` | 41–60 | RFP §4(2-1) Committees |
| `/tmp/rfp_audit/sec_4_2_2to6.txt` | 61–87 | RFP §4(2-2..6) Board / Investigations / Medical / Barcode / Biometric |
| `/tmp/rfp_audit/sec_4_2_7_and_sla.txt` | 88–108 | RFP §4(2-7) Question Bank + SLA |

Extraction script (reproducible):

```python
import fitz
doc = fitz.open("<PDF path>")
for i in range(start, end):
    print(f"========== PAGE {i+1} ==========")
    print(doc[i].get_text())
```

### 7.2 Source files read

| File | Purpose |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Operating context |
| [PRODUCT.md](../PRODUCT.md) | Strategic context |
| [POLISH_REPORT.md](../POLISH_REPORT.md) §1–§3 | Polish closeout |
| [Tasks/KARASA_GAPS.md](../Tasks/KARASA_GAPS.md) (full) | Prior coverage map |
| [src/routes.tsx](../src/routes.tsx) (1–290) | Route registry |
| [src/config/routes.ts](../src/config/routes.ts) (1–110) | URL constants |
| [src/features/auth/rbac.ts](../src/features/auth/rbac.ts) (full) | RBAC definitions |
| [src/shared/types/domain.ts](../src/shared/types/domain.ts) (1–200, 580–600) | Domain types |
| [src/shared/mock-data/index.ts](../src/shared/mock-data/index.ts) (1–100) | Mock-data root |
| [src/features/admin/index.ts](../src/features/admin/index.ts) (full) | Admin barrel |
| [src/features/applicant-portal/index.ts](../src/features/applicant-portal/index.ts) (full) | Applicant-portal barrel |
| [src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx](../src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx) (1–73) | — |
| [src/features/applicant-portal/pages/Stage3PersonalPage.tsx](../src/features/applicant-portal/pages/Stage3PersonalPage.tsx) (1–204) | — |
| [src/features/applicant-portal/pages/Stage4EducationPage.tsx](../src/features/applicant-portal/pages/Stage4EducationPage.tsx) (1–171) | — |
| [src/features/applicant-portal/pages/Stage7FamilyPage.tsx](../src/features/applicant-portal/pages/Stage7FamilyPage.tsx) (1–289) | — |
| [src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx](../src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx) (1–134) | — |
| [src/features/applicant-portal/pages/Stage9PrintCardPage.tsx](../src/features/applicant-portal/pages/Stage9PrintCardPage.tsx) (1–209) | — |
| [src/features/applicant-portal/pages/Stage10FollowUpPage.tsx](../src/features/applicant-portal/pages/Stage10FollowUpPage.tsx) (1–105) | — |
| [src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx](../src/features/applicant-portal/pages/Stage11AcquaintanceDocPage.tsx) (1–170) | — |
| [src/features/applicant-portal/pages/CategorySelectionPage.tsx](../src/features/applicant-portal/pages/CategorySelectionPage.tsx) (1–249) | — |
| [src/features/applicant-portal/pages/EligibilityCheckPage.tsx](../src/features/applicant-portal/pages/EligibilityCheckPage.tsx) (1–329) | — |
| [src/features/applicant-portal/api/categories.service.ts](../src/features/applicant-portal/api/categories.service.ts) (excerpts) | Eligibility service |
| [src/features/medical/pages/StationExamPage.tsx](../src/features/medical/pages/StationExamPage.tsx) (1–120) | Per-station exam form |
| [src/features/medical/api/medical.service.ts](../src/features/medical/api/medical.service.ts) (excerpts) | STATION_LABELS + ALL_STATION_KEYS |
| [src/features/board/pages/Sprint6Pages.tsx](../src/features/board/pages/Sprint6Pages.tsx) (1–100) | Board sessions/decisions |
| [src/features/exams/pages/Sprint7Pages.tsx](../src/features/exams/pages/Sprint7Pages.tsx) (1–80) | Question bank CRUD |
| [src/features/committees/pages/CommitteeDetailPage.tsx](../src/features/committees/pages/CommitteeDetailPage.tsx) (excerpts) | Two-phase signature canon |

### 7.3 Grep queries run

| Query | Purpose | Hits |
|---|---|---|
| `refund\|إعادة المقابل\|Refund` in `src/` | Confirm refund missing | 0 |
| `leadership\|رئاسة الأكاديمية\|academy_leadership` in `src/` | Confirm leadership-inquiries missing | 0 |
| `paternalGrandfatherWives\|fatherWives\|motherHusbands` in `src/features/applicant-portal/` | Confirm Stage 7 missing arrays | 0 |
| `familyIncome\|prior_jobs\|legalCases\|foreignNaturalized` in `src/features/applicant-portal/` | Confirm Stage 11 missing fields | 0 |
| `MOIPASS\|moipass` in `src/features/auth/`, `src/features/landing/` | Confirm MOIPASS framing | 7 hits — UI shipped, real API deferred |
| `STATION_LABELS\|MedicalStationKey` in medical | Confirm 8 stations | 8 confirmed |
| `suspended\|on-hold\|معتمد` in committees | Confirm two-phase canon | 8 hits |

---

*End of audit. No source files modified. `git status` shows only `docs/SCOPE_AUDIT.md` as new.*
