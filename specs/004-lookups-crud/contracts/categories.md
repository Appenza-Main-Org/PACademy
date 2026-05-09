# Contract — Applicant Categories

**Story**: [User Story 3](../spec.md#user-story-3--manage-applicant-categories-priority-p1) (P1) | **FRs**: FR-K01 – FR-K06

> Seven RFP-defined keys, immutable. Super_admin can edit conditions, required tests, and procedures — but not invent new categories. Mid-cycle edits apply to **all** applicants (in-flight + new), gated by a stale-count-protected risk-confirmation flow (FR-K03 clarification).

---

## Endpoints

### Public read

#### `GET /categories` → `200 CategoryListItemDto[]`

Returns all open categories (read-only shape consumed by the public picker). Auth: `[Authorize]`.

### Admin

#### `GET /admin/categories` → `200 CategoryDetailDto[]`

All seven categories with full conditions + required-test definitions.

#### `GET /admin/categories/{key}` → `200 CategoryDetailDto`

Single category by key. `404` only if the key is outside the seven (defensive — should be impossible by FR-K01).

#### `GET /admin/categories/{key}/impact?proposedConditions={json}` → `200 CategoryConditionImpactDto`

**Pre-flight for the FR-K03 risk-confirmation modal.** Computes (a) the number of in-flight applicants currently in this category for any active cycle, and (b) the specific condition fields that would change between the current `Conditions` and the proposed JSON. The SPA uses this response to populate the modal **before** calling PATCH.

```csharp
public record CategoryConditionImpactDto(
    int InFlightApplicantCount,
    string[] FieldsChanging);
```

#### `PATCH /admin/categories/{key}`

Body: `UpdateCategoryRequest`. Validates `confirmedAffectedCount` against the live count under `IsolationLevel.Serializable`; mismatch → `422 STALE_AFFECTED_COUNT`. On success, writes audit `{ confirmed: true, affectedApplicantCount: N, fieldsChanged: [...] }` plus the before/after JSON diff.

**No `POST` and no `DELETE` on this entity** — keys are immutable per FR-K01, K04.

---

## DTOs

### `CategoryListItemDto`

```csharp
public record CategoryListItemDto(
    string Key,              // 1 of 7 RFP keys
    string NameAr,
    string DescriptionAr,
    bool IsAccepting);       // computed: any active cycle has this category open
```

### `CategoryDetailDto`

```csharp
public record CategoryDetailDto(
    string Key,
    string NameAr,
    string DescriptionAr,
    CategoryConditionDto Conditions,
    RequiredTestDto[] RequiredTests,
    ProcedureDto[] Procedures,
    DateTime UpdatedAt);
```

### `CategoryConditionDto`

```csharp
public record CategoryConditionDto(
    int? AgeMin,
    int? AgeMax,
    string? Gender,                  // "male" | "female" | "any"
    int? MinScorePercent,            // [0, 100]
    string? RequiredQualification,
    HeightRangeDto? HeightCm,
    string[]? MaritalStatus,
    bool? NoCriminalRecord,
    string[]? Nationality,
    bool? EmployerApprovalRequired,
    bool? NominationOnly,
    string[]? FreeText);

public record HeightRangeDto(int Min, int Max);
```

### `RequiredTestDto`

```csharp
public record RequiredTestDto(
    string Kind,                     // RequiredTestKind enum
    int Order,
    string PassingCriteria);
```

### `UpdateCategoryRequest`

```csharp
public record UpdateCategoryRequest(
    CategoryConditionDto? Conditions,
    RequiredTestDto[]? RequiredTests,
    ProcedureDto[]? Procedures,
    int ConfirmedAffectedCount);     // FR-K03 — required, validated against live count
```

---

## Error codes (this entity)

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_CATEGORY_KEY` | 422 | POST attempted (defensive — controller has no POST) or PATCH against an unknown key. |
| `STALE_AFFECTED_COUNT` | 422 | PATCH's `confirmedAffectedCount` does not match the live count. SPA must re-call `/impact` and re-prompt the user. |
| `INVALID_TEST_KIND` | 422 | `RequiredTest.Kind` outside the canonical `RequiredTestKind` enum (FR-K05). |

---

## FR-K03 flow (impact preview → PATCH)

```
SPA                                     Server
 │                                       │
 │─ GET /admin/categories/{key}          │
 │                                       │─ 200 CategoryDetailDto
 │  (user edits Conditions in UI)        │
 │─ GET /admin/categories/{key}/impact?  │
 │     proposedConditions=<json>         │
 │                                       │─ 200 { InFlightApplicantCount: 47,
 │                                       │        FieldsChanging: ["minScorePercent"] }
 │  (modal renders count + diff +        │
 │   "أتعهد بمراجعة الأثر…" checkbox)     │
 │─ PATCH /admin/categories/{key}        │
 │     ConfirmedAffectedCount: 47        │
 │                                       │─ Serializable txn:
 │                                       │   live count == 47? → 200
 │                                       │   else            → 422 STALE_AFFECTED_COUNT
```

The Serializable transaction is what makes the count check race-free: between the impact preview and the PATCH, a new applicant could register. If the count drifted, the server rejects with `STALE_AFFECTED_COUNT` and the SPA re-fetches the impact and re-prompts.

---

## Acceptance scenarios → endpoints

| Scenario | Endpoint |
|---|---|
| AC-1 (GET 7 categories with full conditions) | `GET /admin/categories` |
| AC-2 (PATCH with correct confirmedAffectedCount → 200 + audit) | `PATCH /admin/categories/{key}` |
| AC-2a (stale count → 422) | `PATCH /admin/categories/{key}` |
| AC-3 (POST unknown key → 422) | (defensive — controller has no POST) |
| AC-4 (PATCH `requiredTests` array preserves order) | `PATCH /admin/categories/{key}` |
| AC-5 (any auth user can GET public) | `GET /categories` |
