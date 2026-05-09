# Contract — Reference Data

**Story**: [User Story 1](../spec.md#user-story-1--manage-reference-data-dictionaries-priority-p1--mvp) (P1, MVP) | **FRs**: FR-L01 – FR-L08

> Eight reference categories: `governorate`, `specialization`, `rank`, `college`, `qualification`, `nationality`, `relationship`, `case-type`. Read access is broader than write — any authenticated user can GET; only super_admin can mutate.

---

## Endpoints

### Public read (any authenticated user — FR-L08)

#### `GET /reference-data`

Query parameters:

| Name | Type | Required | Notes |
|---|---|---|---|
| `category` | string | yes | One of the 8 categories. |
| `page` | int | no | default 1 |
| `pageSize` | int | no | default 50, max 200 |
| `sortBy` | string | no | `sortOrder` \| `nameAr` |
| `sortDir` | string | no | `asc` \| `desc` |

Returns `200` with `ReferenceDataListItemDto[]`, plus headers `X-Total-Count`, `X-Page-Count`. Archived rows are filtered out.

### Admin (super_admin only)

#### `GET /admin/reference-data`

Same query shape as the public read, plus `?includeArchived=true` to include soft-deleted rows. Returns `ReferenceDataListItemDto[]`.

#### `GET /admin/reference-data/{id}`

Returns `200` with `ReferenceDataDetailDto`. `404` if no row.

#### `POST /admin/reference-data`

Body: `CreateReferenceDataRequest`. Returns `201` with `ReferenceDataDetailDto` and `Location: /admin/reference-data/{id}`. Duplicate `(category, key)` → `422 REFERENCE_KEY_TAKEN`. Unknown category → `400`. Missing `nameAr` → `400` with Arabic message.

#### `PATCH /admin/reference-data/{id}`

Body: `UpdateReferenceDataRequest` (all fields optional). Returns `200` with the updated DTO. `Category` and `Key` are immutable post-creation.

#### `POST /admin/reference-data/{id}/archive`

Soft-delete. Returns `204`. If any FK references exist → `422 REFERENCE_IN_USE` and the row is not archived.

---

## DTOs

### `ReferenceDataListItemDto`

```csharp
public record ReferenceDataListItemDto(
    Guid Id,
    string Category,        // 8 enum values
    string Key,             // ^[a-z0-9_-]+$
    string NameAr,
    string? NameEn,
    int SortOrder,
    bool IsActive,
    bool Archived);
```

### `ReferenceDataDetailDto`

Adds `Metadata?` (raw JSON), `CreatedAt`, `ArchivedAt?`, `DemoOrigin`.

### `CreateReferenceDataRequest`

```csharp
public record CreateReferenceDataRequest(
    string Category,        // FluentValidator: in the 8 enum values
    string Key,             // FluentValidator: ^[a-z0-9_-]+$
    string NameAr,          // required, ≤ 200
    string? NameEn,         // ≤ 200
    JsonElement? Metadata,  // optional
    int? SortOrder);        // server defaults to max + 1 if null
```

### `UpdateReferenceDataRequest`

```csharp
public record UpdateReferenceDataRequest(
    string? NameAr,
    string? NameEn,
    JsonElement? Metadata,
    int? SortOrder,
    bool? IsActive);
```

`Category` and `Key` are not patchable.

### `ReferenceDataListFilters`

```csharp
public record ReferenceDataListFilters(
    string? Category,
    bool? IsActive,
    bool IncludeArchived,
    int Page = 1,
    int PageSize = 50,
    string? SortBy = null,
    string? SortDir = null);
```

---

## Error codes (this entity)

| Code | HTTP | Trigger |
|---|---|---|
| `REFERENCE_KEY_TAKEN` | 422 | POST with `(category, key)` that already exists on an active row. |
| `REFERENCE_IN_USE` | 422 | Archive blocked because the row is FK-referenced by another aggregate. |
| `INVALID_CATEGORY` | 400 | Category outside the 8-enum. |

---

## Acceptance scenarios → endpoints

| Scenario | Endpoint |
|---|---|
| AC-1 (paginated 27 governorates with headers) | `GET /admin/reference-data?category=governorate` |
| AC-2 (POST + audit) | `POST /admin/reference-data` |
| AC-3 (duplicate key 422) | `POST /admin/reference-data` |
| AC-4 (invalid category 400) | `POST /admin/reference-data` |
| AC-5 (archive in-use 422) | `POST /admin/reference-data/{id}/archive` |
| AC-6 (non-super-admin 403) | Any `/admin/reference-data` write |
| AC-7 (any auth user can GET public) | `GET /reference-data?category=...` |
