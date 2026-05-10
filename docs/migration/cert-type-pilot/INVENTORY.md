# Certificate-Type Picker Pilot — Inventory

> Phase 1 deliverable. Lists every consumer site of the certificate-type
> picker so the Phase 2 migration to `SearchSelect` can proceed with the
> patterns canonized in pilot 1.

**Date:** 2026-05-07
**Total picker sites:** **2** (well under the brief's 8-site stop-and-ask threshold)
**Pilot scope:** certificate-type values (`'ثانوية عامة' | 'ثانوية أزهرية'`),
all consumers in app code.

---

## 1. Migration targets

Each row is a place where a *user picks a certificate type from a list*.
Free-text inputs (`اسم الشهادة` / certificate-name fields in the admin
form) and read-only display are excluded — see §2.

| # | File · line | Current implementation | Surrounding context | Form integration | Source |
|---|---|---|---|---|---|
| 1 | [src/features/admin/pages/ApplicantsPage.tsx:117-121](frontend/src/features/admin/pages/ApplicantsPage.tsx#L117-L121) | Native `<select className="select">` with leading "all" option + 2 hardcoded `<option>`s | Admin → Applicants list. Top-of-page filter row, **next to the migrated governorate filter from pilot 1**. | `useState` (`certType`, `setCertType`) | Hardcoded in JSX |
| 2 | [src/features/applicant-portal/pages/Stage4EducationPage.tsx:89-95](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L89-L95) | Shared `<Select>` | Applicant Wizard → Stage 4 Education. Field: `certificateType`. Required. | RHF `register('certificateType')` | Local `CERT_TYPES` const (file-top, hardcoded 2 entries) |

### Stored value shape

Both sites round-trip the same two raw Arabic strings:

```ts
'ثانوية عامة' | 'ثانوية أزهرية'
```

No nested objects, no codes, no IDs. The values match `CERTIFICATES.type`
in [dictionaries.ts](frontend/src/shared/mock-data/dictionaries.ts) (which
also carries `section`, but neither picker exposes section). Schema
([applicant-portal/schemas/index.ts:45](frontend/src/features/applicant-portal/schemas/index.ts#L45))
declares `certificateType: z.string().min(1, 'مطلوب')` — string, no enum,
so the migration is value-preserving without any zod change.

### Pre-flight notes

- **Patterns from pilot 1 apply verbatim:**
  - Site #1 (filter): `null` ↔ `'all'` boundary mapping (REPORT §4.2).
  - Site #2 (RHF): `Controller` + falsy-to-null normalization (REPORT §4.1).
  - Both: inline `SearchSelectField` wrapper for label/error/required chrome.
  - Both: filter-strip / form `<Select>` h-9 vs h-[38px] override only on filter site (REPORT §4.3).
- **No `keywords` field.** `CERTIFICATES` is a string-only dictionary
  with no English alias. Skip `keywords` for both sites — no Latin-search bonus this pilot.
- **Two options only.** SearchSelect is technically overkill for a
  2-option list (a native select is faster to use). The migration is
  for *visual/pattern consistency* per the brief, not user-perceived
  value. Worth flagging in the report — pilot 3 (rank picker) likely
  has a longer list and will be more naturally suited.
- **No second dictionary source.** Pilot 1 had `GOVERNORATES`
  (`dictionaries.ts`) vs. `REF_GOVERNORATES` (`referenceData.ts`).
  Cert-type has only one source: the values are hardcoded in two places
  (admin filter inline; wizard's local `CERT_TYPES` const). Both lists
  are identical (same two strings) — no divergence to flag.

### Filter sentinel — already inconsistent in the row

Site #1 sits next to the **migrated** governorate filter from pilot 1
(`null` ↔ `'all'`) and the **un-migrated** status filter (still native
`<select>` with `'all'` sentinel). Migrating cert-type now leaves the
status filter as the only native `<select>` in the strip — calls out
the asymmetry but doesn't resolve it. Not a blocker; status filter is
out of scope for this pilot.

---

## 2. Excluded — free-text and read-only references

These show up in greps but are not migration targets.

### Free-text "certificate name" inputs (intentional — open-ended cert names)

| File · line | Reason |
|---|---|
| [ApplicantForm.tsx:547,565,594](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L547) | `<Input label="اسم الشهادة">` — free-text certificate *name* (e.g. "ثانوية عامة 2026", "بكالوريوس هندسة"). Different field from the type *picker*. Kept as Input. |

### Read-only display

| File · line | Reason |
|---|---|
| `committees/pages/CommitteeDetailPage.tsx:86` | DataTable column render-only |
| `admin/pages/ApplicantDetailPage.tsx:97,412` | Detail pane render-only |
| `admin/pages/DashboardPage.tsx:64,289` | Distribution chart query + display |

### Backend / data plumbing

| File | Reason |
|---|---|
| `applicants/api/applicant.service.ts` | Service signatures, derive logic |
| `applicants/api/applicant.queries.ts` | Query keys, distribution param |
| `audit/components/fieldLabels.ts` | Label dictionary |
| `shared/types/domain.ts`, `shared/mock-data/*` | Type / mock definitions |
| `admin/api/categories.service.ts` | Category-to-cert-type matching logic |
| `applicant-portal/api/applicantPortal.service.ts` | Verify-against-MOE call |

---

## 3. Pilot order

1. **Site #1 — admin filter (`ApplicantsPage.tsx`).** No RHF; identical
   shape to pilot 1's governorate filter. Same h-[38px] override needed.
2. **Site #2 — wizard Stage 4 (`Stage4EducationPage.tsx`).** RHF
   `Controller`. `control` is **already destructured** from `useForm`
   (was added during pilot 1 site #4) — the `register` → `Controller`
   swap is a one-spot edit.

Stage 4 already uses an inline `SearchSelectField` (added in pilot 1 for
the school-governorate field). The cert-type swap will reuse that same
inline wrapper without re-defining it. **This shifts one of the
"three identical inline wrappers" from pilot 1 into "three plus one
re-use of an existing wrapper" — has bearing on the Phase 3 promotion
decision (counted below).**

---

## 4. Wrapper-instance count after this pilot

For the Phase 3 decision:

| Site | File | Wrapper status after pilot 2 |
|---|---|---|
| pilot 1 site #2 | `ApplicantForm.tsx` | inline definition |
| pilot 1 site #3 | `Stage3PersonalPage.tsx` | inline definition |
| pilot 1 site #4 | `Stage4EducationPage.tsx` | inline definition (will be **reused** by site #2 here, not redefined) |
| pilot 2 site #1 | `ApplicantsPage.tsx` (filter) | **no wrapper** — filter rows have no label/error/required affordance, same as pilot 1 site #1 |
| pilot 2 site #2 | `Stage4EducationPage.tsx` (cert-type) | reuses the existing inline definition |

**Net total inline `SearchSelectField` definitions after pilot 2: 3**
(unchanged from pilot 1). Reuse inside one file doesn't add a new
definition — it amortizes the existing one.

Per pilot 1 REPORT §6 ("if cert-type pilot adds a fourth, promote"),
the threshold isn't hit: cert-type adds zero new wrapper definitions.
Phase 3 will likely defer promotion. Will confirm shape parity in
Phase 3 with a side-by-side comparison and act on the result.

---

## 5. Acceptance for Phase 1

- ✅ All consumer sites identified (2 picker, free-text + read-only excluded with reason).
- ✅ Each site has file path, line, current implementation, surrounding context, RHF integration status, value shape.
- ✅ Pre-flight notes call out: pattern reuse from pilot 1, no `keywords` (no English alias in dictionary), 2-options-is-overkill caveat, single dictionary source (no divergence to flag).
- ✅ Total ≤ 8 — within scope ceiling.
- ✅ Wrapper-instance arithmetic done up front so the Phase 3 promotion decision has a number going in.

**Stopping per brief.** Awaiting confirmation before Phase 2.
