/*
  REVIEW ONLY - DO NOT RUN UNTIL APPROVED

  Purpose:
    Normalize valid live PACademy_staging_db.admin_records applicant/grade JSON rows
    into the existing dbo.applicants and dbo.applicant_grades tables.

  Safety:
    - Non-destructive: no DELETE statements.
    - Invalid short-NID grade rows are logged to an issue table, not inserted.
    - dbo-only grade rows are logged to an issue table, not deleted.
    - Soft-deleted grade history is not inserted into active normalized grades.
    - The whole script runs in one transaction and rolls back on any error.

  Required approval decisions before running:
    1. Live PACademy_staging_db.admin_records rows are the source of truth.
    2. Short-NID Azhar rows should be quarantined, not inserted.
    3. dbo-only grade rows should remain untouched and be logged.
    4. Soft-deleted grade rows will be handled later as history/archive.
*/

SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

DECLARE @run_id uniqueidentifier = NEWID();
DECLARE @now datetimeoffset = SYSDATETIMEOFFSET();

IF OBJECT_ID(N'[PACademy_staging_db].[admin_record_normalization_issues]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[admin_record_normalization_issues]
    (
        [id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_admin_record_normalization_issues] PRIMARY KEY,
        [run_id] uniqueidentifier NOT NULL,
        [issue_code] nvarchar(96) NOT NULL,
        [entity_type] nvarchar(96) NOT NULL,
        [source_key] nvarchar(256) NULL,
        [natural_key] nvarchar(256) NULL,
        [details_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_admin_record_normalization_issues_created_at] DEFAULT SYSDATETIMEOFFSET()
    );

    CREATE INDEX [IX_admin_record_normalization_issues_run_code]
        ON [PACademy_staging_db].[admin_record_normalization_issues] ([run_id], [issue_code], [entity_type]);
END;

IF OBJECT_ID(N'tempdb..#live_grade_source', N'U') IS NOT NULL DROP TABLE #live_grade_source;
IF OBJECT_ID(N'tempdb..#valid_grade_source', N'U') IS NOT NULL DROP TABLE #valid_grade_source;
IF OBJECT_ID(N'tempdb..#staging_applicants', N'U') IS NOT NULL DROP TABLE #staging_applicants;

SELECT
    [admin_id] = ar.[id],
    [seat] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.seat')),
    [seating_number] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.seatingNumber'))), ''),
    [nid] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nid'))), ''),
    [name] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.name'))), ''),
    [kind] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.kind'))), ''),
    [gender] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.gender'))), ''),
    [branch] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.branch'))), ''),
    [graduation_year] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.graduationYear')),
    [school_category_code] = COALESCE(
        NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.schoolCategoryCode'))), ''),
        NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.schoolCategory'))), '')
    ),
    [school] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.school'))), ''),
    [region] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.region'))), ''),
    [exam_round] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.examRound'))), ''),
    [total] = TRY_CONVERT(decimal(7,2), JSON_VALUE(ar.[payload_json], '$.total')),
    [import_max] = TRY_CONVERT(decimal(7,2), JSON_VALUE(ar.[payload_json], '$.importMax')),
    [override_max] = TRY_CONVERT(decimal(7,2), JSON_VALUE(ar.[payload_json], '$.overrideMax')),
    [last_edited_at] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.lastEditedAt'))), ''),
    [last_edited_by] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.lastEditedBy'))), ''),
    [grade_changed_at] = TRY_CONVERT(datetimeoffset, JSON_VALUE(ar.[payload_json], '$.gradeChangedAt')),
    [previous_grade] = TRY_CONVERT(decimal(7,2), JSON_VALUE(ar.[payload_json], '$.previousGrade')),
    [status] = COALESCE(NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.status'))), ''), N'مستجد'),
    [payload_json] = ar.[payload_json],
    [created_at] = ar.[created_at],
    [updated_at] = ar.[updated_at]
INTO #live_grade_source
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'grades'
  AND JSON_VALUE(ar.[payload_json], '$.deletedAt') IS NULL
  AND COALESCE(LOWER(JSON_VALUE(ar.[payload_json], '$.isDeleted')), N'false') <> N'true';

SELECT *
INTO #valid_grade_source
FROM #live_grade_source
WHERE [nid] IS NOT NULL
  AND LEN([nid]) = 14
  AND [seat] IS NOT NULL
  AND [seating_number] IS NOT NULL
  AND [name] IS NOT NULL
  AND [total] IS NOT NULL
  AND [import_max] IS NOT NULL;

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues]
    ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT
    @run_id,
    N'INVALID_GRADE_SOURCE_ROW',
    N'grade',
    [admin_id],
    [nid],
    (
        SELECT
            [seat],
            [seating_number],
            [nid],
            [name],
            [kind],
            [school_category_code],
            [total],
            [import_max],
            [reason] = N'Live staging grade row is missing required normalized fields or does not have a 14-digit NID.'
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ),
    @now
FROM #live_grade_source
WHERE [nid] IS NULL
   OR LEN([nid]) <> 14
   OR [seat] IS NULL
   OR [seating_number] IS NULL
   OR [name] IS NULL
   OR [total] IS NULL
   OR [import_max] IS NULL;

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues]
    ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT
    @run_id,
    N'DBO_ONLY_GRADE_ROW',
    N'grade',
    CONVERT(nvarchar(128), d.[id]),
    d.[nid],
    (
        SELECT
            d.[seat],
            d.[seating_number],
            d.[nid],
            d.[name],
            d.[kind],
            d.[school_category_code],
            d.[total],
            d.[import_max],
            [reason] = N'Normalized grade row exists in dbo but no live staging grade row matched by NID.'
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ),
    @now
FROM [dbo].[applicant_grades] AS d
LEFT JOIN #valid_grade_source AS s ON s.[nid] = d.[nid]
WHERE s.[nid] IS NULL;

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [nid] HAVING COUNT_BIG(*) > 1)
    THROW 51000, 'Duplicate valid staging grade NIDs detected. Aborting normalization.', 1;

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seat] HAVING COUNT_BIG(*) > 1)
    THROW 51001, 'Duplicate valid staging grade seats detected. Aborting normalization.', 1;

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seating_number] HAVING COUNT_BIG(*) > 1)
    THROW 51002, 'Duplicate valid staging grade seating numbers detected. Aborting normalization.', 1;

IF EXISTS
(
    SELECT 1
    FROM #valid_grade_source AS s
    JOIN [dbo].[applicant_grades] AS d
      ON d.[seat] = s.[seat]
     AND d.[nid] <> s.[nid]
)
    THROW 51003, 'A staging grade seat conflicts with a different dbo grade NID. Aborting normalization.', 1;

IF EXISTS
(
    SELECT 1
    FROM #valid_grade_source AS s
    JOIN [dbo].[applicant_grades] AS d
      ON d.[seating_number] = s.[seating_number]
     AND d.[nid] <> s.[nid]
)
    THROW 51004, 'A staging grade seating number conflicts with a different dbo grade NID. Aborting normalization.', 1;

MERGE [dbo].[applicant_grades] WITH (HOLDLOCK) AS target
USING #valid_grade_source AS source
ON target.[nid] = source.[nid]
WHEN MATCHED THEN
    UPDATE SET
        target.[seat] = source.[seat],
        target.[seating_number] = source.[seating_number],
        target.[name] = source.[name],
        target.[kind] = source.[kind],
        target.[gender] = source.[gender],
        target.[branch] = source.[branch],
        target.[graduation_year] = source.[graduation_year],
        target.[school_category_code] = source.[school_category_code],
        target.[school] = source.[school],
        target.[region] = source.[region],
        target.[exam_round] = source.[exam_round],
        target.[total] = source.[total],
        target.[import_max] = source.[import_max],
        target.[override_max] = source.[override_max],
        target.[last_edited_at] = source.[last_edited_at],
        target.[last_edited_by] = source.[last_edited_by],
        target.[grade_changed_at] = source.[grade_changed_at],
        target.[previous_grade] = source.[previous_grade],
        target.[status] = source.[status],
        target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        [id],
        [seat],
        [seating_number],
        [nid],
        [name],
        [kind],
        [gender],
        [branch],
        [graduation_year],
        [school_category_code],
        [school],
        [region],
        [exam_round],
        [total],
        [import_max],
        [override_max],
        [last_edited_at],
        [last_edited_by],
        [grade_changed_at],
        [previous_grade],
        [status],
        [created_at],
        [updated_at]
    )
    VALUES
    (
        NEWID(),
        source.[seat],
        source.[seating_number],
        source.[nid],
        source.[name],
        source.[kind],
        source.[gender],
        source.[branch],
        source.[graduation_year],
        source.[school_category_code],
        source.[school],
        source.[region],
        source.[exam_round],
        source.[total],
        source.[import_max],
        source.[override_max],
        source.[last_edited_at],
        source.[last_edited_by],
        source.[grade_changed_at],
        source.[previous_grade],
        source.[status],
        @now,
        @now
    );

SELECT
    [source_applicant_id] = TRY_CONVERT(uniqueidentifier, JSON_VALUE(ar.[payload_json], '$.sourceApplicantId')),
    [national_id] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nationalId'))), ''),
    [full_name] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.name'))), ''),
    [gender] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.gender'))), ''),
    [date_of_birth] = TRY_CONVERT(date, NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.birthDate'))), '')),
    [birth_governorate] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.governorate'))), ''),
    [birth_district] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.city'))), '')
INTO #staging_applicants
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'applicants'
  AND NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nationalId'))), '') IS NOT NULL;

IF EXISTS (SELECT 1 FROM #staging_applicants GROUP BY [national_id] HAVING COUNT_BIG(*) > 1)
    THROW 51005, 'Duplicate staging applicant national IDs detected. Aborting normalization.', 1;

MERGE [dbo].[applicants] WITH (HOLDLOCK) AS target
USING #staging_applicants AS source
ON target.[national_id] = source.[national_id]
WHEN MATCHED THEN
    UPDATE SET
        target.[full_name] = COALESCE(source.[full_name], target.[full_name]),
        target.[gender] = COALESCE(source.[gender], target.[gender]),
        target.[date_of_birth] = COALESCE(source.[date_of_birth], target.[date_of_birth]),
        target.[birth_governorate] = COALESCE(source.[birth_governorate], target.[birth_governorate]),
        target.[birth_district] = COALESCE(source.[birth_district], target.[birth_district]),
        target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        [id],
        [national_id],
        [phone_number],
        [full_name],
        [email],
        [gender],
        [religion],
        [date_of_birth],
        [birth_governorate],
        [birth_district],
        [source],
        [created_at],
        [updated_at]
    )
    VALUES
    (
        COALESCE(source.[source_applicant_id], NEWID()),
        source.[national_id],
        N'',
        source.[full_name],
        NULL,
        source.[gender],
        NULL,
        source.[date_of_birth],
        source.[birth_governorate],
        source.[birth_district],
        N'admin_records_normalization',
        @now,
        @now
    );

SELECT
    [run_id] = @run_id,
    [issue_rows_logged] = COUNT_BIG(*)
FROM [PACademy_staging_db].[admin_record_normalization_issues]
WHERE [run_id] = @run_id;

COMMIT TRANSACTION;
