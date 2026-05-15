# Committee Grade Types — Migration Report

Closeout for the four committee-list changes:

1. Domain model — `Committee` carries `categoryKey`, `capacity`,
   `gradeType` (`'score'` | `'tier'`), `gradeMin`, `gradeMax`. New
   `GRADE_TIERS` tuple + `GradeTier` type.
2. Mock seed — 5 demo rows replaced with **12** hand-written
   deterministic committees grouped by category and grade-type per
   the spec.
3. List page — `/admin/committee/list` now groups under a Radix Tabs
   strip (one tab per applicant category, matching the dominant admin
   pattern). The picked tab scopes the table; URL mirrors the choice
   via `?category=<key>`. Empty category → the prescribed `EmptyState`
   with CTA "إضافة لجنة" deep-linking
   `/admin/committee/create?category=<key>`.
4. Edit + display — shared `CommitteeEditDialog` opens from the row's
   icon button (`aria-label="تعديل اللجنة"`) on the list **and** from
   the "تعديل" header button on `/admin/committee/:id`. Mode-branched
   inputs: `score` → two `Input type="number"` with `%` suffix;
   `tier` → two `Select<GRADE_TIERS>`. Saves via `useCommitteeUpdate`
   (now optimistic across cached list + detail) → toast
   "تم تحديث اللجنة".

---

## 1 · Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Use **Tabs** (not chip filter) for category grouping | Matches the dominant admin pattern: `CommitteesManagementPage` (the wizard step), `ExamScheduleStep`, `LookupTabPanel`, `CategoriesPanel`. Keeps the page reading like a section browser, not a faceted search. URL is `?category=<key>` so deep links survive reload. |
| 2 | `GRADE_TIERS` stored as **indices** on the Committee, not labels | Indices are sortable, comparable, and stable across copy edits. The labels are derived at render time via `formatCommitteeGrade()` so the seed/service stays free of Arabic-string comparison. |
| 3 | Single canonical formatter `formatCommitteeGrade(c)` | One source of truth for the "معيار القبول" column on the list and the "شروط التوزيع" item on the detail. Collapses TAGDIR `min === max` to a single label. |
| 4 | Reuse the existing `CommitteeRules` legacy fields | Removed from the form & display, but the type still carries the optional legacy fields so older seeds keep round-tripping through the service. The new `gradeType`/`gradeMin`/`gradeMax` are the canonical model. |
| 5 | Service `update()` validates all three invariants | `CAPACITY_NOT_POSITIVE` (1..999), `GRADE_RANGE_INVERTED` (min ≤ max), and `COMMITTEE_AT_CAPACITY` (capacity ≥ assigned count). All surface as Arabic-copy toasts via the queries layer's `surfaceError`. |
| 6 | Optimistic update on `useCommitteeUpdate` | The list row + detail card both reflect the patch instantly. Snapshot rollback on error. `onSettled` re-invalidates both slices. |

---

## 2 · Files touched

### Created

| Path | Purpose |
|---|---|
| `frontend/src/features/committees/lib/formatCommitteeGrade.ts` | Single sanctioned renderer for the "معيار القبول" column and detail card. |
| `frontend/src/features/committees/components/CommitteeEditDialog.tsx` | Shared inline-edit surface (mode-branched fields + zod-style local validation). |
| `docs/committee-grade-types/REPORT.md` | This file. |
| `docs/committee-grade-types/screenshots/01..04-*.png` | Visual evidence. |

### Modified

| Path | Change |
|---|---|
| `frontend/src/shared/types/domain.ts` | Adds `GRADE_TIERS`, `GradeTier`, `CommitteeGradeType`. Extends `Committee` with `categoryKey`, `capacity` (required), `gradeType`, `gradeMin`, `gradeMax`. |
| `frontend/src/shared/mock-data/index.ts` | Replaces the 5-row seed with 12 hand-written committees distributed across the 4 ApplicantCategoryKey buckets per spec. |
| `frontend/src/features/committees/api/committee.service.ts` | `CommitteePayload` requires `categoryKey`/`capacity`/`gradeType`/`gradeMin`/`gradeMax`. `update()` validates capacity range, grade range, and capacity-vs-assigned invariant; throws typed `ConflictError`. INTEGRATION CONTRACT block added. |
| `frontend/src/features/committees/api/committee.queries.ts` | `useCommitteeUpdate` now optimistic across list + detail cache slices with snapshot rollback. |
| `frontend/src/features/committees/pages/CommitteeListPage.tsx` | Replaces the multi-select with a Radix Tabs strip. Replaces the legacy two grade columns with the unified "معيار القبول" column. Adds the row-level icon-only "تعديل اللجنة" button that opens `CommitteeEditDialog` in place. Empty-state copy: "لا توجد لجان مرتبطة بهذه الفئة" + CTA "إضافة لجنة" → `/admin/committee/create?category=<key>`. |
| `frontend/src/features/committees/pages/CommitteeDetailPage.tsx` | Reuses `CommitteeEditDialog` from the header "تعديل" button. "شروط التوزيع" card now renders Category / السعة / المسنّد / معيار القبول. Drops the legacy alphabet+gender+applicantType triad. |
| `frontend/src/features/committees/pages/CommitteeCreatePage.tsx` | Threads `categoryKey`/`gradeType`/`gradeMin`/`gradeMax` into the create payload (defaults from the existing form's specialization picker + rules). |

No `shared/components/` additions — feature-local. No new deps.

---

## 3 · Seed distribution

| ID | Category | gradeType | Range | Capacity |
|---|---|---|---|---:|
| C-01 | `officers_general` | score | 95–100% | 60 |
| C-02 | `officers_general` | score | 90–95%  | 55 |
| C-03 | `officers_general` | score | 85–90%  | 50 |
| C-04 | `officers_general` | score | 80–85%  | 45 |
| C-05 | `physical_education_bachelor` | score | 80–100% | 30 |
| C-06 | `physical_education_bachelor` | score | 70–80%  | 25 |
| C-07 | `law_bachelor` | tier | امتياز مع مرتبة الشرف  | 40 |
| C-08 | `law_bachelor` | tier | امتياز → امتياز مع مرتبة الشرف | 35 |
| C-09 | `law_bachelor` | tier | جيد جدًا → امتياز     | 30 |
| C-10 | `law_bachelor` | tier | جيد → جيد جدًا       | 25 |
| C-11 | `specialized_officers` | tier | امتياز              | 20 |
| C-12 | `specialized_officers` | tier | جيد جدًا → امتياز    | 15 |

Total capacity: 430. Assigned roster: 369. `applicants` values are
all < `capacity` so no committee is "full" out of the gate.

---

## 4 · Screenshots

`docs/committee-grade-types/screenshots/`:

| File | Shows |
|---|---|
| `01-list-officers-general-score.png` | List page with `officers_general` tab active. 4 score-mode rows; "معيار القبول" column reads "الدرجة: 95% – 100%" etc. Each row carries the icon-only "تعديل اللجنة" button. |
| `02-list-law-bachelor-tier.png` | Same list with `law_bachelor` tab active. 4 tier-mode rows; column reads "التقدير: جيد – جيد جدًا" / "التقدير: امتياز مع مرتبة الشرف" (collapses to single label when min===max). |
| `03-edit-dialog-tier.png` | `CommitteeEditDialog` open on a tier-mode committee. Capacity Input + two Select<GRADE_TIERS> populated from the committee's current band. |
| `04-edit-dialog-score.png` | Same dialog on a score-mode committee. Two numeric inputs (0..100) with `%` suffix. |

---

## 5 · Service contract (mirrors `docs/DB_CONSTRAINTS.md` semantics)

```
PATCH /api/committees/:id  → Committee
  body: Partial<Committee>
```

Throws:
- `409 CAPACITY_NOT_POSITIVE`   capacity must be integer 1..999.
- `409 GRADE_RANGE_INVERTED`    `gradeMin ≤ gradeMax` post-patch.
- `409 COMMITTEE_AT_CAPACITY`   `capacity` cannot drop below the
                                count of assigned applicants.

Cache invalidation: `committeeKeys.detail(id)` + `committeeKeys.list()`
after the optimistic write settles.

---

## 6 · Verification

- ✅ `npm run typecheck` clean per commit (4 commits on `main`).
- ✅ List page renders 12 committees correctly grouped under 4 tabs.
- ✅ Empty category fallback exists (physical_education_bachelor has 2
  rows so the empty-state path is only reachable in fresh test data).
- ✅ Edit dialog opens from both surfaces (list row icon + detail
  header button). Tier branch / score branch render the right fields.
- ✅ Optimistic update fires — confirmed visually (list row reflects
  patch before the simulated latency resolves).
