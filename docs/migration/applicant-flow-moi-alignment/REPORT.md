# Applicant Portal — MOI reference-flow alignment

> Migration report for the `feat(applicant): align with MOI reference flow` workstream.
> Reference PDF: [`docs/references/applicant-flow-moi-portal.pdf`](../../references/applicant-flow-moi-portal.pdf) (DOC-20220806-WA0053, 12 pages).
> Baseline tag: `applicant-flow-verified` (2026-05-09).
> Cut on: 2026-05-16.

## Goal

The MOI reference flow document captures the Police Academy applicant portal as it ran on `moi.gov.eg`. Our `/applicant` flow had the right 11-stage skeleton but several screens diverged in structure, copy, and affordances. This workstream brings each user-facing applicant screen into 1:1 alignment with the PDF while preserving our design system, RTL chrome, Radix primitives, and token discipline.

## Screenshots

Not captured in this report — left to the reviewer to capture against a local `npm run dev` instance after pulling the branch. The textual mapping table below names every route to walk.

## Mapping table — PDF page → route → component → status

| PDF page | Route | Component | Status | Notes |
|---|---|---|---|---|
| p.3 (category select) | `/applicant/start` | `CategorySelectionPage` | DONE | Card-grid replaced with the Card-wrapped vertical-stack table. 4 header rows (identity, eligibility, specializations, instructions) each open a `Drawer` via blue `عرض` button. Per-category row with primary `التقدم للإلتحاق` button + Tooltip when disabled. Multi-cycle picker strip kept above the table for the male+female concurrent-cohort case. |
| p.4 (applicant data) | `/applicant/profile` | `Stage345ApplicantDataPage` (new) | DONE | Single scrollable page replacing the 3 legacy sub-routes. Sections: bachelor block (conditional on category) → ثانوية block → personal data (read-only from MOI session) → address + contact → declaration checkbox + `حفظ`. Legacy `profile/personal`, `profile/education`, `profile/marital` redirect here. Marital block moved out. |
| p.5 lower (verify) | `/applicant/verify` (new) | `VerifyApplicantPage` (new) | DONE | NID + mobile re-entry. Mismatch → inline `role="alert"` panel. Match → wizard store `verifiedAt` + nav to `/applicant`. |
| p.5 top (summary) | `/applicant` | `ApplicantPortalPage` | DONE | Generic wizard-hub replaced with the read-only summary screen + top-bar action cluster (`الدفع` / `تعديل الطلب` / `عرض إرشادات التقدم`) + yellow modification-deadline banner. Primary CTA adapts to draft state (4 states: unpaid / paid-no-parents / parents-no-date / fully wired). |
| p.6–7 (payment) | `/applicant/payment` | `Stage6PaymentPage` | DONE | Three-step state machine: method picker → fawry-code panel _or_ Fawry-hosted credit-card simulation (3 sub-steps: method / details / summary). Both methods persist a deterministic 10-digit `paymentReference` on the wizard store. Confirm Payment → success toast → nav to family. |
| p.8–10 (family) | `/applicant/profile/family` | `Stage7FamilyPage` | DONE | Rebuilt as a 4-tab strip (father / mother / stepfather conditional / view). `stepfather` tab unlocks only when applicant ticks الوالدة متزوجة بغير الوالد. `view` tab carries the summary `DataTable` + `اعتماد` button (disabled until tabs 1+2 are saved). **Drops** the extended family tree (grandparents, siblings, relatives to 4th degree). See deviation note below. |
| p.11 (exam date) | `/applicant/exam-schedule` | `Stage8ExamSchedulePage` | DONE | Day-card grid replaced with read-only header rows (إسم الطالب / الرقم القومي / اللجنة) + a single `Select` بـ "تاريخ الإختبار" + primary `حفظ` button. Submit fires the PDF's success `Modal` ("تنبيه / تم اختيار تاريخ الإختبار بنجاح / موافق"), then on dismiss navigates to print-card. |
| p.11 lower + p.12 (print card) | `/applicant/print-card` | `Stage9PrintCardPage` | DONE | Top non-print Card carries the accent-coloured notice + top-end `طباعة`/`تحميل` actions. PrintLayout body: barcode column + identity column + verification stamp + payment-reference line + prose exam-date sentence + كشف ومواعيد الإختبارات table. Barcode value is `{nationalId}-{paymentReference}` so it correlates with the wizard store. |
| p.12 lower (results) | `/applicant/follow-up` | `Stage10FollowUpPage` | DONE | Pipeline-tile grid replaced with a single `DataTable` mirroring the Stage 9 exam table columns: م · الإختبار · التاريخ · النتيجة · ملاحظات. Tone-mapped `Badge` per pipeline state. |

## Routes diff

```
+  /applicant/profile                       ← Stage345ApplicantDataPage (new)
+  /applicant/verify                        ← VerifyApplicantPage (new)
~  /applicant/profile/personal              → redirect to /applicant/profile
~  /applicant/profile/education             → redirect to /applicant/profile
~  /applicant/profile/marital               → redirect to /applicant/profile/family
   /applicant                               ← ApplicantPortalPage (rebuilt — summary)
   /applicant/payment                       ← Stage6PaymentPage (rebuilt — two methods)
   /applicant/profile/family                ← Stage7FamilyPage (rebuilt — parent tabs)
   /applicant/exam-schedule                 ← Stage8ExamSchedulePage (refined — read-only header)
   /applicant/print-card                    ← Stage9PrintCardPage (refined — store-bound)
   /applicant/follow-up                     ← Stage10FollowUpPage (refined — DataTable)
```

New `ROUTES` constants surfaced in [`frontend/src/config/routes.ts`](../../../frontend/src/config/routes.ts):

```
applicantProfile      = '/applicant/profile'
applicantVerify       = '/applicant/verify'
applicantFamily       = '/applicant/profile/family'
applicantPayment      = '/applicant/payment'
applicantExamSchedule = '/applicant/exam-schedule'
applicantPrintCard    = '/applicant/print-card'
applicantFollowUp     = '/applicant/follow-up'
```

## Stepper diff

`STAGE_KEYS` / `STAGE_LABELS` in [`frontend/src/features/applicant-portal/ApplicantPortalLayout.tsx`](../../../frontend/src/features/applicant-portal/ApplicantPortalLayout.tsx):

| Idx | Old key | Old label | → | New key | New label |
|---|---|---|---|---|---|
| 0 | `auth/step-1` | التحقق · الهاتف | → | `auth/step-1` | التحقق · الهاتف |
| 1 | `auth/step-2` | التحقق · رمز SMS | → | `auth/step-2` | التحقق · رمز SMS |
| 2 | `profile/personal` | البيانات الشخصية | → | `profile` | **البيانات الشخصية والدراسية** (collapsed 3+4+5) |
| 3 | `profile/education` | البيانات التعليمية | → | `verify` | **التحقق من المستخدم** (new) |
| 4 | `profile/marital` | الحالة الاجتماعية | → | `''` (summary) | **ملخّص الطلب** (the `/applicant` index) |
| 5 | `payment` | سداد رسوم التقديم | → | `payment` | سداد رسوم التقديم |
| 6 | `profile/family` | بيانات الأسرة | → | `profile/family` | **بيانات الوالدين** (renamed) |
| 7 | `exam-schedule` | موعد الاختبار | → | `exam-schedule` | موعد الاختبار |
| 8 | `print-card` | طباعة كارت التردد | → | `print-card` | **بطاقة التردد** (renamed) |
| 9 | `follow-up` | متابعة الإجراءات | → | `follow-up` | **نتائج الاختبارات** (renamed) |
| 10 | `acquaintance-doc` | وثيقة التعارف | → | `acquaintance-doc` | وثيقة التعارف |

The stepper count stays at 11 — removed 2, added 2.

The `ApplicantPortalLayout.activeIndex` lookup was updated to do exact-match first (so `''` reliably resolves to the summary node when the URL is `/applicant`), with a `startsWith(k + '/')` fallback for nested children.

## Wizard-store schema diff

[`store/applicantPortal.store.ts`](../../../frontend/src/features/applicant-portal/store/applicantPortal.store.ts):

```diff
 interface ApplicantPortalState {
   nationalId: string | null;
   selectedCategoryKey: string | null;
   selectedCycleId: string | null;
+  verifiedAt: number | null;
+  paid: boolean;
+  paymentMethod: 'fawry-code' | 'credit-card' | null;
+  paymentReference: string | null;
+  fawryCode: string | null;
+  firstExamDate: string | null;
+  parentsApproved: boolean;
   ...setters
 }
```

`clear()` resets all 7 new fields. Setters: `setVerifiedAt`, `setPayment`, `setFirstExamDate`, `setParentsApproved`. Payment uses a single combined setter to keep `paid`, `paymentMethod`, `paymentReference`, and `fawryCode` atomic.

## Mock-service additions

[`api/applicantPortal.service.ts`](../../../frontend/src/features/applicant-portal/api/applicantPortal.service.ts):

| Method | Contract | Backing store |
|---|---|---|
| `verifyApplicant({ nationalId, mobile })` | `POST /applicant/verify` → `{ confirmed }` | `moiSessionMatches` compares against `MOI_APPLICANT_SESSION` |
| `createPaymentIntent({ method })` | `POST /applicant/payment/intent` → `{ intentId, refNumber, fawryCode? }` | Deterministic codes from `deterministicPaymentReference` + `deterministicFawryCode` |
| `confirmPayment({ intentId })` | `POST /applicant/payment/confirm` → `{ confirmed: true, paidAt }` | Mutates `DRAFT.furthestStage` to 6 |
| `approveParents()` | `POST /applicant/parents/approve` → `{ approvedAt }` | Mutates `DRAFT.furthestStage` to 7 |
| `pickFirstExamDate({ date })` | `POST /applicant/exam-date` → `{ date }` | Persists `DRAFT.examSlot` |

Each method carries a JSDoc `INTEGRATION CONTRACT` header listing the eventual REST endpoint per CLAUDE.md §6.

Corresponding TanStack-Query hooks added in [`api/applicantPortal.queries.ts`](../../../frontend/src/features/applicant-portal/api/applicantPortal.queries.ts): `useVerifyApplicantMutation`, `useCreatePaymentIntent`, `useConfirmPaymentMutation`, `useApproveParentsMutation`, `usePickFirstExamDateMutation`.

## MOI session mock

[`lib/moi-session.mock.ts`](../../../frontend/src/features/applicant-portal/lib/moi-session.mock.ts) provides `MOI_APPLICANT_SESSION` — the deterministic identity payload that represents the moi.gov.eg SSO handoff. Values match the printed reference card (`30506121601234` NID → 1995-06-12 birth, gov code 16, male, +20 1012345678). `moiSessionMatches()` is the verification predicate used by the verify step.

## Deterministic codes

[`lib/deterministic-codes.ts`](../../../frontend/src/features/applicant-portal/lib/deterministic-codes.ts) carries a small isolated LCG keyed off the applicant id (DJB2-ish hash XOR-mixed with three different per-purpose constants). Three helpers: `deterministicPaymentReference` (10 digits), `deterministicFawryCode` (8 digits), `deterministicFileNumber` (4 digits). The shared `shared/mock-data/seed.ts` LCG is left alone — it carries hundreds of mock generators at boot and entangling it with per-applicant codes would break the seed=42 determinism guarantee for those.

## New primitives added to `shared/components`

**None.** Every page is composed from the existing sanctioned Radix-backed primitives:

| Used | What it covers |
|---|---|
| `Card`, `Button`, `Badge`, `Input`, `Textarea`, `Select`, `SearchSelect`, `Field` | All form composition |
| `Drawer`, `Modal`, `Tabs`, `Tooltip` + `TooltipProvider` | Layered surfaces |
| `DataTable` | Family summary + follow-up results |
| `PrintLayout`, `Code128Barcode`, `KhayameyaStripe`, `LogoMark`, `IconStamp` | Print card |
| `toast`, `LoadingState`, `EmptyState`, `ErrorState` | Affordances |

Per CLAUDE.md §2.5 — no new shared component was added because none of the new compositions hit the "≥3 reuse sites + not a layout + not one-screen + no existing-primitive-with-5-lines-of-styling-covers-it" bar.

## Deviations from the PDF (with rationale)

These are intentional departures from a strict 1:1 PDF clone. Each is local to one screen.

1. **Stage 7 family — extended family tree dropped.**
   The PDF only collects father / mother / stepfather. The previous implementation collected grandparents (4), siblings (variable), and relatives to the 4th degree because the security-clearance pipeline (investigations app) consumes those. The reviewer asked for strict 1:1 PDF coverage on this surface — the extended family data now needs to come from a separate investigations-side intake form. **Action item:** open a follow-up to give Investigations its own intake surface for grandparents/siblings/relatives if the existing security-clearance flow can no longer source that data from the applicant draft.

2. **`addressDistrict` and `birthDistrict` use a flat `CITIES` list, not a true governorate→district mapping.**
   We don't have a real GG→qism/markaz lookup in the seed yet. Both dropdowns are flat searchable lists of major Egyptian cities. Backend-integration day will swap them for a dependent dropdown sourced from `/admin/lookups/locations`.

3. **`AdmissionCycle.modificationDeadline` is not in the domain yet.**
   The yellow banner on the summary page surfaces the cycle's `closeDate` until the dedicated field lands. Backend-integration spec needs `modificationDeadline: string` on `AdmissionCycle`.

4. **`Fawry hosted page` uses a watermark label only — no Fawry logo.**
   The prompt allows a small grayscale Fawry logo as watermark, but we don't bundle Fawry brand assets. The simulation panel carries a `محاكاة بوابة فوري` chip + `FAWRY · sandbox` mono caption to signal the imitation without using their mark.

5. **Bachelor block in `Stage345ApplicantDataPage` shows only for non-`officers_general`.**
   PDF describes this as "غير قسم عام" — our 4-key category set has `officers_general` as the one without a bachelor requirement, so the conditional is a single equality check.

6. **`الإسم رباعي` and `إسم الشهرة` in the read-only block are derived from the MOI session's `fullName`.**
   The PDF separates the two; the MOI session payload combines them. We render the full string for إسم رباعي and the first two tokens for إسم الشهرة. When the real MOI SSO lands, the session payload will carry both fields explicitly.

7. **`Tooltip` on the disabled `التقدم للإلتحاق` button on `/applicant/start` reads either "باب التقدم غير مفتوح..." or "هذا القسم يفتح عبر الترشيح الإداري فقط — لا تقديم مباشر."**
   The PDF's tooltip text is implicit ("لن يسمح لأي متقدم..."). We split into two explicit reasons because they correspond to two genuinely different code paths (`isOpen=false` vs `nominationOnly=true`).

8. **The Fawry-code 48-hour countdown is computed at render time, not at intent creation.**
   So the displayed deadline shifts forward by milliseconds on each render. Production should snapshot `intent.createdAt + 48h` on the server and surface it via the intent response.

9. **`AddressDistrict`, the secondary mobile, twitter, instagram, fax fields are optional.**
   The PDF marks the bottom contact block as optional via the form's overall layout. We make those fields optional in the zod schema; only `currentAddressDetail`, `addressGovernorate`, `addressDistrict` are required.

10. **The `View Verification` step (PDF p.5 lower) does not gate Stage 1+2 entry.**
    The prompt explicitly asked for the new verify step to be added between profile and summary (PDF order). It does NOT replace the existing Stage 1+2 SMS auth. That gate stays as-is.

## Files changed (summary)

```
modified:   frontend/src/config/routes.ts
modified:   frontend/src/features/applicant-portal/ApplicantPortalLayout.tsx
modified:   frontend/src/features/applicant-portal/api/applicantPortal.queries.ts
modified:   frontend/src/features/applicant-portal/api/applicantPortal.service.ts
modified:   frontend/src/features/applicant-portal/index.ts
modified:   frontend/src/features/applicant-portal/pages/ApplicantPortalPage.tsx
modified:   frontend/src/features/applicant-portal/pages/ApplicationSummaryPage.tsx
modified:   frontend/src/features/applicant-portal/pages/CategorySelectionPage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage10FollowUpPage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage2AuthSmsPage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx
modified:   frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx
modified:   frontend/src/features/applicant-portal/schemas/index.ts
modified:   frontend/src/features/applicant-portal/store/applicantPortal.store.ts
modified:   frontend/src/routes.tsx
deleted:    frontend/src/features/applicant-portal/pages/Stage3PersonalPage.tsx
deleted:    frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx
deleted:    frontend/src/features/applicant-portal/pages/Stage5MaritalPage.tsx
new file:   frontend/src/features/applicant-portal/lib/deterministic-codes.ts
new file:   frontend/src/features/applicant-portal/lib/moi-session.mock.ts
new file:   frontend/src/features/applicant-portal/pages/Stage345ApplicantDataPage.tsx
new file:   frontend/src/features/applicant-portal/pages/VerifyApplicantPage.tsx
```

## Verification done before opening the PR

- `npm --prefix frontend run typecheck` → clean.
- All nine screens reachable end-to-end from `/applicant/start` → `/applicant/follow-up` in mock mode (route registry inspected manually; no live click-through done — reviewer should walk the flow).
- Stepper count stays at 11 visible stages.
- No `useEffect`-for-fetching introduced.
- No `any`, no default exports.
- No new shared component or library added.

## Verification deferred to reviewer

- Personal-data page on a 380px viewport (RTL Arabic) without horizontal scroll — needs a live browser.
- Print preview of `/applicant/print-card` shows only the card + exam table — needs `Cmd+P` against the route.
- `npm --prefix frontend run lint` — config not yet committed (Sprint 10 hardening).

## Loom-style note (where we deliberately diverge from the PDF, and why)

The single largest deviation is the Stage 7 family-tree drop — see deviation note #1 above. Choosing strict 1:1 PDF coverage means the investigations team can no longer source extended-family data from the applicant draft. The reviewer accepted this trade-off during discussion ("Drop completely (strict 1:1 PDF)"), so the responsibility for sourcing that data moves to the investigations app. The other deviations are all small (missing domain fields, brand assets we don't own, optional-vs-required precedence) and each is local to one screen.

Two non-PDF affordances I kept on top of the strict reference:

1. The multi-cycle picker strip on `/applicant/start` (above the table). The reference assumed one cycle; our codebase already supports concurrent male+female cohorts and the existing `AdmissionCycle.cohort` field is on the wire. Removing the strip would have created a regression for the female cohort whenever both are open simultaneously.

2. The accent-coloured `محاكاة عرض توضيحية` chip in the payment header. The previous Stage 6 carried it; the prompt's PDF-strict version doesn't show it. We kept it because the reviewer's earlier feedback in this codebase emphasised that fake-payment surfaces must visibly mark themselves as demos — a guardrail that supersedes the strict-1:1 rule for safety.
