# Phase 1 Quickstart: Modular-Monolith Refactor (Phase 5)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/)

> Operator's guide for executing phase 5. Each section answers: "I just sat down at my workstation — what do I do next?" Tasks T300–T371 in [tasks.md](./tasks.md) are the canonical breakdown; this file is the human-friendly index.

---

## Prereqs

- `.NET 10` SDK installed (`dotnet --version` ≥ 10.0)
- Docker running (for the `pacademy-sql` SQL Server container)
- `dotnet ef` tool (`dotnet tool install --global dotnet-ef`)
- Repo at `D:\Projects Appenza\PACademy` (Windows / PowerShell paths used in examples)
- Spec 003 + spec 004 merged to `dev`. Verify: `git log --oneline dev | grep -E "spec: 003|spec: 004"`

---

## Day 0 — branch + scaffold (T300–T306)

```pwsh
# 1. Branch
git checkout dev
git pull
git checkout -b 005-modular-monolith

# 2. Scaffold the directory layout (T301)
$base = "backend/src"
$dirs = @(
    "$base/Shared/PACademy.Shared.Contracts",
    "$base/Shared/Audit/PACademy.Shared.Audit.Domain",
    "$base/Shared/Audit/PACademy.Shared.Audit.Application",
    "$base/Shared/Audit/PACademy.Shared.Audit.Infrastructure",
    "$base/Shared/Audit/PACademy.Shared.Audit.Public",
    "$base/Modules/Identity/PACademy.Modules.Identity.Domain",
    "$base/Modules/Identity/PACademy.Modules.Identity.Application",
    "$base/Modules/Identity/PACademy.Modules.Identity.Infrastructure",
    "$base/Modules/Identity/PACademy.Modules.Identity.Public",
    "$base/Modules/Admissions/PACademy.Modules.Admissions.Domain",
    "$base/Modules/Admissions/PACademy.Modules.Admissions.Application",
    "$base/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure",
    "$base/Modules/Admissions/PACademy.Modules.Admissions.Public",
    "$base/Modules/ReferenceData/PACademy.Modules.ReferenceData.Domain",
    "$base/Modules/ReferenceData/PACademy.Modules.ReferenceData.Application",
    "$base/Modules/ReferenceData/PACademy.Modules.ReferenceData.Infrastructure",
    "$base/Modules/ReferenceData/PACademy.Modules.ReferenceData.Public",
    "$base/Modules/Workflows/PACademy.Modules.Workflows.Domain",
    "$base/Modules/Workflows/PACademy.Modules.Workflows.Application",
    "$base/Modules/Workflows/PACademy.Modules.Workflows.Infrastructure",
    "$base/Modules/Workflows/PACademy.Modules.Workflows.Public"
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }

# 3. Add csprojs (T301–T302)
foreach ($d in $dirs) {
    $name = (Split-Path $d -Leaf)
    & dotnet new classlib -o $d -n $name --framework net10.0 --force
}

# 4. Add to solution (T302)
foreach ($d in $dirs) {
    $name = (Split-Path $d -Leaf)
    & dotnet sln backend/PACademy.slnx add "$d/$name.csproj"
}

# 5. Wire project references per T303 — see tasks.md for the exact list per project

# 6. Green checkpoint (T306)
dotnet build backend/PACademy.slnx
```

If `dotnet build` is green, you're ready to start moving types. If it fails, the most likely cause is a missing reference in T303.

---

## Day 1 — `Shared.Contracts` foundation (T307–T309)

Move 3 things and you're done with the foundation:

```pwsh
# 1. PagedResult<T>
git mv backend/src/PACademy.Contracts/Common/PagedResult.cs `
       backend/src/Shared/PACademy.Shared.Contracts/PagedResult.cs

# 2. ApiError
git mv backend/src/PACademy.Contracts/ApiError.cs `
       backend/src/Shared/PACademy.Shared.Contracts/ApiError.cs

# 3. Add the new ErrorCodes class (no source to move — write fresh per contracts/error-codes.md)
# (See contracts/error-codes.md for the full file.)
```

Update `using` statements across the solution: replace `PACademy.Contracts.Common` with `PACademy.Shared.Contracts`. Find/sed:

```pwsh
Get-ChildItem -Path backend/src,backend/tests -Recurse -Filter *.cs |
    ForEach-Object {
        (Get-Content $_.FullName) -replace 'PACademy\.Contracts\.Common', 'PACademy.Shared.Contracts' |
            Set-Content $_.FullName
    }
dotnet build backend/PACademy.slnx
```

---

## Day 2 — Shared.Audit (T310–T318)

> Audit ports first because Identity's login flow writes audit rows.

```pwsh
# 1. Move AuditEntry aggregate + IAuditableWrite + AuditAction enum
git mv backend/src/PACademy.Domain/Audit/* `
       backend/src/Shared/Audit/PACademy.Shared.Audit.Domain/

# 2. Move IAuditWriter -> rename to AuditApi (impl of IAuditApi)
git mv backend/src/PACademy.Infrastructure/Audit/AuditWriter.cs `
       backend/src/Shared/Audit/PACademy.Shared.Audit.Application/AuditApi.cs
# Edit the file: rename class, implement IAuditApi (which has same signature as IAuditWriter)

# 3. Create AuditDbContext + the immutability trigger migration
# See tasks.md T315–T317 for the full file content.

# 4. Generate migration
dotnet ef migrations add InitialAuditSnapshot `
    --context AuditDbContext `
    --project backend/src/Shared/Audit/PACademy.Shared.Audit.Infrastructure `
    --startup-project backend/src/PACademy.Api

# 5. Wire AddAuditModule(...) into Program.cs FIRST (other modules depend on it)
```

Verify with the existing audit tests:

```pwsh
dotnet test --filter "FullyQualifiedName~Audit"
```

---

## Day 3 — Identity (T319–T328)

> Identity ports next because every other module reads the current user.

Same pattern as Audit:
1. Move Domain types (`SystemUser`, `Session`, `Role`)
2. Move Application use cases (`Login`, `Logout`, `GetMe`, `Admin/Users/*`)
3. Move Infrastructure (`IdentityDbContext`, AspNet Identity wiring, `InSystemIdentityProvider`)
4. Define `IIdentityApi` per [contracts/identity-api.md](./contracts/identity-api.md)
5. `AddIdentityModule(...)` in Program.cs (after Audit)
6. Generate `InitialIdentitySnapshot` migration
7. Run the existing Login + Admin/Users tests

---

## Day 4 — ReferenceData and Workflows (T329–T339k)

> Sibling modules; can run in parallel if you have two contributors.

Same pattern. Skim [contracts/reference-data-api.md](./contracts/reference-data-api.md) and [contracts/workflows-api.md](./contracts/workflows-api.md) for the public-API shapes.

---

## Day 5 — Admissions (T340–T355)

> Last to port; consumes everything.

Most mechanical of the five module ports because:
- Domain types are largest but well-defined (`Applicant`, `Cycle`, `Category`, `AdmissionRule`)
- Use cases get a refactor pass: every `ICurrentUser` injection becomes `IIdentityApi`, every direct `db.ReferenceDataEntries` query becomes `IReferenceDataApi.ListByCategoryAsync(...)`, every direct `db.Workflows` query becomes `IWorkflowsApi.GetPublishedAsync(...)`.
- The `CrossModuleUnitOfWork` exercise: any admin write that emits an audit row now opens a UoW.

Run the spec-004 admin smoke (`Admin/Cycles/CrudTests`, etc.) — green = done.

---

## Day 6 — verification + migration cutover + seeders (T356–T369)

```pwsh
# 1. Architecture tests — they should already pass at this point
dotnet test backend/tests/PACademy.Architecture.Tests

# 2. Drop & recreate the dev DB to test the per-context update flow
dotnet ef database drop --force `
    --project backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure `
    --startup-project backend/src/PACademy.Api

# 3. Update each context (any order — verify SC-X01)
$contexts = "AuditDbContext","IdentityDbContext","ReferenceDataDbContext","WorkflowsDbContext","AdmissionsDbContext"
foreach ($ctx in $contexts) {
    dotnet ef database update --context $ctx `
        --project backend/src/Modules/$($ctx.Replace('DbContext','')) `
        --startup-project backend/src/PACademy.Api
    # Note: actual project paths differ per module — see tasks.md
}

# 4. Start API with --seed-demo and verify same row counts as phase 4
$env:ASPNETCORE_ENVIRONMENT = "Development"
backend/src/PACademy.Api/bin/Debug/net10.0/PACademy.Api.exe --seed-demo
# Expect: 240 applicants / 11 system users / 80 audit rows / 105 ref rows / 7 categories / 4 cycles / 1 admission rule

# 5. Smoke-test the SPA
npm --prefix frontend run dev
# log in as super_admin / SuperAdmin123! → click through /admin/cycles, /admin/categories,
# /admin/admission-rules, /admin/reference-data/* and confirm responses match phase 4
```

---

## Cleanup (T370–T371)

```pwsh
# 1. Delete now-empty legacy directories
git rm -r backend/src/PACademy.Domain/Audit
git rm -r backend/src/PACademy.Domain/Users
git rm -r backend/src/PACademy.Domain/Cycles
# ... etc per T370

# 2. Format + test
dotnet format backend/PACademy.slnx --verify-no-changes
dotnet test backend/PACademy.slnx

# 3. Update CLAUDE.md §3 with the new project tree
# 4. Open PR — title: "spec: 005 modular-monolith refactor"
```

---

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| `dotnet ef migrations has-pending-model-changes` reports changes after a clean port | The legacy `PaDbContext` still holds entity configurations for moved types | Remove the configurations from `PaDbContext.OnModelCreating` |
| Architecture test fails with "Admissions.Application depends on Identity.Infrastructure" | A use case still injects a concrete `InSystemIdentityProvider` (or similar) | Replace with `IIdentityApi` injection |
| `CrossModuleUnitOfWork` test fails with "transaction has been disposed" | The use case is using the DI-injected `DbContext` instead of `uow.Use<T>()` | Per FR-D07 — use cases that participate in a UoW MUST call `uow.Use<T>()`; they don't get the scoped instance from DI |
| `dotnet ef database update --context AdmissionsDbContext` errors with "table already exists" | Cutover script ran but left a phantom legacy migration | Verify `__EFMigrationsHistory_Admissions` was populated by the cutover; if not, run the SQL script manually |
| Frontend reports unknown error codes | A new code was added to `ErrorCodes.cs` without updating `frontend/src/shared/api/errors.ts` | Coordinate the frontend mapping update in the same PR (per [contracts/error-codes.md](./contracts/error-codes.md) versioning policy) |

---

## When to roll back

If the carve doesn't compile after Day 5 and the path forward isn't clear within 2 hours, `git reset --hard` to the last green build (likely Day 4 checkpoint). The work is layered — losing one day of porting is cheaper than fighting a half-broken Day 5 commit.

If the dev DB cutover (`005_split_migration_history.sql`) corrupts the local DB, drop and recreate via the dev path:

```pwsh
dotnet ef database drop --force --project backend/src/PACademy.Api
foreach ($ctx in $contexts) {
    dotnet ef database update --context $ctx --project ... --startup-project backend/src/PACademy.Api
}
```

The cutover script is for migrating an existing DB; on a fresh DB the per-context migrations create the tables directly with no need to populate the historical history.
