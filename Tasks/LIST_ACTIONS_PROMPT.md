# Universal Import / Export / Duplicate — Admin List Pages

> **Claude Code Implementation Prompt**
> Add three reusable actions (Import / Export / Duplicate) to every admin list page across all 9 apps, driven by a single config-driven `ListActions` primitive wired into the existing `DataTable<TRow>`.

---

## 1 · Goal

Three actions, available across every admin list/table page:

1. **Export (تصدير)** — download the current list (respecting active filters + search) as CSV by default; XLSX if the codebase already has an XLSX helper.
2. **Import (استيراد)** — upload a CSV/XLSX file, preview rows in a dialog with per-row validation, commit on confirm. Dry-run preview is **mandatory** — no silent imports.
3. **Duplicate (نسخ)** — single-row action available from each row's actions menu (and bulk if the table already has multi-select). Creates a new entity with a `-نسخة` suffix, fresh ID, soft-delete fields cleared, status reset to draft/inactive per entity convention.

All three actions are **opt-in per list via a config prop**. Some entities (audit trail, applicants self-registering) can't be sensibly imported or duplicated — the config makes that explicit.

**Frontend only.** Backend integration phase will swap `simulateLatency()` + MOCK writes for real `apiClient` calls per `CLAUDE.md §6`.

---

## 2 · Required Reading (in order)

1. **`CLAUDE.md`** — full read. §2.5 component authoring rules (the three layers: tokens → Radix → composition), §3 Clean Arch, §5 RBAC, §6 mock pattern, §8 design system, §9 conventions. Non-negotiable.
2. **`docs/PRODUCT.md`** §4 — two-phase signature canon (preliminary vs final). The duplicate-then-edit flow is conceptually a "preliminary save" — reuse the dashed gold notice shape.
3. **`Tasks/DESIGN_SYSTEM.md`** — visual constitution. No new tokens.
4. **`frontend/src/shared/components/DataTable.tsx`** — current generic list primitive. Has multi-select, density, sticky header, pagination, per-column hide-on. The toolbar slot is the integration point.
5. **`frontend/src/shared/components/Modal.tsx`**, **`FileUpload.tsx`** — reuse for the import dialog. Don't roll new.
6. **`frontend/src/shared/lib/audit.ts`** — `withAudit` wrapper from admin Gap E. Every import/export/duplicate emits audit.
7. **`Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md`** — Gap D (soft delete) and Gap E (audit) patterns. New actions must respect both.
8. **`docs/INTEGRATION_HANDOFF.md`** §2 — service inventory; new `bulkImport` and `createFromTemplate` methods must be added.
9. **`docs/DB_CONSTRAINTS.md`** — the 9 invariants. Duplicate must respect uniqueness constraints (e.g. `NID_CYCLE_DUPLICATE` for applicants; `EXAM_ORDER_DUPLICATE` for exams; `ACTIVE_CYCLE_EXISTS` for cycles).

If anything in this prompt conflicts with `CLAUDE.md`, `CLAUDE.md` wins. Stop and flag.

---

## 3 · Working Directory

All `npm` invocations from `/Users/mac/Projects/PACademy/PACademy/frontend`.

---

## 4 · List-Page Inventory (per CLAUDE.md §4 routes)

Build the full inventory in Phase 1; this is the starting reference. Per-list strategy explicitly:

### Admin (9 apps × multiple lists each)

| Surface | Page | Entity | Export | Import | Duplicate | Notes |
|---|---|---|---|---|---|---|
| Admin | `/admin/applicants` | Applicant | ✅ | ❌ | ❌ | Self-registering; bulk insert breaks audit chain |
| Admin | `/admin/users` | SystemUser | ✅ | ✅ | ✅ | NID-driven bulk import via Gap B officer lookup |
| Admin | `/admin/audit` | AuditEntry | ✅ | ❌ | ❌ | Append-only; never imported or duplicated |
| Admin | `/admin/reference-data/:tab` | LookupRow | ✅ | ✅ | ❌ | Bulk lookup load is the main use case |
| Admin | `/admin/cycles` | Cycle | ✅ | ❌ | ✅ | Duplicate = "copy from previous" (reuses Gap J exam-plan copy pattern); only one active cycle invariant must hold |
| Admin | `/admin/categories` | Category | ✅ | ❌ | ✅ | Duplicate within or across cycles |
| Admin | `/admin/workflows` | Workflow | ✅ | ❌ | ✅ | Duplicate stages too |
| Admin | `/admin/admission-rules` | (no list — single config page) | — | — | — | Skip |
| Admin | `/admin/reports` | (composite dashboard, no list) | — | — | — | Skip |
| Admin | `/admin/admission-setup/*` | (composite wizard) | — | — | — | Skip — each step has its own surface |
| Committee | `/admin/committee/list` | Committee | ✅ | ❌ | ✅ | Duplicate clones officers + capacity, not scheduled exams |
| Committee | `/admin/committee/schedule` | (timeline view, not a list) | — | — | — | Skip |
| Board | `/board/sessions` | Session | ✅ | ❌ | ✅ | Duplicate clones agenda + members, not decisions |
| Board | `/board/decisions` | Decision | ✅ | ❌ | ❌ | Decisions are signed artefacts |
| Board | `/board/members` | Member | ✅ | ✅ | ❌ | Bulk member roster import |
| Investigations | `/investigations/cases` | Case | ✅ | ❌ | ❌ | Cases are unique per applicant |
| Investigations | `/investigations/incoming` | Inbox item | ✅ | ❌ | ❌ | Read-only inbox |
| Investigations | `/investigations/outgoing` | Outbox item | ✅ | ❌ | ❌ | |
| Investigations | `/investigations/distribution` | Distribution | ✅ | ❌ | ❌ | |
| Medical | `/medical/queue` | Queue entry | ✅ | ❌ | ❌ | |
| Medical | `/medical/results` | Result | ✅ | ✅ | ❌ | Bulk result entry from external device |
| Barcode | `/barcode/scans` | Scan log | ✅ | ❌ | ❌ | Read-only log |
| Barcode | `/barcode/batch` | Batch | ✅ | ❌ | ✅ | Duplicate batch config for reissue |
| Biometric | `/biometric/history` | Verification | ✅ | ❌ | ❌ | Read-only log |
| Biometric | `/biometric/monitoring` | Monitor event | ✅ | ❌ | ❌ | |
| Exams | `/question-bank/manage` | Question | ✅ | ✅ | ✅ | Bulk question import; duplicate-then-edit pattern |
| Exams | `/exams` | Exam | ✅ | ❌ | ✅ | Duplicate exam config |
| Exams | `/exams/results` | ExamResult | ✅ | ✅ | ❌ | Bulk result entry |

### Notes from the inventory

- **Cycles + categories + workflows duplicate** maps to the "copy-from-previous-cycle" pattern already shipped in Gap J for exam plans. Reuse the service-layer pattern; don't fork.
- **Questions + medical results + lookup bulk import** are the high-value import use cases. Everything else is import-disabled.
- **Audit + decisions + signed artefacts** are export-only — they're signed/append-only data.
- **Composite pages** (admin-setup wizard steps, reports dashboard, committee schedule timeline, admission-rules config) are skipped — they're not lists.

Phase 1 produces the full canonical inventory at `docs/LIST_ACTIONS_INVENTORY.md`. The table above is a starting point — re-verify against the actual `routes.tsx` registry.

---

## 5 · Architecture Guidance

### 5.1 The three-layer rule (per CLAUDE.md §2.5)

Build to all three layers in order:

1. **Tokens** — every color, spacing, motion duration from `tokens.css`. The import-success row gets `--success-50` background; the import-error row gets `--terra-50` background. No hex literals, no px values where tokens exist.
2. **Behavior primitives (Radix)** — file picker, modal dialog, dropdown menu (for the export-format picker and duplicate confirm) all use existing Radix wrappers in `shared/components/`. No direct `@radix-ui/*` imports in features.
3. **Composition** — `ListActions`, `ImportDialog`, `ImportPreviewTable`, `ExportMenu`, `DuplicateAction` live in `shared/components/data-table/`. The `DataTable` page consumer passes a `listActions={...}` config prop.

### 5.2 File structure

```
src/
├── shared/
│   ├── components/
│   │   └── data-table/                                  ← NEW subfolder
│   │       ├── DataTable.tsx                            ← existing; extend toolbar slot
│   │       ├── ListActions.tsx                          ← NEW — renders the three buttons based on config
│   │       ├── ImportDialog.tsx                         ← NEW — file picker + preview + commit
│   │       ├── ImportPreviewTable.tsx                   ← NEW — row-level validation display
│   │       ├── ExportMenu.tsx                           ← NEW — format picker + filename input
│   │       ├── DuplicateAction.tsx                      ← NEW — row-level action; opens ConfirmDialog
│   │       ├── list-actions.types.ts                    ← NEW — ListActionsConfig<TRow> + helpers
│   │       └── index.ts                                 ← barrel exports
│   ├── lib/
│   │   ├── csv.ts                                       ← NEW (if absent) — minimal CSV serialize/parse with BOM
│   │   └── xlsx.ts                                      ← NEW (only if `xlsx` package already in package.json)
│   └── types/
│       └── list-actions.ts                              ← NEW — shared ImportResult, ExportFormat types
└── features/
    └── (each list-bearing feature gains a service method per action it supports)
        └── api/
            ├── <feature>.service.ts                     ← extend with bulkImport / createFromTemplate
            └── <feature>.queries.ts                     ← extend with useBulkImport, useDuplicate hooks
```

### 5.3 Per-list config shape

```ts
// src/shared/components/data-table/list-actions.types.ts
import type { ZodSchema } from 'zod';

export interface ListActionsConfig<TRow> {
  entityKey: string;                          // e.g. 'admin.users', 'admin.cycles' — used for audit, permissions, telemetry
  entityLabelAr: string;                       // e.g. 'مستخدمي النظام' — used in dialog headers + toasts
  export?: ExportConfig<TRow>;
  import?: ImportConfig<TRow>;
  duplicate?: DuplicateConfig<TRow>;
}

export interface ExportConfig<TRow> {
  enabled: boolean;
  formats: ReadonlyArray<'csv' | 'xlsx'>;
  columns: ReadonlyArray<{
    key: keyof TRow & string;
    labelAr: string;
    format?: (value: unknown, row: TRow) => string;
  }>;
  filenamePrefix: string;                      // e.g. 'مستخدمين-' → 'مستخدمين-2026-05-11.csv'
  scope?: 'filtered' | 'all';                  // default: 'filtered' (user can toggle in ExportMenu)
}

export interface ImportConfig<TRow> {
  enabled: boolean;
  formats: ReadonlyArray<'csv' | 'xlsx'>;
  schema: ZodSchema<unknown>;                  // row-level validation
  templateUrl?: string;                         // optional download-template link
  onCommit: (rows: unknown[]) => Promise<ImportResult>;
  onConflict?: 'skip' | 'merge' | 'restore-or-create';  // for soft-deleted unique-key conflicts
}

export interface DuplicateConfig<TRow> {
  enabled: boolean;
  transform: (row: TRow) => Omit<TRow, 'id'>;  // strips id, soft-delete fields; suffixes label
  onCommit: (newRow: Omit<TRow, 'id'>) => Promise<TRow>;
  redirectToEdit?: boolean;                     // default true — open new row in edit page
}

export interface ImportResult {
  successCount: number;
  failedRows: ReadonlyArray<{ rowIndex: number; errors: ReadonlyArray<string> }>;
}
```

### 5.4 DataTable integration

```tsx
<DataTable
  rows={rows}
  columns={columns}
  listActions={{
    entityKey: 'admin.users',
    entityLabelAr: 'مستخدمي النظام',
    export: {
      enabled: true,
      formats: ['csv', 'xlsx'],
      columns: [
        { key: 'fullArabicName', labelAr: 'الاسم الرباعي' },
        { key: 'nationalId', labelAr: 'الرقم القومي' },
        { key: 'officerCode', labelAr: 'كود الضابط' },
        { key: 'roles', labelAr: 'الأدوار', format: (v) => (v as string[]).join('، ') },
        { key: 'status', labelAr: 'الحالة', format: (v) => v === 'active' ? 'نشط' : 'غير نشط' },
      ],
      filenamePrefix: 'مستخدمين-',
    },
    import: {
      enabled: true,
      formats: ['csv', 'xlsx'],
      schema: userImportSchema,
      onCommit: usersService.bulkImport,
      onConflict: 'restore-or-create',
    },
    duplicate: {
      enabled: true,
      transform: cloneUserRow,
      onCommit: usersService.createFromTemplate,
    },
  }}
/>
```

If `listActions` prop is omitted, the toolbar renders without the three buttons (backward compatible). Lists that exist but haven't been configured yet show nothing — no broken UI.

---

## 6 · TypeScript Constraints (non-negotiable per CLAUDE.md §2)

- Strict mode. **No `any`.** Use `unknown` and narrow via zod.
- **No default exports.** Named exports only.
- Discriminated unions on `ImportResult.failedRows` if error categories diverge (e.g. format vs business-rule).
- Generic `ListActionsConfig<TRow>` properly threaded through `DataTable<TRow>`.
- All Permission strings type-checked against the RBAC permission union.

---

## 7 · Implementation Phases

Three phases. After each: `npm run typecheck` and `npm run build` clean. Atomic commits.

### Phase 1 — Inventory + primitives

1. **Build the canonical inventory.** Walk every admin list page from `CLAUDE.md §4`:
   ```bash
   grep -rln "DataTable\b\|<table" src/features/
   ```
   For each list page, determine the entity, decide which of the three actions apply (use §4 of this prompt as starting point but verify against actual page code), document any constraints (uniqueness invariants, audit-only, etc.). Save to `docs/LIST_ACTIONS_INVENTORY.md`.

2. **Build the shared primitives** in `src/shared/components/data-table/`:
   - `ListActions` — renders three buttons (Export / Import / Duplicate) based on config; each button is hidden if `config.<action>?.enabled !== true`. Buttons live in the existing DataTable toolbar slot.
   - `ExportMenu` — DropdownMenu (Radix) with format options + filename input + "تصدير المُصفّى فقط" toggle + Submit. Active state: disabled when `rows.length === 0` (tooltip: "لا توجد بيانات للتصدير").
   - `ImportDialog` — Modal with three substeps: file picker → preview → confirm. Each substep visible only when state advances.
   - `ImportPreviewTable` — uses `DataTable` itself (inception) with success/error row styling via tokens. Per-row errors visible as a popover or expandable detail row.
   - `DuplicateAction` — Wraps a ConfirmDialog ("هل أنت متأكد من نسخ {entityLabelAr}؟"). On confirm: calls `transform(row)`, then `onCommit`, then navigates to edit page if `redirectToEdit !== false`.

3. **CSV serializer/parser** at `src/shared/lib/csv.ts`:
   - Serialize: header row from column labels, value rows with proper quoting, BOM prefix for Excel-friendly UTF-8.
   - Parse: lenient header detection, type-coerce via zod schema, return `{ rows, parseErrors }`.
   - ~50 lines max. Don't add a CSV dependency.

4. **XLSX support** (conditional):
   - Check `package.json` for `xlsx`, `exceljs`, or `papaparse`. If `xlsx` is already a dep, build `src/shared/lib/xlsx.ts` wrapping its read/write. If not present, **do NOT add the dependency**; CSV-only for now. Log the absence in `docs/LIST_ACTIONS_INVENTORY.md` so the user can approve adding xlsx later if needed.

5. **Audit emissions** in `withAudit`:
   - `entity_exported` — actor, entity type, row count, format, filter snapshot (before is `null`; after carries metadata).
   - `entity_imported` — actor, entity type, attempted count, success count, fail count.
   - `entity_duplicated` — actor, source ID, new ID.
   Add these `AuditAction` literals to the union in `domain.ts`.

**Commit:** `feat(shared/data-table): list-actions primitives + inventory`

### Phase 2 — Wire to admin lists (entity-family batches)

For each entity family, add `listActions` config to the page, implement service-layer `bulkImport`/`createFromTemplate` methods, add TanStack Query hooks.

#### Batch 1 — Users / Roles
- `usersService.bulkImport(rows: OfficerCandidate[])` — validates each via NID + officer code; calls `lookupOfficer` per row to enrich; commits on success. Returns `ImportResult`.
- `usersService.createFromTemplate(sourceId, overrides)` — clones a user's role assignments and scope, fresh NID required, status defaults to inactive.
- **Commit:** `feat(admin/users): import/export/duplicate via listActions`

#### Batch 2 — Cycles / Categories / Workflows
- Reuse Gap J's exam-plan copy pattern for duplicate. `cycleService.createFromTemplate(sourceCycleId)` clones all linked categories, committees-of-record (not committee assignments), exam plan, fee config. Status resets to draft. ⚠️ Cannot duplicate into a state that violates `ACTIVE_CYCLE_EXISTS`.
- **Commit:** `feat(admin/cycles+categories+workflows): import/export/duplicate via listActions`

#### Batch 3 — Lookups
- `lookupsService.bulkImport(rows, lookupKey)` — bulk load reference data. Strong validation: enum keys, RTL Arabic labels, sortOrder integers.
- **Commit:** `feat(admin/reference-data): import/export via listActions`

#### Batch 4 — Audit / Applicants / Logs (export-only)
- Apply export config only; no service-layer changes needed.
- **Commit:** `feat(admin/audit+applicants+logs): export via listActions`

#### Batch 5 — Committees / Board / Investigations / Medical / Barcode / Biometric / Exams
- Per inventory in §4 of this prompt. Apply the configs.
- **Commit per app or grouped sensibly:** `feat(<app>): list actions per inventory`

### Phase 3 — Edge cases + permissions + polish

1. **Empty list export disabled.** Tooltip explains.
2. **Filter-respecting export** — toggle in ExportMenu (default on). Off = export all (warns if >10k rows).
3. **Large exports** — progress indicator for >500 rows; chunk the serialization (yield to event loop every 100 rows).
4. **Import validation errors** displayed inline. User can:
   - "استيراد الصالح فقط" — commits only valid rows.
   - "إلغاء" — cancels everything.
   - "تنزيل تقرير الأخطاء" — downloads error rows as CSV.
5. **Duplicate of entity with unique constraints** — auto-suffix labels with `-نسخة` (or `-نسخة ٢` if `-نسخة` exists). Reset ALL fields that must be unique to either empty or a placeholder. Open duplicate in **edit page**, not detail page — user must explicitly save. Uses the `<dashed gold notice>` (PRODUCT.md §4 preliminary-save canon) to signal unsaved-draft state.
6. **Permissions** — each action gates on a permission:
   - `{entityKey}:export`
   - `{entityKey}:import`
   - `{entityKey}:duplicate`
   Default grant rules:
   - `*:export` → anyone with `*:read`.
   - `*:import` → only roles with `*:write`.
   - `*:duplicate` → only roles with `*:write`.
   Add to `rbac.ts` as a permissions block per entity. Verify against existing roles.
7. **Soft-delete interaction:**
   - Duplicating a soft-deleted row: blocked with "لا يمكن نسخ سجل محذوف".
   - Import row matching a soft-deleted unique key: dialog asks "استعادة السجل المحذوف أم إنشاء جديد؟" if `onConflict === 'restore-or-create'`; otherwise default to error.
8. **Keyboard** — Esc closes ImportDialog; Enter on preview commits; focus trapped inside dialog.
9. **RTL** — file picker, progress bar, modal, dialog all use logical properties (`ms-`/`me-`/`ps-`/`pe-`/`inset-inline-*`).
10. **i18n** — every label, button, toast, error in Arabic. No mixed strings.

**Commit:** `feat(shared/data-table): list-actions edge cases + permissions + polish`

---

## 8 · Validation Requirements

After every phase:

```bash
cd /Users/mac/Projects/PACademy/PACademy/frontend
npm run typecheck
npm run build
npm run lint   # if present
```

After Phase 3:

```bash
# No `any` in new code
grep -rn ": any" src/shared/components/data-table/ src/shared/lib/csv.ts
# No default exports
grep -rn "export default" src/shared/components/data-table/
# Clean Arch — shared doesn't import features
grep -rn "from '@/features/" src/shared/
# Hard-coded design values absent
grep -rn "#[0-9a-fA-F]\{6\}\|px;" src/shared/components/data-table/
```

All four must return zero.

---

## 9 · UX Expectations

- **List toolbar is unobtrusive.** Three buttons grouped together on the start side of the toolbar (RTL: right edge), separated from filters by a divider. Icons + Arabic labels.
- **Export feels instant.** Small lists (<500 rows): no progress, just download. Large lists: progress bar with row count.
- **Import dialog is calm.** No flashy animation. Step indicator: ١. اختر الملف → ٢. مراجعة → ٣. حفظ. Each step has a clear next-action button.
- **Preview makes errors visible.** Failed rows highlighted in `--terra-50` background; success rows in default surface. Error count + success count shown at the top.
- **Duplicate is reassuring.** ConfirmDialog text: "سيتم إنشاء نسخة جديدة من {entityLabelAr} لتعديلها." Not "are you sure?" — the user already clicked the action; the confirm is just a beat to think.
- **All Arabic.** No English UI strings.
- **Per-app accent preserved.** ExportMenu's primary button uses `var(--accent-500)`, not hardcoded teal.
- **§4 preliminary-save canon** applied: the duplicate edit page shows the dashed gold notice "لم يتم الحفظ بعد" until user explicitly saves.

---

## 10 · Acceptance Criteria

- [ ] `docs/LIST_ACTIONS_INVENTORY.md` exists; every admin list page documented with action support + rationale.
- [ ] `ListActions` primitive renders three buttons based on config; omits any disabled.
- [ ] Export downloads UTF-8 CSV (or XLSX if dep present) of the current filtered view; BOM included for Excel.
- [ ] Export "filtered vs all" toggle works; default is filtered.
- [ ] Import shows preview dialog with per-row validation; commits only on explicit confirm.
- [ ] Import surfaces failed rows with downloadable error report.
- [ ] Duplicate creates new row with `-نسخة` suffix, opens in edit mode (not detail), doesn't commit until save.
- [ ] Soft-delete row cannot be duplicated; error toast.
- [ ] Import row matching soft-deleted unique key prompts restore-or-create.
- [ ] Every action emits audit via `withAudit` (export, import, duplicate).
- [ ] RBAC permissions added: `{entity}:export`, `{entity}:import`, `{entity}:duplicate`. Defaults flow from existing `:read` and `:write`.
- [ ] Cannot duplicate cycle into state that violates `ACTIVE_CYCLE_EXISTS`.
- [ ] `INTEGRATION CONTRACT` JSDoc on every new service method.
- [ ] No `any`, no default exports.
- [ ] `npm run typecheck` and `npm run build` clean.
- [ ] All four `grep` violation checks return zero.
- [ ] `docs/INTEGRATION_HANDOFF.md` §2 updated with new `bulkImport` and `createFromTemplate` methods per service.
- [ ] Adding actions to a 17th list = single config entry on that list's page; no `ListActions`/`DataTable` changes.

---

## 11 · Final Verification Checklist

Run before declaring done:

- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — clean.
- [ ] `npm run lint` — clean (or note absence).
- [ ] All four grep violation checks return zero.
- [ ] Click-through each app's flagship list (code inspection sufficient; full manual UX testing on demo cut):
  - [ ] `/admin/users` — all three actions visible and functional.
  - [ ] `/admin/cycles` — export ✓, duplicate ✓ (no import).
  - [ ] `/admin/reference-data/governorates` — export + import (no duplicate).
  - [ ] `/admin/audit` — export only.
  - [ ] `/admin/applicants` — export only.
  - [ ] `/question-bank/manage` — all three.
- [ ] Export round-trip: export a list, re-import the same file, confirm zero failed rows.
- [ ] Duplicate workflow: duplicate a cycle, verify it's in draft, verify ACTIVE_CYCLE_EXISTS not violated.
- [ ] Audit trail (`/admin/audit`) shows entries for each test export, import, duplicate.
- [ ] `docs/INTEGRATION_HANDOFF.md` §2 row added per new service method.

---

## 12 · Closeout

After all acceptance criteria pass:

1. Tag: `git tag list-actions-shipped`.
2. Push tags if origin exists.
3. Append a section to `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md` titled "Universal Import / Export / Duplicate (post-closeout enhancement)" with: inventory summary, primitives shipped, per-entity service-method additions, commit list.
4. Append to `docs/INTEGRATION_HANDOFF.md` §8 (open questions): "Bulk-import error retry strategy — should backend support partial commits with a retry token, or are imports atomic? Affects ImportPreviewTable's 'import valid only' affordance."
5. Report final summary: phases shipped, commits, files touched, validation status, tag.

---

## 13 · Stopping Conditions

Stop and ask only if:

- More than 20 list pages surface in Phase 1 inventory and the action-applicability matrix is genuinely unclear for >3 of them — surface the inventory and let the user resolve before primitives ship.
- An entity's duplicate semantics are ambiguous (e.g. does duplicating a cycle clone scheduled exams? assigned committees? draft applicants?) — surface; don't pick silently.
- Existing `DataTable` toolbar slot can't accept new children without a significant refactor — surface; refactor is a separate workstream.
- More than 5 entities need brand-new `bulkImport` service methods with no analog in mock data — surface; that's a domain-modeling conversation.
- `xlsx` is not in `package.json` and >3 entity owners would benefit — surface; user decides whether to add the dep.
- Adding `*:export` / `*:import` / `*:duplicate` permissions to `rbac.ts` requires modifying Gap C's role definitions in a way that conflicts with shipped seed data.

Otherwise: ship phase by phase.

---

**Begin Phase 1 inventory now. Post the inventory table to `docs/LIST_ACTIONS_INVENTORY.md` before writing any primitives.**
