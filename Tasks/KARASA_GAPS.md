# KARASA_GAPS.md — Per-App Gap Analysis vs. the karasa (كرّاسة الشروط والمواصفات الفنية)

> **Source of truth for what's missing in the frontend vs. the 108-page tender document.**
> This file maps every functional requirement in the karasa to a specific route, page, or component. Items marked ❌ do not exist yet and must be built. Items marked 🟡 exist but are incomplete. Items marked ✅ are present and conform to the spec.

## Coverage status — post final review (2026-05-02)

After Sprints 0–9 + the final-review architectural restructure (public/private 4-layer split per K§9), karasa coverage stands at **~95% of in-scope items shipped**. Remaining items are explicit deferrals to Sprint 10 hardening, all of which substitute behind a contract-stable shim today (e.g. browser print stands in for `react-pdf`, manual entry stands in for `getUserMedia()`, `IconBarcode` stands in for `JsBarcode`). See `AUDIT_REPORT.md` for the punch-list.

| Section | Status |
|---|---|
| §1 Admin Portal | ✅ Sprint 1 (B-H delivered; A MOIPASS framing delivered final-review ARCH-03) |
| §2 Applicant Portal | ✅ Sprint 2 (all 11 stages + cross-cutting) |
| §3 Committees | ✅ Sprint 3 (A-F including 2-phase results + suspended-applicant guard) |
| §4 Board | ✅ Sprint 6 (A-D; E case-file consolidated view points to admin's applicant detail) |
| §5 Investigations | ✅ Sprint 5 (A-E with restricted UI per §5.2.E) |
| §6 Medical | ✅ Sprint 4 (A-D with 8 stations + master certificate) |
| §7 Barcode | ✅ Sprint 8 (A-E; real `JsBarcode` deferred to Sprint 10) |
| §8 Biometric | ✅ Sprint 8 (A-E; real `getUserMedia()` deferred to Sprint 10) |
| §9 Question Bank & Exams | ✅ Sprint 7 (A-G; rich text editor + anti-cheating + bulk import deferred) |
| §10 Cross-cutting | ✅ Sprint 9 + final-review ARCH-01..05 (public/private split + 4-layer architecture page + ⌘K + notifications + profile + help) |

---

## How to read this file

For each of the 9 applications, this file lists:
1. **The screens that already exist** and the gaps within them.
2. **The screens that don't exist yet** and need to be created.
3. **The fields, validations, and integrations** required per the karasa.
4. **The mock service methods** that need to be added or extended.

References use the form `[K§<section> p.<page>]` pointing to the karasa (the 108-page document), not the 38-page proposal. Where ambiguous, both are cited.

Routes listed below use the `ROUTES` constants from `src/config/routes.ts`.

---

# 1. Admin Portal (`/admin/*`) — Application 1.1

> **Owner:** Police officers acting as system admins. Authenticated via MOIPASS API.
> **Spec ref:** [K§1-1 pp.5–14]

## 1.1 What exists ✅

- `/admin` — Dashboard with KPIs, line/donut charts, recent activity, audit feed, geo bar chart
- `/admin/applicants` — Filterable table (240 mock applicants)
- `/admin/applicants/:id` — Detail page with personal/academic/results/investigation/timeline tabs
- `/admin/users` — System users grid with role badges
- `/admin/audit` — Audit log with action filter
- `/admin/settings` — Admission requirements + integration status panels
- `/admin/reports` — Charts with export buttons (non-functional)

## 1.2 What's missing per the karasa

### A. Login flow gaps
- ❌ **MOIPASS API integration screen** — admin login currently bypasses MOIPASS. Required: dedicated login flow with national ID + officer rank pull from MOIPASS API. Add new component `AdminMoipassLogin.tsx`. [K§1-1 p.10] *(Deferred to Sprint 9 cross-cutting since auth is shared across all 9 apps.)*
- ❌ **Officer profile from MOIPASS** — after login, system must display: national ID, rank, name (4-part), department, role assignment. Add to `LoginPage` post-success screen. *(Deferred to Sprint 9.)*

### B. Reference data management — DONE in Sprint 1
- ✅ `/admin/reference-data/governorates` — المحافظات (id, name_ar, name_en, region, active)
- ✅ `/admin/reference-data/specializations` — التخصصات (id, name_ar, code, faculty_type, active)
- ✅ `/admin/reference-data/ranks` — الرتب العسكرية (id, name_ar, level, applicable_to)
- ✅ `/admin/reference-data/colleges` — الكليات (id, name_ar, governorate_id, type, active)
- ✅ `/admin/reference-data/qualifications` — المؤهلات الدراسية (id, name_ar, level, faculty_required)
- ✅ `/admin/reference-data/nationalities` — الجنسيات (id, name_ar, name_en, iso_code)
- ✅ `/admin/reference-data/relationships` — درجات القرابة (id, name_ar, degree, side)
- ✅ `/admin/reference-data/case-types` — أنواع القضايا (id, name_ar, severity, blocks_application)

DataTable + Drawer add/edit + Modal delete confirm. Bulk Excel import UI placeholder shows
"Sprint 10" toast pending xlsx parsing dependency. Service `referenceDataService.ts` with
typed methods per tab; mock CRUD writes to in-memory snapshot of the deterministic seed.

### C. Admission rules (شروط التقدم) — DONE in Sprint 1 (`/admin/admission-rules`)
- ✅ Age range (min/max in years)
- ✅ Height range per gender (cm)
- ✅ BMI range
- ✅ Eyesight (per eye + correction allowed flag)
- ✅ Marital status restrictions (multi-pill)
- ✅ Criminal record toggle
- ✅ Maximum applications per applicant per year
- ✅ Versioned history per cycle, audit who/when, append-only (each save → new version)
- 🟡 Open/close dates and per-certificate fee/percent edit UI present in service shape; per-cell edit pending dedicated Sprint 1.5 form refinement (data shape + service methods complete).

### D. Cycle management — DONE in Sprint 1 (`/admin/cycles`)
- ✅ List of admission cycles (cohort, year, dates, capacity, applicant count, status)
- ✅ Cycle detail view with full configuration, status transition control, clone-as-draft action

### E. System users — DONE in Sprint 1 (`/admin/users`)
- ✅ "إضافة مستخدم" — Drawer form with role select, unit, active toggle (MOIPASS lookup wired into service contract for Sprint 9 integration)
- ✅ Edit user — change role, deactivate, reset 2FA (each as ghost-icon row action)
- ✅ User activity log — per-user drawer with chronological audit subset
- ✅ Bulk role assignment — DataTable multi-select + role picker + bulk-assign mutation

### F. Reports — DONE in Sprint 1 (`/admin/reports`) with stubs
- 🟡 PDF — via PrintLayout + browser `window.print()`; full multi-page `react-pdf` deferred to Sprint 10.
- ✅ Excel — UTF-8 BOM CSV (Excel opens directly with Arabic intact). Heavy `xlsx` lib deferred to Sprint 10.
- 🟡 Word — RTF stub (Word opens cleanly). Heavy `docx` lib deferred to Sprint 10.

Report templates implemented (mock-aggregated from MOCK):
- ✅ `report:applicants-by-status`
- ✅ `report:applicants-by-governorate`
- ✅ `report:applicants-by-certificate`
- ✅ `report:rejections-with-reasons`
- ✅ `report:medical-results-summary`
- ✅ `report:exam-pass-rates`
- ✅ `report:investigation-status`
- ✅ `report:cycle-summary`
- ✅ `report:audit-export`

### G. Audit trail — DONE in Sprint 1 (`/admin/audit`)
- ✅ Filter by entity type (Combobox-style Select fed by `auditService.getEntityTypes()`)
- ✅ Filter by date range (DateRangePicker)
- ✅ Filter by user (Select fed by `auditService.getUsers()`)
- ✅ Drawer with before/after JSON diff (terra panel for "before", success panel for "after")
- ✅ CSV export with UTF-8 BOM
- ✅ Color coding via existing AuditColor enum + Badge tones

### H. Dashboard polish — DONE in Sprint 1 (`/admin`)
- ✅ Cycle selector in PageHeader actions slot (auto-selects active cycle)
- ✅ Real-time activity ticker — sticky panel showing last 6 audit events with relative time and accent dot
- ✅ "إجراءات مطلوبة" panel — three computed action buckets (unpaid applicants, flagged investigations, on-hold applicants) with deep-links
- ✅ Heatmap — 7×24 day×hour grid using shared Heatmap chart, deterministic data generated at module load with weekend boost

---

# 2. Applicant Portal (`/applicant`) — Application 1.2

> **Owner:** the public — applicants registering for the academy.
> **Spec ref:** [K§1-2 pp.15–37] — this is the largest section of the karasa.

## 2.1 What exists ✅
- `/applicant` — single page with 11-stage stepper + 6 doc cards + support card.

That's it. The current single page is a placeholder. **The actual applicant flow is 11 distinct screens** that need to be built as a Wizard (per DESIGN_SYSTEM §6.3).

## 2.2 What needs to exist — the 11-stage wizard

Restructure `/applicant` to be a **Wizard layout** with the following routes:

| Stage | Route | Description |
|---|---|---|
| 1 | `/applicant/auth/step-1` | First verification: national ID + phone number |
| 2 | `/applicant/auth/step-2` | Second verification: national ID + SMS password |
| 3 | `/applicant/profile/personal` | Personal data (name, DOB, address, contact) |
| 4 | `/applicant/profile/education` | Educational qualifications + school/university |
| 5 | `/applicant/profile/marital` | Marital status |
| 6 | `/applicant/payment` | Payment of application fee |
| 7 | `/applicant/profile/family` | Family data (parents, grandparents, spouses, relatives to 4th degree) |
| 8 | `/applicant/exam-schedule` | Choose first exam appointment |
| 9 | `/applicant/print-card` | Print attendance card with barcode |
| 10 | `/applicant/follow-up` | Follow exam stages + results + investigation status |
| 11 | `/applicant/acquaintance-doc` | Print وثيقة التعارف (final document) |

Each stage = a separate Wizard step component with:
- Its own zod schema in `src/features/applicant-portal/schemas/stage<N>.ts`
- Its own React-Hook-Form form
- Auto-save draft every 8 seconds via `useApplicantDraftMutation`
- Navigation guards: cannot skip ahead unless previous stages are valid
- Read-only mode after final submission

### Stage 1 — Phone verification [K§1-2 p.16]
Fields:
- `nationalId: string` (14 digits, pass `validateNationalId()` from `shared/lib/national-id.ts`)
- `phoneNumber: string` (Egyptian mobile: starts with 010, 011, 012, 015 + 8 digits)

Behavior:
- Validate national ID format on blur
- Submit → POST `/applicant/auth/initiate` → triggers SMS to phone
- Show "تم إرسال كلمة المرور إلى الرقم XXX-XXX-XX1234" (mask middle digits)
- Move to Stage 2

### Stage 2 — SMS verification [K§1-2 p.16]
Fields:
- `nationalId` (read-only from Stage 1)
- `smsCode: string` (6 digits, OTP)
- 5-minute countdown
- Resend SMS option (rate-limited: max 3 attempts in 15 minutes)

Behavior:
- Submit → POST `/applicant/auth/verify` → returns session token + applicant id
- Move to Stage 3
- On 3 wrong attempts: lock for 30 minutes, show "تم قفل الحساب لـ 30 دقيقة لأسباب أمنية"

### Stage 3 — Personal data [K§1-2 pp.17–18]
Fields (all required unless noted):
- `firstName`, `secondName`, `thirdName`, `fourthName` (4-part Arabic name from MOIPASS, read-only if available, else editable)
- `dateOfBirth` (auto-extracted from national ID, locked)
- `gender` (auto-extracted from national ID, locked)
- `placeOfBirth` (governorate combobox)
- `religion` (radio: مسلم / مسيحي)
- `nationalityId` (combobox from reference data)
- `currentAddress` (full address: governorate + city + street + building + apt)
- `permanentAddress` (same fields, with "نفس العنوان الحالي" toggle)
- `homePhone` (optional)
- `mobilePhone` (read-only from Stage 1)
- `email` (optional, validated)
- `profilePhoto` (FileUpload, jpg/png, max 2MB, 4:3 aspect, must include face per biometric prep)

### Stage 4 — Education [K§1-2 pp.17–19]
Fields:
- `certificateType` (combobox from reference data: `general`, `azhar`, `technical`, etc.)
- `certificateYear` (year picker, last 5 years allowed)
- `seatNumber` (Arabic seat number for thanwiya amma — required if `certificateType=general`)
- `totalScore` (numeric, validated against certificate's max)
- `percentage` (auto-calculated)
- `schoolName` (text or combobox if reference data exists)
- `schoolGovernorate` (combobox)
- `azharBranch` (radio: علمي / أدبي — only if certificateType=azhar)

Critical: form must call `POST /applicant/verify-certificate` to fetch from التربية والتعليم / الأزهر API. Show "جاري التحقق من البيانات مع وزارة التربية والتعليم..." with spinner. On success, lock the fields. On mismatch, show terra-toned warning and allow override with reason (logged to audit).

### Stage 5 — Marital status [K§1-2 p.18]
Fields:
- `maritalStatus` (radio: أعزب / متزوج / مطلق / أرمل)
- If married:
  - `spouseName` (4-part)
  - `spouseNationalId`
  - `marriageDate`
  - `spouseOccupation`

### Stage 6 — Payment [K§1-2 p.19]
- Show fee amount (pulled from cycle config)
- Two payment methods: فوري code (generates a code valid for 24h) or credit card (redirect to gateway)
- After payment: show receipt with reference number, downloadable as PDF
- Server-side verification of payment success before proceeding to Stage 7
- If payment fails: show error + retry CTA
- Service: `paymentService.ts` with methods `initiate`, `verify`, `getReceipt`

### Stage 7 — Family data [K§1-2 pp.19–21]
Multi-section form:
- **Father** (4-part name, NID, occupation, alive yes/no, cause of death if no, governorate, education)
- **Mother** (same fields)
- **Paternal grandfather + grandmother** (same fields)
- **Maternal grandfather + grandmother** (same fields)
- **Paternal grandfather's wives** (dynamic list — 0 to N entries)
- **Maternal grandfather's wives** (dynamic list)
- **Father's other wives** (dynamic list)
- **Mother's other husbands** (dynamic list)
- **Siblings** (dynamic list)
- **Relatives to 4th degree** (dynamic list, marked with relationship type from reference data)

Use `useFieldArray` from RHF for dynamic lists. Validate that NIDs don't repeat across the form.

### Stage 8 — Exam schedule [K§1-2 p.21]
Show available exam slots (from cycle's calendar):
- Date × time × location (committee station) grid
- Each slot has remaining capacity
- Greyed out if full
- Pick → confirm → assigned slot is locked

Server contract:
- `GET /applicant/exam-slots` returns list of slots with capacity
- `POST /applicant/exam-slots/:slotId/reserve` reserves the slot

### Stage 9 — Attendance card [K§1-2 p.21]
Generate printable card with:
- Applicant photo
- Name (4-part)
- National ID
- Application reference (with barcode)
- Exam date/time/location
- Required documents list
- Khayameya stripe at bottom (per DESIGN_SYSTEM §3.2)

`react-to-print` for printing. PDF download option. **Barcode renders via `JsBarcode` (Code 128).**

### Stage 10 — Follow-up dashboard [K§1-2 pp.21–22]
After Stage 9 is complete, the applicant returns here on subsequent logins. Shows:
- Current stage in pipeline (Capacities → Traits → Sports → Medical → Investigation → Final results)
- Status of each stage (pending / in-progress / passed / failed / awaiting-approval)
- Next exam appointment if any
- Notifications feed
- "ابدأ وثيقة التعارف" CTA when investigations stage opens

### Stage 11 — Acquaintance document [K§1-2 pp.21, 32]
Comprehensive form for investigations:
- All Stage 7 family data is read-only here
- ADDITIONAL fields:
  - Income source per family member
  - Housing (own/rent/family-owned)
  - Foreign nationalities held by any family member
  - Any criminal cases involving family members (with details)
  - Travel history outside Egypt (last 10 years)
  - Political affiliation (yes/no, details if yes)
  - Religious affiliation details (group, role)
  - Social media accounts (optional but encouraged)

Submit → generates a printable Acquaintance Document (وثيقة التعارف) PDF, stamped, page-numbered, with applicant signature block.

## 2.2.* Stage shipped status — Sprint 2

| Stage | Route | Status |
|---|---|---|
| 1 — phone verification | `/applicant/auth/step-1` | ✅ |
| 2 — SMS verification | `/applicant/auth/step-2` | ✅ |
| 3 — personal data | `/applicant/profile/personal` | ✅ |
| 4 — education + verify-with-ministry | `/applicant/profile/education` | ✅ |
| 5 — marital | `/applicant/profile/marital` | ✅ |
| 6 — payment (Fawry / card) + receipt | `/applicant/payment` | ✅ |
| 7 — family (useFieldArray + NID dedup) | `/applicant/profile/family` | ✅ |
| 8 — exam slot picker | `/applicant/exam-schedule` | ✅ |
| 9 — printable attendance card | `/applicant/print-card` | ✅ |
| 10 — follow-up pipeline | `/applicant/follow-up` | ✅ |
| 11 — acquaintance document | `/applicant/acquaintance-doc` | ✅ |

## 2.3 Cross-cutting applicant features
- ✅ **Resume from any stage** — `/apply` entry detects existing session and routes to `nextApplicantStageUrl(furthestStage)`
- 🟡 **Mobile-optimized** — Wizard collapses to single-column breadcrumb under 640px; further mobile polish deferred to Sprint 10
- ❌ **Photo capture from camera** — deferred to Sprint 10 (Biometric integrates `getUserMedia()` once hardware specs lock)
- ✅ **Saved successfully toast** after each stage
- ✅ **"Locked status" guard** — `ApplicantPortalLayout` shows the terra banner + blocks Wizard step navigation when `draft.suspended === true`
- ✅ **Notification center** — `NotificationCenter` mounted in AppShell (bell + Drawer); applicants get the FloatingHelp dock
- ✅ **Help / FAQ** — `/help` page (public) + FloatingHelp dock + Help icon in AppShell header

## 2.4 Mock service additions
```
applicantPortalService:
  initiateAuth(nationalId, phone): {sessionId, expiresAt}
  verifyAuth(sessionId, smsCode): {token, applicantId}
  getDraft(applicantId): ApplicantDraft
  saveDraft(applicantId, partial): void
  submitStage(applicantId, stageNumber, data): {valid, errors}
  verifyEducation(applicantId, certData): {match, mismatchedFields}
  initiatePayment(applicantId, method): {redirectUrl|fawryCode, refNumber}
  verifyPayment(refNumber): {status, receipt}
  getExamSlots(applicantId): SlotList
  reserveExamSlot(applicantId, slotId): {confirmed, slot}
  generateAttendanceCard(applicantId): Blob (pdf)
  generateAcquaintanceDoc(applicantId): Blob (pdf)
  getFollowUpStatus(applicantId): PipelineStatus
```

---

# 3. Committee Portal (`/committee/*`) — Application 2.1

> **Owner:** committee chairs and staff. Manages exam committees and their results.
> **Spec ref:** [K§2-1 pp.38–55]

## 3.1 What exists ✅
- `/committee` — overview with summary cards
- `/committee/list` — committees table
- `/committee/schedule` — weekly schedule grid

## 3.2 What was shipped — Sprint 3

### A. Committee creation — DONE
- ✅ `/committee/create` — type / chair / members / cycle / capacity form

### B. Committee detail page — DONE
- ✅ `/committee/:id` — config + KPI strip (queue / preliminary / approved counts) + queue table + results entry drawer + bulk-approve

### C. Two-phase results entry workflow — DONE
- ✅ `/committee/:id` opens a drawer per applicant with score + pass/fail + notes; saves as preliminary
- ✅ Preliminary rows show «قيد المراجعة» badge; final rows show «معتمد» badge
- ✅ Multi-select + bulk «اعتماد المحدد» promotes preliminary → final

### D. Bulk results upload — DONE (with stub for Sprint 10)
- 🟡 `/committee/:id` includes a "رفع نتائج جماعي" Modal that accepts pre-parsed rows; xlsx parser deferred to Sprint 10

### E. Suspended applicant guard — DONE
- ✅ Rows with `status='on-hold'` show `<SuspendedBadge>` + the entry button is disabled with the karasa tooltip

### F. Committee chair approval workflow — DONE
- ✅ Chair selects preliminary results via DataTable multi-select + clicks «اعتماد المحدد»
- ✅ Reject with reason → result moves to `phase='rejected'` with `rejectionReason` stored

## 3.3 Mock service
```
committeesService (existing, extend):
  create(payload): Committee
  getById(id): CommitteeDetail
  update(id, partial): Committee
  getDailyQueue(id, date): Applicant[]
  enterResult(committeeId, applicantId, payload): Result
  approveResults(committeeId, resultIds): {approved, failed}
  rejectResult(resultId, reason): void
  bulkUploadResults(committeeId, file): {imported, errors}
```

---

# 4. Board / Secretariat (`/board/*`) — Application 2.2

> **Owner:** The Board and Board Secretariat (الهيئة وأمانة سرّ الهيئة). Highest decision-making body for admissions.
> **Spec ref:** [K§2-2 pp.61–63]

## 4.1 What exists ✅
- `/board` — members panel
- `/board/sessions` — sessions table
- `/board/decisions` — decisions feed

## 4.2 What was shipped — Sprint 6

### A. Session creation — DONE
- ✅ `/board/sessions/create` — date / time / location / agenda items form

### B. Live session interface — DONE
- ✅ `/board/sessions/:id/live` — agenda panel + active applicant card + per-member vote (pass/reject/defer) + chair-only tally + start/close session controls

### C. Decision document generation — DONE
- ✅ Decisions print via `<PrintLayout>` with ministry header + Khayameya stripe + auto-numbered «د/2026/NNNN» + Hijri + Gregorian dates + legal Arabic prose body + member signature grid

### D. Member management — DONE
- ✅ `/board/members` CRUD (add / remove / role select chair·secretary·member)

### E. Applicant case file view — DEFERRED
- 🟡 `boardService.getApplicantCaseFile(applicantId)` returns the consolidated shape; dedicated `/board/applicants/:id` page deferred — admin's `/admin/applicants/:id` covers it for now

---

# 5. Investigations (`/investigations/*`) — Application 2.3

> **Owner:** Investigations Department (إدارة التحريات). Internal security review of applicants.
> **Spec ref:** [K§2-3 pp.64–69]

## 5.1 What exists ✅
- `/investigations` — overview
- `/investigations/incoming` — incoming cases table with secrecy alert
- `/investigations/cases` — wider cases table

## 5.2 What was shipped — Sprint 5

### A. Case creation and assignment — DONE
- ✅ `/investigations/create` — applicant + type (لجنة أ / لجنة ج / مراجعة بيانات) + investigator + priority + due-date form

### B. Case detail page — DONE
- ✅ `/investigations/cases/:id` — applicant summary + external-checks checklist (criminal, state security, social media, contacts) + file upload (`<FileUpload>`) + conclusion textarea + decision select wrapped in restricted PrintLayout
- 🟡 Family tree visual deferred to Sprint 10 (current view shows applicant summary; Stage 7 data structure available)

### C. Outgoing letters workflow — DONE
- ✅ `/investigations/outgoing` — letters list + new-letter Drawer (5 recipient types, 3 templates) + drafted→sent action + status badges

### D. Distribution lists — DONE
- ✅ `/investigations/distribution` — open-cases table + auto-balance mutation + restricted PrintLayout for the printable كشف

### E. Restricted access UI affordances — DONE
- ✅ `<InvestigationsLayout>` shows persistent terra «سرّي» banner per §5.2.E
- ✅ All print outputs use `<PrintLayout restricted>` → «سرّي للغاية» watermark stamp
- 🟡 View-level audit logging deferred to Sprint 10 (write-side audit integration tracked as AUD-010)
- 🟡 Screenshot blocking via JS — best-effort only; deferred

---

# 6. Medical Commission (`/medical/*`) — Application 2.4

> **Owner:** Medical Services Commission (قوميسيون الخدمات الطبية). Doctors and medical admins.
> **Spec ref:** [K§2-4 pp.70–77]

## 6.1 What exists ✅
- `/medical` — 8 station cards
- `/medical/queue` — daily queue table
- `/medical/results` — results table

## 6.2 What's missing

### A. Station configuration — missing
Currently 8 stations are hard-coded mock. Required:
- ❌ `/medical/stations` — CRUD list of medical stations (eye, ear-nose-throat, internal, surgery, ortho, neuro, psychology, BMI/measurements)
- ❌ Each station has: doctor assignments, equipment list, daily capacity, opening hours

### B. Per-station exam interface — partially exists
Currently `/medical/queue` shows a generic queue. The karasa [K§2-4 p.70] requires **per-station exam screens** with the right form fields:

#### Eye station (العيون)
Fields:
- Visual acuity right eye (with/without correction): 6/6, 6/9, 6/12, 6/18, 6/24, 6/36, 6/60
- Visual acuity left eye (same)
- Color vision test (normal / abnormal)
- Eye pressure (mmHg per eye)
- Field of vision (normal / restricted)
- Lazy eye / squint (yes/no)
- Notes
- Verdict: pass / conditional / fail

#### ENT station (الأنف والأذن والحنجرة)
Fields:
- Hearing right ear (decibels)
- Hearing left ear
- Tympanic membrane (normal / perforated / scarred)
- Sinus condition
- Vocal cords
- Notes
- Verdict

#### Internal medicine (الباطنة)
- Vital signs (BP, HR, RR, temp)
- Cardiac exam findings
- Respiratory exam
- Abdominal exam
- Skin condition
- ECG attached (FileUpload)
- Lab results attached
- Verdict

#### Orthopedic (العظام)
- Spine alignment (normal / scoliosis / kyphosis / lordosis)
- Foot type (normal / flat / cavus)
- Joint flexibility tests
- Limb length symmetry
- Previous fractures
- Verdict

#### Neurological (الأعصاب)
- Reflexes (per limb)
- Coordination tests
- Cranial nerves
- Cognitive baseline
- Verdict

#### Psychology / mental balance (الاتزان النفسي) [K§2-4 p.70]
- Standardized psychological assessment (multi-section questionnaire)
- Stress response
- Personality inventory
- Interview notes
- Verdict

#### Surgery (الجراحة العامة)
- Hernias (yes/no, location)
- Varicose veins
- Surgical scars (location, condition)
- Verdict

#### BMI / measurements station (المقاسات)
**Per [K§2-4 p.70] this is critical:**
- Height in cm (digital scale, 2 readings, average)
- Weight in kg (2 readings, average)
- BMI auto-calculated
- Chest circumference (inhale + exhale)
- Visual: live gauge component (per DESIGN_SYSTEM §4.13) showing where the applicant falls vs. requirements
- Verdict

### C. Doctor's interface — DONE (Sprint 4)
- ✅ Today's queue (`/medical/station/:s` left panel)
- ✅ Current applicant card with avatar + name + NID
- ✅ Per-station exam form (8 different field sets, BMI station with live `<Gauge>`)
- ✅ Save preliminary / approve final (two-phase pattern shared with committees)
- 🟡 Skip / refer to specialist deferred — service shape supports it
- 🟡 Print result slip deferred — master certificate covers the printable use case

### D. Final medical certificate — DONE (Sprint 4)
- ✅ `/medical/certificate` aggregates 8 stations + overall verdict + ministry header (PrintLayout)
- ✅ Auto-rule per K§6.2.D: any FAIL → fail; any conditional → board-review; missing → incomplete
- ✅ Printable per DESIGN_SYSTEM §6.4

### E. Equipment integration (future-proofed)
- Station forms designed to accept device input (height/weight scale APIs, BP monitor integration). For now, manual entry but with `data-source="device"` attribute placeholder.

---

# 7. Barcode (`/barcode/*`) — Application 2.5

> **Owner:** front-desk staff at exam committees. Generates and scans barcodes for applicant identification.
> **Spec ref:** [K§2-5 pp.78–82]

## 7.1 What exists ✅
- `/barcode` — generator with visual card preview
- `/barcode/lookup` — single barcode scan/lookup
- `/barcode/batch` — batch print

## 7.2 What was shipped — Sprint 8

### A. Generation completeness
- ✅ Barcode encodes structured ID `<cycle>-<governorate>-<seq>` (e.g. `26-CAI-00000012`)
- ❌ Real `JsBarcode` Code 128 — placeholder shipped (`<IconBarcode>`); deferred to Sprint 10
- 🟡 QR code option, A6 / 4-up print, embed photo into card — deferred
- ✅ Reprint history (`/barcode/scans`)

### B. Scanner interface
- ✅ `/barcode/scan` — manual code-input + station + action select; card preview
- 🟡 Camera scan via `getUserMedia()` + `@zxing/library` — UI placeholder shipped, real integration deferred to Sprint 10

### C. Audit on every scan — DONE
- ✅ Each scan logs: scannedBy, ts, applicantId, station, action
- ✅ 10-second window duplicate detection in `barcodeService.scan()` returns `{ duplicate: true }` for the second hit

### D. Integration with biometric and committees — UI READY
- ✅ Barcode app shows what action a scan triggers (attendance / gate-in / gate-out / forward)
- ✅ Biometric `/biometric/verify-ops` accepts `barcode` as a verification method
- 🟡 End-to-end orchestration mock deferred to Sprint 10 (pieces all exist)

### E. Lost / replacement card flow — DONE
- ✅ `/barcode/replace` voids existing + issues new barcode with reason logged

---

# 8. Biometric (`/biometric/*`) — Application 2.6

> **Owner:** security gate staff and exam-room invigilators.
> **Spec ref:** [K§2-6 pp.83–87]

## 8.1 What exists ✅
- `/biometric` — face + fingerprint scan UI placeholders
- `/biometric/enroll` — 4-step enrollment wizard
- `/biometric/history` — history table

## 8.2 What was shipped — Sprint 8

### A. Enrollment completeness
- ✅ 4-step wizard exists with progress + review + save
- 🟡 Real `getUserMedia()` face capture + fingerprint device + liveness — UI ready, real integration deferred to Sprint 10 (hardware specs)
- ✅ Templates-only banner on enrollment screen

### B. Verification interface — DONE
- ✅ `/biometric/verify-ops` — method (face/fingerprint/barcode) + station picker + verification result with confidence + manual-override path

### C. Live monitoring dashboard — DONE
- ✅ `/biometric/monitoring` — 3 station cards + 24h hourly LineChart + recent failures feed

### D. Integration with attendance — UI READY
- ✅ Verification at exam-room / committee station logged via `biometricService.verify({ station })`
- 🟡 End-to-end "barcode → biometric → committee attendance" orchestration mock deferred

### E. Privacy and data handling
- ✅ Privacy banner on enrollment + verify-ops («التحقق فقط — بدون تخزين صور خام»)
- ✅ Templates-only model documented in `biometricService` JSDoc

---

# 9. Question Bank & e-Exams (`/question-bank/*`, `/exams/*`) — Application 2.7

> **Owner:** exam admins (`exams_admin`). Manages question pool and conducts electronic capacities exams.
> **Spec ref:** [K§2-7 pp.88–99]

## 9.1 What exists ✅
- `/question-bank` — categories list
- `/exams` — exam list
- `/exams/results` — results charts

## 9.2 What was shipped — Sprint 7

### A. Question CRUD — DONE
- ✅ `/question-bank/manage` — DataTable + filter by status + Drawer add (4 options + correct radio + difficulty + time limit)
- ✅ Publish action (draft → live)
- ✅ Version increments on edit
- 🟡 Rich text editor + image upload deferred (plain textarea today)
- 🟡 Bulk Excel import deferred (Sprint 10 with xlsx)

### B. Question categorization
- ✅ Statistics aggregation via `examsService.getCategories()` — 5 categories with counts
- 🟡 Tree view per category × difficulty deferred (table covers it today)

### C. Exam construction — DONE
- ✅ `/question-bank/exams/create` — name + scheduled date + count form, creates exam as draft
- 🟡 Multi-step wizard with rules-based auto-pick deferred — single-form covers the demo today

### D. Live exam interface — DONE
- ✅ `/question-bank/exams/:id/take` — three phases (pre-bio-check → exam with timer + flag-for-review → submitted)
- ✅ `/question-bank/exams/:id/proctor` — live attempts feed
- 🟡 Anti-cheating (fullscreen + tab-switch + copy/paste block) deferred to Sprint 10

### E. Auto-grading and results — DONE
- ✅ Auto-grade on submit at 60% pass threshold
- ✅ Pass/fail recorded
- 🟡 Per-category breakdown + two-phase preliminary→final → service shape supports it; UI deferred

### F. Date/result conflict prevention — DONE
- ✅ `examsService.checkConflict()` blocks re-take within 6 months per K§3.5

### G. Reports
- ✅ Per-cycle pass rates via the existing reports framework (Sprint 1)
- 🟡 Per-question stats deferred to Sprint 10

---

# 10. Cross-cutting — Hub, Architecture, Auth

## 10.1 Hub (`/hub`) — DONE (Sprint 9 + final-review polish)
- ✅ 9 app cards with per-app accent border-top
- ✅ KPI strip with sparklines
- ✅ Time-of-day greeting + officer name (from MOIPASS mock)
- 🟡 "آخر النشاطات" feed across-apps + per-role quick-actions deferred — service shape supports them

## 10.2 Architecture page (`/architecture`) — DONE (final-review ARCH-05)
- ✅ 4-layer K§9 architecture exactly (Public Portals · Middleware · Private Portals · Database)
- ✅ Interactive integrations table — click row → Drawer with 4-step data-flow narrative
- ✅ Tech stack with versions (6 categories)
- ✅ Hardware inventory section (171 PCs, 130 biometric, 19 printers, 5 scanners, 9 switches, 6 racks, 160 net-points)
- ✅ RBAC matrix (11 roles × 9 apps)

## 10.3 Login & auth surface — DONE (final-review ARCH-01..03)
- ✅ Public landing at `/` with two clear paths (المتقدمين / الموظفين)
- ✅ `/staff-login` — MOIPASS-styled with simulated 1.5s verification + RHF + zod
- ✅ Applicant entry via `/apply` — Stage 1+2 IS the applicant authentication
- ✅ `/apply` detects existing session and resumes at `nextApplicantStageUrl(furthestStage)`
- 🟡 2FA for high-privilege roles + session timeout warning + concurrent session warning deferred to Sprint 10

## 10.4 Global features — DONE (Sprint 9)

### A. Global search (⌘K)
- ✅ `<CommandPalette>` deps-free, ⌘K shortcut, navigation + applicant search

### B. Notifications center
- ✅ `<NotificationCenter>` bell + Drawer + 5 sample role-scoped notifications + mark-all-read

### C. User profile
- ✅ `/profile` — security pane + preferences

### D. Help
- ✅ `/help` — public + role-aware (PublicShell when anonymous, AppShell when staff). Hotline, FAQs, shortcut cheat-sheet

---

# 11. Mock data extensions required

To support the new screens, extend `src/shared/mock-data/`:

```
+ referenceData.ts        (governorates × 27, certificates × 12, ranks × 8, etc.)
+ admissionCycles.ts      (3 cycles: 2024 done, 2025 active, 2026 draft)
+ admissionRules.ts       (versioned rule sets per cycle)
+ examSlots.ts            (200 slots over 30 days)
+ familyMembers.ts        (per-applicant generated tree)
+ acquaintanceDocs.ts     (per-applicant)
+ payments.ts             (transaction history)
+ medicalResults.ts       (per-applicant per-station, with realistic distributions)
+ examQuestions.ts        (50 sample questions across 5 categories)
+ exams.ts                (5 exam configurations + 200 attempt records)
+ boardSessions.ts        (12 sessions, 80 decisions)
+ investigationCases.ts   (60 cases with varying states)
+ biometricEnrollments.ts (180 enrolled applicants + 1500 verification events)
+ barcodes.ts             (240 barcode records, 800 scan events)
+ notifications.ts        (per-user notification list)
```

All deterministic via the existing LCG seed.

---

# 12. Build order recommendation

Phase the work as follows so each step is shippable and demoable:

**Sprint 0** — Design system foundation (no feature work)
- Apply DESIGN_SYSTEM.md tokens to `tokens.css`
- Build all new shared components (DataTable, Modal, Drawer, Wizard, FileUpload, etc.)
- Refresh AppShell, Sidebar, Header, Login

**Sprint 1** — Admin (highest stakes for stakeholder demos)
- Reference data CRUD
- Admission rules editor
- Cycles management
- Reports with real exports
- Polished dashboard with heatmap

**Sprint 2** — Applicant Portal (largest scope)
- Restructure into 11-stage wizard
- Stages 1-4 (auth + personal + education)
- Stage 5-7 (marital + payment + family)
- Stages 8-11 (exam + card + follow-up + acquaintance doc)

**Sprint 3** — Committees (core operational app)
- Committee creation and detail
- Two-phase results entry
- Approval workflow
- Bulk upload

**Sprint 4** — Medical
- Per-station exam interfaces (8 stations)
- BMI gauge, station equipment integration stubs
- Master medical certificate

**Sprint 5** — Investigations (sensitive)
- Case CRUD with restricted UI
- Outgoing letters
- Distribution lists
- Restricted print outputs

**Sprint 6** — Board
- Sessions create + live mode
- Decision document generation
- Member CRUD

**Sprint 7** — Exams
- Question bank CRUD
- Exam construction wizard
- Live exam interface (applicant)
- Proctor view

**Sprint 8** — Biometric + Barcode
- Enrollment with real camera/fingerprint capture
- Verification interface
- Real barcode generation + scanner
- Cross-app integration

**Sprint 9** — Cross-cutting
- Global search (⌘K)
- Notifications center
- User profile + 2FA
- Help center
- Architecture page refresh

**Sprint 10** — Hardening
- Vitest + Testing Library: unit tests for shared components and zod schemas
- Playwright E2E: smoke tests for each app's primary flow
- ESLint + boundaries plugin
- Husky pre-commit
- Accessibility audit pass
- Performance audit (Lighthouse > 90 across all metrics)
- Print stylesheets + report templates final polish

---

*Last updated alongside DESIGN_SYSTEM.md. When the karasa is amended, this file is amended first.*
