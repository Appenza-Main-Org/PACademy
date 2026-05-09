# Phase 1 Data Model: Modular-Monolith Refactor (Phase 5)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

> Phase 5 does **not** introduce new entities; every type already exists. This document maps which `DbContext` owns each table after the carve, lists cross-module foreign keys (now bare `Guid` columns — see R0.5), and pins JSON column shapes that survived from spec 004.

---

## Per-context table ownership

The phase-5 cut places every existing table under exactly one `DbContext`. Migration history is partitioned per context (`__EFMigrationsHistory_<Module>`).

| `DbContext` | Tables owned | Migrations history | Carved from |
|---|---|---|---|
| `IdentityDbContext` | `system_users` (extends `AspNetUsers`), `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetRoleClaims`, `AspNetUserTokens`, `AspNetUserLogins`, `sessions` | `__EFMigrationsHistory_Identity` | `PACademy.Infrastructure/Persistence/PaDbContext` (auth + identity slice) |
| `AdmissionsDbContext` | `applicants`, `cycles`, `categories`, `admission_rules` | `__EFMigrationsHistory_Admissions` | `PaDbContext` (admissions slice) |
| `ReferenceDataDbContext` | `reference_data_entries` | `__EFMigrationsHistory_ReferenceData` | `PaDbContext` (lookups slice — single table) |
| `WorkflowsDbContext` | `workflows`, `workflow_stages` | `__EFMigrationsHistory_Workflows` | `PaDbContext` (workflows slice) |
| `AuditDbContext` (Shared) | `audit_entries` (with immutability trigger from spec 003) | `__EFMigrationsHistory_Audit` | `PaDbContext` (audit slice) |
| `PaDbContext` (legacy, shrunk) | `reports_*` snapshot tables (until phase 10) | `__EFMigrationsHistory_Legacy` (renamed) | unchanged — what's left after the carve |

---

## Per-module entity catalogue

### Modules.Identity

| Aggregate / Entity | Table | Notes |
|---|---|---|
| `SystemUser` (extends `IdentityUser<Guid>`) | `system_users` | NationalId (unique), OfficerCode, FullName, Mobile, Email, Unit, Role, IssueDate, CardFactoryNumber, IsActive, Archived, ArchivedAt, DemoOrigin |
| `Session` | `sessions` | Per-user session tracking (FR-A07 from spec 003 — unique active session, prior session revoked on login) |
| `Role` (AspNet Core Identity) | `AspNetRoles` etc. | Standard Identity tables |

**Public read surface** (`Identity.Public/IIdentityApi.cs`):

```csharp
public interface IIdentityApi
{
    Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default);
    Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default);
}
public sealed record CurrentUserDto(Guid Id, string FullName, string Role, IReadOnlyList<string> Apps);
```

### Modules.Admissions

| Aggregate / Entity | Table | JSON columns | Notes |
|---|---|---|---|
| `Applicant` | `applicants` | — | `CreatedByUserId : Guid` is a cross-module FK to `system_users.Id`, no DB constraint |
| `Cycle` | `cycles` | `OpenCategoriesJson`, `ConditionOverridesJson` | Spec 004 FR-Y04/Y05; `IX_cycles_year_cohort_active WHERE Status=Active` (unique partial — single Active per (year, cohort)) |
| `Category` | `categories` | `ConditionsJson`, `RequiredTestsJson`, `ProceduresJson` | 7 RFP keys — immutable. `IsSpec=true` for the 7 |
| `AdmissionRule` | `admission_rules` | `RulesJson` | Versioned per `(CycleId, Version)`; `IX_admission_rules_cycle_version` unique. PATCH/DELETE forbidden (FR-R01 spec 004) |

**Public read surface** (`Admissions.Public/IAdmissionsApi.cs`):

```csharp
public interface IAdmissionsApi
{
    Task<CycleSummaryDto?> GetActiveCycleAsync(CancellationToken ct = default);
    Task<CategorySummaryDto?> GetCategoryByKeyAsync(string key, CancellationToken ct = default);
}
public sealed record CycleSummaryDto(Guid Id, string NameAr, int Year, string Cohort, DateTime OpenDate, DateTime CloseDate);
public sealed record CategorySummaryDto(Guid Id, string Key, string NameAr, bool IsActive, bool IsSpec);
```

### Modules.ReferenceData

| Aggregate / Entity | Table | Notes |
|---|---|---|
| `ReferenceDataEntry` | `reference_data_entries` | 8 categories: governorate, specialization, rank, college, qualification, nationality, relationship, case-type. `(Category, Key)` unique among non-archived rows. Metadata column carries per-category extras (region for governorates, isoCode for nationalities, etc.) as JSON |

**Public read surface** (`ReferenceData.Public/IReferenceDataApi.cs`):

```csharp
public interface IReferenceDataApi
{
    Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(string category, CancellationToken ct = default);
    Task<ReferenceDataItemDto?> FindByKeyAsync(string category, string key, CancellationToken ct = default);
}
public sealed record ReferenceDataItemDto(Guid Id, string Category, string Key, string NameAr, string? NameEn, string? Metadata, int SortOrder, bool IsActive);
```

### Modules.Workflows

| Aggregate / Entity | Table | Notes |
|---|---|---|
| `Workflow` | `workflows` | `(CategoryKey, CycleId)` unique among `Status=Published` rows (`IX_workflows_categorykey_cycleid_published WHERE Status=Published`). Status enum: `Draft=1, Published=2, Archived=3` |
| `WorkflowStage` | `workflow_stages` | Child of Workflow. Unique on `(WorkflowId, Order)`. `Order` 1-based, contiguous (FR-W04 spec 004). `Kind` from `RequiredTestKind` enum |

**Public read surface** (`Workflows.Public/IWorkflowsApi.cs`):

```csharp
public interface IWorkflowsApi
{
    Task<WorkflowSummaryDto?> GetPublishedAsync(string categoryKey, Guid cycleId, CancellationToken ct = default);
    Task<bool> HasInflightApplicantsAsync(Guid workflowId, CancellationToken ct = default);
}
public sealed record WorkflowSummaryDto(
    Guid Id,
    string Name,
    string CategoryKey,
    Guid CycleId,
    IReadOnlyList<WorkflowStageSummaryDto> Stages);
public sealed record WorkflowStageSummaryDto(int Order, string Kind, string PassingCriteria);
```

### Shared.Audit

| Aggregate / Entity | Table | Notes |
|---|---|---|
| `AuditEntry` | `audit_entries` | Append-only via SQL trigger (UPDATE/DELETE blocked). Carry-over from spec 003 |

**Public write surface** (`Shared.Audit.Public/IAuditApi.cs`):

```csharp
public interface IAuditApi
{
    Task RecordAsync(
        AuditAction action,
        string targetType,
        Guid targetId,
        string targetLabel,
        AuditOutcome outcome,
        string? beforeJson,
        string? afterJson,
        CancellationToken ct = default);
}
public enum AuditAction { Login, Logout, Create, Update, Archive, Delete, View, Export }
public enum AuditOutcome { Success, ValidationFailed, PermissionDenied, NotFound, Conflict, ServerError }
```

---

## Cross-module foreign keys (bare `Guid`, no DB constraint — FR-D04, R0.5)

Every reference below is a `Guid` column with **no** EF navigation property and **no** DB-level `FOREIGN KEY` constraint. The relationship is enforced by the writing module's code path.

| Table.Column | References | Owning context | Referenced context | Enforcement |
|---|---|---|---|---|
| `applicants.CreatedByUserId` | `system_users.Id` | Admissions | Identity | App-layer (writer authenticated the user) |
| `applicants.CycleId` | `cycles.Id` | Admissions | Admissions | Same context — DB FK kept (`IX_applicants_cycle`) |
| `audit_entries.UserId` | `system_users.Id` | Audit | Identity | App-layer (writer authenticated the user) |
| `audit_entries.TargetId` | depends on `TargetType` | Audit | (varies) | App-layer (polymorphic; not enforceable as a single FK) |
| `cycles.CreatedBy` | `system_users.Id` | Admissions | Identity | App-layer |
| `categories.CreatedBy` | `system_users.Id` | Admissions | Identity | App-layer |
| `admission_rules.CycleId` | `cycles.Id` | Admissions | Admissions | Same context — DB FK kept |
| `admission_rules.ChangedById` | `system_users.Id` | Admissions | Identity | App-layer |
| `workflows.CategoryKey` | `categories.Key` | Workflows | Admissions | App-layer (Workflows publish use case calls `IAdmissionsApi.GetCategoryByKeyAsync` — see plan §A2) |
| `workflows.CycleId` | `cycles.Id` | Workflows | Admissions | App-layer (publish use case validates cycle exists/active) |
| `workflows.CreatedBy` | `system_users.Id` | Workflows | Identity | App-layer |
| `workflow_stages.WorkflowId` | `workflows.Id` | Workflows | Workflows | Same context — DB FK kept (cascade-delete child) |
| `reference_data_entries.CreatedBy` (if present) | `system_users.Id` | ReferenceData | Identity | App-layer |
| `sessions.UserId` | `system_users.Id` | Identity | Identity | Same context — DB FK kept |

**Same-context FKs** (e.g. `applicants.CycleId` → `cycles.Id` both in Admissions) keep DB-level constraints — those don't violate the cross-context rule.

**Cross-context FKs** become bare Guids — the constraint is a policy, not an `ALTER TABLE`.

---

## JSON column shapes (carry-over from spec 004)

These shapes were defined in spec 004 and survive the carve unchanged. Each lives in its module's domain:

### `cycles.OpenCategoriesJson` (Admissions)

```jsonc
{
  "officers_general":            { "isOpen": true,  "capacity": 200, "notes": "" },
  "officers_specialized":        { "isOpen": true,  "capacity":  50, "notes": "" },
  "postgraduate":                { "isOpen": false, "capacity":  null, "notes": "بالترشيح" },
  "institute_officers_training": { "isOpen": false, "capacity":  null, "notes": "" },
  "institute_traffic":           { "isOpen": false, "capacity":  null, "notes": "" },
  "institute_guarding":          { "isOpen": false, "capacity":  null, "notes": "" },
  "special_units":               { "isOpen": false, "capacity":  null, "notes": "" }
}
```

### `cycles.ConditionOverridesJson` (Admissions)

```jsonc
{
  "officers_general": { "minScorePercent": 85 }   // partial — only the fields to override
}
```

### `categories.ConditionsJson` (Admissions)

```jsonc
{
  "ageMin": 17, "ageMax": 22,
  "minScorePercent": 75,
  "requiredQualification": "thanaweya_amma",
  "gender": "male",
  "minHeightCm": 170,
  "medicalRequired": true,
  "maritalStatus": "single",
  "conductCheck": true,
  "egyptianNationalityRequired": true,
  "employerApprovalRequired": false,
  "nominationOnly": false,
  "freeText": ["مجموع مناسب في الثانوية العامة"]
}
```

### `categories.RequiredTestsJson` (Admissions)

```jsonc
[
  { "kind": "aptitude",      "order": 1, "passingCriteria": "" },
  { "kind": "posture",       "order": 2, "passingCriteria": "" },
  { "kind": "medical",       "order": 3, "passingCriteria": "" },
  { "kind": "physical",      "order": 4, "passingCriteria": "" },
  { "kind": "psychological", "order": 5, "passingCriteria": "" },
  { "kind": "interview",     "order": 6, "passingCriteria": "" },
  { "kind": "drug",          "order": 7, "passingCriteria": "" }
]
```

### `categories.ProceduresJson` (Admissions)

```jsonc
["تقديم الأوراق", "مقابلة شخصية", "مراجعة أمنية"]
```

### `admission_rules.RulesJson` (Admissions)

```jsonc
{
  "age":           { "minYears": 17, "maxYears": 22 },
  "height":        { "male":   { "min": 170, "max": 195 }, "female": { "min": 162, "max": 185 } },
  "bmi":           { "min": 19, "max": 28 },
  "eyesight":      { "minRightEye": "6/9", "minLeftEye": "6/9", "correctionAllowed": false },
  "maritalStatus": ["single"],
  "noCriminalRecord": true,
  "acceptedCertificates": ["ثانوية عامة", "ثانوية أزهرية"],
  "minPercentByCertType": { "ثانوية عامة": 75, "ثانوية أزهرية": 75 },
  "applicationFee":        { "ثانوية عامة": 1500, "ثانوية أزهرية": 1500 },
  "maxApplicationsPerYear": 1,
  "changedBy":             { "userId": "<guid>", "name": "..." }
}
```

### `reference_data_entries.Metadata` (ReferenceData)

Per-category JSON. Examples:

```jsonc
// governorate
{ "region": "delta" }

// specialization
{ "code": "POL-SCI", "facultyType": "military" }

// rank
{ "level": 4, "applicableTo": "officer" }

// nationality
{ "isoCode": "EG" }

// case-type
{ "severity": "high", "blocksApplication": true }
```

---

## Per-aggregate invariants (preserved from spec 004)

| Module | Invariant | Where enforced |
|---|---|---|
| Admissions | At most one `Cycle` with `Status=Active` per `(Year, Cohort)` | Unique partial index `IX_cycles_year_cohort_active WHERE Status=Active`; `TransitionCycleStatusUseCase` wraps in `IsolationLevel.Serializable` (spec 004 FR-Y02) |
| Admissions | Category key is one of the 7 RFP keys (immutable) | Validator + `Category.IsSpec=true` (FR-K01) |
| Admissions | Mid-cycle category condition edits require `confirmedAffectedCount` matching live in-flight applicants | `UpdateCategoryUseCase` Serializable check, throws `STALE_AFFECTED_COUNT` (FR-K03 spec 004) |
| Admissions | Admission rules are append-only per cycle (immutable versions) | `CreateAdmissionRuleUseCase` computes `Version = max + 1` under Serializable; controller PATCH/DELETE return 405 (FR-R01 spec 004) |
| Workflows | At most one `Workflow` with `Status=Published` per `(CategoryKey, CycleId)` | Unique partial index `IX_workflows_categorykey_cycleid_published WHERE Status=Published`; `PublishWorkflowUseCase` Serializable, single-context (FR-W02 spec 004; FR-W04 spec 005) |
| Workflows | Stage `Order` is 1-based, contiguous, no gaps | Validator + unique index on `(WorkflowId, Order)` (FR-W04 spec 004) |
| Identity | One active `Session` per user; new login revokes prior session | `LoginUseCase` `IsolationLevel.Serializable` (FR-A07 spec 003) |
| Audit | UPDATE/DELETE on `audit_entries` blocked at SQL level | Trigger created in `AuditDbContext`'s migration (carry-over from spec 003 `AuditImmutabilityTrigger`) |

---

## Migration history split (cutover)

After phase-5 merge, every `__EFMigrationsHistory_<Module>` table records the migrations its `DbContext` is responsible for. The **legacy** `__EFMigrationsHistory` table is dropped after a successful split.

| New history table | Migrations adopted from legacy | New phase-5 migration |
|---|---|---|
| `__EFMigrationsHistory_Identity` | `20260508121134_Initial` (Identity slice), `20260508121214_AuditImmutabilityTrigger` (the user-related parts) | `<timestamp>_InitialIdentitySnapshot` (no DDL — pure model snapshot relocation) |
| `__EFMigrationsHistory_Audit` | `20260508121214_AuditImmutabilityTrigger` (the audit-trigger part) | `<timestamp>_InitialAuditSnapshot` |
| `__EFMigrationsHistory_Admissions` | `20260509130659_004_LookupsCrudExtensions` (admissions slice), `20260509144412_004b_LookupsCrudCompleteSchema` (admissions slice) | `<timestamp>_InitialAdmissionsSnapshot` |
| `__EFMigrationsHistory_ReferenceData` | `20260509144412_004b_LookupsCrudCompleteSchema` (ref-data slice) | `<timestamp>_InitialReferenceDataSnapshot` |
| `__EFMigrationsHistory_Workflows` | `20260509144412_004b_LookupsCrudCompleteSchema` (workflows slice) | `<timestamp>_InitialWorkflowsSnapshot` |

Two of the legacy migrations (`AuditImmutabilityTrigger`, `004b_LookupsCrudCompleteSchema`) are referenced by **multiple** new histories. The cutover script is idempotent and inserts the same `MigrationId` into each relevant history table; the actual SQL DDL was applied once in the legacy history, so re-applying is not needed — just the bookkeeping rows.

After cutover, future migrations (e.g. adding a column to `applicants`) appear in exactly one history table.
