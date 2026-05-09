# Contracts — Admin Lookups CRUD

This directory holds API contract sketches per entity. The **authoritative** OpenAPI snapshots are produced post-implementation by **T281** (capture `/openapi/v1.json` after rebuild and split into per-entity YAML files: `reference-data.openapi.yaml`, `cycles.openapi.yaml`, `categories.openapi.yaml`, `admission-rules.openapi.yaml`, `workflows.openapi.yaml`).

Until T281 lands, this directory contains **planning sketches** — five `.md` files that document the endpoint surface, request/response DTOs, and error codes per entity. They are derived from [plan.md §API surface](../plan.md#api-surface) and [data-model.md](../data-model.md).

---

## Endpoint matrix at a glance

| Entity | Public read | Admin read | Create | Update | Status / lifecycle | Delete |
|---|---|---|---|---|---|---|
| **reference-data** | `GET /reference-data` | `GET /admin/reference-data` `GET /admin/reference-data/{id}` | `POST /admin/reference-data` | `PATCH /admin/reference-data/{id}` | `POST /admin/reference-data/{id}/archive` | — (soft only) |
| **cycles** | `GET /cycles` | `GET /admin/cycles` `GET /admin/cycles/{id}` | `POST /admin/cycles` | `PATCH /admin/cycles/{id}` | `POST /admin/cycles/{id}/status` | `DELETE /admin/cycles/{id}` (Draft + 0 applicants only) |
| **categories** | `GET /categories` | `GET /admin/categories` `GET /admin/categories/{key}` `GET /admin/categories/{key}/impact` | — (keys immutable) | `PATCH /admin/categories/{key}` | — | — |
| **admission-rules** | — (use eligibility check) | `GET /admin/admission-rules` `GET /admin/admission-rules/{id}` | `POST /admin/admission-rules` (versioned) | `405 ADMISSION_RULES_IMMUTABLE` | — | `405 ADMISSION_RULES_IMMUTABLE` |
| **workflows** | `GET /workflows` (Published only) | `GET /admin/workflows` `GET /admin/workflows/{id}` | `POST /admin/workflows` | `PATCH /admin/workflows/{id}` | `POST /admin/workflows/{id}/publish` `POST /admin/workflows/{id}/archive` | — (soft via archive) |

---

## Cross-cutting contract rules (FR-X01 – FR-X06)

| Rule | Mechanism |
|---|---|
| **AuthZ** | All `/admin/*` endpoints: `[Authorize(Policy = "Role:super_admin")]`. Public reads: `[Authorize]` only. |
| **Audit** | Every successful mutation writes via `IAuditWriter.RecordAsync` with `action`, `targetType`, `targetId`, `targetLabel`, `outcome=Success`, and a JSON before/after diff for PATCH. |
| **CSRF** | Mutating requests carry `X-CSRF-Token` header that matches the `csrf-token` cookie. Existing `CsrfMiddleware` handles enforcement. |
| **Pagination** | All list endpoints accept `page`, `pageSize` (max 200), `sortBy`, `sortDir`, plus entity-specific filters. Responses carry `X-Total-Count` and `X-Page-Count` headers. |
| **Soft-delete default** | Soft-delete via `Archived=true, ArchivedAt=now`. Hard-delete only where FR-X03 permits. Soft-deleted rows queryable via `?includeArchived=true`. |
| **Error envelope** | `{ "code": "<STABLE_ID>", "message": "<Arabic display text>", "fields"?: { ... } }`. English `code` for SPA mapping; Arabic `message` for users. |

---

## Error code registry (cross-entity)

Stable English identifiers; Arabic display text on `message`.

| Code | HTTP | Source FR | Meaning |
|---|---|---|---|
| `REFERENCE_KEY_TAKEN` | 422 | FR-L02 | `(category, key)` already exists for an active row. |
| `REFERENCE_IN_USE` | 422 | FR-L05 | Archive blocked because the row is referenced by an applicant or rule. |
| `INVALID_CYCLE_TRANSITION` | 422 | FR-Y01 | Status transition is not allowed (Draft→Closed, reverse, etc.). |
| `OVERLAPPING_ACTIVE_CYCLE` | 422 | FR-Y02 | Another `Active` cycle exists for the same `(year, cohort)`. |
| `CYCLE_CLOSED` | 422 | FR-Y01 | Submission attempted against a Closed/Archived cycle. |
| `CYCLE_HAS_APPLICANTS` | 422 | FR-Y06 | Hard-delete blocked because the cycle has applicants. |
| `INVALID_CATEGORY_KEY` | 422 | FR-K01 | POST attempted against an unknown category key. |
| `STALE_AFFECTED_COUNT` | 422 | FR-K03 | `confirmedAffectedCount` does not match the live count. SPA must re-fetch and re-confirm. |
| `ADMISSION_RULES_IMMUTABLE` | 405 | FR-R01 | PATCH or DELETE attempted on an existing admission rule version. |
| `WORKFLOW_IN_USE` | 422 | FR-W05 | Stage reorder blocked because applicants are mid-stage on the previous order. |

---

## Files

- [reference-data.md](./reference-data.md)
- [cycles.md](./cycles.md)
- [categories.md](./categories.md)
- [admission-rules.md](./admission-rules.md)
- [workflows.md](./workflows.md)
