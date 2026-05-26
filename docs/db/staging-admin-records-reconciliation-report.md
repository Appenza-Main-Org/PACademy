# Staging Admin Records Reconciliation Report

Date: 2026-05-26

## Scope

Read-only reconciliation between:

- Active source JSON: `PACademy_staging_db.admin_records`
- Existing normalized targets: `dbo.applicants`, `dbo.applicant_grades`

No staging data was modified.

## Grade Reconciliation

### Key Counts

| Metric | Count |
|---|---:|
| Live staging grade rows | 10,143 |
| `dbo.applicant_grades` rows | 10,000 |
| Matched by NID | 9,998 |
| Staging live rows missing in `dbo` by NID | 145 |
| `dbo` rows missing in staging by NID | 2 |
| Matched by seating number | 9,998 |
| Staging live rows missing in `dbo` by seating number | 145 |
| `dbo` rows missing in staging by seating number | 2 |

### Missing Staging Rows Breakdown

145 active staging grade rows are not in `dbo.applicant_grades`.

| Kind | Category | NID length | Rows | Seat range |
|---|---|---:|---:|---|
| `azhar` | `SCH-03` | 8 | 107 | 23195-23336 |
| `azhar` | `SCH-03` | 7 | 33 | 23198-23334 |
| `azhar` | `SCH-03` | 6 | 3 | 23223-23337 |
| `general` | `SCH-01` | 14 | 2 | 21387-21388 |

Decision:

- The 2 valid 14-digit `general` rows can be backfilled into `dbo.applicant_grades`.
- The 143 short-NID Azhar rows should not be treated as consistent applicant-grade rows until NIDs are corrected or explicitly accepted as non-national synthetic/import rows.

### `dbo` Rows Missing in Staging

2 normalized rows exist in `dbo.applicant_grades` but not in live staging:

| Seat | Seating number | NID | Category | Total |
|---:|---|---|---|---:|
| 15 | 1897311 | 30601010000000 | `SCH-07` | 646.98 |
| 17 | 1897312 | 30601010000001 | `SCH-07` | 660.00 |

Recommendation: keep them for now and record as reconciliation issues. Do not delete them without product/data-owner approval.

### Field Differences for Matched Grade Rows

9,998 rows match by NID, but many fields differ because active staging appears newer/different than the normalized table.

| Field | Difference count |
|---|---:|
| `seat` | 9,998 |
| `seating_number` | 0 |
| `name` | 351 |
| `kind` | 0 |
| `gender` | 9,998 |
| `branch` | 0 |
| `graduation_year` | 9,413 |
| `school_category_code` | 8,777 |
| `school` | 0 |
| `region` | 9,998 |
| `exam_round` | 8,777 |
| `total` | 3 |
| `import_max` | 9,413 |
| `override_max` | 0 |
| `status` | 9,998 |

Observed pattern:

- Staging uses English gender codes like `male`; `dbo` has Arabic values like `ذكر`.
- Staging has current import/category/year values such as `graduationYear=2027`, `SCH-01`, `importMax=410`.
- `dbo` has older values for many matched rows such as `graduation_year=2026`, `SCH-07`, `import_max=700`.

Recommendation: if `admin_records` is accepted as the active source of truth, update matched `dbo.applicant_grades` fields from live staging for valid 14-digit NID rows. This is a review-gated write.

### Soft-Deleted Staging Grades

| Metric | Value |
|---|---:|
| Soft-deleted staging grade rows | 13,194 |
| Distinct deleted NIDs | 10,002 |
| Distinct deleted seating numbers | 10,002 |
| Delete date | 2026-05-25 |
| Distinct deleting actor values | 1 |
| Distinct delete reason values | 0 |

Recommendation: do not backfill soft-deleted rows into the active normalized grade table until we decide whether they belong in:

- a `deleted_at`/soft-delete extension on `dbo.applicant_grades`,
- a separate grade history/archive table,
- or import batch history only.

## Applicant Reconciliation

### Key Counts

| Metric | Count |
|---|---:|
| Staging applicant JSON rows | 4 |
| `dbo.applicants` rows | 4 |
| Matched by national ID | 4 |
| Staging missing in `dbo` | 0 |
| `dbo` missing in staging | 0 |

### Field Differences

| Field | Difference count |
|---|---:|
| Name | 1 |
| Gender | 1 |
| Birth date | 0 |
| Governorate | 1 |
| City/district | 1 |
| `dbo` missing phone | 0 |
| `dbo` missing email | 1 |

Recommendation: update `dbo.applicants` from staging only for fields where staging has a non-empty value, while preserving normalized-only fields such as phone and email.

## Review-Only Migration Draft

Generated draft:

[20260526_normalize_admin_records_to_dbo_review.sql](/Users/mac/Projects/PACademy/PACademy/docs/db/migrations/20260526_normalize_admin_records_to_dbo_review.sql)

What it is designed to do if approved and run later:

- Create a non-destructive issue table in `PACademy_staging_db`.
- Log invalid short-NID grade rows instead of inserting them into `dbo.applicant_grades`.
- Log `dbo`-only grade rows instead of deleting them.
- Preflight duplicate/conflicting valid grade keys.
- Upsert valid 14-digit live staging grades into `dbo.applicant_grades`.
- Update matched valid `dbo.applicant_grades` rows from active staging values.
- Update `dbo.applicants` from staging values while preserving phone/email/source fields.

What it intentionally does not do:

- It does not delete any row.
- It does not process soft-deleted grade history into the active normalized table.
- It does not insert the 143 invalid short-NID Azhar rows as valid grade records.
- It does not switch application code to read from normalized tables.

## Approval Needed

Before running any write on staging, confirm these decisions:

1. `PACademy_staging_db.admin_records` live rows are the source of truth over current `dbo.applicant_grades`.
2. The 143 short-NID Azhar rows should be quarantined as issues, not inserted into normalized grades.
3. The 2 `dbo`-only grade rows should remain untouched and logged as issues.
4. Soft-deleted grade rows should be preserved later in history/archive, not active grades.
