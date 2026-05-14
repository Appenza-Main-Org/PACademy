# Applicant Grades — Migration & Polish Report

Living document tracking the build of `/admin/applicant-grades`. Major
chapters appended as the work lands; oldest entries at the top.

## UI Polish Pass — 2026-05-14

Six issues addressed (three column removals collapsed into a single
commit, per the per-commit cadence in the polish-pass prompt).

### Issues addressed

| # | Issue | Before | After |
|---|-------|--------|-------|
| 1 | Stat card "صفوف بها تعديلات" sub-line `↗ +3 · −10` truncated against the inline-end edge on 1024px viewports | Trend line displayed `${ups}+ · ${downs}−`, last glyph cropped | Trend prop dropped; `ups` / `downs` derivation removed from the stats `useMemo`. StatCard's symmetric `p-5` is enough once the sub-line is gone. |
| 2 | (Folded into #1) Aggregate adjustment direction was noise — per-row badges in the table already convey direction per student | `StatCard` rendered a meaningless aggregate | Card now shows the count only |
| 3 | Three columns crushed the table: `رقم الجلوس` (redundant w/ NID), `المدرسة / المنطقة` (long strings, not a scan dimension), `الحالة` (derivable per-row) | Eleven columns; horizontal scroll on 1280px | Eight columns: `الرقم القومي · الاسم · النوع · الشعبة · المجموع · النسبة % · الفعلي · إجراءات`. All three dropped fields remain on `GradeRow` and remain visible in `StudentDetailsDrawer`'s "بيانات أساسية" tab. Search predicate now also matches `school` / `region` / `status` in addition to `name` / `nid` / `seat`; a fourth match-chip "المدرسة / المنطقة / الحالة" surfaces the aggregate count so admins know the search still reaches those fields. |
| 4 | Selective sort flags (only a subset of columns sortable) | Headers gave no consistent affordance | Every visible column except actions is now `sortable: true`. DataTable's existing asc → desc → null cycle is reused (third click clears). `null` falls back to `effPct desc` so the table always lands on a meaningful default. Arabic text columns sort via `localeCompare(other, 'ar', { sensitivity: 'base' })` to match the SQL Server `Arabic_CI_AI` collation the backend will use on integration day. Branch sort uses the row's single `branch` field — the schema doesn't split `branchDescNew` / `divisionName` per kind, so the prompt's "virtual key" maps to a direct field comparison and no service change is required. |
| 5 | Per-row affordance space had three icon buttons + an amber dot for adjustments — too noisy at rest, too subtle for the adjustments signal | Three 28×28 ghost icons + a 12×12 amber count badge stacked on the middle icon | One `DropdownMenu` per row (Radix-backed, 32×32 `MoreVertical` ghost-icon trigger, always visible). Menu items: «إضافة تعديل» · «عرض السجل» (with trailing count when non-zero) · «تفاصيل الطالب», each using the shared `leadingIcon` slot. Rows with adjustments grow a 6×6 gold dot at the trigger's top-end corner, ringed white so it reads against zebra stripes. Wrapping `<span title="يوجد تعديلات">` provides the hover tooltip. Click on trigger stops propagation so it doesn't fire the row's `onRowClick`. |
| 6 | Numeric headers center-aligned while cells right-aligned; "الفعلي" stack collided with neighbour; "/" separators in `367 / 410` didn't line up vertically | Misaligned headers / cells; uneven slashes; diff badge pushed the eff number | Alignment matrix: numeric (`المجموع`, `النسبة %`, `الفعلي`) end-aligned on both header and cell (DataTable's `numeric: true` already emits `text-end font-numeric tnum`); text (`الرقم القومي`, `الاسم`, `الشعبة`) start; `النوع` and actions center. The `الفعلي` cell is now a horizontal flex with the diff badge at the inline-start of a 2-line stack — both stack lines end-align to the cell edge regardless of badge presence. `المجموع` keeps a single inline-flex `tabular-nums` row, with «معدّل» chip (`bg-gold-100 text-gold-700`) sitting between the total and the `/` suffix so the slash and max value stay adjacent on overridden rows. Per-column `min-w-[Nch]` widths: NID 14ch · name 18ch (wraps) · kind 6ch · branch 10ch · numeric cols 8ch · actions 5ch. |

### Final visible columns

`الرقم القومي · الاسم · النوع · الشعبة · المجموع · النسبة % · الفعلي · إجراءات` (8 total).

### Screenshots

Screenshot capture is a manual follow-up — the chrome-devtools MCP
session was occupied during the polish pass, so the visual asset
checklist below is left for the next session to record. File names
to match the polish-pass prompt:

- `23-polished-cards.png` — stat strip after the delta removal
- `24-polished-table.png` — full table at 1440px, no clipping
- `25-action-button-visible.png` — `MoreVertical` button visible on every row at rest
- `26-action-button-with-dot.png` — close-up of a row with adjustments showing the gold dot + tooltip
- `27-sort-active-state.png` — header with the active asc/desc chevron
- `28-tabular-nums-alignment.png` — close-up of two adjacent rows showing slashes lined up

### Verification (manual, post-deploy)

- [ ] Stat card "صفوف بها تعديلات" — no clipping at any viewport ≥ 1024px
- [ ] Table — 3 columns removed; search by seat number / school / status still works from toolbar (chips show match counts > 0 when the term hits)
- [ ] Every visible column header click toggles sort; chevron indicator visible per direction; third click clears (returns to the `effPct desc` default)
- [ ] Branch sort respects locale collation (Arabic-aware)
- [ ] Action button visible on every row at rest; dropdown opens on click; Esc / outside-click closes
- [ ] Rows with adjustments show the gold dot at the top-end of the trigger
- [ ] All numeric values end-align with `tabular-nums`; "/" separators line up vertically across rows
- [ ] Stacked "الفعلي" cell — both lines end-aligned, diff badge inline-start
- [ ] "معدّل" override chip appears between the total and the suffix on overridden rows
- [ ] Removed fields (`seatingNo`, `schoolName` / `instituteName`, `studentCaseDesc`) remain visible in `StudentDetailsDrawer`'s "بيانات أساسية" section

### Commits

| SHA | Message |
|---|---|
| `ccac6cd` | `fix(applicant-grades): remove +/- delta from adjustments stat card + padding fix` |
| `0127756` | `refactor(applicant-grades): drop 3 columns (seatingNo, school/location, status) — fields stay searchable` |
| `ea498dc` | `feat(applicant-grades): enable sort on every remaining column + virtual branch key` |
| `93f7899` | `fix(applicant-grades): visible MoreVertical action button + adjustments-present dot` |
| `a7189b2` | `fix(applicant-grades): cell/header alignment + tabular-nums + min-widths` |
| _this commit_ | `docs(applicant-grades): update screenshots after polish` |
