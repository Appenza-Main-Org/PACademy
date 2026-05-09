# Contract — Workflows

**Story**: [User Story 5](../spec.md#user-story-5--manage-workflows-priority-p2) (P2) | **FRs**: FR-W01 – FR-W08

> A workflow is a `(name, categoryKey, cycleId, stages[])` tuple with a status: `Draft → Published → Archived`. At most one `Published` per `(categoryKey, cycleId)` pair (FR-W02 clarification). Publishing auto-archives the prior `Published` workflow scoped to the same `(categoryKey, cycleId)` in a single Serializable transaction.

---

## Endpoints

### Public read

#### `GET /workflows?categoryKey=...` → `200 WorkflowDetailDto`

Returns the `Published` workflow for the category in the active cycle. `Draft` and `Archived` are filtered out for non-super-admins.

### Admin

#### `GET /admin/workflows`

Query: `?categoryKey=...`, `?cycleId=...`, `?status=...`, `?includeArchived=true`. Returns `WorkflowListItemDto[]`.

#### `GET /admin/workflows/{id}` → `200 WorkflowDetailDto`

Includes all stages (eager-loaded via `Include(WorkflowStages)`).

#### `POST /admin/workflows`

Body: `CreateWorkflowRequest`. Returns `201 WorkflowDetailDto` in `Draft` status. The new workflow is **not** visible to applicants until published.

#### `PATCH /admin/workflows/{id}`

Body: `UpdateWorkflowRequest`. Patches `name` and stage order. **Stage reorder on a Published workflow with applicants mid-stage** → `422 WORKFLOW_IN_USE` (FR-W05); the only supported "reorder" path is to publish a new workflow version.

#### `POST /admin/workflows/{id}/publish` → `200 PublishWorkflowResponse`

Wraps in Serializable transaction:
1. SELECT current `Published` workflow for `(categoryKey, cycleId)`.
2. UPDATE that row to `Archived`.
3. UPDATE target row to `Published`.
4. Audit both transitions.

```csharp
public record PublishWorkflowResponse(
    Guid PublishedId,
    Guid? ArchivedId);   // prior Published, if any; null on first publish
```

The 32-way concurrency test (T271) verifies exactly one row ends `Published` under concurrent publish requests.

#### `POST /admin/workflows/{id}/archive` → `200`

Soft-delete via `Status=Archived, ArchivedAt=now`. Applicants mid-workflow continue against the archived definition (FR-W06).

**No DELETE endpoint** — hard-delete on `Draft` workflows with no applicants is permitted via the controller's `DELETE` handler (FR-W07), but the test plan does not exercise it; archive is the canonical path.

---

## DTOs

### `WorkflowListItemDto`

```csharp
public record WorkflowListItemDto(
    Guid Id,
    string Name,
    string CategoryKey,
    Guid CycleId,
    WorkflowStatus Status,
    int StageCount,
    DateTime UpdatedAt);
```

### `WorkflowDetailDto`

```csharp
public record WorkflowDetailDto(
    Guid Id,
    string Name,
    string CategoryKey,
    Guid CycleId,
    WorkflowStatus Status,
    WorkflowStageDto[] Stages,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? PublishedAt,
    DateTime? ArchivedAt,
    byte[] RowVersion);            // for optimistic concurrency on stage edits
```

### `WorkflowStageDto`

```csharp
public record WorkflowStageDto(
    Guid Id,
    int Order,                     // 1-based, contiguous
    string Kind,                   // RequiredTestKind enum
    string PassingCriteria);
```

### `CreateWorkflowRequest`

```csharp
public record CreateWorkflowRequest(
    string Name,                   // required
    string CategoryKey,            // 1 of 7 RFP keys
    Guid CycleId,
    StageInputDto[] Stages);       // contiguous 1-based ordering

public record StageInputDto(int Order, string Kind, string PassingCriteria);
```

### `UpdateWorkflowRequest`

```csharp
public record UpdateWorkflowRequest(
    string? Name,
    StageInputDto[]? Stages,
    byte[] RowVersion);            // required for optimistic concurrency
```

### `WorkflowListFilters`

```csharp
public record WorkflowListFilters(
    string? CategoryKey,
    Guid? CycleId,
    WorkflowStatus? Status,
    bool IncludeArchived,
    int Page = 1, int PageSize = 50);
```

---

## Error codes (this entity)

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_TEST_KIND` | 422 | `Stage.Kind` outside the canonical `RequiredTestKind` enum (FR-W03). |
| `STAGE_ORDER_GAP` | 422 | Stages do not form a contiguous 1-based sequence (FR-W04). |
| `WORKFLOW_IN_USE` | 422 | Stage reorder/removal attempted on a Published workflow with applicants mid-stage. |
| `INVALID_CATEGORY_KEY` | 422 | `categoryKey` outside the 7 RFP keys. |
| `WORKFLOW_VERSION_MISMATCH` | 409 | `RowVersion` mismatch on PATCH (concurrent edit). |

---

## Acceptance scenarios → endpoints

| Scenario | Endpoint |
|---|---|
| AC-1 (POST draft → 201, not visible to applicants) | `POST /admin/workflows` |
| AC-2 (publish auto-archives prior Published in same `(cat, cycle)`) | `POST /admin/workflows/{id}/publish` |
| AC-3 (reorder Published with applicants → 422) | `PATCH /admin/workflows/{id}` |
| AC-4 (invalid stage kind → 400) | `POST /admin/workflows` |
| AC-5 (archive succeeds; mid-flow applicants continue) | `POST /admin/workflows/{id}/archive` |
