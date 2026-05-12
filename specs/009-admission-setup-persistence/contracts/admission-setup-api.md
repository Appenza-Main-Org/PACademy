# Internal REST Contract: Admission-Setup Wizard API

> **⚠ Amendment 001 active (2026-05-12)** — §6 `GET /step-statuses` now returns 13 rows. Step keys `cycle_metadata` and `marital_status_rules` are removed. See [`../AMENDMENT-001-wizard-step-count.md`](../AMENDMENT-001-wizard-step-count.md).

**Branch**: `009-admission-setup-persistence` | **Date**: 2026-05-11 (amended 2026-05-12)

This document specifies the REST surface added by spec 009. Every endpoint
is super-admin gated unless noted otherwise; every mutation runs through
the audit middleware and the optimistic-locking guard.

Conventions:
- All routes are versionless under `/admin/` (the existing admin API
  prefix). The full URL is `http(s)://<host>/api/<route>`.
- All entities carry a server-emitted `rowVersion` (base64-encoded
  `byte[8]`) on read. Writes must echo the latest `rowVersion` in the
  request body. Mismatch → 409 with `RowVersionConflictResult`.
- Authorization: every endpoint requires the appropriate
  `admission-setup:*` policy. Read endpoints use `admission-setup:read`;
  writes use `admission-setup:write`; apply uses `admission-setup:apply`;
  clone uses `admission-setup:clone`.
- All Arabic messages returned in `RowVersionConflictResult.messageAr`
  or generic `ApiError.messageAr` fields per the existing
  `ApiError` shape in `Shared.Contracts`.

---

## 1. Step 9 — Committee Merge/Split Rules

```text
GET    /admin/admission-setup/cycles/{cycleId}/merge-split-rules
       ?status=planned|applied|cancelled (optional filter)
       ?includeArchived=true (super-admin only)
       → CommitteeMergeSplitRuleDto[]

GET    /admin/admission-setup/merge-split-rules/{id}
       → CommitteeMergeSplitRuleDto

POST   /admin/admission-setup/cycles/{cycleId}/merge-split-rules
       Body: CreateMergeSplitRuleRequest
             { type, sourceCommitteeIds, targetCommitteeIds, reason?, effectiveAt }
       → 201 CommitteeMergeSplitRuleDto

PATCH  /admin/admission-setup/merge-split-rules/{id}
       Body: UpdateMergeSplitRuleRequest + rowVersion
       → 200 CommitteeMergeSplitRuleDto
       Rejects with 409 if status != 'planned'

POST   /admin/admission-setup/merge-split-rules/{id}/cancel
       Body: { reason?, rowVersion }
       → 200 CommitteeMergeSplitRuleDto (status='cancelled')
       Rejects with 409 if status != 'planned'

POST   /admin/admission-setup/merge-split-rules/{id}/preview
       → MergeSplitPreviewDto
           { applicantsMoved: [{ id, fromCommitteeId, toCommitteeId, ... }],
             capacityChanges: [{ committeeId, before, after }],
             brokenReferences: [...],
             previewHash: string }
       Permission: admission-setup:apply

POST   /admin/admission-setup/merge-split-rules/{id}/apply
       Body: { confirmPreviewHash: string, rowVersion: string }
       → 200 ApplyResultDto
           { applied: true, applicantsMoved: int, durationMs: int }
       Side-effects (atomic): rule.status → 'applied', applicants
         reassigned, CommitteeMember rows updated, capacity recomputed,
         audit entry emitted.
       Rejects with 409 if confirmPreviewHash stale or rowVersion stale.
       Permission: admission-setup:apply

POST   /admin/admission-setup/merge-split-rules/{id}/archive
       (super-admin only soft-delete; only allowed on 'planned' or 'cancelled')
       Body: { reason: string }
       → 204
```

---

## 2. Step 10 — Committee Score Thresholds

```text
GET    /admin/admission-setup/cycles/{cycleId}/score-thresholds
       → CommitteeScoreThresholdDto[]   (one per committee in the cycle)

GET    /admin/admission-setup/cycles/{cycleId}/committees/{committeeId}/score-threshold
       → CommitteeScoreThresholdDto

PUT    /admin/admission-setup/cycles/{cycleId}/committees/{committeeId}/score-threshold
       Body: { min, max, rowVersion? }
       → 200 CommitteeScoreThresholdDto    (upsert — creates if missing)
       Rejects with 422 if min > max or out of cycle range.
```

---

## 3. Step 11 — Exam Date Config

```text
GET    /admin/admission-setup/cycles/{cycleId}/exam-dates
       → ExamDateConfigDto | null

PUT    /admin/admission-setup/cycles/{cycleId}/exam-dates
       Body: { firstAvailableDate, bookableDays[], blackoutDates[], rowVersion? }
       → 200 ExamDateConfigDto    (upsert — one row per cycle)
       Rejects with 422 on validation failure (FR-020).
```

---

## 4. Step 13 — Total Score Config

```text
GET    /admin/admission-setup/cycles/{cycleId}/total-score
       → TotalScoreConfigDto[]   (one per applicantStream)

GET    /admin/admission-setup/cycles/{cycleId}/total-score/{stream}
       → TotalScoreConfigDto

PUT    /admin/admission-setup/cycles/{cycleId}/total-score/{stream}
       Body: { components[], totalScoreOutOf, rowVersion? }
       → 200 TotalScoreConfigDto    (upsert)
       Rejects with 422 if weights don't sum to 100 or unknown exam_key.
```

---

## 5. Step 15 — Electronic Declaration

```text
GET    /admin/admission-setup/cycles/{cycleId}/declaration
       → ElectronicDeclarationDto | null    (the currently-published version)

GET    /admin/admission-setup/cycles/{cycleId}/declaration/versions
       → ElectronicDeclarationDto[]    (all versions for the cycle)

POST   /admin/admission-setup/cycles/{cycleId}/declaration
       Body: { bodyAr, effectiveFrom }
       → 201 ElectronicDeclarationDto    (creates a new draft version)

PATCH  /admin/admission-setup/declaration/{id}
       Body: { bodyAr?, effectiveFrom?, rowVersion }
       → 200 ElectronicDeclarationDto
       Rejects with 409 if version is already published.

POST   /admin/admission-setup/declaration/{id}/publish
       Body: { rowVersion }
       → 200 ElectronicDeclarationDto
       Side-effect: any previously-published version for the same cycle
       has `published_at` cleared in the same transaction. Audit entry
       `notification_published` emitted.

POST   /admin/admission-setup/declaration/{id}/archive
       (super-admin only soft-delete; not allowed if currently published)
       Body: { reason }
       → 204
```

---

## 6. Wizard Step Status

```text
GET    /admin/admission-setup/cycles/{cycleId}/step-statuses
       → WizardStepStatusDto[]   (15 rows, one per AdmissionSetupStepKey)

POST   /admin/admission-setup/cycles/{cycleId}/steps/{stepKey}/complete
       Body: { rowVersion? }   (status row may not exist yet)
       → 200 WizardStepStatusDto    (status='complete')
       Audit: `wizard_step_completed`.

POST   /admin/admission-setup/cycles/{cycleId}/steps/{stepKey}/reopen
       Body: { rowVersion }
       → 200 WizardStepStatusDto    (status='in_progress')
       Audit: `wizard_step_reopened`.
```

The `not_started → in_progress` transition is automatic on first save
of any field in the step; clients do not need to call any endpoint to
trigger it.

---

## 7. Cross-cycle copy (P4)

```text
POST   /admin/cycles/{targetId}/copy-from/{sourceId}
       Body: { confirmReplace?: boolean }
       → 200 CycleCloneSummaryDto
           { copied: { totalRows: int, perStep: { stepKey: int } },
             brokenReferences: [{ stepKey, sourceId, key, reason }],
             durationMs: int }

       Rejects with:
         - 404 if either cycle id is unknown
         - 422 if target is not in 'draft' status (FR-022)
         - 409 if target is non-empty and confirmReplace !== true
       Permission: admission-setup:clone
       Side-effects (atomic): all source wizard rows inserted into
         target with remapped ids; audit `cycle_cloned` emitted.
```

---

## 8. Step 7 — Cycle Exam Plan (replaces frontend MOCK)

```text
GET    /admin/cycles/{cycleId}/exam-plan
       ?categoryId=<guid> (optional — per-category filter)
       → CycleExamDto[]   (sorted by `order`)

POST   /admin/cycles/{cycleId}/exam-plan
       Body: { examTypeKey, categoryId?, order, isRequired, feeEgp? }
       → 201 CycleExamDto

PATCH  /admin/cycle-exams/{id}
       Body: UpdateCycleExamRequest + rowVersion
       → 200 CycleExamDto

POST   /admin/cycles/{cycleId}/exam-plan/reorder
       Body: { orderedIds: string[] }
       → 200 CycleExamDto[]
       Side-effect: reassigns `order` 10, 20, 30, …

POST   /admin/cycle-exams/{id}/archive
       Body: { reason }
       → 204

POST   /admin/cycle-exams/{id}/restore
       → 200 CycleExamDto
       (super-admin only)
```

---

## 9. Step 8 — Committees (replaces frontend MOCK)

```text
GET    /admin/committees
       ?cycleId=<guid> (required)
       ?status=active|paused|archived
       ?includeArchived=true (super-admin only)
       → CommitteeDto[]

GET    /admin/committees/{id}
       → CommitteeDto

POST   /admin/committees
       Body: CreateCommitteeRequest
             { cycleId, key, nameAr, nameEn?, chairUserId?, dailyCapacity, specializations[] }
       → 201 CommitteeDto

PATCH  /admin/committees/{id}
       Body: UpdateCommitteeRequest + rowVersion
       → 200 CommitteeDto

POST   /admin/committees/{id}/members
       Body: { userId, role }
       → 201 CommitteeMemberDto

DELETE /admin/committees/{id}/members/{userId}
       → 204

POST   /admin/committees/{id}/archive
       Body: { reason }
       → 204

POST   /admin/committees/{id}/restore
       → 200 CommitteeDto
       (super-admin only)
```

---

## 10. Step 12 — Date-Committee Binding

```text
GET    /admin/committees/{committeeId}/date-bindings
       → CommitteeDateBindingDto[]

PUT    /admin/committees/{committeeId}/date-bindings/{boundDate}
       Body: { capacity, rowVersion? }
       → 200 CommitteeDateBindingDto    (upsert)

DELETE /admin/committees/{committeeId}/date-bindings/{boundDate}
       → 204 (resets to committee's default daily_capacity for that date)
```

---

## 11. Step 14 — Notification Templates (replaces frontend MOCK)

```text
GET    /admin/notification-templates
       ?cycleId=<guid>  (null filter = global templates)
       ?triggerEvent=...
       ?isPublished=true|false
       → NotificationTemplateDto[]

GET    /admin/notification-templates/{id}
       → NotificationTemplateDto

POST   /admin/notification-templates
       Body: CreateNotificationTemplateRequest
             { cycleId?, triggerEvent, subjectAr, bodyAr, channel }
       → 201 NotificationTemplateDto    (isPublished=false)

PATCH  /admin/notification-templates/{id}
       Body: UpdateNotificationTemplateRequest + rowVersion
       → 200 NotificationTemplateDto
       Rejects with 409 if isPublished=true (use publish/unpublish endpoint).

POST   /admin/notification-templates/{id}/publish
       Body: { rowVersion }
       → 200 NotificationTemplateDto    (isPublished=true, publishedAt set)

POST   /admin/notification-templates/{id}/unpublish
       Body: { rowVersion }
       → 200 NotificationTemplateDto    (isPublished=false, publishedAt cleared)

POST   /admin/notification-templates/{id}/archive
       Body: { reason }
       → 204

POST   /admin/notification-templates/{id}/restore
       → 200 NotificationTemplateDto
       (super-admin only)
```

---

## Concurrency conflict response shape

```json
{
  "code": "ROW_VERSION_CONFLICT",
  "messageAr": "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة",
  "messageEn": "This record was modified by another user — please refresh.",
  "currentRowVersion": "AAAAAAAAB7E=",
  "entityType": "CommitteeMergeSplitRule",
  "entityId": "5f3c…"
}
```

Returned as HTTP 409 by every PATCH / POST mutation that supplies a
stale `rowVersion`. Frontend should:
1. Show a non-dismissible toast with `messageAr`.
2. Refetch the entity via its GET endpoint.
3. Surface a diff between the admin's in-flight edits and the server's
   current state (per FR-013 edge case).

---

## Validation rejection response shape

```json
{
  "code": "VALIDATION_FAILED",
  "messageAr": "...",
  "fieldErrors": {
    "components": "Total weights must sum to 100; got 95",
    "max_score": "max_score must be >= min_score"
  }
}
```

Returned as HTTP 422 by writes that fail per-entity invariants (weight
sums, threshold ranges, merge-rule shape, exam-date subset).
