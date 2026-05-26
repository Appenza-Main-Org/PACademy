/*
  UAT/STAGING NORMALIZATION

  Purpose:
    Convert all active PACademy_staging_db.admin_records entity modules into
    real PACademy_staging_db SQL tables.

  Active modules covered:
    - applicants
    - grades
    - questions
    - exams
    - settings
    - admissionSetup.applicationSettings.{cycleId}

  Also denormalizes hot cycle fields from admission_cycles.payload_json into columns.

  Safety:
    - Does not delete, truncate, or update admin_records.
    - Invalid grade rows are quarantined in admin_record_normalization_issues.
    - Soft-deleted grade rows are logged and skipped from active applicant_grades.
    - Child rows in normalized target tables are refreshed from their source rows
      so the script is rerunnable.
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

/* -------------------------------------------------------------------------- */
/* Cycles: keep existing table, add normalized hot columns                     */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'cohort') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [cohort] nvarchar(32) NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'open_date') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [open_date] datetimeoffset NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'close_date') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [close_date] datetimeoffset NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'expected_capacity') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [expected_capacity] int NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'deleted_at') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [deleted_at] datetimeoffset NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'deleted_by') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [deleted_by] nvarchar(128) NULL;

IF COL_LENGTH(N'PACademy_staging_db.admission_cycles', N'delete_reason') IS NULL
    ALTER TABLE [PACademy_staging_db].[admission_cycles] ADD [delete_reason] nvarchar(512) NULL;

EXEC sp_executesql N'
UPDATE c
SET
    [cohort] = COALESCE(NULLIF(JSON_VALUE(c.[payload_json], ''$.cohort''), ''''), c.[cohort]),
    [open_date] = COALESCE(TRY_CONVERT(datetimeoffset, JSON_VALUE(c.[payload_json], ''$.openDate'')), c.[open_date]),
    [close_date] = COALESCE(TRY_CONVERT(datetimeoffset, JSON_VALUE(c.[payload_json], ''$.closeDate'')), c.[close_date]),
    [expected_capacity] = COALESCE(TRY_CONVERT(int, JSON_VALUE(c.[payload_json], ''$.expectedCapacity'')), c.[expected_capacity]),
    [deleted_at] = COALESCE(TRY_CONVERT(datetimeoffset, JSON_VALUE(c.[payload_json], ''$.deletedAt'')), c.[deleted_at]),
    [deleted_by] = COALESCE(NULLIF(JSON_VALUE(c.[payload_json], ''$.deletedBy''), ''''), c.[deleted_by]),
    [delete_reason] = COALESCE(NULLIF(JSON_VALUE(c.[payload_json], ''$.deleteReason''), ''''), c.[delete_reason])
FROM [PACademy_staging_db].[admission_cycles] AS c
WHERE ISJSON(c.[payload_json]) = 1;';

/* -------------------------------------------------------------------------- */
/* Applicants + grades                                                        */
/* -------------------------------------------------------------------------- */

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
    CREATE UNIQUE INDEX [UX_staging_applicants_national_id] ON [PACademy_staging_db].[applicants] ([national_id]);
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
    CREATE UNIQUE INDEX [UX_staging_applicant_grades_nid] ON [PACademy_staging_db].[applicant_grades] ([nid]);
    CREATE UNIQUE INDEX [UX_staging_applicant_grades_seat] ON [PACademy_staging_db].[applicant_grades] ([seat]);
    CREATE UNIQUE INDEX [UX_staging_applicant_grades_seating_number] ON [PACademy_staging_db].[applicant_grades] ([seating_number]);
    CREATE INDEX [IX_staging_applicant_grades_filters] ON [PACademy_staging_db].[applicant_grades] ([school_category_code], [graduation_year], [branch], [kind], [seat]);
    CREATE INDEX [IX_staging_applicant_grades_changed] ON [PACademy_staging_db].[applicant_grades] ([grade_changed_at], [seat]) WHERE [grade_changed_at] IS NOT NULL;
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
        CONSTRAINT [FK_staging_applicant_grade_adjustments_grade] FOREIGN KEY ([applicant_grade_id]) REFERENCES [PACademy_staging_db].[applicant_grades] ([id])
    );
    CREATE UNIQUE INDEX [UX_staging_applicant_grade_adjustments_source] ON [PACademy_staging_db].[applicant_grade_adjustments] ([applicant_grade_id], [source_entry_id]);
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
    [school_category_code] = COALESCE(NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.schoolCategoryCode'))), ''), NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.schoolCategory'))), '')),
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

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues] ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT @run_id, N'INVALID_GRADE_SOURCE_ROW', N'grade', [admin_record_id], [nid],
       (SELECT [seat], [seating_number], [nid], [name], [kind], [school_category_code], [total], [import_max],
               [reason] = N'Live staging grade row is missing required normalized fields or does not have a 14-digit NID.'
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
       @now
FROM #live_grade_source
WHERE [nid] IS NULL OR LEN([nid]) <> 14 OR [seat] IS NULL OR [seating_number] IS NULL OR [name] IS NULL OR [kind] IS NULL OR [total] IS NULL OR [import_max] IS NULL;

INSERT INTO [PACademy_staging_db].[admin_record_normalization_issues] ([run_id], [issue_code], [entity_type], [source_key], [natural_key], [details_json], [created_at])
SELECT @run_id, N'SOFT_DELETED_GRADES_SKIPPED', N'grade', N'grades', NULL,
       (SELECT [skippedRows] = COUNT_BIG(*), [distinctNids] = COUNT(DISTINCT JSON_VALUE(ar.[payload_json], '$.nid')),
               [minDeletedAt] = MIN(JSON_VALUE(ar.[payload_json], '$.deletedAt')),
               [maxDeletedAt] = MAX(JSON_VALUE(ar.[payload_json], '$.deletedAt')),
               [reason] = N'Soft-deleted grade rows were intentionally not inserted into active normalized grades.'
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
       @now
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'grades'
  AND (JSON_VALUE(ar.[payload_json], '$.deletedAt') IS NOT NULL OR COALESCE(LOWER(JSON_VALUE(ar.[payload_json], '$.isDeleted')), N'false') = N'true');

IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [nid] HAVING COUNT_BIG(*) > 1) THROW 51000, 'Duplicate valid staging grade NIDs detected.', 1;
IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seat] HAVING COUNT_BIG(*) > 1) THROW 51001, 'Duplicate valid staging grade seats detected.', 1;
IF EXISTS (SELECT 1 FROM #valid_grade_source GROUP BY [seating_number] HAVING COUNT_BIG(*) > 1) THROW 51002, 'Duplicate valid staging grade seating numbers detected.', 1;

MERGE [PACademy_staging_db].[applicant_grades] WITH (HOLDLOCK) AS target
USING #valid_grade_source AS source
ON target.[nid] COLLATE DATABASE_DEFAULT = source.[nid] COLLATE DATABASE_DEFAULT
WHEN MATCHED THEN UPDATE SET
    target.[admin_record_id] = source.[admin_record_id], target.[seat] = source.[seat], target.[seating_number] = source.[seating_number],
    target.[name] = source.[name], target.[kind] = source.[kind], target.[gender] = source.[gender], target.[branch] = source.[branch],
    target.[graduation_year] = source.[graduation_year], target.[school_category_code] = source.[school_category_code],
    target.[school] = source.[school], target.[region] = source.[region], target.[exam_round] = source.[exam_round],
    target.[total] = source.[total], target.[import_max] = source.[import_max], target.[override_max] = source.[override_max],
    target.[last_edited_at] = source.[last_edited_at], target.[last_edited_by] = source.[last_edited_by],
    target.[grade_changed_at] = source.[grade_changed_at], target.[previous_grade] = source.[previous_grade],
    target.[status] = source.[status], target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [admin_record_id], [seat], [seating_number], [nid], [name], [kind], [gender], [branch], [graduation_year],
     [school_category_code], [school], [region], [exam_round], [total], [import_max], [override_max], [last_edited_at],
     [last_edited_by], [grade_changed_at], [previous_grade], [status], [payload_json], [created_at], [updated_at])
VALUES
    (NEWID(), source.[admin_record_id], source.[seat], source.[seating_number], source.[nid], source.[name], source.[kind],
     source.[gender], source.[branch], source.[graduation_year], source.[school_category_code], source.[school], source.[region],
     source.[exam_round], source.[total], source.[import_max], source.[override_max], source.[last_edited_at], source.[last_edited_by],
     source.[grade_changed_at], source.[previous_grade], source.[status], source.[payload_json], source.[created_at], @now);

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
    [payload_json] = ar.[payload_json], [created_at] = ar.[created_at], [updated_at] = ar.[updated_at]
INTO #staging_applicants
FROM [PACademy_staging_db].[admin_records] AS ar
WHERE ar.[module] = N'applicants' AND NULLIF(LTRIM(RTRIM(JSON_VALUE(ar.[payload_json], '$.nationalId'))), '') IS NOT NULL;

IF EXISTS (SELECT 1 FROM #staging_applicants GROUP BY [national_id] HAVING COUNT_BIG(*) > 1) THROW 51005, 'Duplicate staging applicant national IDs detected.', 1;

MERGE [PACademy_staging_db].[applicants] WITH (HOLDLOCK) AS target
USING #staging_applicants AS source
ON target.[national_id] COLLATE DATABASE_DEFAULT = source.[national_id] COLLATE DATABASE_DEFAULT
WHEN MATCHED THEN UPDATE SET
    target.[admin_record_id] = source.[admin_record_id], target.[phone_number] = COALESCE(source.[phone_number], target.[phone_number]),
    target.[full_name] = COALESCE(source.[full_name], target.[full_name]), target.[email] = COALESCE(source.[email], target.[email]),
    target.[gender] = COALESCE(source.[gender], target.[gender]), target.[date_of_birth] = COALESCE(source.[date_of_birth], target.[date_of_birth]),
    target.[birth_governorate] = COALESCE(source.[birth_governorate], target.[birth_governorate]),
    target.[birth_district] = COALESCE(source.[birth_district], target.[birth_district]),
    target.[certificate_type] = COALESCE(source.[certificate_type], target.[certificate_type]),
    target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [admin_record_id], [national_id], [phone_number], [full_name], [email], [gender], [date_of_birth],
     [birth_governorate], [birth_district], [certificate_type], [source], [payload_json], [created_at], [updated_at])
VALUES
    (COALESCE(source.[source_applicant_id], NEWID()), source.[admin_record_id], source.[national_id], source.[phone_number],
     source.[full_name], source.[email], source.[gender], source.[date_of_birth], source.[birth_governorate],
     source.[birth_district], source.[certificate_type], N'admin_records', source.[payload_json], source.[created_at], @now);

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
AND target.[source_entry_id] COLLATE DATABASE_DEFAULT = source.[source_entry_id] COLLATE DATABASE_DEFAULT
WHEN MATCHED THEN UPDATE SET
    target.[reason] = source.[reason], target.[reason_label] = source.[reason_label], target.[note] = source.[note],
    target.[amount] = source.[amount], target.[by] = source.[by], target.[when_label] = source.[when_label],
    target.[is_active] = source.[is_active], target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [applicant_grade_id], [source_entry_id], [reason], [reason_label], [note], [amount], [by], [when_label], [is_active], [payload_json], [created_at], [updated_at])
VALUES
    (NEWID(), source.[applicant_grade_id], source.[source_entry_id], source.[reason], source.[reason_label], source.[note],
     source.[amount], source.[by], source.[when_label], source.[is_active], source.[payload_json], @now, @now);

/* -------------------------------------------------------------------------- */
/* Exam questions and exams                                                   */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID(N'[PACademy_staging_db].[exam_questions]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exam_questions]
    (
        [id] nvarchar(128) NOT NULL CONSTRAINT [PK_staging_exam_questions] PRIMARY KEY,
        [category] nvarchar(256) NULL,
        [difficulty] int NULL,
        [type] nvarchar(64) NULL,
        [text] nvarchar(max) NULL,
        [correct_index] int NULL,
        [time_limit_seconds] int NULL,
        [notes] nvarchar(max) NULL,
        [status] nvarchar(48) NOT NULL,
        [version] int NOT NULL,
        [image_url] nvarchar(1024) NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_exam_questions_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_exam_questions_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );
    CREATE INDEX [IX_staging_exam_questions_category_status] ON [PACademy_staging_db].[exam_questions] ([category], [status], [difficulty]);
END;

IF OBJECT_ID(N'[PACademy_staging_db].[exam_question_options]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exam_question_options]
    (
        [question_id] nvarchar(128) NOT NULL,
        [option_order] int NOT NULL,
        [option_text] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_staging_exam_question_options] PRIMARY KEY ([question_id], [option_order]),
        CONSTRAINT [FK_staging_exam_question_options_question] FOREIGN KEY ([question_id]) REFERENCES [PACademy_staging_db].[exam_questions] ([id])
    );
END;

IF OBJECT_ID(N'[PACademy_staging_db].[exam_question_matching_pairs]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exam_question_matching_pairs]
    (
        [question_id] nvarchar(128) NOT NULL,
        [pair_order] int NOT NULL,
        [prompt] nvarchar(max) NOT NULL,
        [match_text] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_staging_exam_question_matching_pairs] PRIMARY KEY ([question_id], [pair_order]),
        CONSTRAINT [FK_staging_exam_question_matching_pairs_question] FOREIGN KEY ([question_id]) REFERENCES [PACademy_staging_db].[exam_questions] ([id])
    );
END;

MERGE [PACademy_staging_db].[exam_questions] WITH (HOLDLOCK) AS target
USING
(
    SELECT
        [id] = ar.[id],
        [category] = NULLIF(JSON_VALUE(ar.[payload_json], '$.category'), ''),
        [difficulty] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.difficulty')),
        [type] = NULLIF(JSON_VALUE(ar.[payload_json], '$.type'), ''),
        [text] = JSON_VALUE(ar.[payload_json], '$.text'),
        [correct_index] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.correctIndex')),
        [time_limit_seconds] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.timeLimitSeconds')),
        [notes] = JSON_VALUE(ar.[payload_json], '$.notes'),
        [status] = COALESCE(NULLIF(JSON_VALUE(ar.[payload_json], '$.status'), ''), N'draft'),
        [version] = COALESCE(TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.version')), 1),
        [image_url] = JSON_VALUE(ar.[payload_json], '$.imageUrl'),
        [payload_json] = ar.[payload_json],
        [created_at] = ar.[created_at],
        [updated_at] = ar.[updated_at]
    FROM [PACademy_staging_db].[admin_records] AS ar
    WHERE ar.[module] = N'questions'
) AS source
ON target.[id] = source.[id]
WHEN MATCHED THEN UPDATE SET
    target.[category] = source.[category], target.[difficulty] = source.[difficulty], target.[type] = source.[type],
    target.[text] = source.[text], target.[correct_index] = source.[correct_index], target.[time_limit_seconds] = source.[time_limit_seconds],
    target.[notes] = source.[notes], target.[status] = source.[status], target.[version] = source.[version],
    target.[image_url] = source.[image_url], target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [category], [difficulty], [type], [text], [correct_index], [time_limit_seconds], [notes], [status], [version], [image_url], [payload_json], [created_at], [updated_at])
VALUES
    (source.[id], source.[category], source.[difficulty], source.[type], source.[text], source.[correct_index],
     source.[time_limit_seconds], source.[notes], source.[status], source.[version], source.[image_url], source.[payload_json], source.[created_at], @now);

DELETE o
FROM [PACademy_staging_db].[exam_question_options] AS o
JOIN [PACademy_staging_db].[admin_records] AS ar ON ar.[module] = N'questions' AND ar.[id] = o.[question_id];

INSERT INTO [PACademy_staging_db].[exam_question_options] ([question_id], [option_order], [option_text])
SELECT ar.[id], TRY_CONVERT(int, opt.[key]), CONVERT(nvarchar(max), opt.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.options') AS opt
WHERE ar.[module] = N'questions';

DELETE p
FROM [PACademy_staging_db].[exam_question_matching_pairs] AS p
JOIN [PACademy_staging_db].[admin_records] AS ar ON ar.[module] = N'questions' AND ar.[id] = p.[question_id];

INSERT INTO [PACademy_staging_db].[exam_question_matching_pairs] ([question_id], [pair_order], [prompt], [match_text])
SELECT ar.[id], TRY_CONVERT(int, pair.[key]), JSON_VALUE(pair.[value], '$.prompt'), JSON_VALUE(pair.[value], '$.match')
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.matchingPairs') AS pair
WHERE ar.[module] = N'questions';

IF OBJECT_ID(N'[PACademy_staging_db].[exams]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exams]
    (
        [id] nvarchar(128) NOT NULL CONSTRAINT [PK_staging_exams] PRIMARY KEY,
        [name_ar] nvarchar(400) NOT NULL,
        [cycle_id] nvarchar(128) NULL,
        [scheduled_for] nvarchar(128) NULL,
        [status] nvarchar(48) NOT NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_exams_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_exams_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );
    CREATE INDEX [IX_staging_exams_cycle_status] ON [PACademy_staging_db].[exams] ([cycle_id], [status]);
END;

IF OBJECT_ID(N'[PACademy_staging_db].[exam_rules]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exam_rules]
    (
        [exam_id] nvarchar(128) NOT NULL,
        [rule_order] int NOT NULL,
        [category] nvarchar(256) NULL,
        [difficulty_min] int NULL,
        [difficulty_max] int NULL,
        [question_count] int NULL,
        [minutes] int NULL,
        CONSTRAINT [PK_staging_exam_rules] PRIMARY KEY ([exam_id], [rule_order]),
        CONSTRAINT [FK_staging_exam_rules_exam] FOREIGN KEY ([exam_id]) REFERENCES [PACademy_staging_db].[exams] ([id])
    );
END;

IF OBJECT_ID(N'[PACademy_staging_db].[exam_question_links]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[exam_question_links]
    (
        [exam_id] nvarchar(128) NOT NULL,
        [question_order] int NOT NULL,
        [question_id] nvarchar(128) NOT NULL,
        CONSTRAINT [PK_staging_exam_question_links] PRIMARY KEY ([exam_id], [question_order]),
        CONSTRAINT [FK_staging_exam_question_links_exam] FOREIGN KEY ([exam_id]) REFERENCES [PACademy_staging_db].[exams] ([id])
    );
END;

MERGE [PACademy_staging_db].[exams] WITH (HOLDLOCK) AS target
USING
(
    SELECT
        [id] = ar.[id],
        [name_ar] = COALESCE(NULLIF(JSON_VALUE(ar.[payload_json], '$.nameAr'), ''), ar.[id]),
        [cycle_id] = NULLIF(JSON_VALUE(ar.[payload_json], '$.cycleId'), ''),
        [scheduled_for] = JSON_VALUE(ar.[payload_json], '$.scheduledFor'),
        [status] = COALESCE(NULLIF(JSON_VALUE(ar.[payload_json], '$.status'), ''), N'draft'),
        [payload_json] = ar.[payload_json],
        [created_at] = ar.[created_at]
    FROM [PACademy_staging_db].[admin_records] AS ar
    WHERE ar.[module] = N'exams'
) AS source
ON target.[id] = source.[id]
WHEN MATCHED THEN UPDATE SET
    target.[name_ar] = source.[name_ar], target.[cycle_id] = source.[cycle_id], target.[scheduled_for] = source.[scheduled_for],
    target.[status] = source.[status], target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [name_ar], [cycle_id], [scheduled_for], [status], [payload_json], [created_at], [updated_at])
VALUES
    (source.[id], source.[name_ar], source.[cycle_id], source.[scheduled_for], source.[status], source.[payload_json], source.[created_at], @now);

DELETE r FROM [PACademy_staging_db].[exam_rules] AS r JOIN [PACademy_staging_db].[admin_records] AS ar ON ar.[module] = N'exams' AND ar.[id] = r.[exam_id];
INSERT INTO [PACademy_staging_db].[exam_rules] ([exam_id], [rule_order], [category], [difficulty_min], [difficulty_max], [question_count], [minutes])
SELECT ar.[id], TRY_CONVERT(int, exam_rule.[key]), JSON_VALUE(exam_rule.[value], '$.category'), TRY_CONVERT(int, JSON_VALUE(exam_rule.[value], '$.difficultyMin')),
       TRY_CONVERT(int, JSON_VALUE(exam_rule.[value], '$.difficultyMax')), TRY_CONVERT(int, JSON_VALUE(exam_rule.[value], '$.count')), TRY_CONVERT(int, JSON_VALUE(exam_rule.[value], '$.minutes'))
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.rules') AS exam_rule
WHERE ar.[module] = N'exams';

DELETE l FROM [PACademy_staging_db].[exam_question_links] AS l JOIN [PACademy_staging_db].[admin_records] AS ar ON ar.[module] = N'exams' AND ar.[id] = l.[exam_id];
INSERT INTO [PACademy_staging_db].[exam_question_links] ([exam_id], [question_order], [question_id])
SELECT ar.[id], TRY_CONVERT(int, q.[key]), CONVERT(nvarchar(128), q.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.questionIds') AS q
WHERE ar.[module] = N'exams';

/* -------------------------------------------------------------------------- */
/* Admin settings                                                             */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID(N'[PACademy_staging_db].[admin_settings]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[admin_settings]
    (
        [id] nvarchar(64) NOT NULL CONSTRAINT [PK_staging_admin_settings] PRIMARY KEY,
        [exam_days_per_applicant] int NULL,
        [exam_slot_selection_window_days] int NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_admin_settings_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_admin_settings_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );
END;

MERGE [PACademy_staging_db].[admin_settings] WITH (HOLDLOCK) AS target
USING
(
    SELECT
        [id] = N'settings',
        [exam_days_per_applicant] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.examDaysPerApplicant')),
        [exam_slot_selection_window_days] = TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.examSlotSelectionWindowDays')),
        [payload_json] = ar.[payload_json],
        [created_at] = ar.[created_at]
    FROM [PACademy_staging_db].[admin_records] AS ar
    WHERE ar.[module] = N'settings' AND ar.[id] = N'settings'
) AS source
ON target.[id] = source.[id]
WHEN MATCHED THEN UPDATE SET
    target.[exam_days_per_applicant] = source.[exam_days_per_applicant],
    target.[exam_slot_selection_window_days] = source.[exam_slot_selection_window_days],
    target.[payload_json] = source.[payload_json],
    target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [exam_days_per_applicant], [exam_slot_selection_window_days], [payload_json], [created_at], [updated_at])
VALUES
    (source.[id], source.[exam_days_per_applicant], source.[exam_slot_selection_window_days], source.[payload_json], source.[created_at], @now);

/* -------------------------------------------------------------------------- */
/* Cycle application settings drafts                                          */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID(N'[PACademy_staging_db].[cycle_application_settings]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[cycle_application_settings]
    (
        [id] nvarchar(256) NOT NULL CONSTRAINT [PK_staging_cycle_application_settings] PRIMARY KEY,
        [cycle_id] nvarchar(128) NOT NULL,
        [version] int NOT NULL,
        [updated_at_payload] datetimeoffset NULL,
        [payload_json] nvarchar(max) NULL,
        [created_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_cycle_application_settings_created_at] DEFAULT SYSDATETIMEOFFSET(),
        [updated_at] datetimeoffset NOT NULL CONSTRAINT [DF_staging_cycle_application_settings_updated_at] DEFAULT SYSDATETIMEOFFSET(),
        [row_version] rowversion NOT NULL
    );
    CREATE UNIQUE INDEX [UX_staging_cycle_application_settings_cycle] ON [PACademy_staging_db].[cycle_application_settings] ([cycle_id]);
END;

IF OBJECT_ID(N'[PACademy_staging_db].[cycle_application_setting_headers]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[cycle_application_setting_headers]
    (
        [cycle_setting_id] nvarchar(256) NOT NULL,
        [category_key] nvarchar(128) NOT NULL,
        [application_start] date NULL,
        [application_end] date NULL,
        [age_reference_date] date NULL,
        [age_min] int NULL,
        [max_age] int NULL,
        [grade_kind] nvarchar(64) NULL,
        [min_percentage] decimal(7,2) NULL,
        [academic_grade_id] nvarchar(128) NULL,
        [payload_json] nvarchar(max) NULL,
        CONSTRAINT [PK_staging_cycle_application_setting_headers] PRIMARY KEY ([cycle_setting_id], [category_key]),
        CONSTRAINT [FK_staging_cycle_application_setting_headers_setting] FOREIGN KEY ([cycle_setting_id]) REFERENCES [PACademy_staging_db].[cycle_application_settings] ([id])
    );
END;

IF OBJECT_ID(N'[PACademy_staging_db].[cycle_application_setting_values]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[cycle_application_setting_values]
    (
        [cycle_setting_id] nvarchar(256) NOT NULL,
        [category_key] nvarchar(128) NOT NULL,
        [value_group] nvarchar(96) NOT NULL,
        [value_order] int NOT NULL,
        [value] nvarchar(256) NOT NULL,
        CONSTRAINT [PK_staging_cycle_application_setting_values] PRIMARY KEY ([cycle_setting_id], [category_key], [value_group], [value_order])
    );
    CREATE INDEX [IX_staging_cycle_application_setting_values_lookup] ON [PACademy_staging_db].[cycle_application_setting_values] ([value_group], [value]);
END;

IF OBJECT_ID(N'[PACademy_staging_db].[cycle_application_setting_entries]', N'U') IS NULL
BEGIN
    CREATE TABLE [PACademy_staging_db].[cycle_application_setting_entries]
    (
        [cycle_setting_id] nvarchar(256) NOT NULL,
        [entry_group] nvarchar(32) NOT NULL,
        [entry_order] int NOT NULL,
        [entry_id] nvarchar(256) NULL,
        [category_key] nvarchar(128) NULL,
        [payload_json] nvarchar(max) NULL,
        CONSTRAINT [PK_staging_cycle_application_setting_entries] PRIMARY KEY ([cycle_setting_id], [entry_group], [entry_order])
    );
END;

MERGE [PACademy_staging_db].[cycle_application_settings] WITH (HOLDLOCK) AS target
USING
(
    SELECT
        [id] = ar.[id],
        [cycle_id] = COALESCE(NULLIF(JSON_VALUE(ar.[payload_json], '$.cycleId'), ''), REPLACE(ar.[module], N'admissionSetup.applicationSettings.', N'')),
        [version] = COALESCE(TRY_CONVERT(int, JSON_VALUE(ar.[payload_json], '$.version')), 1),
        [updated_at_payload] = TRY_CONVERT(datetimeoffset, JSON_VALUE(ar.[payload_json], '$.updatedAt')),
        [payload_json] = ar.[payload_json],
        [created_at] = ar.[created_at]
    FROM [PACademy_staging_db].[admin_records] AS ar
    WHERE ar.[module] LIKE N'admissionSetup.applicationSettings.%'
) AS source
ON target.[id] = source.[id]
WHEN MATCHED THEN UPDATE SET
    target.[cycle_id] = source.[cycle_id], target.[version] = source.[version], target.[updated_at_payload] = source.[updated_at_payload],
    target.[payload_json] = source.[payload_json], target.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN INSERT
    ([id], [cycle_id], [version], [updated_at_payload], [payload_json], [created_at], [updated_at])
VALUES
    (source.[id], source.[cycle_id], source.[version], source.[updated_at_payload], source.[payload_json], source.[created_at], @now);

DELETE h
FROM [PACademy_staging_db].[cycle_application_setting_headers] AS h
JOIN [PACademy_staging_db].[cycle_application_settings] AS s ON s.[id] = h.[cycle_setting_id];

INSERT INTO [PACademy_staging_db].[cycle_application_setting_headers]
    ([cycle_setting_id], [category_key], [application_start], [application_end], [age_reference_date], [age_min], [max_age], [grade_kind], [min_percentage], [academic_grade_id], [payload_json])
SELECT
    ar.[id],
    header.[key],
    TRY_CONVERT(date, JSON_VALUE(header.[value], '$.applicationStart')),
    TRY_CONVERT(date, JSON_VALUE(header.[value], '$.applicationEnd')),
    TRY_CONVERT(date, JSON_VALUE(header.[value], '$.ageReferenceDate')),
    TRY_CONVERT(int, JSON_VALUE(header.[value], '$.ageMin')),
    TRY_CONVERT(int, JSON_VALUE(header.[value], '$.maxAge')),
    JSON_VALUE(header.[value], '$.gradeKind'),
    TRY_CONVERT(decimal(7,2), JSON_VALUE(header.[value], '$.minPercentage')),
    JSON_VALUE(header.[value], '$.academicGradeId'),
    CONVERT(nvarchar(max), header.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.headers') AS header
WHERE ar.[module] LIKE N'admissionSetup.applicationSettings.%';

DELETE v
FROM [PACademy_staging_db].[cycle_application_setting_values] AS v
JOIN [PACademy_staging_db].[cycle_application_settings] AS s ON s.[id] = v.[cycle_setting_id];

INSERT INTO [PACademy_staging_db].[cycle_application_setting_values] ([cycle_setting_id], [category_key], [value_group], [value_order], [value])
SELECT ar.[id], header.[key], groups.[value_group], TRY_CONVERT(int, item.[key]), CONVERT(nvarchar(256), item.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.headers') AS header
CROSS APPLY
(
    VALUES
        (N'graduationYears', JSON_QUERY(header.[value], '$.graduationYears')),
        (N'maritalStatus', JSON_QUERY(header.[value], '$.maritalStatus')),
        (N'divisions', JSON_QUERY(header.[value], '$.divisions')),
        (N'schoolCategories', JSON_QUERY(header.[value], '$.schoolCategories')),
        (N'genderTypes', JSON_QUERY(header.[value], '$.genderTypes'))
) AS groups([value_group], [json_array])
CROSS APPLY OPENJSON(groups.[json_array]) AS item
WHERE ar.[module] LIKE N'admissionSetup.applicationSettings.%'
  AND groups.[json_array] IS NOT NULL;

DELETE e
FROM [PACademy_staging_db].[cycle_application_setting_entries] AS e
JOIN [PACademy_staging_db].[cycle_application_settings] AS s ON s.[id] = e.[cycle_setting_id];

INSERT INTO [PACademy_staging_db].[cycle_application_setting_entries] ([cycle_setting_id], [entry_group], [entry_order], [entry_id], [category_key], [payload_json])
SELECT ar.[id], N'local', TRY_CONVERT(int, entry.[key]), JSON_VALUE(entry.[value], '$.id'), JSON_VALUE(entry.[value], '$.category'), CONVERT(nvarchar(max), entry.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.local') AS entry
WHERE ar.[module] LIKE N'admissionSetup.applicationSettings.%'
UNION ALL
SELECT ar.[id], N'approved', TRY_CONVERT(int, entry.[key]), JSON_VALUE(entry.[value], '$.id'), JSON_VALUE(entry.[value], '$.category'), CONVERT(nvarchar(max), entry.[value])
FROM [PACademy_staging_db].[admin_records] AS ar
CROSS APPLY OPENJSON(ar.[payload_json], '$.approved') AS entry
WHERE ar.[module] LIKE N'admissionSetup.applicationSettings.%';

SELECT
    [run_id] = @run_id,
    [applicants] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicants]),
    [applicant_grades] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicant_grades]),
    [applicant_grade_adjustments] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[applicant_grade_adjustments]),
    [exam_questions] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exam_questions]),
    [exam_question_options] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exam_question_options]),
    [exam_question_matching_pairs] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exam_question_matching_pairs]),
    [exams] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exams]),
    [exam_rules] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exam_rules]),
    [exam_question_links] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[exam_question_links]),
    [admin_settings] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[admin_settings]),
    [cycle_application_settings] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[cycle_application_settings]),
    [cycle_application_setting_headers] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[cycle_application_setting_headers]),
    [cycle_application_setting_values] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[cycle_application_setting_values]),
    [cycle_application_setting_entries] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[cycle_application_setting_entries]),
    [issue_rows_logged_this_run] = (SELECT COUNT_BIG(*) FROM [PACademy_staging_db].[admin_record_normalization_issues] WHERE [run_id] = @run_id);

COMMIT TRANSACTION;
