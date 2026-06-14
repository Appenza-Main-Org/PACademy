# Bug-Fix Batch — Applicant Profile / Family Info / Print Card / Relatives / Payment Card

> Implementation prompt for Claude Code. PACademy admin + applicant portal.
> Stack: React 18 + TS strict + Vite + TanStack Query + Zustand + Tailwind + Radix wrappers. Backend: .NET 10 / EF Core / SQL Server. UI is Arabic RTL.
> Hard rules: lookups-only (no new enums), no `any`, no default exports, no hex colors outside `tokens.css`, logical CSS properties (RTL-first), TanStack Query only (no `useEffect` fetching), one conventional commit per fix with grep-provable acceptance criteria in the body.

---

## Phase 0 — Scope Gate (MANDATORY — no edits before this is reviewed)

Before touching any file, audit and report:

1. Locate and list the exact files rendering each affected surface:
   - Applicant profile family section (`/applicant/profile/family`, Stage 7 pages + any shared family card component)
   - Admin applicant-detail family/relatives/print surfaces (`/admin/applicants/:applicantId` and `/applicant/print-card` — `AdmissionFormSection.tsx`, `profileData.ts`, print stylesheet)
   - Educational Information section on the applicant profile page (`/applicant/profile`) and its admin mirror
   - "الحالة الحالية" card component on admin applicant details
   - Relatives data flow: API endpoint, use case, `applicant_family_members` query, frontend query hook, and the "بيانات الأقارب" renderer
2. For Issue 2, trace exactly which field is being printed for المؤهل / الوظيفة (e.g. `qualification` code vs `qualification_detail` vs lookup `description`) and where the lookup code→Arabic-label resolution happens (or fails to).
3. For Issue 4, report whether the failure is: (a) import not writing rows, (b) rows written but FK/applicant-id mismatch, (c) API not returning them, or (d) API returns them but UI filters/renders wrong. Include a sample SQL count per applicant and one sample API response.
4. For Issue 3, report where educational fields are currently hardcoded and where the applicant-category educational configuration lives (admission-setup category config / lookup tables). Confirm whether a config-driven field schema already exists or needs to be added.
5. List every file you intend to touch per group below, and explicitly list frozen surfaces (everything else — especially admission-setup wizard, payment flow logic, exam scheduling, lookups admin, RBAC files).

**STOP. Report the above and wait for approval before any edit.**

---

## Work Groups (execute in this order — grouped to minimize re-touching the same surfaces)

### Group A — Family Information rendering (Issues 1 + 2, same data slice)

#### A1 — Issue 1: Family info cards UI/layout (applicant profile)

Module: طلب إلتحاق بكلية الشرطة — `https://admin-staging.appenzademo.com/applicant`

Fix the family information cards:
- Long values (addresses, qualifications, workplace) must wrap inside card boundaries: `break-words` / `overflow-wrap: anywhere` on value cells, never on labels.
- Equal card heights: grid layout (`grid` + `auto-rows-fr` or flex column with `h-full`), not content-driven heights.
- Consistent label/value alignment using logical properties (`ms-/me-/ps-/pe-`, `text-start`) — no `left/right` physical properties.
- Proper field spacing; no overlap at any breakpoint. Verify at 360px, 768px, 1280px widths.
- Arabic typography: keep existing font tokens; no new hex values — tokens only.

Constraints: pure presentational fix. No data-shape, store, or service changes. Do not touch the family form tabs' save logic.

Commit: `fix(applicant): wrap and align family info cards with equal heights`

#### A2 — Issue 2: Print card shows description instead of actual qualification/job values

`https://admin-staging.appenzademo.com/applicant/print-card`

- For every family member rendered on the printed application card (father, mother, guardian, grandparents, siblings — all 15 `relation` values in `applicant_family_members`), المؤهل and الوظيفة must display the **stored value resolved to its Arabic lookup label** — not the lookup description, not detail/free-text fallback unless the code is the "other" sentinel, not placeholder/static text.
- Resolution must be lookup-driven via the existing qualification/profession lookup services. If a code has no matching lookup row, render the raw stored value — never a description and never empty.
- Apply the same resolver to on-screen and print render paths (they share `AdmissionFormSection.tsx` / `profileData.ts` — fix at the snapshot/mapping layer once, not per-view).
- Dynamic for all family members present on the applicant — no hardcoded member list in the print mapping.

Constraints: do not alter the print layout/barcode/exam table; only the field-value mapping.

Commit: `fix(applicant): resolve qualification and job lookup labels on print card`

**Group A regression checks (must pass before Group B):**
- `/applicant/profile/family` tabs save/edit/اعتماد flow unchanged (manually walk father → mother → review → approve).
- Print card barcode value, payment-reference line, and exam table unchanged (visual diff before/after).
- `grep` proves no physical `left/right` CSS or hex colors were introduced.
- **All-applicants check:** verify with ≥3 applicants of different categories and different family compositions (with/without stepfather, long vs short text values). Fix must be data-driven — zero applicant-specific or member-specific conditionals.

---

### Group B — Admin Applicant Details page (Issues 4 + 5, same page)

#### B1 — Issue 4 (Bug): Relatives data not displayed in بيانات الأقارب

`https://admin-staging.appenzademo.com/admin/applicants/{applicantId}`

Investigate in this order, fix at the true root cause only:
1. Import path writes `ApplicantRelatives` / `applicant_family_members` rows correctly (check identifier mapping: imported NID ↔ `applicant_id` join — normalize NID as 14-digit string, watch for leading-zero loss).
2. Rows linked to the correct applicant (FK integrity, cycle scoping).
3. Admin API endpoint queries the correct table and returns the rows.
4. UI consumes the response and renders (check the query hook key, the count source for "X قريب", and any empty-state guard that fires incorrectly).

Then render the full column set: صلة القرابة، الاسم، الرقم القومي، المؤهل، الوظيفة، تاريخ الميلاد، محافظة الميلاد، محافظة الإقامة، مركز الإقامة، العنوان، الديانة، على قيد الحياة. صلة القرابة، المؤهل، الوظيفة، governorates, الديانة resolve via lookups (governorates: 27 + sentinel `88 / خارج الجمهورية`, zero-padded two-digit strings).

The relative **count** must reflect actual row count, never a placeholder.

Commit: `fix(admin): display applicant relatives records in details page` (split into two commits if the root cause requires a backend fix: one `fix(backend)` + one `fix(admin)`).

#### B2 — Issue 5 (Enhancement): Convert "الحالة الحالية" into a payment summary card

Same page. Required change:
- **Remove** المستندات from the card.
- Card becomes **بيانات الدفع** containing: حالة السداد، قيمة الرسوم، تاريخ السداد (if available), رقم العملية / رقم الإيصال (if available). Conditional fields hidden (not blank-rendered) when absent.
- Applicant workflow status (الحالة) stays visible — either kept on this card per current data or relocated to an existing adjacent status surface; report which during Phase 0 and pick the option that touches the fewest files.
- Pull payment fields from the existing payment data already on the applicant detail payload (`paymentReference`, payment confirmation timestamp) — no new endpoint unless the payload lacks a field; if it does, stop and ask.

Commit: `feat(admin): refocus current-status card as payment summary`

**Group B regression checks:**
- All other cards/sections on `/admin/applicants/:id` render identically (exam results card, portal identity, committee assignment, documents section elsewhere).
- Applicants **without** relatives still show the proper empty state (no crash, no "undefined").
- Applicants **without** payment show correct unpaid state.
- **All-applicants check:** verify relatives + payment card against ≥5 applicants spanning: has relatives / no relatives / paid / unpaid / portal vs imported origin. No per-applicant conditionals.

---

### Group C — Issue 3: Category-driven educational score fields (largest — isolated last)

`https://admin-staging.appenzademo.com/applicant/profile`

Replace hardcoded educational fields (مجموع الثانوية العامة، النسبة المئوية، التقدير، …) with rendering driven by the **Applicant Category configuration** in the active cycle:

1. **Config source:** read the category's educational configuration from admission-setup category settings (the same config admins already edit). If the current config schema can't express a field list per category, extend it lookup-style — configurable rows, **no new enums**, no code-change-required seed rows. Stop and ask before any schema extension.
2. **Rendering:** the profile page reads applicant → category → educational field config → renders only those fields. Examples: secondary-school category → مجموع الثانوية العامة / النسبة المئوية / المجموع الكلي; university-graduate → التقدير / GPA / النسبة التراكمية.
3. **Validation:** field-level validation rules (required, min/max, numeric) come from the config, applied via the existing form validation layer.
4. **Persistence:** values store/display correctly and surface in Applicant Lookup + reports unchanged in shape (verify reports dashboard educational columns still resolve).
5. **Admin editability:** changing a category's educational settings in admission-setup changes the rendered fields with no code change.

Acceptance (grep-provable):
- `grep` shows zero hardcoded educational score field definitions remaining in the profile page component.
- Config-driven field registry has an `INTEGRATION CONTRACT` JSDoc header on its service method.

**STOP-AND-ASK gate:** after Phase 0 reporting for this group and before writing the config schema, present the proposed field-config shape and wait for approval.

Commits (granular): `feat(applicant): drive educational score fields from category config` + separate commits per touched backend/admin surface.

**Group C regression checks:**
- Existing applicants with already-saved educational data still display their values (backward-compatible read — old data maps onto the configured fields, nothing dropped).
- Admission-setup wizard completion badges and overlapping-rules validation unaffected.
- Applicant Lookup and reports educational columns unaffected.
- **All-applicants check:** verify one applicant per active category renders the correct field set; switching a category's config in admin immediately changes rendering for all applicants in that category.

---

## Final Gate — Review + Merge + Deploy

After all three groups pass their regression checks:

1. Run the full frontend type-check + lint + existing test suites; zero new warnings.
2. **Use clean-code-guard to review this change.**
3. **Is this safe to merge? Use clean-code-guard.**
4. Only after clean-code-guard passes both: push to `staging`, verify on `admin-staging.appenzademo.com` (re-run the all-applicants checks against staging data), then push to `main`.
5. If clean-code-guard flags anything: fix, re-run the affected group's regression checks, and re-review before pushing.

Do not push anything before step 4's staging verification passes.
