# Exam-Schedule Page — `/admin/committee/schedule`

Four-tab admin surface that drives the per-(committee × date) exam
calendar. Each tab scopes both the form (DatePicker + capacity + Add)
and the table below it to one applicant category.

## Tab map

| Display label (Arabic) | `ApplicantCategoryKey` |
|---|---|
| القسم العام | `officers_general` |
| الضباط المتخصصين | `specialized_officers` |
| الحقوقيين | `law_bachelor` |
| تربية رياضية إناث | `physical_education_bachelor` |

Active tab mirrored to the URL as `?tab=<key>` so deep links + back-buttons survive a reload.

## Behavior

- The header form takes a date and a capacity (1..999). The **إضافة** button stays disabled until both fields are valid AND the active category has ≥1 committee.
- Clicking **إضافة** calls `addScheduleBatch({ categoryKey, date, capacity })`. The service creates one `ExamScheduleEntry` per `Committee` whose `categoryKey === activeTab`. On success, toast: **تمت إضافة {n} لجنة بتاريخ {date}**.
- The table beneath shows only entries for the active tab (resolved via committee FK). Each row has an icon-only **حذف الموعد** button.
- Empty state: **لم تُضف مواعيد اختبارات بعد**.

## Surface area

- Domain: `ExamScheduleEntry` in [domain.ts](../../frontend/src/shared/types/domain.ts).
- Mock: `MOCK.examSchedule` seeded empty in [mock-data/index.ts](../../frontend/src/shared/mock-data/index.ts).
- Service: `listSchedule` / `addScheduleBatch` / `removeScheduleEntry` in [committee.service.ts](../../frontend/src/features/committees/api/committee.service.ts). INTEGRATION CONTRACT block:
  ```
  GET    /committees/schedule?category=<key>     → ExamScheduleEntry[]
  POST   /committees/schedule/batch              → ExamScheduleEntry[]
           body: { categoryKey, date, capacity }
  DELETE /committees/schedule/:id                → 204
  ```
- Queries: `scheduleKeys.byCategory(key)` + `useScheduleByCategory` / `useAddScheduleBatchMutation` / `useRemoveScheduleEntryMutation`. Both mutations invalidate the same `byCategory` slice.
- Page: [CommitteeSchedulePage.tsx](../../frontend/src/features/committees/pages/CommitteeSchedulePage.tsx).

## Screenshots

`docs/exam-schedule/screenshots/`:

| File | Shows |
|---|---|
| `01-tab-officers-general.png` | القسم العام — 4 committees, form + empty state. |
| `02-tab-specialized-officers.png` | الضباط المتخصصين — 2 committees. |
| `03-tab-law-bachelor.png` | الحقوقيين — 4 committees. |
| `04-tab-physical-education.png` | تربية رياضية إناث — 2 committees. |

Each per-tab subtitle confirms the committee count for that category
("يتم إنشاء موعد لكل لجنة (N لجنة)").
