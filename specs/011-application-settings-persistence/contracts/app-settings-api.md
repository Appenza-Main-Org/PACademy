# Internal REST Contract: Application Settings API

**Branch**: `011-application-settings-persistence` | **Date**: 2026-05-12

This document specifies the REST surface added by spec 011. Every endpoint is super-admin gated (or `committee_admin` via the `admission-setup:read|write` permissions). Every mutation runs through the audit middleware and the optimistic-locking guard.

Conventions:
- All routes are versionless under `/admin/app-settings/`. Full URL is `http(s)://<host>/api/<route>`.
- All entities carry a server-emitted `rowVersion` (base64-encoded `byte[8]`) on read. Writes must echo the latest `rowVersion`. Mismatch → 409 with `RowVersionConflictResult` (shared shape from spec 009 `Shared.Contracts.Concurrency`).
- Conflict responses use `ConflictErrorResult` (shape: `{ code, messageAr, messageEn, fieldErrors? }`). Each of the 7 codes documented in `docs/DB_CONSTRAINTS.md §11` is a possible response.

---

## 1. Category configs (Tier 1)

```text
GET    /admin/app-settings/category-configs
       → ApplicantCategoryConfigDto[]
       Sorted by sort_order ASC, created_at ASC (FR-017).
       Permission: admission-setup:read

GET    /admin/app-settings/category-configs/{id}
       → ApplicantCategoryConfigDto
       404 if not found.

PATCH  /admin/app-settings/category-configs/{id}
       Body: { isActive: bool, sortOrder?: int, rowVersion: string }
       → 200 ApplicantCategoryConfigDto
       Rejects with:
         - 409 ROW_VERSION_CONFLICT if rowVersion stale
         - 409 CATEGORY_HAS_ACTIVE_YEARS when flipping isActive=false
           and descendant active+non-deleted year rows exist
         - 422 UNKNOWN_CATEGORY if categoryId not in lookup catalogue (only
           on create-via-POST, see §1.5)
       Permission: admission-setup:write

POST   /admin/app-settings/category-configs              (rare — admin "enable category")
       Body: { categoryId: string, sortOrder: int }
       → 201 ApplicantCategoryConfigDto
       Rejects with:
         - 422 UNKNOWN_CATEGORY
         - 409 DUPLICATE_CATEGORY (UX_AppCatConfig_Category violation)
       Permission: admission-setup:write
```

`ApplicantCategoryConfigDto` shape:

```json
{
  "id": "guid",
  "categoryId": "CAT-01",
  "isActive": true,
  "sortOrder": 10,
  "createdAt": "2026-05-12T...",
  "updatedAt": "2026-05-12T...",
  "rowVersion": "base64-byte8",
  "categoryLabelAr": "ضباط متخصصون"     // joined from lookup catalogue
}
```

---

## 2. Category-specialization junctions (Tier 2)

```text
GET    /admin/app-settings/category-configs/{configId}/specializations
       → ApplicantCategorySpecializationDto[]
       Sorted by created_at ASC.
       Permission: admission-setup:read

GET    /admin/app-settings/category-configs/{configId}/eligible-specializations
       → SpecializationLookupRow[]
       Returns specialization-lookup rows NOT yet attached to this config.
       When the SPC × CAT mapping ships (post-spec 010), also filters by
       (categoryId, specializationId) ∈ mapping.
       Permission: admission-setup:read

POST   /admin/app-settings/category-configs/{configId}/specializations
       Body: { specializationId: string }
       → 201 ApplicantCategorySpecializationDto
       Rejects with:
         - 422 UNKNOWN_SPECIALIZATION
         - 409 DUPLICATE_SPECIALIZATION (UX_AppCatSpec_ConfigSpec)
         - 409 SPECIALIZATION_NOT_MAPPED  ← reserved for post-spec-010 mapping
       Permission: admission-setup:write

DELETE /admin/app-settings/specializations/{id}
       → 204
       CASCADE deletes descendant years (and their side rows).
       Permission: admission-setup:write
```

`ApplicantCategorySpecializationDto` shape:

```json
{
  "id": "guid",
  "configId": "guid",
  "specializationId": "SPC-02",
  "isActive": true,
  "createdAt": "2026-05-12T...",
  "rowVersion": "base64-byte8",
  "specializationNameAr": "هندسة برمجيات",         // joined from lookup
  "facultyCode": "FAC-03",                           // joined from lookup
  "yearCount": 6                                     // computed
}
```

---

## 3. Year rows (Tier 3)

```text
GET    /admin/app-settings/specializations/{csId}/years
       ?includeDeleted=true (super-admin only)
       → ApplicantSpecializationYearDto[]
       Sorted by graduation_year DESC, application_start_date ASC.
       Permission: admission-setup:read

GET    /admin/app-settings/years/{id}
       → ApplicantSpecializationYearDto
       Permission: admission-setup:read

POST   /admin/app-settings/specializations/{csId}/years
       Body: full year payload (see schema below)
       → 201 ApplicantSpecializationYearDto
       Rejects with all 7 conflict codes (DUPLICATE_YEAR, OVERLAPPING_PERIOD,
       INVALID_DATE_RANGE, AGE_NOT_POSITIVE, GRADE_RANGE_INVALID,
       GENDER_REQUIRED).
       Permission: admission-setup:write

PATCH  /admin/app-settings/years/{id}
       Body: partial year payload + rowVersion
       → 200 ApplicantSpecializationYearDto
       Same conflict codes + ROW_VERSION_CONFLICT.
       Permission: admission-setup:write

DELETE /admin/app-settings/years/{id}
       → 204 (soft delete — is_deleted=true)
       Permission: admission-setup:write
```

`ApplicantSpecializationYearDto` shape:

```json
{
  "id": "guid",
  "categorySpecializationId": "guid",
  "graduationYear": 2026,
  "genderTypes": ["male", "female"],
  "maritalStatusCodes": ["أعزب", "متزوج"],
  "maxAge": 22,
  "minGrade": 85,
  "maxGrade": 100,
  "applicationStartDate": "2026-07-01",
  "applicationEndDate": "2026-08-15",
  "ageCalcDate": "2026-09-01",
  "isActive": true,
  "isDeleted": false,
  "createdAt": "2026-05-12T...",
  "updatedAt": "2026-05-12T...",
  "rowVersion": "base64-byte8"
}
```

Year payload for POST/PATCH (PATCH omits required fields):

```json
{
  "graduationYear": 2026,
  "genderTypes": ["male"],                             // ≥1 required
  "maritalStatusCodes": ["أعزب"],                      // ≥0
  "maxAge": 22,                                         // optional
  "minGrade": 85,                                       // optional
  "maxGrade": 100,                                      // optional
  "applicationStartDate": "2026-07-01",
  "applicationEndDate": "2026-08-15",
  "ageCalcDate": "2026-09-01",
  "isActive": true,
  "rowVersion": "..."                                   // PATCH only
}
```

---

## 4. Bulk save

```text
POST   /admin/app-settings/bulk-save
       Body: BulkSavePayload
             { changes: BulkYearChange[] }

       BulkYearChange:
       {
         "id": "string | null",                       // null on create
         "kind": "create" | "update" | "delete",
         "categorySpecializationId": "guid",
         "row": { …year payload… }                    // omitted on delete
       }

       → 200 BulkSaveResult { created: int, updated: int, deleted: int }
       Rejects with 422 + per-row error map:
         {
           "code": "BULK_SAVE_FAILED",
           "messageAr": "...",
           "fieldErrors": {
             "<change-id-or-index>": "DUPLICATE_YEAR",
             ...
           }
         }
       The whole batch is rolled back on any single failure (FR-012).
       Permission: admission-setup:write
```

Each change is validated and applied within a single SQL Server transaction at `Snapshot` isolation level. The audit middleware emits exactly one entry per `kind` (so a batch of 1 create + 2 updates + 1 delete produces 4 audit entries with the same transaction-timestamp).

---

## 5. Conflict-code response shapes

### `ROW_VERSION_CONFLICT` (409)

```json
{
  "code": "ROW_VERSION_CONFLICT",
  "messageAr": "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة",
  "messageEn": "This record was modified by another user — please refresh.",
  "currentRowVersion": "AAAAAAAAB7E=",
  "entityType": "ApplicantSpecializationYear",
  "entityId": "guid"
}
```

(Reuses `Shared.Contracts.Concurrency.RowVersionConflictResult` from spec 009.)

### `DUPLICATE_YEAR` (409)

```json
{
  "code": "DUPLICATE_YEAR",
  "messageAr": "يوجد بالفعل صف لسنة التخرج هذه يشترك في نفس النوع",
  "messageEn": "A row with this graduation year already exists with overlapping genders.",
  "fieldErrors": {
    "graduationYear": "مكرر — اختر سنة مختلفة أو غيّر اختيار النوع"
  }
}
```

### `OVERLAPPING_PERIOD` (409)

```json
{
  "code": "OVERLAPPING_PERIOD",
  "messageAr": "نطاق التواريخ يتداخل مع صف آخر بنفس النوع",
  "messageEn": "Application window overlaps with another row that shares a gender.",
  "fieldErrors": {
    "applicationStartDate": "تداخل مع نطاق آخر",
    "applicationEndDate":   "تداخل مع نطاق آخر"
  }
}
```

### `INVALID_DATE_RANGE` (422)

```json
{
  "code": "INVALID_DATE_RANGE",
  "messageAr": "تاريخ نهاية التقديم يجب أن يكون بعد أو يساوي تاريخ البدء",
  "fieldErrors": {
    "applicationEndDate": "يجب أن يكون بعد تاريخ البدء"
  }
}
```

### `AGE_NOT_POSITIVE` (422)

```json
{
  "code": "AGE_NOT_POSITIVE",
  "messageAr": "الحد الأقصى للعمر يجب أن يكون رقماً موجباً",
  "fieldErrors": { "maxAge": "أكبر من صفر" }
}
```

### `GRADE_RANGE_INVALID` (422)

```json
{
  "code": "GRADE_RANGE_INVALID",
  "messageAr": "الحد الأدنى للدرجة يجب أن يكون أقل من أو يساوي الحد الأقصى",
  "fieldErrors": {
    "minGrade": "أقل من أو يساوي الحد الأقصى",
    "maxGrade": "أكبر من أو يساوي الحد الأدنى"
  }
}
```

### `GENDER_REQUIRED` (422)

```json
{
  "code": "GENDER_REQUIRED",
  "messageAr": "يجب اختيار نوع واحد على الأقل",
  "fieldErrors": { "genderTypes": "اختر ذكر و/أو أنثى" }
}
```

### `CATEGORY_HAS_ACTIVE_YEARS` (409)

```json
{
  "code": "CATEGORY_HAS_ACTIVE_YEARS",
  "messageAr": "لا يمكن إيقاف الفئة — توجد سنوات نشطة. عطّل السنوات أولاً",
  "messageEn": "Cannot deactivate category — active year rows exist. Deactivate years first."
}
```

### `SPECIALIZATION_NOT_MAPPED` (409, reserved)

```json
{
  "code": "SPECIALIZATION_NOT_MAPPED",
  "messageAr": "هذا التخصص غير مرتبط بالفئة المختارة",
  "messageEn": "This specialization is not mapped to the chosen category."
}
```

V1 does NOT throw this. Reserved for the day spec 010 ships the SPC × CAT lookup mapping.

---

## 6. Permission summary

| Operation                              | Permission              |
|----------------------------------------|-------------------------|
| All GET endpoints                      | `admission-setup:read`  |
| All mutating endpoints (PATCH/POST/DELETE/bulk-save) | `admission-setup:write` |

No new permission policy. Spec 007 already provisions `admission-setup:read|write` for `super_admin` (via `*`) and `committee_admin` (explicit).

---

## 7. Audit emissions

Every mutation emits one audit entry through the existing audit middleware. `module = 'lookups'` on all entries.

| Endpoint                                                | Audit `action` | Audit `entityType`              |
|---------------------------------------------------------|----------------|----------------------------------|
| `PATCH /category-configs/{id}` (toggle isActive)        | `update`       | `ApplicantCategoryConfig`        |
| `POST /category-configs`                                | `create`       | `ApplicantCategoryConfig`        |
| `POST /…/specializations`                               | `create`       | `ApplicantCategorySpecialization`|
| `DELETE /specializations/{id}`                          | `delete`       | `ApplicantCategorySpecialization`|
| `POST /…/years`                                         | `create`       | `ApplicantSpecializationYear`    |
| `PATCH /years/{id}`                                     | `update`       | `ApplicantSpecializationYear`    |
| `DELETE /years/{id}`                                    | `soft_delete`  | `ApplicantSpecializationYear`    |
| `POST /bulk-save`                                       | one per change kind in batch | per change                      |

No new `AuditAction` values needed (all 4 used values already exist).
