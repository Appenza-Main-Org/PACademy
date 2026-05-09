# Quickstart — Admin Lookups CRUD

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Tasks**: [tasks.md](./tasks.md)

> One-page operator's guide for the developer who picks up spec 004 the morning of T200. Five user stories, each ships the same backend → contracts → frontend slice. The slice is mechanical once Phase 2 (schema deltas) is live.

---

## Before you start

- Spec 003 (`003-admin-auth-rbac`) has merged to `dev`. The `Role:super_admin` policy and `IAuditWriter` are already wired (T143 + T142/T170 from spec 003).
- Spec 003 T196 (lint/format baseline) is closed — otherwise spec 004 will need `--no-verify` on every commit, blocking T285.
- You're on `dev` and have the latest pulled.

```powershell
git checkout dev; git pull
git checkout -b 004-lookups-crud      # T200
```

---

## Phase 2 first — schema deltas (T201–T210)

Phase 2 is **blocking**: no US1–US5 task may begin until Phase 2 lands. The five aggregate edits all go in one migration:

```powershell
# After editing the five domain entities (T201–T205):
dotnet ef migrations add 004_LookupsCrudExtensions `
  --project backend/src/PACademy.Infrastructure `
  --startup-project backend/src/PACademy.Api

# Verify the generated migration matches the SQL pseudocode in data-model.md.
dotnet ef database update `
  --project backend/src/PACademy.Infrastructure `
  --startup-project backend/src/PACademy.Api
```

Verify the new shape:

```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -d PACademy `
  -Q "SELECT name FROM sys.indexes WHERE name IN ('IX_cycles_year_cohort_active','IX_workflows_categorykey_cycleid_published','IX_admission_rules_cycle_version')"
```

Re-seed if needed:

```powershell
$env:SeedDemo = "true"
dotnet run --project backend/src/PACademy.Api
```

---

## The per-entity slice (US1 → US5)

Every story repeats the same pattern. Use US1 (Reference Data) as the reference implementation; it's the simplest and ships first.

### Backend slice (≈ 12 tasks per story)

1. **Tests first** (Constitution II — NON-NEGOTIABLE). Each story commits these *failing* tests before any production code:
   - `Admin/<Entity>/CrudTests.cs` — happy path
   - `Admin/<Entity>/ValidationTests.cs` — error codes + 422 paths
   - `Admin/<Entity>/RbacTests.cs` — non-super-admin gets 403
   - Story-specific: `TransitionTests.cs` (US2), `EligibilityIntegrationTests.cs` (US3), `ImmutabilityPropertyTests.cs` (US4), `PublishConcurrencyTests.cs` (US5)
2. **DTOs** in `Contracts/Admin/<Entity>/` — five files: `ListItem`, `Detail`, `Create<Request>`, `Update<Request>`, `<Filters>`. Some entities omit one (Categories has no `Create`; AdmissionRules has no `Update`).
3. **Validator** in `Application/Admin/<Entity>/` — FluentValidation. Arabic on display, English on `code`.
4. **Use cases** — typically `List`, `Get`, `Create`, `Update`, `Archive` (some stories add `TransitionStatus`, `Publish`).
5. **Controllers** — one `Admin*Controller` (super_admin policy) and one public `*Controller` (`[Authorize]` only). AdmissionRules has only the admin controller.
6. **DI registration** — add the new use cases + validator in `DependencyInjection.cs`.

### Frontend slice (≈ 3 tasks per story)

The integration is **mechanical and identical** for each of the five surfaces:

1. **Edit `frontend/src/features/admin/api/<entity>.service.ts`** — replace each method body with `apiClient.{verb}('/admin/<entity>...', ...)`. Keep the export shape (`*.list, .get, .create, .update, .archive, ...`) unchanged so consumers don't break.

   Before:
   ```ts
   async list(filters) {
     await simulateLatency();
     return paginate(MOCK.entities.filter(...), filters);
   }
   ```

   After:
   ```ts
   async list(filters) {
     return apiClient
       .get('/admin/<entity>', { params: filters })
       .then(r => ({ items: r.data, total: Number(r.headers['x-total-count']) }));
   }
   ```

2. **Edit `frontend/src/features/admin/api/<entity>.queries.ts`** — types update only if a DTO field shifted. Keep the `keys` factory unchanged.

3. **Edit pages** — replace `MOCK + simulateLatency()` references with the existing query hooks. Add the four async-state cases (`LoadingState` / `EmptyState` / `ErrorState` / data) per Constitution III. For mutations, add success toast + error toast + field-level error mapping for `code: *_TAKEN` / `*_IN_USE`.

---

## Story-by-story sanity check

After each story's tasks land, verify with these one-shot smoke tests (also covered by the Playwright specs):

| Story | Smoke check |
|---|---|
| **US1** — Reference data | Open `/admin/reference-data/case-types` → add row "قضية تموين" → reload → confirm it appears in `/investigations/create` case-type picker. |
| **US2** — Cycles | POST `/admin/cycles` for 2026-male `Draft` → PATCH `/admin/cycles/{id}/status` to `Active` → public `/applicant/start` lists it as selectable. |
| **US3** — Categories | PATCH `officers_general.minScorePercent = 85` with the correct `confirmedAffectedCount` from the impact preview → synthetic 84% applicant rejected at `/applicant/eligibility`. Stale count → 422. |
| **US4** — Admission rules | POST v2 for cycle 2026-M → `GET /admin/admission-rules?cycleId=...` lists v1 + v2 ordered by `effectiveAt DESC` → PATCH on v1 returns 405. |
| **US5** — Workflows | POST draft workflow with stages [aptitude, posture, medical, drug, physical, interview] → publish → previous `Published` for the same `(category, cycle)` is `Archived` in one transaction. |

---

## Common pitfalls

- **Forgetting the impact-preview round-trip in US3**. The SPA has to call `GET /admin/categories/{key}/impact?proposedConditions=<json>` to populate the modal **before** submitting the PATCH with `confirmedAffectedCount`. Stale count → 422 `STALE_AFFECTED_COUNT`. Plan a single mutation hook that owns both calls.
- **Publishing a workflow without wrapping the auto-archive in Serializable**. The 32-way concurrency test (T271) will catch it — but it's faster to read [plan.md R0.5](./plan.md#r05--public-read-endpoints-without-admin-prefix) and [tasks.md T276](./tasks.md) before writing.
- **Mock-data leftover imports** in admin pages. After the swap, `import { MOCK } from '@/shared/mock-data'` should be gone from every `features/admin/pages/*.tsx`. The `T286` bundle audit is the canary; check sooner than that.
- **Forgetting to register the new DI bindings**. Each story has a single DI task (T229, T243, T255, T267, T279) — easy to miss when you've already moved to the frontend slice.

---

## Done when

- All five user stories' Acceptance Scenarios pass via integration + Playwright tests.
- All eight Success Criteria from [spec.md §Success Criteria](./spec.md#success-criteria) are objectively measurable in CI logs.
- OpenAPI snapshots committed to `specs/004-lookups-crud/contracts/` (T281).
- CLAUDE.md §13 quick-reference table updated with the new endpoints and the swapped-from-mock status (T284).
- Pre-commit hook passes without `--no-verify` on the merge commit.
