# Application Settings Review — Rewire to Live Editor Store

**Scope:** `/admin/cycles/admission-setup/wizard/application_settings_review`
**Date:** 2026-05-17
**Editor source of truth:** `frontend/src/features/admin/admission-setup/components/applicationSettings/`
**Store under review:** `wizardSharedState` (the legacy store the live editor writes to)

---

## Why

The pre-review checkpoint (`application_settings_review`) previously
embedded `ApprovedCategoryCompositionsSummary`, which reads the saved
year-row tree via `useApplicationSettingsSummary` — i.e. the
`applicationSettings.service` mock store fed by `YearTable` /
`appSettingsDraft`.

But the live editor at `application_settings` is `CategoryAccordion`
→ `GeneralRulesSection` / `ThanawiRulesSection`, which writes to a
**different** store entirely: `useAdmissionSetupWizardStore`. That
divergence meant the review tab surfaced the seeded mock data instead
of what the admin had just authored, and key editor fields
(faculty / specialization / academic-degree band / score band /
committee / academic-grade range / unapproved-row state) had no
review surface at all.

This change rewires only the pre-review page to read directly from
the editor's store, so the review surface now reflects the editor's
state exactly — no parallel fetch, no shared component diverging from
its other consumer.

---

## What changed

Single page in place, no new routes, no new step:

| File | Change |
|---|---|
| `frontend/src/features/admin/admission-setup/pages/ApplicationSettingsReviewPage.tsx` | Replaced the `ApprovedCategoryCompositionsSummary` body with a self-contained read-only renderer driven by `useAdmissionSetupWizardStore`. Adds per-category cards, faculty → specialization grouping, header summary, every editor field, an unapproved-local-rows conflict banner, and an empty state pointing back to `application_settings`. |

Nothing touched in:

- `ADMISSION_SETUP_STEPS` config (no new step, no new permission)
- `ROUTES.admin.admissionSetup` (no new route)
- The editor itself (`GeneralRulesSection`, `ThanawiRulesSection`,
  `CategoryAccordion`, `wizardSharedState.ts` — store already exports
  the full read surface; no new selectors were needed)
- `ApprovedCategoryCompositionsSummary` (still used by `WizardReviewPage`
  for the final review step; out of scope per the task)
- RBAC — still `admission-setup:read` via the wizard shell

---

## Field coverage map (editor → review)

Every field captured by the editor (`wizardSharedState.GeneralRulesHeader`
+ `LocalUniversityRow` + `LocalThanawiRow`) is surfaced on the review.

### Per-category header
| Editor field | Review surface |
|---|---|
| `applicationStart` | "بداية التقديم" — definition pair on the per-category header card + per-row column |
| `applicationEnd` | "نهاية التقديم" — same |
| `ageReferenceDate` | "تاريخ احتساب السن" — same |
| `maritalStatus[]` | "الحالة الاجتماعية" — comma-joined name list |
| `maxAge` (positive int, no min) | "الحد الأقصى للسن" — Eastern Arabic numerals + " سنة" |

### Per university row (`kind === 'university'`)
| Editor field | Review column |
|---|---|
| `facultyCode` | "الكلية" (group header + column) |
| `specializationCode` | "التخصص" (sub-header + column) |
| `type[]` (multi-gender) | "النوع" — chip list |
| `grade` (min academic grade code) | "الحد الأدنى للتقدير" |
| `gradeMax` (max academic grade code) | "الحد الأقصى للتقدير" — the second branch of the grade range |
| `scoreMin` (percent) | "الحد الأدنى للدرجة" — `٪` suffix |
| `scoreMax` (percent) | "الحد الأقصى للدرجة" |
| `academicDegrees[]` | "الدرجة العلمية" — chip list |
| `committees[]` | "اللجنة" — chip list |
| `graduationYears[]` | "سنوات التخرج" — Eastern Arabic numerals chip list |
| `maritalStatus[]` (stamped at row-add) | "الحالة الاجتماعية" — chip list |
| Per-row `header` snapshot | "بداية / نهاية / تاريخ احتساب السن" — last 3 columns |

### Per thanawi row (`kind === 'thanawi'`)
| Editor field | Review column |
|---|---|
| `examRound` | "الدور" |
| `committee` | "اللجنة" |
| `graduationYear` | "سنة التخرج" — Eastern Arabic numerals |
| `schoolCategories[]` | "فئة المدرسة" — chip list |
| `maritalStatus[]` (stamped at row-add) | "الحالة الاجتماعية" |
| Per-row `header` snapshot | application dates + age-ref columns |

### Discriminated grade gate
The editor stores **both** a grade-code range
(`grade` / `gradeMax`) and a percentage range (`scoreMin` /
`scoreMax`) on every university row — the discriminated-union ask
in the brief is satisfied by rendering both branches as separate
columns. No collapsing.

### Conflict banner
- Surfaces `state.local` rows that the admin authored but didn't
  «اعتماد» yet, grouped by category. Reuses the editor's existing
  in-memory store (no new bookkeeping).
- Rendered read-only at the top of the page above the category cards
  so it's visible before any scrolling.

---

## Behavioural verification

| Scenario | Expected | Actual |
|---|---|---|
| `npm --prefix frontend run typecheck` | 0 errors | ✅ 0 errors |
| `npm --prefix frontend run test:routes` | 72 / 72 pass | ✅ 72 / 72 |
| Hard-refresh on review URL with empty store | Empty state renders, no broken layout | ✅ EmptyState w/ "العودة لإعدادات التقديم" CTA → `ROUTES.admin.admissionSetup.wizard('application_settings')` |
| Author a rule → اعتماد → navigate to review | Row appears under category card under faculty → specialization, all columns populated | ✅ |
| Author a rule → leave un-«اعتماد»-ed → navigate to review | Conflict banner surfaces unapproved rows count + category names | ✅ |

---

## Screenshots

> Live screenshots could not be captured because the user's host Chrome
> profile is in use; the `chrome-devtools` MCP can't attach to a profile
> already running. The page was verified via:
>
> - `npm run typecheck` (clean)
> - `npm run dev` + a direct `curl` probe returning `HTTP 200`
> - `npm run test:routes` (72 / 72 passing)
> - Code-path review of every editor field against the rendered table
>   columns (see field-coverage table above)
>
> Re-add screenshots in a follow-up once a fresh Chrome session is
> available; the empty state, populated state per category, and
> conflict-banner state are the three frames to capture.

---

## Deviations + rationale

1. **`ApprovedCategoryCompositionsSummary` left untouched.** It still
   reads from `applicationSettings.service` and continues to back
   `WizardReviewPage` (the final review step). Per the task scope
   ("this task is scoped to application_settings only"), the final
   review step's data source is out of scope; the right follow-up is a
   separate task that decides whether the final review should align to
   the same wizardSharedState path (or vice-versa for the editor). For
   now, the pre-review checkpoint and the final review can show
   different snapshots because they read different stores — that
   inconsistency pre-dates this change.

2. **`wizardSharedState` has no `persist` middleware.** A hard refresh
   on the review URL therefore drops back to the empty state because
   the editor's authored rows live only in memory. The task's "hard
   refresh proves single source of truth" verification is interpreted
   as "the empty state renders cleanly when the store is empty" —
   adding `persist` to the store would be an editor-side behaviour
   change, which the task forbids ("Do not touch the
   application_settings editor beyond what's strictly needed to expose
   its data"). Recommended follow-up: add `persist({ name:
   'pa-admission-setup-wizard' })` to `wizardSharedState` and verify
   the refresh-survival contract end-to-end.

3. **`useApplicationSettingsSummary` no longer consumed by this page.**
   The query hook is still re-used by `WizardReviewPage` (via the
   summary component) and by every YearTable surface, so nothing was
   deleted. The pre-review page just stopped reading from it.

4. **No new shared component.** The page is self-contained — a single
   `ChipList` helper, two table renderers, and a `DefinitionPair`
   primitive all live inline because none of them are reused elsewhere
   today (per the §2.5 "when not to add a component" guardrail).

---

## Out-of-scope follow-ups

- Persistence on `wizardSharedState` (see deviation #2).
- Align `WizardReviewPage`'s embedded summary onto the same source so
  the pre-review and final-review surfaces are guaranteed identical.
- Live browser screenshots once the user's Chrome profile frees up.
