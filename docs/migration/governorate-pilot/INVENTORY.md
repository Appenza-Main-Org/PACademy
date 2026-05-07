# Governorate Picker Pilot — Inventory

> Phase 1 deliverable. Lists every consumer site of the 27-Egyptian-governorate
> picker so the Phase 2 migration to `SearchSelect` can be planned and executed
> one site at a time.

**Date:** 2026-05-07
**Total picker sites:** **4** (under the brief's "more than 8" stop-and-ask threshold)
**Pilot scope:** Egyptian governorates (27 entries), all consumers in app code
(dev page excluded).

---

## 1. Migration targets

Each row is a place where a *user picks a governorate from a list*. Free-text
inputs and read-only display are excluded (see §2).

| # | File · line | Current implementation | Surrounding form / screen | RHF? | Notes |
|---|---|---|---|---|---|
| 1 | [src/features/admin/pages/ApplicantsPage.tsx:99](frontend/src/features/admin/pages/ApplicantsPage.tsx#L99) | Native `<select className="select">` with leading "all" option | Admin → Applicants list page. Top-of-page filter row. | ❌ — `useState` (`governorate`, `setGovernorate`) | Filter; sets `'all' \| <name>`. Source: `MOCK.governorates` (canonical). |
| 2 | [src/features/admin/components/applicants/ApplicantForm.tsx:398-405](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L398-L405) | Shared `<Select>` with leading `{ value: '', label: '— اختر —' }` placeholder | Admin → Applicants → New / Edit form, "Address" section. Field: `currentAddress.governorate`. | ✅ — `register('currentAddress.governorate')` | Required. Error wired through `errors.currentAddress?.governorate?.message`. Source: `GOVERNORATES` (dictionaries.ts). |
| 3 | [src/features/applicant-portal/pages/Stage3PersonalPage.tsx:105-111](frontend/src/features/applicant-portal/pages/Stage3PersonalPage.tsx#L105-L111) | Shared `<Select>` | Applicant Wizard → Stage 3 Personal. Field: `placeOfBirth` (governorate is the option set). | ✅ — `register('placeOfBirth')` | Required. Source: `REF_GOVERNORATES` (referenceData.ts). |
| 4 | [src/features/applicant-portal/pages/Stage4EducationPage.tsx:124-130](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L124-L130) | Shared `<Select>` | Applicant Wizard → Stage 4 Education. Field: `schoolGovernorate`. | ✅ — `register('schoolGovernorate')` | Required. Source: `REF_GOVERNORATES` (referenceData.ts). |

### Pre-flight notes that affect Phase 2

#### a. RHF integration — three sites need `Controller`, not `register`

`SearchSelect` is a controlled component (`value: string | null`,
`onChange: (next: string | null) => void`). It does **not** accept the
`{ ref, name, onChange(e), onBlur }` spread that `register()` produces (which
expects a native `<select>` event-style `onChange`). For sites #2, #3, #4 the
clean migration is `Controller` from `react-hook-form`:

```tsx
<Controller
  control={control}
  name="currentAddress.governorate"
  render={({ field }) => (
    <SearchSelect
      value={field.value ?? null}
      onChange={(next) => field.onChange(next ?? '')}
      ...
    />
  )}
/>
```

This is a one-line wrap — not a structural rework — so it stays inside the
"drop-in swap" envelope.

#### b. Filter site (#1) needs an "all" sentinel

The admin filter holds `'all' | <governorate-name>` in a `useState`.
`SearchSelect` returns `null` when nothing is selected, not a magic string.
The site already maps "all" to "no filter" semantically — easiest path is to
treat `null === 'all'` and convert at the read/write boundary. No data-shape
change.

#### c. Data source — the brief says use `dictionaries.ts`

Sites #1 and #2 already use `GOVERNORATES` (the canonical 27-name string array
from `mock-data/dictionaries.ts`). Sites #3 and #4 use `REF_GOVERNORATES` from
`mock-data/referenceData.ts`, mapping `g.nameAr` to both value and label —
which produces the *same* 27 strings as `GOVERNORATES`. The migration switches
sites #3 and #4 to `GOVERNORATES` per the brief; **stored value shape is
unchanged** (it's still the Arabic name string, same as today).

#### d. Wrapping — labels, errors, required indicators

`SearchSelect` exposes only the trigger + popover, not a labelled wrapper.
The existing `Select` provides `label` / `error` / `helper` / `required`
chrome. To keep visual parity (the brief says "visually identical wrapper"),
each migration adds a thin local `Field` wrapper inside the consuming file
that mirrors `Select`'s label/error/required treatment. If the same wrapper
is needed for the cert-type and rank pilots later, **promote** it to
`shared/components/Field.tsx`. For this pilot it stays per-file.

---

## 2. Excluded — free-text inputs and read-only display

These are *not* migration targets. Recording them so the next reviewer doesn't
think they were missed.

### Free-text governorate inputs (intentional — family-member addresses)

| File · line | Reason |
|---|---|
| [src/features/admin/components/applicants/ApplicantForm.tsx:840](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L840) | Family-member governorate, `<Input>` free text. Family rows accept arbitrary place names (e.g. "Riyadh", "London") that aren't in the 27-Egyptian list. Keep as Input. |
| [src/features/applicant-portal/pages/Stage7FamilyPage.tsx:224](frontend/src/features/applicant-portal/pages/Stage7FamilyPage.tsx#L224) | Same — family-member free-text governorate. |

### Read-only display (no picker)

| File · line | Reason |
|---|---|
| [src/features/committees/pages/CommitteeDetailPage.tsx:85,351-352](frontend/src/features/committees/pages/CommitteeDetailPage.tsx#L85) | DataTable column + detail row, render only. |
| [src/features/admin/pages/ApplicantDetailPage.tsx:152](frontend/src/features/admin/pages/ApplicantDetailPage.tsx#L152) | DefRow read-only. |
| [src/features/admin/components/reports/TestResultsSection.tsx:43-45](frontend/src/features/admin/components/reports/TestResultsSection.tsx#L43-L45) | Heatmap row labels. |
| [src/features/audit/components/fieldLabels.ts:18](frontend/src/features/audit/components/fieldLabels.ts#L18) | Label dictionary. |
| [src/features/admin/pages/DashboardPage.tsx:65,321](frontend/src/features/admin/pages/DashboardPage.tsx#L65) | Distribution chart query. |
| [src/features/design-revamp/pages/RevampComparisonPage.tsx](frontend/src/features/design-revamp/pages/RevampComparisonPage.tsx) | Static before/after viewer with hardcoded sample text. |

### Reference-data CRUD (editing the governorate dictionary itself)

| File · line | Reason |
|---|---|
| [src/features/admin/pages/ReferenceDataPage.tsx](frontend/src/features/admin/pages/ReferenceDataPage.tsx) | This page is the CRUD admin for the governorate dictionary. Lines 519-521 edit the *code* of a governorate row, not pick one. Skip. |

### Backend / data plumbing — no UI

| File | Reason |
|---|---|
| `applicants/api/applicant.service.ts`, `applicants/api/applicant.queries.ts` | Service signatures and query keys. |
| `applicants/schemas.ts`, `applicant-portal/schemas/index.ts` | Zod schemas — value shape unchanged by this pilot. |
| `barcode/api/barcode.service.ts:24` | Uses governorate to build a barcode code; not a picker. |
| `admin/api/reports.service.ts`, `admin/api/referenceData.service.ts` | Aggregate queries / dictionary service. |
| `shared/types/domain.ts`, `shared/mock-data/*` | Type and mock-data definitions. |

### Already on `SearchSelect` (dev review only)

| File · line | Reason |
|---|---|
| [src/features/dev/PrimitivesReviewPage.tsx:29-40,197](frontend/src/features/dev/PrimitivesReviewPage.tsx#L29) | DEV-only `/_dev/primitives` review surface. Hardcoded subset of governorates for the demo (10, not 27). Out of scope for this pilot. |

---

## 3. Pilot order recommendation

Suggested order (lowest-risk first), each its own commit:

1. **Site #1 — admin filter (`ApplicantsPage.tsx`).** No RHF; smallest blast
   radius; "all" sentinel exercises the `null` ↔ "all" mapping pattern.
2. **Site #2 — admin form (`ApplicantForm.tsx`).** First RHF `Controller`
   site; isolated (admin-only).
3. **Site #3 — wizard Stage 3 (`Stage3PersonalPage.tsx`).** First applicant-
   surface migration; verifies per-app accent inheritance under `data-app="applicant"`.
4. **Site #4 — wizard Stage 4 (`Stage4EducationPage.tsx`).** Same shape as #3,
   different RHF field name.

---

## 4. Acceptance for Phase 1

- ✅ All consumer sites identified (4 picker, 2 free-text excluded with reason,
  CRUD page excluded with reason, backend/types listed).
- ✅ Each site has file path, line, current implementation, surrounding context,
  and RHF integration status.
- ✅ Pre-flight notes call out the two integration concerns (`Controller` for
  RHF; `null` ↔ "all" for the filter) before the brief's "stop-and-ask"
  triggers can fire mid-migration.
- ✅ Total ≤ 8 sites — within the brief's scope ceiling.

**Stopping per brief.** Awaiting confirmation before Phase 2.
