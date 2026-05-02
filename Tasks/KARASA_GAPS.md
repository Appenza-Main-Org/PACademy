# KARASA_GAPS.md — Per-App Gap Analysis vs. the karasa (كرّاسة الشروط والمواصفات الفنية)

> **Source of truth for what's missing in the frontend vs. the 108-page tender document.**
> This file maps every functional requirement in the karasa to a specific route, page, or component. Items marked ❌ do not exist yet and must be built. Items marked 🟡 exist but are incomplete. Items marked ✅ are present and conform to the spec.

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

## 2.3 Cross-cutting applicant features
- ❌ **Resume from any stage** — sessionStorage + server draft sync
- ❌ **Mobile-optimized** — current Wizard layout collapses to single-column under 640px
- ❌ **Photo capture from camera** — `getUserMedia()` API + cropper for profile photo
- ❌ **Saved successfully toast** after each stage
- ❌ **"Locked status" guard** — if applicant is `suspended` or `disqualified`, all stages become read-only with terra-toned banner
- ❌ **Notification center** — bell icon in shell, list of system messages
- ❌ **Help / FAQ** — sticky help panel with contact info, common questions

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

## 3.2 What's missing

### A. Committee creation / configuration — missing
- ❌ `/committee/create` — wizard for creating a new committee:
  - Name, code, type (capacities / traits / sports / interview)
  - Chair officer (combobox from system users)
  - Members (multi-select from system users)
  - Cycle assignment
  - Exam stations under it (multi-add)
  - Capacity per session
  - Schedule grid

### B. Committee detail page — missing
- ❌ `/committee/:id` — single committee detail showing:
  - Committee config (editable by `committee_admin`)
  - Members list with photos
  - Today's queue (applicants assigned today)
  - Today's results entry table
  - Audit log scoped to this committee

### C. Results entry workflow [K§2-1 pp.40–55]
This is the core feature and **does not exist**:
- ❌ `/committee/:id/results-entry` — interface for committee members to enter test results per applicant.
  - Search applicant by NID or barcode scan
  - Show applicant card (photo + name + NID + assigned tests)
  - Per test: enter score / pass-fail / notes
  - Save as **مرحلة أولية (preliminary)** — editable by entry user
  - "اعتماد" — promotes to **مرحلة نهائية (final)** — locked, only super_admin can override

The two-phase workflow is mandatory per [K§2-1 p.55] and the scope summary's "حظر إجراء أولي ثم اعتماد نهائي".

UI must visually distinguish:
- Preliminary results: dashed border, "قيد المراجعة" badge, edit allowed
- Final results: solid border, gold seal icon, "معتمد" badge, edit blocked

### D. Bulk results upload — missing
- ❌ `/committee/:id/bulk-upload` — Excel template download → user fills → upload → preview → confirm
- Validation against schema, error report per row

### E. Suspended applicant guard — missing
Per [K§2-1 p.41] and the scope summary, **suspended applicants must be blocked from any insert/edit/delete in committee operations**:
- ❌ Suspended applicants appear in red banner at top of any committee screen they're referenced in
- ❌ Their results entries are disabled with tooltip: "هذا المتقدم موقوف — لا يمكن التعديل"

### F. Committee chair approval workflow — missing
- ❌ Committee chair sees a queue of "preliminary results awaiting my approval"
- ❌ Bulk approve action (with confirmation modal)
- ❌ Reject with reason → results returned to entry user for correction

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

## 4.2 What's missing

### A. Session creation — missing
- ❌ `/board/sessions/create` — schedule a new session:
  - Date, time, location, agenda items
  - Attendees (multi-select from board members)
  - Linked applicants (those whose cases are reviewed this session)
  - Pre-meeting briefing pack (auto-generated PDF with applicant summaries)

### B. Live session interface — missing
- ❌ `/board/sessions/:id/live` — used during a session:
  - Current applicant being discussed (large photo + summary card)
  - Voting widget (each member votes pass/reject/defer)
  - Real-time vote tally (only chair sees individual votes; others see counts)
  - Move to next applicant
  - Session minutes auto-recorded

### C. Decision document generation [K§2-2 p.61]
- ❌ Decisions must be printable as official documents with:
  - Ministry header + Khayameya stripe
  - Decision number (auto-generated, format: `د/2026/<seq>`)
  - Decision date (Hijri + Gregorian)
  - Body text in legal Arabic prose (template-driven)
  - Members' signature blocks
  - Official seal placeholder
- Stored as PDF + linked to applicant record

### D. Member management — missing
- ❌ `/board/members` (currently `/board` shows them, but no CRUD): add / remove / change role of board members. Restricted to `board_admin`.

### E. Applicant case file view — missing
- ❌ `/board/applicants/:id` — board-specific applicant view consolidating:
  - All exam results
  - Investigation summary
  - Medical results
  - Previous board decisions if any
  - Attached documents
  - Discussion notes (per session)

---

# 5. Investigations (`/investigations/*`) — Application 2.3

> **Owner:** Investigations Department (إدارة التحريات). Internal security review of applicants.
> **Spec ref:** [K§2-3 pp.64–69]

## 5.1 What exists ✅
- `/investigations` — overview
- `/investigations/incoming` — incoming cases table with secrecy alert
- `/investigations/cases` — wider cases table

## 5.2 What's missing

### A. Case creation and assignment — missing
- ❌ `/investigations/create` — open new investigation:
  - Linked applicant (from approved committees queue)
  - Case type (لجنة أ / لجنة ج / مراجعة بيانات)
  - Assigned investigator (combobox from `investigator` role users)
  - Priority
  - Due date

### B. Case detail page [K§2-3 pp.64–66]
- ❌ `/investigations/cases/:id` — full case file:
  - Applicant summary (read-only)
  - Family tree (visual representation of all Stage 7 + Stage 11 data)
  - External database checks: criminal records, intelligence flags, social media
  - Evidence panel: file uploads + notes
  - Sub-task list per investigator
  - Conclusion field (predetermined options + freeform note)
  - Decision: pass / fail / defer-with-conditions
  - Attached PDF report

### C. Outgoing letters (صادر) workflow [K§2-3 p.64]
- ❌ `/investigations/outgoing` — list of outgoing requests to other ministries / agencies
  - Compose letter (template-driven)
  - Track status (sent / acknowledged / responded / closed)
  - Link to case file

### D. Distribution lists (كشوف) [K§2-3 p.64]
- ❌ `/investigations/distribution` — bulk-distribute applicants across investigators:
  - Filter applicants pending investigation
  - Auto-balance load across active investigators
  - Manual override
  - Generate distribution PDF (printable list)

### E. Restricted access UI affordances
The whole feature is sensitive. Per [K§2-3 p.64] and DESIGN_SYSTEM §2.2 (terracotta = restricted):
- ❌ All investigation screens have a persistent "سرّي" banner
- ❌ All investigation print outputs have a "سرّي للغاية" stamp watermark
- ❌ Audit log captures every view of every investigation case (not just edits)
- ❌ Screenshots blocked via JS where possible (best-effort)

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

### C. Doctor's interface
Each doctor logs into their station and sees:
- ❌ Today's queue (in arrival order)
- ❌ Current applicant (large photo + summary)
- ❌ Exam form (per station)
- ❌ Save preliminary / submit final (two-phase like committees)
- ❌ Skip / refer to specialist
- ❌ Print result slip

### D. Final medical certificate
- ❌ Master view aggregating all 8 stations' results for an applicant
- ❌ Overall verdict with auto-calculation logic (any FAIL → overall FAIL; any conditional → board review)
- ❌ Printable medical certificate per [DESIGN_SYSTEM §6.4]

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

## 7.2 What's missing

### A. Generation completeness
Current generator is visual-only. Required:
- ❌ Real barcode generation using `JsBarcode` library (Code 128 standard)
- ❌ Barcode encodes a structured ID: `<cycle>-<governorate>-<seq>` (e.g., `26-CAI-00001234`)
- ❌ QR code option for richer encoding (alternative format)
- ❌ Print-ready layout (A6 cards, 4-up A4 sheet, label-printer)
- ❌ Embed photo into card
- ❌ Reprint history with audit log

### B. Scanner interface
- ❌ `/barcode/scan` — full-screen scanner mode using `getUserMedia()` + `@zxing/library` for real camera barcode scanning
- ❌ Manual fallback: text input
- ❌ On scan, show applicant card + last action options:
  - Mark attendance for committee X
  - Log in/out of premises
  - Forward to another station

### C. Audit on every scan
- ❌ Each scan logs: who scanned, when, where, applicant_id, action taken, station context
- ❌ Detect duplicate scans within 10 seconds (likely double-trigger) and confirm

### D. Integration with biometric and committees [K§2-5 p.78]
The barcode app must talk to:
- ❌ Biometric system: scan barcode → triggers biometric verification step
- ❌ Committees: scan = applicant present in the committee
- ❌ Medical: scan = applicant arrived at station

These integrations are mock for now but the UI flows must exist.

### E. Lost / replacement card flow
- ❌ "إصدار بدل فاقد" — generate a replacement with new barcode, mark old as void, log who authorized

---

# 8. Biometric (`/biometric/*`) — Application 2.6

> **Owner:** security gate staff and exam-room invigilators.
> **Spec ref:** [K§2-6 pp.83–87]

## 8.1 What exists ✅
- `/biometric` — face + fingerprint scan UI placeholders
- `/biometric/enroll` — 4-step enrollment wizard
- `/biometric/history` — history table

## 8.2 What's missing

### A. Enrollment completeness
Current 4-step wizard is UI-only. Required per [K§2-6 p.83]:
- ❌ Step 1: capture face — actual `getUserMedia()` integration with face-detection feedback (libs: `face-api.js` or `MediaPipe`). Multiple captures (front, left, right) for templating.
- ❌ Step 2: capture fingerprints — UI for fingerprint device input. Mock with file upload of fingerprint image. Capture 10 fingers, label per finger.
- ❌ Step 3: liveness check — applicant blinks / turns head, anti-spoofing
- ❌ Step 4: review + confirm + save → server stores templates (not raw images)

### B. Verification interface — missing
- ❌ `/biometric/verify` — operational mode at gates and exam rooms:
  - Scan face → match against enrolled template, show top match with confidence score
  - Or scan fingerprint → match
  - Or scan barcode → fall back to face or fingerprint verification
  - On match: green confirmation + log entry/exit
  - On no-match: red alert + manual override path (with reason)

### C. Live monitoring dashboard — missing
- ❌ `/biometric/monitoring` — real-time view for security supervisor:
  - All gate stations (entry/exit) with current activity
  - Recent verifications (last 50)
  - Failed verifications (require attention)
  - Per-station traffic chart (line chart, 24h)

### D. Integration with attendance [K§2-6 p.83]
- ❌ Verification at exam-room entry = attendance for that exam
- ❌ Verification at academy gate = entry/exit logged
- ❌ Cross-check: barcode + biometric must both succeed for high-security exams

### E. Privacy and data handling
- ❌ All biometric data encrypted at rest (mention in mock service)
- ❌ Templates only — never raw biometric data stored
- ❌ Per-applicant audit log of every biometric event (visible in admin audit)
- ❌ Banner on enrollment screen: "بياناتك البيومترية محمية وتُستخدم فقط لأغراض التحقق من الهوية"

---

# 9. Question Bank & e-Exams (`/question-bank/*`, `/exams/*`) — Application 2.7

> **Owner:** exam admins (`exams_admin`). Manages question pool and conducts electronic capacities exams.
> **Spec ref:** [K§2-7 pp.88–99]

## 9.1 What exists ✅
- `/question-bank` — categories list
- `/exams` — exam list
- `/exams/results` — results charts

## 9.2 What's missing

### A. Question CRUD — missing
- ❌ `/question-bank/create` — new question form:
  - Category (combobox: قدرات لفظية / قدرات عددية / منطق / سرعة بديهة / etc.)
  - Difficulty level (1-5)
  - Question text (rich text editor for math/RTL support)
  - Question image (optional, FileUpload)
  - Question type: multiple-choice (4 options), true/false, ordering, fill-in
  - Answer options + correct answer marker
  - Time limit per question (seconds)
  - Notes (for QA reviewers)
- ❌ `/question-bank/:id` — view/edit single question with version history
- ❌ Bulk import from Excel template
- ❌ Publish workflow: draft → review → approved → live

### B. Question categorization
- ❌ Tree view of categories with question counts per category × difficulty
- ❌ Statistics: per-question pass rate (after exam runs)

### C. Exam construction — missing
- ❌ `/exams/create` — wizard:
  - Step 1: Exam metadata (name, cycle, type, scheduled date)
  - Step 2: Composition rules (e.g., "10 questions from قدرات لفظية difficulty 3-4, time limit 15 minutes")
  - Step 3: Auto-generate exam preview (algorithm picks questions per rules)
  - Step 4: Review + manual swap of any question
  - Step 5: Lock + publish

### D. Live exam interface — missing (for applicants taking the exam)
- ❌ `/exams/take/:examId` — applicant-facing exam interface:
  - Pre-exam: identity verification (biometric integration), instructions, "ابدأ الاختبار" CTA
  - During exam: large clear question, options with radio, timer (per-question + total), question navigator (jump between), "علم للمراجعة" flag
  - Anti-cheating: full-screen mode, tab-switch detection, copy/paste blocked
  - Submit early option
  - On time-up: auto-submit
- ❌ `/exams/:examId/proctor` — invigilator view: list of applicants currently taking, time remaining, flagged events

### E. Auto-grading and results [K§2-7 p.88]
- ❌ Auto-grade on submission
- ❌ Score breakdown per category
- ❌ Pass/fail per cycle's threshold
- ❌ Two-phase: preliminary results (visible to exam_admin) → final approval (approved by exams_admin) → published to applicant
- ❌ Re-grade workflow if a question is invalidated post-hoc

### F. Date/result conflict prevention [K§3.5 p.41]
Per the karasa, system must prevent date/result conflicts with previous or upcoming exams for same applicant. Add:
- ❌ Server-side check: if applicant has taken a similar exam in last X months, block re-take or show warning
- ❌ Cross-cycle exam history per applicant viewable in admin

### G. Reports
- ❌ Per-exam: question-level stats (pass rate, average time)
- ❌ Per-cycle: overall pass rate, score distribution, per-governorate breakdown
- ❌ Export to PDF / Excel

---

# 10. Cross-cutting — Hub, Architecture, Auth

## 10.1 Hub (`/`) — needs minor additions
- ✅ 9 app cards
- ✅ KPI strip
- ❌ Personalized greeting based on time of day + role
- ❌ "آخر النشاطات" feed across all apps the user has access to
- ❌ Quick actions per role (e.g., applicant: "متابعة طلبي"; committee_admin: "نتائج اليوم"; medical_admin: "طابور القومسيون")

## 10.2 Architecture page (`/architecture`)
- ✅ Currently shows 6-tier diagram
- ❌ Update to show **4-layer architecture from K§9** exactly: Public Portals + Middleware + Private Portals + Database
- ❌ Make integration table interactive — click an integration to see its data flow detail
- ❌ Add tech stack with versions

## 10.3 Login
- ✅ Role picker exists (demo only)
- ❌ Real login screen needs **two paths**:
  - Officer login (MOIPASS-backed) for admin/committee/medical/board/investigations/exams roles
  - Applicant login (NID + SMS) for applicants only
- ❌ Forgot password flow (admin only — applicants restart Stage 1)
- ❌ 2FA prompt for high-privilege roles
- ❌ Session timeout warning at 25 minutes (5 min before logout)
- ❌ Concurrent session warning if same user logs in elsewhere

## 10.4 Global features missing

### A. Global search (⌘K)
- ❌ Implement command palette (`cmdk` library)
- ❌ Searches across: applicants (by NID or name), committees, exams, audit, reference data
- ❌ Quick-actions: navigate to route, run report, export current view

### B. Notifications center
- ❌ Bell icon in header → drawer with notification list
- ❌ Per-role notification types:
  - applicant: stage advance, payment confirmed, exam scheduled, results published
  - committee_admin: results awaiting approval, suspended applicant entered, deadline approaching
  - medical_admin: equipment failure, low capacity warning
  - investigator: case assigned, due date approaching
- ❌ Mark read / unread / clear all

### C. User profile / settings
- ❌ `/profile` — current user profile, change password, change avatar, preferences (language stays Arabic, but date format toggle, notification preferences)

### D. Help / documentation
- ❌ `/help` — context-sensitive help, keyboard shortcuts cheat-sheet, video tutorials links, contact support

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
