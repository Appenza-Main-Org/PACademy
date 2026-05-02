# Padding Audit — Badges, Selects, Tables

> Audit + fix for the "cramped" status badges in table cells (and similar issues
> in dropdowns) reported on the live demo. Triggered by the user feedback that
> badges in `/board/sessions` had no breathing room.

## What I checked

| Surface | Component | Source |
|---|---|---|
| Status badges in tables (board, admin, medical, investigations, exams) | `<Badge>` + `<StatusBadge>` | `src/shared/components/Badge.tsx`, `StatusBadge.tsx` |
| Sortable status filters | `<Select>` (native) | `src/shared/components/Select.tsx` |
| Searchable pickers | `<Combobox>` | `src/shared/components/Combobox.tsx` |
| Multi-tag pickers (e.g. ref-data) | `<MultiSelect>` | `src/shared/components/MultiSelect.tsx` |
| Table rows + headers | `<DataTable>` | `src/shared/components/DataTable.tsx` |

## Findings

### LTR-only padding leak (the spec's primary concern)

✅ **None.** Grepped the entire `src/` tree for `\bpl-[0-9]` and `\bpr-[0-9]` —
zero matches. The codebase is already 100% on logical properties (`ps-`/`pe-`
when one-sided, `px-` for symmetric horizontal). RTL flipping works correctly
out of the box.

### Cramped paddings (the actual visible bug)

| # | Component | Before | After | Effect |
|---|---|---|---|---|
| 1 | `Badge` (used everywhere via `StatusBadge` and ad-hoc) | `px-2.5 py-0.5` (10/2 px) + `gap-1` | `px-3 py-1` (12/4 px) + `gap-1.5` + `leading-none` | The single most visible fix — every status pill across the app now has consistent breathing room. |
| 2 | `Combobox` option-badge | `px-2 py-0.5` | `px-2.5 py-1` | Inline category counts read clearly. |
| 3 | `MultiSelect` selected-tag chip | `px-2 py-0.5` | `px-2.5 py-1` | Multi-select chips no longer hug their close (×) button. |
| 4 | `MultiSelect` option-badge | `px-2 py-0.5` | `px-2.5 py-1` | Same — count badges next to dropdown items. |
| 5 | `MultiSelect` trigger | `px-2 py-1` | `ps-3 pe-3 py-1.5` | Was visibly tighter than the matching native `<Select>` (which uses `ps-3 pe-9`); now aligned. Migrated to logical `ps-/pe-` while we were there. |

### Spec items that didn't need a change

- **Native `<Select>` trigger** — already uses `ps-3 pe-9` (room for the trailing chevron). Nothing to do.
- **`<DataTable>` cells** — the three density modes (`compact px-3 py-2`, default `px-4 py-3`, comfortable `px-5 py-4`) match or exceed the spec's "min `ps-4 pe-4 py-3`" recommendation for the default density. Compact density is intentionally tight; the visible cramping inside cells came from the Badge child, not the cell itself, and is fixed by #1.

## How to verify

1. `npm run dev`
2. Visit:
   - `/board/sessions` — status pills (`مجدولة` / `جارية` / `مغلقة`)
   - `/admin/applicants` — status + payment pills
   - `/medical/queue` — verdict pills
   - `/investigations` — status + priority pills (`مفتوحة` / `إيقاف` / `حرجة`...)
   - `/question-bank/results` — outcome pills
3. Each pill should have **visible padding on both sides of the text** — not glued to the rounded edge. RTL is the easy regression check (this is an Arabic-first app); test with `<html dir="rtl">` (the default).

## Constraint compliance

- ✅ No `pl-`/`pr-` introduced; logical properties used everywhere
- ✅ No business logic touched
- ✅ No new className strings inline; fixes are at the shared-component level
- ✅ `npx tsc --noEmit` passes with 0 errors
