# Contract — Admission Cycles

**Story**: [User Story 2](../spec.md#user-story-2--manage-admission-cycles-priority-p1) (P1) | **FRs**: FR-Y01 – FR-Y07

> Cycles drive every applicant cohort. Status enum: `Draft → Active → Closed → Archived`, no skips, no reverses. At most one `Active` per `(year, cohort)` pair (FR-Y02 clarification).

---

## Endpoints

### Public read

#### `GET /cycles`

Query: `?status=Active|Closed`. Default returns `Active + Closed`. `Draft` and `Archived` are filtered out for non-super-admins. Returns `200` with `CycleListItemDto[]` + pagination headers.

### Admin

#### `GET /admin/cycles`

Query: `?status=...`, `?year=...`, `?cohort=...`, `?includeArchived=true`. Returns all rows including Draft/Archived.

#### `GET /admin/cycles/{id}` → `200 CycleDetailDto`

#### `POST /admin/cycles`

Body: `CreateCycleRequest`. Returns `201 CycleDetailDto` in `Draft` status with empty `OpenCategories` and `ConditionOverrides` maps.

#### `PATCH /admin/cycles/{id}`

Body: `UpdateCycleRequest`. Patches `nameAr`, `openDate`, `closeDate`, `expectedCapacity`, `openCategories`, `conditionOverrides`. **Status is not patchable through this endpoint** — use the dedicated transition endpoint.

#### `POST /admin/cycles/{id}/status`

Body: `TransitionCycleStatusRequest { CycleStatus newStatus }`. Wraps in `IsolationLevel.Serializable` to enforce FR-Y02 single-active invariant atomically. See errors below.

#### `DELETE /admin/cycles/{id}`

Hard-delete only when `Status=Draft` AND zero applicants attached. Otherwise `422 CYCLE_HAS_APPLICANTS`. The supported "delete" path for any non-Draft cycle is the `Closed → Archived` transition.

---

## DTOs

### `CycleListItemDto`

```csharp
public record CycleListItemDto(
    Guid Id,
    string NameAr,
    int Year,
    string Cohort,           // "male" | "female"
    CycleStatus Status,
    DateTime OpenDate,
    DateTime CloseDate,
    int ExpectedCapacity,
    int ApplicantCount);     // computed
```

### `CycleDetailDto`

Extends `CycleListItemDto` with:

```csharp
public record CycleDetailDto(
    // ...all fields above...
    Dictionary<string, OpenCategoryEntryDto> OpenCategories,
    Dictionary<string, JsonElement>          ConditionOverrides,
    DateTime CreatedAt,
    DateTime? ArchivedAt);

public record OpenCategoryEntryDto(bool IsOpen, int? Capacity, string? Notes);
```

### `CreateCycleRequest`

```csharp
public record CreateCycleRequest(
    string NameAr,                       // required
    int Year,                            // FluentValidator: ≥ 2024
    string Cohort,                       // "male" | "female"
    DateTime OpenDate,                   // < CloseDate
    DateTime CloseDate,
    int ExpectedCapacity);               // > 0
```

### `UpdateCycleRequest`

```csharp
public record UpdateCycleRequest(
    string? NameAr,
    DateTime? OpenDate,
    DateTime? CloseDate,
    int? ExpectedCapacity,
    Dictionary<string, OpenCategoryEntryDto>? OpenCategories,
    Dictionary<string, JsonElement>? ConditionOverrides);
```

### `TransitionCycleStatusRequest`

```csharp
public record TransitionCycleStatusRequest(CycleStatus NewStatus);
```

### `CycleListFilters`

```csharp
public record CycleListFilters(
    CycleStatus? Status,
    int? Year,
    string? Cohort,
    bool IncludeArchived,
    int Page = 1, int PageSize = 50);
```

---

## Error codes (this entity)

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_CYCLE_TRANSITION` | 422 | Skip-transition (Draft→Closed) or reverse-transition. |
| `OVERLAPPING_ACTIVE_CYCLE` | 422 | Activating a second cycle when one already Active for the same `(year, cohort)`. |
| `ACTIVATION_OUT_OF_WINDOW` | 422 | Activating a cycle where `openDate ≤ now ≤ closeDate` is false (FR-Y03). |
| `CYCLE_CLOSED` | 422 | Applicant submission against a Closed/Archived cycle. |
| `CYCLE_HAS_APPLICANTS` | 422 | Hard-delete attempt on a cycle with attached applicants. |

---

## Acceptance scenarios → endpoints

| Scenario | Endpoint |
|---|---|
| AC-1 (POST → Draft + audit) | `POST /admin/cycles` |
| AC-2 (Draft → Active with window + uniqueness) | `POST /admin/cycles/{id}/status` |
| AC-3 (Active → Closed; subsequent submission rejected) | `POST /admin/cycles/{id}/status` |
| AC-4 (PATCH `openCategories`; public picker reflects) | `PATCH /admin/cycles/{id}` + `GET /cycles` |
| AC-5 (DELETE with applicants → 422) | `DELETE /admin/cycles/{id}` |
| AC-6 (public sees only Active+Closed) | `GET /cycles` |
