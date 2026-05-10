# Applicant Flow Alignment — Verification Pass

**Verification on top of `applicant-flow-aligned` (`213f2b5`) · 2026-05-09**

This report is the closeout for the autonomous verification pass that
walked the 17 AF-N gaps from [docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md](APPLICANT_FLOW_ALIGNMENT_REPORT.md)
against acceptance criteria, checked architecture / helper / audit /
admin-contract / route / print-CSS / durable-record requirements, and
shipped fixes inline.

---

## §1 — Static-check results

| Check | Result | Notes |
|---|---|---|
| `git status --short` | clean | working tree clean before and after each fix commit |
| `git log applicant-flow-aligned --oneline -22` | 17 + 1 (report) + 1 (closeout) confirmed | all AF-N commits present, atomic |
| `npm run typecheck` | clean | 0 errors at start, after each fix, and at the end |
| `npm run build` | clean | final bundle: `1,905.68 kB / 562.77 kB gzipped` |
| `npm run lint` | n/a | `eslint` binary not present (CLAUDE.md notes "config not yet committed; planned"). Pre-existing infrastructure absence; not a verification finding. |

---

## §2 — Architecture audit

Per CLAUDE.md §2 + §3 forbidden-list:

| Rule | Final count | Status |
|---|---|---|
| `from '@/features/'` inside `src/shared/` | 0 | ✅ pass |
| `: any` type annotations in applicant-portal | 0 (only 1 hit, a comment "Demo: any 6-digit") | ✅ pass |
| `: any` type annotations in `arabic.ts` | 0 | ✅ pass |
| `export default` in applicant-portal | 0 | ✅ pass |
| `useEffect.*fetch / useEffect.*axios` in applicant-portal | 0 | ✅ pass |
| `navigate('/...')` hardcoded paths | 11 | ⚠️ all pre-existing (predate AF-N work). Tracked in `TODO.md` item 7. |

---

## §3 — Per-gap functional verification

| Gap | Final status | Notes |
|---|---|---|
| AF-1 — Captcha at Stage 1 | ✅ | element + schema + submit gate present; production contract in `INTEGRATION_HANDOFF.md` §8 q11 |
| AF-2 — Pre-payment identity re-verification | ✅ + fix | `IdentityConfirmGate` blocks payment UI; new fix wraps `confirmPrePayment` in `withAudit` (commit `6bf5d83`) |
| AF-3 — `تعديل الطلب` edit-surface page | ✅ | `ApplicationSummaryPage` at `/applicant/application/summary`, layout link, ROUTES constant |
| AF-4 — Track-specific fields on Stage 4 | ✅ + fix | conditional fields render per category; new fix expands the inline comment to document the future `CategoryConditions.fieldOverrides` migration (commit `2c13349`) |
| AF-5 — Stepfather optional field | ✅ | schema + defaultValues + form fields + `collectNids` + summary modal all wired |
| AF-6 — Parents اعتماد gate | ✅ + fix | summary modal + `acknowledged` checkbox; new fix wraps approval in `withAudit` with applicant actor (commit `f47b404`) |
| AF-7 — Fawry retry-window from cycle config | ✅ | reads `cycle.fees.fawryConfig.retryWindowHours`, defaults to 48; CYC-2026-M seeded with `48` |
| AF-8 — Hosted-page loading skin | ✅ | `Modal` with `خدمة كلية الشرطة` title, spinner, ~1.6s hold |
| AF-9 — Declaration download from Stage 9 | ✅ | secondary `تنزيل إقرار التعارف` button with `FileText` icon |
| AF-10 — Persistent results-tracker | ✅ | `ClipboardCheck`-iconed link in `ApplicantPortalLayout` top nav; visible from every wizard stage |
| AF-11 — Card title `بطاقة التردد` | ✅ | exact title string at line 81 |
| AF-12 — Card اللجنة row + arabicOrdinal helper | ✅ | helper exported from `shared/lib/arabic.ts`; row rendered in identity strip; `COMMITTEE_NUMBER = 2` constant has TODO comment + TODO.md item 3 |
| AF-13 — `رقم الملف` label | ✅ + fix | label change present; new fix adds inline comment documenting label-only resolution (commit `5e06d57`); follow-up tracked in TODO.md item 5 |
| AF-14 — Fawry payment-ref line | ✅ | line rendered between identity strip and exam date; `toEasternArabicNumerals` for digits; `PaymentTransaction.fawryCode` field added; demo seeded |
| AF-15 — Exam-date prose sentence | ✅ | `arabicDayOfWeek` + `arabicTimeOfDay` helpers; sentence renders day-of-week + Gregorian + Arabic time-of-day word; pragmatic default documented in commit message (slot-time-driven, not hardcoded 6am) |
| AF-16 — Barcode below-label | ✅ | `اللجنة [arabicOrdinal(N)]` rendered as bold display text immediately under the bars |
| AF-17 — `كشف ومواعيد الإختبارات` table | ✅ | 5-column table with م / الإختبار / التاريخ / النتيجة / ملاحظات (RTL); "لم يحدد" placeholder; rolled-own table (no shared `DataTable` — print context, sub-15-line table, premature abstraction not justified) |

**All 17 ✅ after fixes shipped.**

---

## §4 — Cross-cutting findings

### 4a. Helper consolidation
- ✅ No overlap between `arabic.ts` (4 new helpers) and `format.ts` (`Intl`-based numeric/date).
- Fix shipped: header JSDoc on `arabic.ts` documents the placement decision (commit `58feaed`).

### 4b. Audit emission coverage
- ✅ AF-2 `confirmPrePayment` and AF-6 parents approval now wrapped in `withAudit` with explicit applicant actor (commits `6bf5d83`, `f47b404`).
- ⚠️ Pre-existing applicant-portal mutations (`saveDraft`, `submitStage`, `initiatePayment`, `verifyPayment`, `reserveExamSlot`, `useEligibilityMutation`) remain unwrapped — predate AF-N work and represent the codebase's existing pattern. Out of verification scope; tracked in `TODO.md` item 6.

### 4c. Admin-contract integrity
- ✅ Single domain change since baseline: `PaymentTransaction.fawryCode?: string` (additive optional). Admin code that reads `PaymentTransaction` is unaffected.
- ✅ `Cycle.fees.fawryConfig` populated on CYC-2026-M using existing `FawryConfig` shape (no shape mutation).
- ✅ AF-4 inline gates do not fork `CategoryConditions`; comment now documents future `fieldOverrides` migration target.
- ✅ Audit emissions reuse existing `applicant.transition` action and `applicants` module.
- ✅ Soft-delete: ApplicationSummaryPage is read-only — no new entity, no soft-delete concern.

### 4d. Route hygiene
- ✅ `ROUTES.applicantApplicationSummary = '/applicant/application/summary'` defined and consumed in the layout link.
- ⚠️ 11 pre-existing hardcoded `navigate('/applicant/...')` calls in stage pages. Predate AF-N work; tracked in `TODO.md` item 7. AF-9's added `navigate` matches the file's existing convention.

### 4e. Print-CSS preservation
- ✅ `print.css` with `@media print` + `@page` rules untouched.
- ✅ `PrintLayout` component still in use.
- ✅ `dir="ltr"` instances scoped to numeric tokens (NID, IDs, dates, barcode) — correct localization.
- ✅ `no-print` class on the action bar.
- ✅ `_legacy/styles/` has no print stylesheet — no pre-existing rules to preserve.

### 4f. Durable records for §8 open items
All 6 items from the closeout now have a durable home (commit `11fa1f4`):

| Open item | Home | Verified |
|---|---|---|
| 1. Print-card screenshots | `docs/polish/applicant-card/README.md` (new) | ✅ |
| 2. COMMITTEE_NUMBER hardcode | `TODO.md` item 3 | ✅ |
| 3. AF-4 fieldOverrides migration | `TODO.md` item 4 + Stage4EducationPage inline comment | ✅ |
| 4. AF-1 captcha provider | `INTEGRATION_HANDOFF.md` §8 q11 | ✅ |
| 5. AF-13 `Applicant.fileNumber` | `TODO.md` item 5 | ✅ |
| 6. AF-2 confirmPrePayment production-strict | `INTEGRATION_HANDOFF.md` §2 (new row) + §4 (3 new error rows) | ✅ |

Bonus: `TODO.md` item 7 surfaced (11 pre-existing hardcoded navigate paths) — verification finding worth durably recording even though out-of-scope to fix here.

### 4g. Reference file staging
- ✅ `docs/references/applicant-flow-moi-portal.pdf` committed.
- ⚠️ `docs/references/attendance-card-printed.jpeg` not in repo (lives in conversation history). New `docs/references/README.md` (commit `0161d6b`) documents the staging gap and re-stage instructions.

---

## §5 — Fixes shipped

| # | Severity | Gap reference | File / Surface | Issue | Commit |
|---|---|---|---|---|---|
| 1 | P3 | AF-13 | [Stage9PrintCardPage.tsx:111](frontend/src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:111) | Verification spec asked for inline comment documenting label-only resolution; only commit-message comment existed | `5e06d57` |
| 2 | P3 | AF-4 | [Stage4EducationPage.tsx:38](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx:38) | Verification spec asked for explicit `fieldOverrides` migration target in inline comment | `2c13349` |
| 3 | P2 | AF-6 | [Stage7FamilyPage.tsx:74](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx:74) | Original AF-6 spec required `withAudit` wrap on parents approval; missing | `f47b404` |
| 4 | P3 | helper | [shared/lib/arabic.ts](frontend/src/shared/lib/arabic.ts) | Verification spec asked for JSDoc documenting placement decision (vs. `format.ts`) | `58feaed` |
| 5 | P2 | AF-2 | [Stage6PaymentPage.tsx:262](frontend/src/features/applicant-portal/pages/Stage6PaymentPage.tsx:262) | New `confirmPrePayment` mutation introduced by AF-N; was unwrapped (no audit emission) | `6bf5d83` |
| 6 | P3 | §8 records | [TODO.md](TODO.md), [INTEGRATION_HANDOFF.md](docs/INTEGRATION_HANDOFF.md), [docs/polish/applicant-card/README.md](docs/polish/applicant-card/README.md) | 6 §8 open items needed durable homes; only commit-message records existed | `11fa1f4` |
| 7 | P3 | references | [docs/references/README.md](docs/references/README.md) | Card photo not staged at expected path; needed README explaining the gap | `0161d6b` |

**Total: 7 fixes** (2 P2 — audit emissions; 5 P3 — documentation/comment).

---

## §6 — Coverage summary

| Metric | Value |
|---|---|
| Total findings | 7 |
| Total fixes shipped | 7 |
| P0 (regressions) | 0 |
| P1 (functional gaps) | 0 |
| P2 (spec compliance) | 2 (AF-2 / AF-6 audit emissions) |
| P3 (documentation / comments) | 5 |
| Final pass rate | 100% (17/17 gaps verified ✅, 0 deferred to follow-up) |
| Pre-existing tech debt surfaced for follow-up | 2 items (TODO.md item 6 audit-coverage sweep, item 7 hardcoded navigate paths) |
| Verification commits | 7 commits between `applicant-flow-aligned` and `applicant-flow-verified` |

---

## §7 — Closeout statement

The 17 AF-N gaps shipped in `applicant-flow-aligned` (`213f2b5`) all
match the acceptance criteria in `docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md`
§5 after the seven verification fixes shipped above. The original
applicant-flow alignment work introduced no Clean-Arch violations
(shared → features = 0, features → other-features = 0), no `: any`
type leaks, no `useEffect`-for-fetching, no admin-contract shape
breaks (only an additive optional field on `PaymentTransaction`),
and no print-CSS regressions. The two non-trivial fixes (AF-2 and
AF-6 audit emissions) bring the new mutations introduced by this
work into compliance with the Gap E `withAudit` pattern; pre-existing
applicant-portal mutations remain un-wrapped and are tracked as a
deferred follow-up. All 6 §8 open items now have durable homes in
`TODO.md` and `docs/INTEGRATION_HANDOFF.md`. Workstream is ready to
hand off to the backend integration phase.
