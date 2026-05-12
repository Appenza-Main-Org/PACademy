# Internal REST Contract: Lookups API

**Branch**: `010-lookup-management-module` | **Date**: 2026-05-12

This document specifies the REST surface added by spec 010. Every endpoint requires `lookups:read` (GET) or `lookups:write` (mutations). Every mutation runs through the audit middleware and the optimistic-locking guard.

Conventions:
- All routes prefixed `/admin/`. Full URL: `http(s)://<host>/api/<route>`.
- All entities carry server-emitted `rowVersion` (base64-encoded `byte[8]`). Writes must echo the latest `rowVersion`. Mismatch → 409 `ROW_VERSION_CONFLICT` with `RowVersionConflictResult` (reuses spec 009 shape).
- Conflict responses use `ConflictErrorResult` (spec 011 shape: `{ code, messageAr, messageEn, fieldErrors? }`). Codes per `docs/DB_CONSTRAINTS.md §10`.
- `typeCode` is a string identifier (e.g., `RELATIONSHIPS`, `GOVERNORATES`); must exist in `lookup_item_types`.
- All response shapes mirror the frontend's `LookupRow<K>` discriminated union — fields are joined into the shape per type code.

---

## 1. Type registry

```text
GET    /admin/lookups/_types                                     → LookupItemTypeDto[]
       Returns all 31 type codes with their metadata.
       Permission: lookups:read
```

`LookupItemTypeDto` shape:
```json
{
  "code": "RELATIONSHIPS",
  "labelAr": "صلات القرابة",
  "codePrefix": "REL",
  "padding": 3,
  "isHierarchical": true,
  "hasDates": false,
  "hasExtras": true,
  "sectionKey": "kinship",
  "sortInSection": 1,
  "isAdminUi": true
}
```

---

## 2. Lookup items CRUD

```text
GET    /admin/lookups/{typeCode}
       ?includeDeleted=true (super-admin only)
       ?activeOnly=true|false
       → LookupItemDto[]
       Sorted by sort_order ASC, created_at ASC.
       Permission: lookups:read

GET    /admin/lookups/{typeCode}/{code}
       → LookupItemDto
       404 if not found or soft-deleted (unless includeDeleted).
       Permission: lookups:read

POST   /admin/lookups/{typeCode}
       Body: CreateLookupItemRequest (shape varies by type — see §2.5)
       → 201 LookupItemDto
       Rejects with:
         - 409 DUPLICATE_CODE
         - 422 SELF_PARENT  (when `parentId` field equals the would-be generated id)
         - 422 INVALID_EXTRAS_SHAPE  (if `extras` JSON missing required fields for the type)
         - 422 UNKNOWN_FACULTY  (SPECIALIZATIONS only, when faculty_code references a non-existent faculty)
         - 422 INVALID_DATE_RANGE
       Permission: lookups:write

PATCH  /admin/lookups/{typeCode}/{code}
       Body: UpdateLookupItemRequest (partial + rowVersion)
       → 200 LookupItemDto
       Rejects with:
         - 409 ROW_VERSION_CONFLICT
         - 409 CIRCULAR_HIERARCHY  (when parent_id update would create a cycle)
         - 422 SELF_PARENT
         - 422 INVALID_EXTRAS_SHAPE
         - 422 INVALID_DATE_RANGE
       Permission: lookups:write

DELETE /admin/lookups/{typeCode}/{code}
       Body: { reason: string }                      (audit detail)
       → 200 { deleted: true }                       — successful soft-delete
       → 409 { deleted: false, reason: 'PARENT_HAS_CHILDREN', referenceCount: int }
       → 409 { deleted: false, reason: 'IN_USE',              referenceCount: int }
       Permission: lookups:write

POST   /admin/lookups/{typeCode}/{code}/restore
       → 200 LookupItemDto
       Resurrects a soft-deleted row (sets deleted_at NULL).
       Permission: lookups:write (super-admin only — enforced at endpoint)

POST   /admin/lookups/{typeCode}/reorder
       Body: { orderedCodes: string[] }
       → 200 LookupItemDto[]
       Side-effect: reassigns sort_order = 10, 20, 30, ….
       Permission: lookups:write
```

### 2.5. CreateLookupItemRequest shape (varies by type)

Common fields (all types):
```json
{
  "code": "string (optional — server generates if omitted)",
  "nameAr": "string (required)",
  "nameEn": "string (optional)",
  "isActive": true,
  "sortOrder": 0,
  "parentCode": "string | null (only for is_hierarchical types)",
  "startDate": "ISO date | null (only for has_dates types)",
  "endDate": "ISO date | null",
  "extras": {  /* per-type shape — see §2.6 */  },
  "facultyCode": "string (only for SPECIALIZATIONS)"
}
```

### 2.6. Per-type `extras` shape (response — all types)

Backend response always includes the full row shape per type code; `extras` is flattened into the DTO at the top level (mapper does the work). The frontend consumer reads `LookupItem.<typeSpecificField>` directly:

```json
// RELATIONSHIPS response
{
  "code": "REL-005",
  "nameAr": "الأخ الشقيق",
  "isActive": true,
  "parentCode": "REL-001",
  "branch": "paternal",
  "gender": "male",
  "degree": 2,
  "sortOrder": 50,
  "createdAt": "...",
  "updatedAt": "...",
  "rowVersion": "..."
}

// NATIONALITIES_COUNTRIES response
{
  "code": "CNT-005",
  "nameAr": "مصر",
  "iso2": "EG",
  "isArab": true,
  "isActive": true,
  ...
}

// SPECIALIZATIONS response (facultyCode promoted to top-level column)
{
  "code": "SPC-007",
  "nameAr": "هندسة برمجيات",
  "facultyCode": "FAC-03",
  "isActive": true,
  ...
}
```

The mapper flattens `extras` JSON → top-level DTO fields per type. Frontend never sees the raw `extras` JSON; the typed `LookupRow<K>` shape is canonical.

---

## 3. Mappings

```text
GET    /admin/lookup-mappings/{mappingKey}
       → LookupMappingDto[]
       mappingKey ∈ { category-specializations, category-committees, category-tests, period-categories }
       Permission: lookups:read

POST   /admin/lookup-mappings/{mappingKey}
       Body: { categoryId: guid, targetId: guid }
       → 201 LookupMappingDto
       Rejects with:
         - 409 DUPLICATE_MAPPING  (composite PK violation)
         - 422 UNKNOWN_TARGET     (one or both refs missing / soft-deleted / wrong type)
       Permission: lookups:write

DELETE /admin/lookup-mappings/{mappingKey}/{categoryId}/{targetId}
       → 204
       Permission: lookups:write
```

`LookupMappingDto` shape:
```json
{
  "categoryId": "guid",
  "targetId": "guid",
  "categoryCode": "CAT-02",                    // joined from lookup_items
  "categoryNameAr": "ضباط متخصصون",
  "targetCode": "SPC-03",
  "targetNameAr": "هندسة برمجيات",
  "sortOrder": 10,
  "createdAt": "..."
}
```

---

## 4. Bulk import + export

```text
POST   /admin/lookups/{typeCode}/import
       Content-Type: multipart/form-data
       Form field "file": .xlsx | .csv (UTF-8)
       Form field "mode": "create-only" | "update-only" | "upsert"
       → 200 ImportResult
       Rejects with 422 if any single row fails validation (full rollback).
       Permission: lookups:write

GET    /admin/lookups/{typeCode}/export
       ?format=xlsx|csv (default: xlsx)
       ?includeDeleted=true (super-admin only)
       → file stream
       Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
                  | text/csv
       Content-Disposition: attachment; filename="{typeCode}-{timestamp}.{ext}"
       Permission: lookups:read
```

`ImportResult` shape:
```json
{
  "inserted": 30,
  "updated": 20,
  "skipped": 0,
  "errors": []                                    // empty if success
}
```

On failure (422):
```json
{
  "code": "BULK_IMPORT_FAILED",
  "messageAr": "فشل الاستيراد - تم التراجع عن جميع التغييرات",
  "errors": [
    { "row": 47, "code": "DUPLICATE_CODE",        "field": "code"     },
    { "row": 89, "code": "INVALID_EXTRAS_SHAPE",  "field": "extras.branch" }
  ]
}
```

The whole batch is rolled back on any error. Frontend's `ImportDialog` renders the per-row errors in the preview table.

---

## 5. Conflict-code response shapes

### `DUPLICATE_CODE` (409)
```json
{
  "code": "DUPLICATE_CODE",
  "messageAr": "الرمز مستخدم بالفعل في نفس النوع",
  "messageEn": "Code already exists for this lookup type.",
  "fieldErrors": { "code": "مستخدم بالفعل" }
}
```

### `SELF_PARENT` (422)
```json
{
  "code": "SELF_PARENT",
  "messageAr": "لا يمكن أن يكون السجل أبًا لنفسه",
  "messageEn": "Row cannot be its own parent.",
  "fieldErrors": { "parentCode": "غير مسموح" }
}
```

### `CIRCULAR_HIERARCHY` (409)
```json
{
  "code": "CIRCULAR_HIERARCHY",
  "messageAr": "تكوين السلسلة سيؤدي إلى حلقة",
  "messageEn": "Hierarchy chain would create a cycle.",
  "fieldErrors": { "parentCode": "اختر سجلًا خارج السلسلة" }
}
```

### `PARENT_HAS_CHILDREN` (409)
```json
{
  "code": "PARENT_HAS_CHILDREN",
  "messageAr": "لا يمكن حذف السجل — توجد سجلات تابعة. احذف التابعين أولاً",
  "messageEn": "Cannot delete — child rows exist. Delete children first.",
  "referenceCount": 5
}
```

### `IN_USE` (409)
```json
{
  "code": "IN_USE",
  "messageAr": "السجل مستخدم في جداول الربط — احذف الروابط أولاً",
  "messageEn": "Row is referenced in mapping tables — remove mappings first.",
  "referenceCount": 3
}
```

### `INVALID_DATE_RANGE` (422)
```json
{
  "code": "INVALID_DATE_RANGE",
  "messageAr": "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية",
  "fieldErrors": {
    "startDate": "قبل تاريخ النهاية",
    "endDate":   "بعد تاريخ البداية"
  }
}
```

### `DUPLICATE_MAPPING` (409)
```json
{
  "code": "DUPLICATE_MAPPING",
  "messageAr": "هذا الربط موجود بالفعل",
  "messageEn": "This mapping already exists."
}
```

### `UNKNOWN_TARGET` (422)
```json
{
  "code": "UNKNOWN_TARGET",
  "messageAr": "أحد السجلين المربوطين غير موجود أو محذوف",
  "messageEn": "One of the referenced lookup rows is missing or soft-deleted.",
  "fieldErrors": {
    "targetId": "السجل غير موجود"
  }
}
```

### `UNKNOWN_FACULTY` (422)
```json
{
  "code": "UNKNOWN_FACULTY",
  "messageAr": "كلية التخصص غير موجودة",
  "fieldErrors": { "facultyCode": "غير موجود" }
}
```

### `INVALID_EXTRAS_SHAPE` (422)
```json
{
  "code": "INVALID_EXTRAS_SHAPE",
  "messageAr": "بنية البيانات الإضافية غير صحيحة لهذا النوع",
  "fieldErrors": {
    "extras.branch": "حقل مطلوب",
    "extras.degree": "يجب أن يكون رقماً بين 1 و4"
  }
}
```

### `ROW_VERSION_CONFLICT` (409 — reused from spec 009)
```json
{
  "code": "ROW_VERSION_CONFLICT",
  "messageAr": "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة",
  "currentRowVersion": "AAAAAAAAB7E=",
  "entityType": "LookupItem",
  "entityId": "guid"
}
```

---

## 6. Permission summary

| Operation                                            | Permission        |
|------------------------------------------------------|-------------------|
| All GET endpoints                                    | `lookups:read`    |
| All mutating endpoints + import + reorder            | `lookups:write`   |
| Restore (POST `/.../restore`)                        | `lookups:write` + super-admin (enforced at endpoint via `[Authorize(Policy = "*")]`) |

Spec 010 adds two new permission policies:
- `lookups:read` — granted to `super_admin` (via `*`), `committee_admin`
- `lookups:write` — granted to `super_admin` (via `*`) only

`committee_admin` reads lookups but does NOT write them. Lookup management is super-admin only by policy (the catalogue is platform-wide; per-cycle data lives in spec 009/011).

---

## 7. Audit emissions

| Endpoint                                          | `action`                                 | `entityType`             |
|---------------------------------------------------|------------------------------------------|---------------------------|
| `POST /lookups/{typeCode}`                        | `create`                                 | `<TypeName>Row`           |
| `PATCH /lookups/{typeCode}/{code}`                | `update`                                 | `<TypeName>Row`           |
| `DELETE /lookups/{typeCode}/{code}`               | `soft_delete`                            | `<TypeName>Row`           |
| `POST /lookups/{typeCode}/{code}/restore`         | `restore`                                | `<TypeName>Row`           |
| `POST /lookups/{typeCode}/reorder`                | `update` (summary)                       | `LookupReorder`           |
| `POST /lookup-mappings/{mappingKey}`              | `create`                                 | `<MappingName>`           |
| `DELETE /lookup-mappings/{mappingKey}/…`          | `delete`                                 | `<MappingName>`           |
| `POST /lookups/{typeCode}/import`                 | `entity_imported` (summary) + per-row    | `<TypeName>Row`           |
| `GET /lookups/{typeCode}/export`                  | `entity_exported`                        | `<TypeName>Row`           |

All entries: `module = 'lookups'`.

`<TypeName>Row` examples: `GovernorateRow`, `RelationshipRow`, `SpecializationRow`, `NationalityCountryRow`. The mapper converts type-code (`GOVERNORATES`) → entity-type-name (`GovernorateRow`) using the type registry.
