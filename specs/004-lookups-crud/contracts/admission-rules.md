# Contract — Admission Rules (versioned, immutable)

**Story**: [User Story 4](../spec.md#user-story-4--manage-admission-rules-versioned-priority-p2) (P2) | **FRs**: FR-R01 – FR-R05

> Versioned per cycle. POST creates a new version; PATCH and DELETE on existing versions return `405 ADMISSION_RULES_IMMUTABLE`. The eligibility check locks the version at applicant creation — republishing v2 does not retroactively reject in-flight applicants.

---

## Endpoints

### Admin only (no public read endpoint)

The eligibility check uses the use case directly, not an HTTP endpoint.

#### `GET /admin/admission-rules?cycleId=...` → `200 AdmissionRuleListItemDto[]`

Lists all versions for a cycle, ordered by `effectiveAt DESC` (FR-R05). The optional `?version=N` filter is super-admin only and used for audit trails.

#### `GET /admin/admission-rules/{id}` → `200 AdmissionRuleDetailDto`

Single version by id.

#### `POST /admin/admission-rules`

Body: `CreateAdmissionRuleRequest`. Computes `Version = (max version for cycle) + 1` inside `IsolationLevel.Serializable` to prevent concurrent v2 publishes. Sets `EffectiveAt = UtcNow`, `ChangedById = currentUser.Id`. Returns `201 AdmissionRuleDetailDto`.

#### `PATCH /admin/admission-rules/{id}` → `405 ADMISSION_RULES_IMMUTABLE`

Documented deliberate 405. Global exception middleware passes the response through.

#### `DELETE /admin/admission-rules/{id}` → `405 ADMISSION_RULES_IMMUTABLE`

Same as PATCH.

---

## DTOs

### `AdmissionRuleListItemDto`

```csharp
public record AdmissionRuleListItemDto(
    Guid Id,
    Guid CycleId,
    int Version,
    DateTime EffectiveAt,
    Guid? ChangedById,
    string? ChangedByLabel);
```

### `AdmissionRuleDetailDto`

Extends list-item with the full rule body:

```csharp
public record AdmissionRuleDetailDto(
    Guid Id,
    Guid CycleId,
    int Version,
    DateTime EffectiveAt,
    Guid? ChangedById,
    string? ChangedByLabel,
    AgeRangeDto Age,
    HeightByGenderDto Height,
    BmiRangeDto Bmi,
    EyesightRequirementDto Eyesight,
    string[] MaritalStatus,
    bool NoCriminalRecord,
    string[] AcceptedCertificates,
    Dictionary<string, int> MinPercentByCertType,
    Dictionary<string, decimal> ApplicationFeeByCertType,
    int MaxApplicationsPerYear);

public record AgeRangeDto(int Min, int Max);
public record HeightByGenderDto(HeightRangeDto Male, HeightRangeDto Female);
public record HeightRangeDto(int Min, int Max);
public record BmiRangeDto(decimal Min, decimal Max);
public record EyesightRequirementDto(decimal MinAcuity, bool ColorVisionRequired);
```

### `CreateAdmissionRuleRequest`

Same body shape as `AdmissionRuleDetailDto` minus the server-controlled fields (`Id`, `Version`, `EffectiveAt`, `ChangedById`). The validator enforces:

- `Age.Min ≤ Age.Max`
- `Bmi.Min ≤ Bmi.Max`
- For each gender: `Height.{gender}.Min ≤ Height.{gender}.Max`
- `ApplicationFeeByCertType[k] ≥ 0` for all `k`
- `MaxApplicationsPerYear ≥ 1`
- `AcceptedCertificates.Length ≥ 1`

### No `Update` or `Delete` DTO

Per FR-R01, the only mutation path is "POST a new version."

---

## Error codes (this entity)

| Code | HTTP | Trigger |
|---|---|---|
| `ADMISSION_RULES_IMMUTABLE` | 405 | PATCH or DELETE on an existing version. |
| `INVALID_RULE_RANGE` | 400 | Validator-level range failures (age, BMI, height per gender). |
| `INVALID_FEE` | 400 | Negative fee in `ApplicationFeeByCertType`. |

---

## Versioning + eligibility lock invariants

- **`Version` is per-`CycleId`**, monotonically increasing, enforced by the unique index `IX_admission_rules_cycle_version` (data-model.md §1).
- **Eligibility lock**: an applicant snapshots the rule version that is current at `CreatedAt`. The eligibility check uses that snapshot — publishing v2 does **not** retroactively reject in-flight applicants. The applicant-side snapshot column is the subject of a future spec (spec 005); for the duration of spec 004, the eligibility check reads "the version with the largest `EffectiveAt ≤ Applicant.CreatedAt`" from `admission_rules`.
- **SC-R01 verification**: T259 property test runs 1000 randomized PATCH/DELETE attempts against existing versions. All must return 405. Tagged `[Trait("Category","Heavy")]`.

---

## Acceptance scenarios → endpoints

| Scenario | Endpoint |
|---|---|
| AC-1 (POST v2 → 201, v1 unchanged) | `POST /admin/admission-rules` |
| AC-2 (PATCH/DELETE existing → 405) | `PATCH /admin/admission-rules/{id}`, `DELETE /admin/admission-rules/{id}` |
| AC-3 (in-flight applicant uses locked version) | (eligibility use case, not HTTP) |
| AC-4 (validator-level range errors → 400) | `POST /admin/admission-rules` |
| AC-5 (list ordered desc by effectiveAt) | `GET /admin/admission-rules?cycleId=...` |
