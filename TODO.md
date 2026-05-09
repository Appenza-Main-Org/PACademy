# TODO — Police Academy Admissions Platform (Frontend)

> Durable record of follow-ups that surfaced during the admin gap closure
> verification pass and are intentionally deferred. Each entry names the
> file, the rule it violates, and why it's parked.

---

## Tech debt — pre-existing `: any` violations

Surfaced by the autonomous verification pass on top of
`admin-gaps-verified` ([docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) §2).
Both pre-date `admin-gaps-complete` (originated in commit `69f4689`,
the monorepo split) and are out of admin-gap scope; flagged here so
they don't get lost.

### 1. `src/shared/lib/zod-resolver.ts:25`

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends Record<string, any>>(schema: z.ZodType<T>): any {
```

- **Rule violated:** CLAUDE.md §2 "Forbidden — `any` — use `unknown` and narrow".
- **Why deferred:** Bridges react-hook-form v7's variance-strict
  `Resolver<T, TContext, TTransformedValues>` to a concrete
  `z.ZodType<T>`. The `eslint-disable-next-line` comment makes the
  exception explicit and intentional.
- **Path forward:** Migrate to `@hookform/resolvers/zod` (the
  upstream package) — drops this shim entirely. Cost: one extra
  dependency in `package.json`. Worth doing before the next major
  RHF upgrade.

### 2. `src/features/admin/components/applicants/ApplicantForm.tsx:831`

```ts
register: any;
```

- **Rule violated:** CLAUDE.md §2 "Forbidden — `any`".
- **Why deferred:** RHF's `UseFormRegister<T>` generic is awkward to
  thread through nested family-member sub-forms with discriminated
  union shapes. Pre-existing pattern in the Sprint-2 admin form
  rewrite.
- **Path forward:** Type as
  `UseFormRegister<ApplicantFormValues>` and accept the readability
  cost; or accept a `setValue`/`getValues` pair instead so the prop
  is a narrower contract.

---

## Tech debt — applicant-flow follow-ups

Surfaced by the autonomous verification pass on top of
`applicant-flow-aligned` (`213f2b5`). These are the items from the
report's §8 closeout that were intentionally pragmatic and need
real-implementation follow-up before backend integration.

### 3. Stage 9 — `COMMITTEE_NUMBER` hardcode

`src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:37`

```ts
const COMMITTEE_NUMBER = 2; // demo
```

- **Rule violated:** hardcoded committee assignment; ignores
  `draft.examSlot.committeeId` (which doesn't exist yet).
- **Why deferred:** `ExamSlot` shape doesn't carry a `committeeId`.
  Wiring it requires a Gap H follow-up to extend the shape and the
  reservation flow.
- **Path forward:** extend `ExamSlot` with `committeeId: string`,
  populate from the slot reservation, derive ordinal in Stage 9 from
  `committeeService.getById(slot.committeeId).number`.

### 4. Stage 4 — track-specific gates inline (AF-4)

`src/features/applicant-portal/pages/Stage4EducationPage.tsx:38–60`

```ts
const requiresBarLicense =
  selectedCategory?.conditions.requiredQualification === 'bachelor_law';
const requiresSportFields =
  selectedCategoryKey === 'institute_officers_training' || …;
```

- **Rule violated:** per-track form shape decisions live in the page
  rather than in admin Gap G's `CategoryConditions`.
- **Why deferred:** the alignment-report scope was a pragmatic
  inline implementation; the thorough version needs a `fieldOverrides`
  block on `CategoryConditions`.
- **Path forward:** add
  `CategoryConditions.fieldOverrides?: { stage4?: { barLicenseRequired?: boolean; sportFieldsRequired?: boolean }; … }`.
  Page reads the override block and computes flags from it. Admin
  category-condition editor surfaces the new toggles.

### 5. Stage 9 — `رقم الملف` is a relabel only (AF-13)

`src/features/applicant-portal/pages/Stage9PrintCardPage.tsx:111`

- **Rule violated:** the printed reference card carries a numeric
  file number (e.g. ending in `٦`); current code renders the
  internal `APP-2026000` ID with the `رقم الملف` label.
- **Why deferred:** introducing `Applicant.fileNumber: number` with
  a `UNIQUE per cycle` invariant requires a backend handshake (DB
  constraint + assignment policy at intake).
- **Path forward:** add `fileNumber` to `Applicant`, allocate at
  intake (typically from a per-cycle counter), update
  `INTEGRATION_HANDOFF.md` §3 invariants, render `fileNumber` on
  the card (with toEasternArabicNumerals).

### 6. Applicant-flow audit-emission gap

`src/features/applicant-portal/api/applicantPortal.queries.ts`

- **Rule:** every mutation should run through `withAudit` for a
  durable record. AF-2 and AF-6 are now wrapped (verification pass);
  pre-existing applicant-portal mutations are not.
- **Why deferred:** `saveDraft`, `submitStage`, `initiatePayment`,
  `verifyPayment`, `reserveExamSlot`, and `useEligibilityMutation`
  predate AF-N work and the codebase pattern doesn't wrap them.
- **Path forward:** sweep the 6 mutations to wrap in `withAudit`
  with the applicant as the actor and module = 'applicants'.
  Optionally extend `submitStage` to accept an `auditReason`
  parameter so the AF-3 edit-surface can emit a distinct
  'edit' descriptor when re-saving stages from the summary page.

### 7. Pre-existing hardcoded `/applicant/...` paths in stage navigation

11 instances across Stage1/2/3/4/5/6/7/8/9/11 pages
(e.g. `Stage9PrintCardPage.tsx:69` —
`navigate('/applicant/acquaintance-doc')`).

- **Rule violated:** CLAUDE.md §13 quick reference — internal links
  should use `ROUTES.*`. Verification pass surfaced 11 hardcoded
  navigate-paths in the wizard; all predate AF-N work and represent
  the established pre-existing convention.
- **Why deferred:** out of scope for verification (not introduced by
  AF-N work). Adding 11 ROUTES constants and migrating call sites is
  a separate code-style cleanup.
- **Path forward:** add `ROUTES.applicant.*` (object form) with
  per-stage keys, migrate the 11 call sites, drop the `applicant`
  string-only constant.

---

## How to use this file

- Append new deferred items as H2/H3 sections under a topic.
- Each item names the file path, the rule, the reason for deferral,
  and the path forward — so a future session can pick it up cold
  without context-archaeology.
- When an item ships, delete the section (don't comment it out).
