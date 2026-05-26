/*
  Applies to UAT/staging only.

  Purpose:
    Create staging-owned normalized tables in [PACademy_staging_db] and backfill
    them from live [PACademy_staging_db].[admin_records].

  Safety:
    - Does not delete or update admin_records.
    - Does not write to dbo.
    - Only valid live grade rows with 14-digit NIDs are inserted/upserted.
    - Invalid grade rows and skipped soft-deleted history are logged.
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

IF OBJECT_ID(N'[PACademy_staging_db].[applicants]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[applicants]
    (
        [id] uniqueidentifier NOT NULL CONSTRAINT [PK_staging_applicants] PRIMARY KEY,
        [admin_record_id] nvarchar(128) NULL,
        [national_id] nvarchar(28) NOT NULL,
        [phone_number] nvarchar(22) NULL,
        [full_name] nvarchar(400) NULL,
        [email] nvarchar(400) NULL,
        [gender] nvarchar(32) NULL,
        [religion] nvarchar(32) NULL,
        [date_of_birth] date NULL,
        [birth_governorate] nvarchar(240) NULL,
        [birth_district] nvarchar(240) NULL,
        [certificate_type] nvarchar(240) NULL,
        [source] nvarchar(64) NOT NULL CONSTRAINT [DF_staging_applicants_source] DEFAULT N'admin_records',
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicants_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicants_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );

    CREATE UNIQUE INDEX [UX_staging_applicants_national_id]
        ON [PACademy_staging_db].[applicants] ([national_id]);
END;

IF OBJECT_ID(N'[PACademy_staging_db].[applicant_grades]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[applicant_grades]
    (
        [id] uniqueidentifier NOT NULL CONSTRAINT [PK_staging_applicant_grades] PRIMARY KEY,
        [admin_record_id] nvarchar(128) NULL,
        [seat] int NOT NULL,
        [seating_number] nvarchar(64) NOT NULL,
        [nid] nvarchar(28) NOT NULL,
        [name] nvarchar(400) NOT NULL,
        [kind] nvarchar(32) NOT NULL,
        [gender] nvarchar(32) NULL,
        [branch] nvarchar(400) NULL,
        [graduation_year] int NULL,
        [school_category_code] nvarchar(64) NULL,
        [school] nvarchar(400) NULL,
        [region] nvarchar(240) NULL,
        [exam_round] nvarchar(128) NULL,
        [total] decimal(7,2) NOT NULL,
        [import_max] decimal(7,2) NOT NULL,
        [override_max] decimal(7,2) NULL,
        [last_edited_at] nvarchar(128) NULL,
        [last_edited_by] nvarchar(240) NULL,
        [grade_changed_at] datetimeoffset NULL,
        [previous_grade] decimal(7,2) NULL,
        [status] nvarchar(128) NOT NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicant_grades_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicant_grades_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );

    CREATE UNIQUE INDEX [UX_staging_applicant_grades_nid]
        ON [PACademy_staging_db].[applicant_grades] ([nid]);

    CREATE UNIQUE INDEX [UX_staging_applicant_grades_seat]
        ON [PACademy_staging_db].[applicant_grades] ([seat]);

    CREATE UNIQUE INDEX [UX_staging_applicant_grades_seating_number]
        ON [PACademy_staging_db].[applicant_grades] ([seating_number]);

    CREATE INDEX [IX_staging_applicant_grades_filters]
        ON [PACademy_staging_db].[applicant_grades] ([school_category_code], [graduation_year], [branch], [kind], [seat]);

    CREATE INDEX [IX_staging_applicant_grades_changed]
        ON [PACademy_staging_db].[applicant_grades] ([grade_changed_at], [seat])
        WHERE [grade_changed_at] IS NOT NULL;
END;

IF OBJECT_ID(N'[PACademy_staging_db].[applicant_grade_adjustments]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[applicant_grade_adjustments]
    (
        [id] uniqueidentifier NOT NULL CONSTRAINT [PK_staging_applicant_grade_adjustments] PRIMARY KEY,
        [applicant_grade_id] uniqueidentifier NOT NULL,
        [source_entry_id] nvarchar(128) NOT NULL,
        [reason] nvarchar(128) NULL,
        [reason_label] nvarchar(256) NULL,
        [note] nvarchar(max) NULL,
        [amount] decimal(7,2) NOT NULL,
        [by] nvarchar(240) NULL,
        [when_label] nvarchar(128) NULL,
        [is_active] bit NOT NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicant_grade_adjustments_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_applicant_grade_adjustments_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL,
        CONSTRAINT [FK_staging_applicant_grade_adjustments_grade]
            FOREIGN KEY ([applicant_grade_id])
            REFERENCES [PACademy_staging_db].[applicant_grades] ([id])
    );

    CREATE UNIQUE INDEX [UX_staging_applicant_grade_adjustments_source]
        ON [PACademy_staging_db].[applicant_grade_adjustments] ([applicant_grade_id], [source_entry_id]);
END;

IF OBJECT_ID(N'tempdb..#live_grade_source', N'U') IS NOT NULL DROP TABLE #live_grade_source;
IF OBJECT_ID(N'tempdb..#valid_grade_source', N'U') IS NOT NULL DROP TABLE #valid_grade_source;
IF OBJECT_ID(N'tempdb..#staging_applicants', N'U') IS NOT NULL DROP TABLE #staging_applicants;

SELECT
    [admin_record_id] = ar.[id],
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
  AND [kind] IS NOT NULL
  AND [total] IS NOT NULL
  AND [import_max] IS NOT NULL;

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues]
    ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT
    @run_id,
    N'INVALID_GRADE_SOURCE_ROW',
    N'grade',
    [admin_record_id],
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
   OR [kind] IS NULL
   OR [total] IS NULL
   OR [import_max] IS NULL;

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues]
    ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT
    @run_id,
    N'SOFT_DELETED_GRADES_SKIPPED',
    N'grade',
    N'grades',
    NULL,
    (
        SELECT
            [skippedRows] = COUNT_BIG(*),
            [distinctNids] = COUNT(DISTINCT JSON_VALUE(ar.[payload_json], '$.nid')),
            [minDeletedAt] = MIN(JSON_VALUE(ar.[payload_json], '$.deletedAt')),
            [maxDeletedAt] = MAX(JSON_VALUE(ar.[payload_json], '$.deletedAt')),
            [reason] = N'Soft-deleted grade rows were intentionally not inserted into active normalized grades.'
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ),
    @now
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'grades'
  AND (JSON_VALUE(ar.[payload_json], '$.deletedAt') IS NOT NULL
       OR COALESCE(LOWER(JSON_VALUE(ar.[payload_json], '$.isDeleted')), N'false') = N'true');

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [nid] HAVING COUNT_BIG(*) > 1)
    THROW 51000, 'Duplicate valid staging grade NIDs detected. Aborting normalization.', 1;

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seat] HAVING COUNT_BIG(*) > 1)
    THROW 51001, 'Duplicate valid staging grade seats detected. Aborting normalization.', 1;

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seating_number] HAVING COUNT_BIG(*) > 1)
    THROW 51002, 'Duplicate valid staging grade seating numbers detected. Aborting normalization.', 1;

MERGE [PACademy_staging_db].[applicant_grades] WITH (HOLDLOCK) AS target
USING #valid_grade_source AS source
ON target.[nid] = source.[nid]
WHEN MATCHED THEN
    UPDATE SET
        target.[admin_record_id] = source.[admin_record_id],
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
        target.[payload_json] = source.[payload_json],
        target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        [id],
        [admin_record_id],
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
        [payload_json],
        [created_at],
        [updated_at]
    )
    VALUES
    (
        NEWID(),
        source.[admin_record_id],
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
        source.[payload_json],
        source.[created_at],
        @now
    );

SELECT
    [admin_record_id] = ar.[id],
    [source_applicant_id] = TRY_CONVERT(uniqueidentifier, JSON_VALUE(ar.[payload_json], '$.sourceApplicantId')),
    [national_id] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nationalId'))), ''),
    [phone_number] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.phoneNumber'))), ''),
    [full_name] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.name'))), ''),
    [email] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.email'))), ''),
    [gender] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.gender'))), ''),
    [date_of_birth] = TRY_CONVERT(date, NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.birthDate'))), '')),
    [birth_governorate] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.governorate'))), ''),
    [birth_district] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.city'))), ''),
    [certificate_type] = NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.certType'))), ''),
    [payload_json] = ar.[payload_json],
    [created_at] = ar.[created_at],
    [updated_at] = ar.[updated_at]
INTO #staging_applicants
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'applicants'
  AND NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nationalId'))), '') IS NOT NULL;

IF EXISTS (SELECT 1 FROM #staging_applicants GROUP BY [national_id] HAVING COUNT_BIG(*) > 1)
    THROW 51005, 'Duplicate staging applicant national IDs detected. Aborting normalization.', 1;

MERGE [PACademy_staging_db].[applicants] WITH (HOLDLOCK) AS target
USING #staging_applicants AS source
ON target.[national_id] = source.[national_id]
WHEN MATCHED THEN
    UPDATE SET
        target.[admin_record_id] = source.[admin_record_id],
        target.[phone_number] = COALESCE(source.[phone_number], target.[phone_number]),
        target.[full_name] = COALESCE(source.[full_name], target.[full_name]),
        target.[email] = COALESCE(source.[email], target.[email]),
        target.[gender] = COALESCE(source.[gender], target.[gender]),
        target.[date_of_birth] = COALESCE(source.[date_of_birth], target.[date_of_birth]),
        target.[birth_governorate] = COALESCE(source.[birth_governorate], target.[birth_governorate]),
        target.[birth_district] = COALESCE(source.[birth_district], target.[birth_district]),
        target.[certificate_type] = COALESCE(source.[certificate_type], target.[certificate_type]),
        target.[payload_json] = source.[payload_json],
        target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        [id],
        [admin_record_id],
        [national_id],
        [phone_number],
        [full_name],
        [email],
        [gender],
        [date_of_birth],
        [birth_governorate],
        [birth_district],
        [certificate_type],
        [source],
        [payload_json],
        [created_at],
        [updated_at]
    )
    VALUES
    (
        COALESCE(source.[source_applicant_id], NEWID()),
        source.[admin_record_id],
        source.[national_id],
        source.[phone_number],
        source.[full_name],
        source.[email],
        source.[gender],
        source.[date_of_birth],
        source.[birth_governorate],
        source.[birth_district],
        source.[certificate_type],
        N'admin_records',
        source.[payload_json],
        source.[created_at],
        @now
    );

MERGE [PACademy_staging_db].[applicant_grade_adjustments] WITH (HOLDLOCK) AS target
USING
(
    SELECT
        [applicant_grade_id] = g.[id],
        [source_entry_id] = COALESCE(NULLIF(JSON_VALUE(adj.[value], '$.id'), ''), CONCAT(g.[nid], N':', CONVERT(nvarchar(20), adj.[key]))),
        [reason] = NULLIF(JSON_VALUE(adj.[value], '$.reason'), ''),
        [reason_label] = COALESCE(NULLIF(JSON_VALUE(adj.[value], '$.reasonLabel'), ''), NULLIF(JSON_VALUE(adj.[value], '$.reason'), '')),
        [note] = NULLIF(JSON_VALUE(adj.[value], '$.note'), ''),
        [amount] = COALESCE(TRY_CONVERT(decimal(7,2), JSON_VALUE(adj.[value], '$.amount')), 0),
        [by] = NULLIF(JSON_VALUE(adj.[value], '$.by'), ''),
        [when_label] = COALESCE(NULLIF(JSON_VALUE(adj.[value], '$.when'), ''), NULLIF(JSON_VALUE(adj.[value], '$.whenLabel'), '')),
        [is_active] = CASE WHEN COALESCE(LOWER(JSON_VALUE(adj.[value], '$.isActive')), N'true') = N'false' THEN CONVERT(bit, 0) ELSE CONVERT(bit, 1) END,
        [payload_json] = CONVERT(nvarchar(max), adj.[value])
    FROM [PACademy_staging_db].[applicant_grades] AS g
    CROSS APPLY OPENJSON(g.[payload_json], '$.log') AS adj
    WHERE ISJSON(g.[payload_json]) = 1
) AS source
ON target.[applicant_grade_id] = source.[applicant_grade_id]
AND target.[source_entry_id] = source.[source_entry_id]
WHEN MATCHED THEN
    UPDATE SET
        target.[reason] = source.[reason],
        target.[reason_label] = source.[reason_label],
        target.[note] = source.[note],
        target.[amount] = source.[amount],
        target.[by] = source.[by],
        target.[when_label] = source.[when_label],
        target.[is_active] = source.[is_active],
        target.[payload_json] = source.[payload_json],
        target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        [id],
        [applicant_grade_id],
        [source_entry_id],
        [reason],
        [reason_label],
        [note],
        [amount],
        [by],
        [when_label],
        [is_active],
        [payload_json],
        [created_at],
        [updated_at]
    )
    VALUES
    (
        NEWID(),
        source.[applicant_grade_id],
        source.[source_entry_id],
        source.[reason],
        source.[reason_label],
        source.[note],
        source.[amount],
        source.[by],
        source.[when_label],
        source.[is_active],
        source.[payload_json],
        @now,
        @now
    );

SELECT
    [run_id] = @run_id,
    [normalized_applicants] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicants]),
    [normalized_grades] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicant_grades]),
    [normalized_adjustments] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicant_grade_adjustments]),
    [issue_rows_logged] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[admin_record_normalization_issues] WHERE [run_id] = @run_id);

COMMIT TRANSACTION;
