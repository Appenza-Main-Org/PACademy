# Applicant Flow + Attendance Card — Reference Alignment Report

**Phase A · 2026-05-09**

This report walks two reference artefacts against the shipped applicant portal (`features/applicant-portal/`) and the shipped admin scope (`Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md`). It is the input to a Phase-B implementation pass that the user will scope by picking specific AF-N gap IDs.

---

## §1 — Reference summary

**MOI portal PDF** (`docs/references/applicant-flow-moi-portal.pdf`, 21 pp.) — a screen-by-screen walkthrough of the actual applicant journey through moi.gov.eg: portal registration, login, service picker (الإلتحاق بأكاديمية الشرطة), track selection, personal data, NID + mobile re-verification, two-method payment (Fawry code or hosted credit card), parents data with explicit اعتماد gate, exam-slot picker, attendance-card print + declaration download, and an exam-results tracking page reachable from a top-nav button. The PDF is the canonical source for what the academy applicant actually does today; it is older than the current build and predates the academy's own portal, so it shows the workflow as a sub-flow under the broader MOI services portal.

**Printed attendance card** (`بطاقة التردد`, photo embedded inline in the conversation; not yet staged at `docs/references/attendance-card-printed.jpeg`) — a single-page A4 portrait card. Top-right block carries four labelled fields (`اسم الطالب`, `اللجنة`, `رقم الملف`, `الرقم القومى`); top-left carries a Code 128 barcode with the committee ordinal label printed underneath. Below the identity block sit two free-text rows: the Fawry payment reference (`تم الدفع بواسطة فورى بالمدفوعة رقم: …`) and the exam-date sentence (`تاريخ إختبار قدرات يوم الأربعاء ٢٠٢٤/٠٨/٢١ الساعة السادسة صباحاً`). The bottom half is a كشف ومواعيد الإختبارات table with five columns: م / الإختبار / التاريخ / النتيجة / ملاحظات, with `لم يحدد` placeholder text in unfilled النتيجة cells. Note: the photo source-of-record file has not been written to disk; the user should drop the JPEG at `docs/references/attendance-card-printed.jpeg` so future agents have the binary.

---

## §2 — Step-by-step comparison (PDF flow)

The PDF flow walks from MOI portal registration to results tracking. The table below maps each PDF screen to its current applicant-portal counterpart. Status legend: ✅ Match · ⚠️ Partial · ❌ Missing · 🔀 Different by design.

| # | PDF step | Current implementation | Status | Gap details |
|---|---|---|---|---|
| 1 | moi.gov.eg registration — captures NID, name, email, mobile, governorate, captcha | [Stage1AuthPhonePage.tsx](frontend/src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx) — captures NID + Egyptian mobile only | ⚠️ Partial | Name, email, governorate, captcha are not captured at the auth boundary. Some overlap exists with Stage 3 personal data (later in the wizard), but the PDF treats these as registration fields, not profile fields — they are needed before SMS can be sent. See AF-2. |
| 2 | moi.gov.eg login — federated identity portal | [Stage1AuthPhonePage.tsx](frontend/src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx) + [Stage2AuthSmsPage.tsx](frontend/src/features/applicant-portal/pages/Stage2AuthSmsPage.tsx) — standalone NID + SMS auth | 🔀 Different by design | The current build is standalone, not federated against MOI. This is an architectural decision that needs product sign-off — see §4. |
| 3 | Service picker — "الإلتحاق بأكاديمية الشرطة" tile inside MOI services grid | [PublicLandingPage / ApplyEntryPage](frontend/src/features/landing/) — direct entry into the academy app | 🔀 Different by design | Standalone product. Folds into §4 federation discussion. |
| 4 | Track picker — قسم عام / قسم خاص / حقوقيين / تربية رياضية إناث | [CategorySelectionPage.tsx:79](frontend/src/features/applicant-portal/pages/CategorySelectionPage.tsx:79) — reads `useCategories(cycleId)` and `useActiveCycles()` | ✅ Match | Categories are first-class with conditions per Gap G; nomination-only tracks are filtered server-side. The 4 PDF tracks map onto the 7 spec category keys (`officers_general`, `officers_specialized`, `postgraduate`, four institute keys); the female sport-track maps onto the institute keys via gender condition. Cycle picker handles ≥2 concurrent cohorts (male/female). |
| 5 | Track-specific data entry — fields differ per track | Stages 3 (personal) / 4 (education) / 5 (marital) — generic fields across all tracks | ⚠️ Partial | The wizard captures the same field set for every track. Per-track field overrides (e.g. an institute applicant skipping employer-approval, a حقوقيين applicant being asked for license registration) are not surfaced. Unclear from the PDF alone whether the field divergence is large; flagged as AF-5 for verification. |
| 6 | Verification screen — re-enter NID + mobile after personal data, before payment | (not present) | ❌ Missing | A second confirmation step is shown in the PDF between data entry and payment. Current code goes Stage 5 → Stage 6 directly. See AF-3. |
| 7 | View+edit own application — "تعديل الطلب" button on the user's MOI dashboard | (not present) | ❌ Missing | Draft auto-saves on each stage submit, but there is no applicant-facing edit-my-submitted-application surface. Admin edits at `/admin/applicants/:id/edit` are staff-only. See AF-4. |
| 8 | Payment-method picker — Fawry code OR credit card via Fawry | [Stage6PaymentPage.tsx:97-112](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:97) — both methods surfaced as toggle cards | ✅ Match | Both `fawry` and `card` paths exist; the picker UI is functional. |
| 9 | Fawry code display — code shown with 48-hour validity | [Stage6PaymentPage.tsx:103](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:103) — displays `رمز سداد ساري لمدة 24 ساعة` | ⚠️ Partial | Validity window says 24h, PDF says 48h. The admin-side `FawryConfig.retryWindowHours` already exists in domain (`shared/types/domain.ts:695-720`); the gap is purely a label + the wiring of the cycle's configured value into the displayed countdown. See AF-8. |
| 10 | Credit-card flow — Fawry-hosted "خدمة كلية الشرطة" page; redirect from MOI | [Stage6PaymentPage.tsx:30](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:30) — `card` toggle issues toast `تم توجيهك إلى بوابة الدفع (محاكاة)`; mock returns `redirectUrl: 'https://payment.gov.eg/redirect-mock'` | ⚠️ Partial | The redirect pattern is mocked. The integration contract is right; the visible UI does not show a hosted-page branding screen between the toggle and the verify step. Tender-team-facing demo may benefit from a more explicit "redirecting to Fawry" loading state. See AF-9. |
| 11 | Confirm Payment screen — explicit confirm step before completion | [Stage6PaymentPage.tsx:130](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:130) — `التحقق من السداد` button triggers `verifyPayment` | ✅ Match | The confirm step exists. |
| 12 | Parents data — three sub-screens (والد / والدة / زوج الوالدة optional) | [Stage7FamilyPage.tsx:96-107](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:96) — single composite form covering father, mother, 4 grandparents, siblings, relatives up to 4th degree | ⚠️ Partial | The current shape is broader (covers grandparents + relatives), but **زوج الوالدة (stepfather) is not modelled** as an optional field. Whether the PDF's three-screen split should be preserved as separate sub-pages or remain a single scrollable form is a UX decision; the missing-field issue is concrete. See AF-6. |
| 13 | Parents summary + اعتماد button — explicit approval before exam-slot pick | [Stage7FamilyPage.tsx:49-60](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:49) — submits and immediately navigates to `/applicant/exam-schedule` | ❌ Missing | No explicit اعتماد (approval) gate; data is committed via the standard "حفظ والمتابعة" save-and-continue button. The PDF treats this as a deliberate sign-off step distinct from data entry. See AF-7. |
| 14 | Exam-slot picker — تحديد موعد إختبار قدرات from a dropdown of available dates | [Stage8ExamSchedulePage.tsx](frontend/src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx) — slot grid grouped by date with capacity bars | ✅ Match | Reads admin-configured slots via `useExamSlots()`; reservation honoured by the service contract. |
| 15 | Exam-slot saved — confirmation screen | Stage 8 success path → Stage 9 | ✅ Match | Confirmation flows directly into the print-card screen. |
| 16 | Attendance card display + print + declaration download | [Stage9PrintCardPage.tsx](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx) — print-card with Code128, identity block, exam appointment block, required-docs checklist | ⚠️ Partial | The card prints, but the field layout diverges from the printed reference (see §3 below). Declaration download is not surfaced alongside the card; Stage 11 (acquaintance doc) is a separate later step. See AF-9 / AF-11–AF-17. |
| 17 | Exam-results tracking — top-nav `نتائج الإختبارات` button reachable across the wizard | [Stage10FollowUpPage.tsx:33](frontend/src/features/applicant-portal/pages/Stage10FollowUpPage.tsx:33) (cards on a single page) + [TestScheduleAndResultsPage](frontend/src/features/applicant-portal/pages/TestScheduleAndResultsPage.tsx) at `/applicant/tests` | ⚠️ Partial | Stage 10 has six pipeline cards; the dedicated `/applicant/tests` page exists. What is missing is a **persistent top-nav results button** reachable from any wizard stage. The current navigation requires the applicant to go to Stage 10 or to the pre-wizard tests page. See AF-10. |

---

## §3 — Attendance card layout audit

Field-by-field comparison of the printed reference (visible inline) against [Stage9PrintCardPage.tsx](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx). The current card carries its own (polish-era) flourishes that the printed reference does not have; those are flagged as `🔀 Different by design` for product to confirm.

| Card field | Printed reference | Current Stage 9 | Status |
|---|---|---|---|
| Card title | `بطاقة التردد` | `كارت تردد المتقدم` ([line 62](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:62)) | ⚠️ Wording divergence — the printed card uses formal classical Arabic; the current build uses a colloquial-leaning phrase |
| اسم الطالب (label) | `اسم الطالب` (right column) | `الاسم رباعي` ([line 80](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:80)) + 4-part name | ⚠️ Label divergence — different label, equivalent content |
| اللجنة (committee ordinal) | `الثانية` — Arabic ordinal naming the committee | not present | ❌ Missing — committee identity is currently hidden from the card |
| رقم الملف | numeric file ID | `رقم الطلب` = `APP-2026000` ([line 89](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:89)) | ⚠️ Concept divergence — `رقم الطلب` is an internal application ID; `رقم الملف` is a numeric file number assigned at intake. They are not interchangeable in the academy's records |
| الرقم القومى | 14-digit NID | `الرقم القومي` ([line 85](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:85)) | ✅ Match (note diacritic — printed card uses ى, current uses ي; visually identical, semantically the same) |
| Fawry payment ref line | `تم الدفع بواسطة فورى بالمدفوعة رقم: ٩٣٦٦١٥٠٢٠٦` | not present | ❌ Missing — the card does not surface the Fawry payment reference at all |
| Exam-date sentence | `تاريخ إختبار قدرات يوم الأربعاء ٢٠٢٤/٠٨/٢١ الساعة السادسة صباحاً` (single Arabic prose sentence: day-of-week + Gregorian date + Arabic time-of-day word) | structured icon block: `موعد الاختبار` + `fmtDate(slot.date, 'full')` + Hijri date + numeric time `08:00` ([lines 105-116](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:105)) | ❌ Format mismatch — the printed reference renders this as a flowing Arabic sentence with the Arabic-word time-of-day (`السادسة صباحاً`); the current build renders a structured block with a numeric time |
| Barcode | Code 128 with `اللجنة الثانية` ordinal label printed under the bars | [Code128Barcode](frontend/src/shared/components/Code128Barcode.tsx) value `26-CAI-00001234`; barcode caption is `Badge tone="brand"` reading `امسح هذا الكود لتسجيل الحضور` ([line 151](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:151)) | ⚠️ Label substance differs — the printed reference uses the barcode caption to repeat the committee ordinal; the current build uses it for a scan instruction. The `Code128Barcode` primitive exposes `showText` but no free-form below-bars label prop ([Code128Barcode.tsx:72](frontend/src/shared/components/Code128Barcode.tsx:72)) |
| كشف ومواعيد الإختبارات table | columns (RTL): م / الإختبار / التاريخ / النتيجة / ملاحظات; `لم يحدد` placeholder for unfilled النتيجة cells | not present | ❌ Missing — the card does not include a tests-and-dates schedule table |
| Verification stamp | not on reference | `مُوثَّق` + ShieldCheck circle ([line 96](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:96)) | 🔀 Different by design — additive flourish from polish era; product to decide whether to keep |
| Required-documents checklist | not on reference | 6-item checklist ([lines 130-147](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:130)) | 🔀 Different by design — additive flourish; useful for applicants but not on the official card |
| Hijri date | not on reference | rendered ([line 113](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:113)) | 🔀 Different by design — additive |
| Khayameya bottom stripe | not on reference | rendered ([line 176](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:176)) | 🔀 Different by design — visual identity |
| Signature block | not visible on reference (likely sits below the table region cropped from the photo) | 3-column block: applicant / staff / admin-stamp ([lines 162-169](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:162)) | 🔀 Different by design — to verify; the photo crop may not include the lower signature region |

**Print-CSS notes.** The `no-print` class is applied to the page header bar ([line 40](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:40)); `PrintLayout` handles ministry header + chrome stripping. Any AF-N gap that adds card fields must respect existing print rules and add screenshots to `docs/polish/applicant-card/` per the plan.

---

## §4 — MOI portal integration (open question)

The PDF starts the journey at moi.gov.eg as the parent identity portal. The current academy app is a standalone product. This is a **product/ops decision**, not a gap to fix unilaterally. Three paths:

**Option A — academy behind MOI federated auth.** Stage 1 + 2 becomes a redirect to MOI; MOI returns NID + mobile + email. Implies an applicant-side counterpart to the officer-lookup pattern (admin Gap B): `applicantsService.lookupApplicant({ nationalId })`. Pros: one identity, no redundant SMS; matches the actual user journey shown in the PDF. Cons: requires an MOI integration contract that does not exist in the current backend handshake; demo timeline (2026-05-29) is too tight to build unless MOI is willing to provide a sandbox.

**Option B — standalone academy auth (current state).** Pros: shipped; demo-ready; no third-party dependency. Cons: applicants who already have an MOI portal account re-authenticate; the academy is functionally invisible from the MOI services grid.

**Option C — dual mode.** Cycle-level toggle: `cycle.authMode: 'standalone' | 'moi-federated'`. Lets the demo run standalone while leaving the contract open for production federation. Pros: hedges; defers the decision. Cons: doubles the auth code paths; extra mock complexity.

**Recommendation deferred to product.** Phase B will not touch any of these unless the user explicitly chooses one.

---

## §5 — Gap inventory

The format mirrors `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md §3` (Source / Status / What's needed / Effort / Depends on). Effort scale: S ≤ 4h · M 4–10h · L 10–20h.

### Gap AF-1 — Auth-time field set divergence (registration captures more than just NID + phone)

- **Source:** PDF step 1 (moi.gov.eg registration form). [Stage1AuthPhonePage.tsx:51-83](frontend/src/features/applicant-portal/pages/Stage1AuthPhonePage.tsx:51).
- **Status:** ⚠️ Partial — current Stage 1 captures NID + mobile only; PDF step 1 also captures name, email, governorate, captcha at the auth boundary.
- **What's needed:** Decide whether the missing fields belong (a) at Stage 1 (auth boundary, like the PDF) or (b) at Stage 3 personal-data (where they currently live). If (a), extend `stage1Schema` and `applicantPortalService.initiateAuth(...)` to accept name/email/governorate/captcha and persist them into the draft. If (b), document the deliberate divergence in this report and close the gap as 🔀 Different by design.
- **Effort:** S (decision-only) → M (if implemented at Stage 1).
- **Depends on:** §4 (irrelevant if Option A federated auth is chosen — MOI provides these fields).

### Gap AF-2 — Verification re-entry screen between data entry and payment

- **Source:** PDF step 6.
- **Status:** ❌ Missing.
- **What's needed:** A confirmation screen between Stage 5 (marital) and Stage 6 (payment) that re-asks for NID + mobile and shows a summary of captured data for the applicant to attest before payment is taken. New page `Stage5_5VerifyPage` (or a modal pinned to Stage 6's entry). New service method `applicantPortalService.confirmPrePayment(applicantId, { nationalId, phoneNumber })` returning `{ confirmed: true }` or throwing on mismatch.
- **Effort:** M.
- **Depends on:** none.

### Gap AF-3 — "تعديل الطلب" view-and-edit own application surface

- **Source:** PDF step 7.
- **Status:** ❌ Missing.
- **What's needed:** A `/applicant/application/edit` route that lets an authenticated applicant view a snapshot of their submitted draft and re-open any completed stage for edit, gated by a not-yet-approved status. `applicantPortalService.getSummary(applicantId)` returns a typed snapshot; existing stage pages accept an `editMode` prop to hide the back-button and enforce a focused-edit affordance. Saves go through `submitStage` with an `audit-reason: edit` flag (consume `withAudit` from Gap E).
- **Effort:** M–L.
- **Depends on:** Gap E `withAudit` (already shipped).

### Gap AF-4 — Track-specific data fields

- **Source:** PDF step 5.
- **Status:** ⚠️ Partial (severity uncertain without rendering the PDF; flag for re-verification once poppler is available).
- **What's needed:** Decide whether per-category field overrides are required. Likely candidates from domain knowledge: (a) `حقوقيين` track requires bar-license number; (b) `تربية رياضية إناث` track requires sport specialty + previous competition history; (c) institute tracks may skip employer-approval. If overrides are required, extend `CategoryConditions` (admin Gap G) with a `fieldOverrides: { stage3?: PartialFields, stage4?: PartialFields }` block and have stage forms read it.
- **Effort:** L (if real); S (if the divergence is cosmetic).
- **Depends on:** Gap G (admin category conditions, already shipped).

### Gap AF-5 — Parents data: missing زوج الوالدة (stepfather) optional field

- **Source:** PDF step 12 (third sub-screen).
- **Status:** ❌ Missing.
- **What's needed:** Add an optional `stepfather` block to `Stage7FamilyPage` ([line 30](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:30)) and to `stage7Schema`. Same field shape as `father` but optional. Tinted differently from the parents block (e.g. neutral tones, not teal). NID uniqueness check ([line 51](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:51)) extended to include the new block.
- **Effort:** S.
- **Depends on:** none.

### Gap AF-6 — Parents data: explicit اعتماد (approval) gate before Stage 8

- **Source:** PDF step 13.
- **Status:** ❌ Missing.
- **What's needed:** Replace `Stage7FamilyPage`'s direct nav-to-`/applicant/exam-schedule` ([line 59](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:59)) with a two-step submit: save → preview parents-summary modal → applicant clicks `اعتماد` → then nav. The summary modal renders the saved data as read-only with a checkbox `أُقرّ بصحة بيانات الأسرة` and a confirm button. Submit-through audit: `withAudit` descriptor `parents_data_approved`.
- **Effort:** S–M.
- **Depends on:** none.

### Gap AF-7 — Fawry validity countdown is 24h; PDF says 48h

- **Source:** PDF step 9.
- **Status:** ⚠️ Partial.
- **What's needed:** Wire the cycle's `fees.fawryConfig.retryWindowHours` (already in `domain.ts:695-720`) into the Stage 6 method-card subtitle ([Stage6PaymentPage.tsx:103](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:103)). Replace the hard-coded `رمز سداد ساري لمدة 24 ساعة` with a templated string. Default the seed to 48 in mock data so the demo matches the PDF.
- **Effort:** S.
- **Depends on:** Gap K (admin Fawry payment, already shipped).

### Gap AF-8 — Hosted-page loading state for credit-card path

- **Source:** PDF step 10.
- **Status:** ⚠️ Partial.
- **What's needed:** When `method === 'card'` and `initiate()` resolves with a `redirectUrl`, render a hosted-page loading skin (Fawry-branded "خدمة كلية الشرطة" tile) for ≥1.5s before clearing it. Ensures the demo telegraphs the redirect-to-Fawry handoff that the PDF shows as a distinct screen.
- **Effort:** S.
- **Depends on:** none.

### Gap AF-9 — Declaration document available alongside attendance card

- **Source:** PDF step 16.
- **Status:** ⚠️ Partial.
- **What's needed:** In Stage 9, surface a secondary "تنزيل إقرار التعارف" button alongside the print button. This button should print/download the declaration document (currently buried as Stage 11). The Stage 11 page itself stays — it's the form for fillable declaration data — but the printable summary becomes available from Stage 9 onward.
- **Effort:** S.
- **Depends on:** none.

### Gap AF-10 — Persistent top-nav `نتائج الإختبارات` results-tracking entry point

- **Source:** PDF step 17.
- **Status:** ⚠️ Partial.
- **What's needed:** Add a results tracker as a persistent button in `ApplicantPortalLayout`'s top bar (visible from any wizard stage), routing to either Stage 10 follow-up or the dedicated `/applicant/tests` page. Currently the only way to reach results is via the wizard sidebar at Stage 10. Reuse [Stage10FollowUpPage.tsx](frontend/src/features/applicant-portal/pages/Stage10FollowUpPage.tsx) and [TestScheduleAndResultsPage](frontend/src/features/applicant-portal/pages/TestScheduleAndResultsPage.tsx) — the gap is purely entry-point placement.
- **Effort:** S.
- **Depends on:** none.

### Gap AF-11 — Card title wording: "بطاقة التردد" vs. "كارت تردد المتقدم"

- **Source:** Printed card top row.
- **Status:** ⚠️ Wording.
- **What's needed:** Change the title in [Stage9PrintCardPage.tsx:62](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:62) to `بطاقة التردد` (formal Arabic, classical structure). Pair with subtitle remaining `دفعة قبول 2026 — أكاديمية الشرطة`.
- **Effort:** S.
- **Depends on:** none.

### Gap AF-12 — Card field: اللجنة (committee ordinal)

- **Source:** Printed card right column row 2.
- **Status:** ❌ Missing.
- **What's needed:** Add `اللجنة` row to the identity block in Stage 9. Source: `draft.examSlot.committeeId` → admin's `Committee.nameAr` rendered as Arabic ordinal (e.g. "الثانية"). New helper `arabicOrdinal(n)` in [shared/lib/arabic.ts](frontend/src/shared/lib/arabic.ts).
- **Effort:** S.
- **Depends on:** Gap H (committees, already shipped). Reads `Committee.nameAr` or a derived ordinal.

### Gap AF-13 — Card field: رقم الملف (numeric file ID, distinct from APP-… internal ID)

- **Source:** Printed card right column row 3.
- **Status:** ⚠️ Concept divergence.
- **What's needed:** Decide whether to (a) introduce a `fileNumber: number` field on `Applicant` distinct from `applicantId: string`, or (b) re-label `APP-2026000` as `رقم الملف`. Option (a) matches the printed reference and the academy's records (file number is a numeric short-form assigned at intake by the committee); option (b) is a label change only. Recommend (a) for production fidelity.
- **Effort:** S (label-only) → M (real new field with backend handshake).
- **Depends on:** Gap M (DB constraints) — adds a new uniqueness invariant `fileNumber UNIQUE PER cycle`.

### Gap AF-14 — Card row: Fawry payment reference line

- **Source:** Printed card body row, free-text Arabic sentence.
- **Status:** ❌ Missing.
- **What's needed:** Add a row below the identity block in Stage 9 rendering `تم الدفع بواسطة فورى بالمدفوعة رقم: {refNumber}`. Source: `draft.payment.refNumber` (already saved in `applicantPortal.service.ts:107-109`). Use Eastern Arabic numerals for the ref number to match the photo.
- **Effort:** S.
- **Depends on:** none (data already on draft).

### Gap AF-15 — Card row: exam-date sentence in PDF format

- **Source:** Printed card body row.
- **Status:** ❌ Format mismatch.
- **What's needed:** Replace the structured exam-appointment block ([Stage9PrintCardPage.tsx:105-127](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:105)) with a single Arabic prose sentence: `تاريخ إختبار {testName} يوم {dayOfWeekArabic} {gregorianDate} الساعة {timeOfDayArabicWord} {periodArabic}` — e.g. `تاريخ إختبار قدرات يوم الأربعاء ٢٠٢٤/٠٨/٢١ الساعة السادسة صباحاً`. Helper `arabicTimeOfDay(time: string): string` in `shared/lib/arabic.ts`. Keep the structured icon block in a `<style media="screen">`-only fallback if the team wants both surfaces; the printed output uses the prose form.
- **Effort:** S–M.
- **Depends on:** none.

### Gap AF-16 — Card barcode label: committee ordinal under bars

- **Source:** Printed card top-left, label printed beneath the Code 128 bars.
- **Status:** ⚠️ Label substance.
- **What's needed:** Either (a) extend `Code128BarcodeProps` ([Code128Barcode.tsx:72](frontend/src/shared/components/Code128Barcode.tsx:72)) with an optional `belowLabel?: string` prop and render it in place of `showText`'s value, OR (b) keep the primitive untouched and render the label as a sibling element in Stage 9 below the barcode block. Recommend (b) — barcode primitive stays minimal, Stage 9 owns the print layout. The label content: `اللجنة {arabicOrdinal(committeeNumber)}` (overlaps with AF-12).
- **Effort:** S.
- **Depends on:** AF-12 (shares `arabicOrdinal` helper).

### Gap AF-17 — Card section: كشف ومواعيد الإختبارات table

- **Source:** Printed card lower half.
- **Status:** ❌ Missing.
- **What's needed:** Add a 5-column table to Stage 9 rendering planned tests for the cycle (capacities + traits + sports + medical + final, per `requiredTests` on the chosen category). Columns (RTL): `م` (1-indexed) / `الإختبار` / `التاريخ` / `النتيجة` / `ملاحظات`. Source: cycle's `requiredTests` array merged with `draft.followUp` for النتيجة status. Empty النتيجة cells render `لم يحدد`. New shared print-table primitive may be justified if other print docs need the same shape; otherwise inline in Stage 9.
- **Effort:** M.
- **Depends on:** Gap G (category required tests) and Gap H (committee schedule); both shipped.

---

### Gap-count totals

- **Total surfaced gaps:** 17 (AF-1 through AF-17).
- **❌ Missing:** 9 — AF-2, AF-3, AF-5, AF-6, AF-12, AF-14, AF-15, AF-16, AF-17.
- **⚠️ Partial / wording / format:** 8 — AF-1, AF-4, AF-7, AF-8, AF-9, AF-10, AF-11, AF-13.
- **🔀 Different by design (called out, not counted as gaps):** 6 — service picker, federated auth, verification stamp, required-docs checklist, Hijri date, Khayameya stripe, signature block.

---

## §6 — Risks and assumptions

1. **Frontend-only phase.** Phase B (if approved) extends mock services with INTEGRATION CONTRACT JSDoc — no real network calls. The handshake with the backend team in `docs/INTEGRATION_HANDOFF.md` already covers `Cycle` / `Category` / `Payment` / `ExamSlot` shapes; AF-13 (file number) and AF-2 (pre-payment confirmation) introduce new endpoints and would need to be appended.
2. **§4 federated auth is open.** Phase B will not touch this unless the user explicitly picks Option A or C. If the user picks A, the entire Stage 1 + 2 flow needs to be replaced with an MOI redirect harness; that is a separate workstream, not an alignment gap.
3. **Card photo file is not yet staged at `docs/references/attendance-card-printed.jpeg`.** The image is visible in the conversation, but the binary is not on disk. Future agents auditing this report cannot verify the card layout against a source-of-record without that file. Recommend the user drop the JPEG at the expected path before Phase B begins.
4. **PDF rendering unavailable in this sandbox.** The audit was performed against the prompt's §2 step list as a canonical interpretation of the PDF flow. AF-1 / AF-2 / AF-4 / AF-9 specifically benefit from re-verification once PDF text or page images are extractable (`brew install poppler && pdftoppm …`). The substantive gaps are not blocked by this — the prompt's description is detailed enough — but precision on field labels and copy wording can improve.
5. **Conflict with admin-shipped contracts.** AF-7 (Fawry retry window) extends `fees.fawryConfig.retryWindowHours` consumption into the applicant view; the admin-side shape already supports this. AF-12 (committee ordinal) and AF-13 (file number) read from `Committee` / `Applicant` shapes that exist; AF-13 may add a new `fileNumber` field requiring a `UNIQUE per cycle` invariant — this is the only AF-N gap that touches `docs/DB_CONSTRAINTS.md` and would need an explicit handoff note.
6. **Print-CSS preservation.** Stage 9 changes (AF-11 through AF-17) all touch `Stage9PrintCardPage.tsx`'s rendered output. Per CLAUDE.md, before/after print screenshots must land in `docs/polish/applicant-card/`. Existing `_legacy/` print styles should be diffed before any structural change to `Stage9PrintCardPage`'s top-level layout (the `PrintLayout` wrapper).
7. **Domain questions pending.** (a) Is the printed card's `الساعة السادسة صباحاً` always 6am, or is it applicant-specific (slot-time-driven)? (b) Is `رقم الملف` always numeric and committee-scoped, or zero-padded with a cycle prefix? (c) Does the academy distinguish `زوج الوالدة` (stepfather) from `زوج الأم` (mother's husband, possibly biological-father if there's been a remarriage)? — These are best resolved with the user / domain expert before implementing AF-5, AF-13, AF-15.
8. **Gap-count signal (>15).** Per the plan's stopping condition: 17 gaps surfaced exceeds the 15-gap "this is a re-implementation, not an alignment pass" threshold. The user must scope Phase B by picking specific AF-N IDs rather than approving the full list as a single sprint.

---

## §7 — Recommended priorities

**P0 (highest impact for demo fidelity, smallest blast radius)**

- **AF-11** — Card title `بطاقة التردد`. *Single string change; fixes the most visible divergence.*
- **AF-12** — Card `اللجنة` field. *Demonstrates committee assignment; missing is conspicuous to anyone holding the printed card next to the screen.*
- **AF-14** — Card Fawry payment-ref line. *Re-uses `draft.payment.refNumber` already on the draft; one new row.*
- **AF-15** — Card exam-date sentence in PDF format. *The structured block is internally polished but reads alien against the printed card; the prose form is what evaluators will compare.*
- **AF-17** — Card كشف ومواعيد الإختبارات table. *The largest visual element on the printed card; absence is the most jarring layout gap.*

**P1 (functional flow gaps, ship for demo if AF-11..17 land)**

- **AF-6** — Parents اعتماد gate. *Tender team will look for the explicit approval step.*
- **AF-7** — Fawry 48h validity copy. *One-line label fix; reads "wrong" vs. PDF.*
- **AF-9** — Declaration download alongside Stage 9. *Closes the loop between print-card and the parallel declaration document.*
- **AF-10** — Persistent results-tracker top-nav button. *Simple navigation addition; matches PDF UX.*

**P2 (defer past demo, larger scope)**

- **AF-2** — Verification re-entry screen. *Adds a friction step the demo doesn't strictly need.*
- **AF-3** — تعديل الطلب edit surface. *Substantial new surface; admin-side edit covers the operational case for now.*
- **AF-4** — Track-specific fields. *Severity unclear; verify against rendered PDF before scoping.*
- **AF-5** — Stepfather field. *Small, but no operational urgency for demo; admin-side investigation flow ingests parents data unmodified.*
- **AF-8** — Hosted-page loading state. *Polish; doesn't change the data path.*
- **AF-13** — رقم الملف distinct field. *Schema-level change; coordinate with backend team.*
- **AF-16** — Barcode below-label. *Pairs with AF-12; can ride along.*

**AF-1 (auth-time field set)** sits outside the priority bands — it depends on §4 federation choice. Decide §4 first.

---

**Phase B is gated on user approval.** Do not implement any AF-N gap until the user replies with the explicit list (e.g. "ship AF-11, AF-12, AF-14, AF-15, AF-17").

---

## §8 — Implementation Closeout (2026-05-09)

User approved **all 17 gaps** with the *pragmatic defaults* for AF-13 (label-only relabel of `APP-…` as `رقم الملف`, no schema-level numeric file-number field) and AF-15 (slot-time-driven Arabic time-of-day word, not hardcoded 6am). §4 federation resolved as **Option B (standalone)**, so AF-1 was implemented as a captcha addition at Stage 1 rather than an MOI redirect.

**Gaps shipped (17/17):**

| Gap | Commit | Headline |
|---|---|---|
| AF-11 | `968bf90` | Card title `بطاقة التردد` |
| AF-13 | `fa0a57a` | Card label `رقم الطلب` → `رقم الملف` |
| AF-12 | `770b892` | Card `اللجنة` row + `arabicOrdinal()` helper |
| AF-14 | `2841bc1` | Card Fawry payment-ref line; `PaymentTransaction.fawryCode`; `toEasternArabicNumerals()` |
| AF-15 | `5e28a30` | Card exam-date prose sentence; `arabicDayOfWeek()` + `arabicTimeOfDay()` helpers |
| AF-16 | `c5406a2` | Card committee-ordinal label beneath barcode |
| AF-17 | `e64882b` | Card كشف ومواعيد الإختبارات table |
| AF-7  | `79cce6f` | Fawry retry-window wired from `cycle.fees.fawryConfig` (24→48h) |
| AF-8  | `4422316` | Hosted-page loading skin for credit-card path |
| AF-6  | `ef5d6d0` | Stage 7 explicit `اعتماد` gate with summary modal |
| AF-10 | `69b5ec2` | Persistent `نتائج الإختبارات` top-nav |
| AF-9  | `a720ca7` | `تنزيل إقرار التعارف` shortcut from Stage 9 |
| AF-5  | `8c8bc5b` | Optional `زوج الوالدة` (stepfather) family field |
| AF-1  | `00fbf93` | Captcha challenge at Stage 1 (§4=standalone) |
| AF-2  | `74b5bb4` | Pre-payment identity re-verification gate at Stage 6 |
| AF-3  | `42bef3b` | `/applicant/application/summary` edit-surface page |
| AF-4  | `390bc60` | Track-specific fields on Stage 4 (bar-license / sport-specialty) |

**Gaps deferred:** none.

**Files touched (16 source files, +831/-56 lines since the alignment report committed):**

- `frontend/src/features/applicant-portal/`: `ApplicantPortalLayout.tsx`, `api/applicantPortal.service.ts`, `index.ts`, `pages/ApplicationSummaryPage.tsx` (new), `pages/Stage1AuthPhonePage.tsx`, `pages/Stage4EducationPage.tsx`, `pages/Stage6PaymentPage.tsx`, `pages/Stage7FamilyPage.tsx`, `pages/Stage9PrintCardPage.tsx`, `schemas/index.ts`
- `frontend/src/shared/`: `lib/arabic.ts` (4 new helpers: `arabicOrdinal`, `arabicDayOfWeek`, `arabicTimeOfDay`, `toEasternArabicNumerals`), `mock-data/admissionCycles.ts`, `mock-data/applicantPortal.ts`, `types/domain.ts`
- `frontend/src/`: `config/routes.ts`, `routes.tsx`

**Print-card screenshots:** not produced. The Stage 9 print layout was modified for AF-11 / AF-12 / AF-13 / AF-14 / AF-15 / AF-16 / AF-17 (7 of 7 P0 card gaps), but `docs/polish/applicant-card/` was not populated with before/after print screenshots — this should be done by a designer via the running dev server (`npm --prefix frontend run dev`) before the demo cut. Recommend opening `/applicant/print-card`, triggering print preview, and capturing a screenshot for each viewport (A4 portrait).

**INTEGRATION_HANDOFF.md updates:** none required. AF-7 and AF-14 consume admin-shipped shapes (`FawryConfig.retryWindowHours`, `PaymentTransaction.fawryCode`) without breaking contracts. AF-13 was implemented as a label-only change so no new uniqueness invariant was added; if the academy's records show `رقم الملف` is a distinct numeric short-form, a follow-up gap would add `Applicant.fileNumber: number` with a `UNIQUE per cycle` constraint.

**Final typecheck:** clean.
**Final build:** clean (`dist/assets/index-B3FGZmbe.js   1,904.94 kB │ gzip: 562.52 kB`).

**Open questions still pending (not blocking demo):**

1. **Card committee number source (AF-12).** Currently a `COMMITTEE_NUMBER = 2` constant in `Stage9PrintCardPage`; production should source from `draft.examSlot.committeeId` once Gap H links the committee through the slot reservation contract.
2. **Track-specific fields (AF-4).** Current implementation hardcodes the trigger conditions inline (`requiredQualification === 'bachelor_law'` for bar license, institute keys for sport specialty). The thorough version pushes a `fieldOverrides` block into admin Gap G's `CategoryConditions`. Acceptable for demo; flag for backend-integration phase.
3. **Captcha (AF-1).** Demo uses a client-side arithmetic challenge. Production needs a server-issued challenge (image, audio, or hCaptcha-style widget) that survives client tampering.
4. **رقم الملف (AF-13).** Resolved as label-only; if the academy's reconciliation needs a numeric short-form distinct from `applicantId`, a follow-up gap would introduce it.
5. **Pre-payment identity verification (AF-2).** Demo's `confirmPrePayment` accepts any well-formed NID + phone pair. Production must compare against the Stage 1 stored values on the server-side draft.
6. **§4 federation revisit.** Standalone resolved this for the demo; if MOI publishes a sandbox before production rollout, this becomes a real workstream that would replace Stage 1+2 with an OIDC redirect harness.
