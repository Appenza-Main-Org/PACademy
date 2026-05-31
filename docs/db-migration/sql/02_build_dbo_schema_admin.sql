IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory_AdminApi]') IS NULL
BEGIN
    CREATE TABLE [dbo].[__EFMigrationsHistory_AdminApi] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory_AdminApi] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[admin_records] (
        [module] nvarchar(96) NOT NULL,
        [id] nvarchar(128) NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_admin_records] PRIMARY KEY ([module], [id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[admission_cycles] (
        [id] nvarchar(96) NOT NULL,
        [name_ar] nvarchar(256) NOT NULL,
        [year] int NOT NULL,
        [status] nvarchar(48) NOT NULL,
        [is_active] bit NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_admission_cycles] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[admission_rules] (
        [id] nvarchar(128) NOT NULL,
        [cycle_id] nvarchar(96) NOT NULL,
        [version] int NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_admission_rules] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[applicant_categories] (
        [key] nvarchar(96) NOT NULL,
        [label_ar] nvarchar(256) NOT NULL,
        [is_open] bit NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_applicant_categories] PRIMARY KEY ([key])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[audit_entries] (
        [id] nvarchar(96) NOT NULL,
        [module] nvarchar(96) NOT NULL,
        [action] nvarchar(96) NOT NULL,
        [entity] nvarchar(128) NOT NULL,
        [entity_id] nvarchar(128) NOT NULL,
        [actor_user_id] nvarchar(128) NOT NULL,
        [actor_name] nvarchar(256) NOT NULL,
        [details] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_audit_entries] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[lookup_rows] (
        [lookup_key] nvarchar(96) NOT NULL,
        [code] nvarchar(96) NOT NULL,
        [name] nvarchar(512) NOT NULL,
        [is_active] bit NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_lookup_rows] PRIMARY KEY ([lookup_key], [code])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[officer_directory] (
        [national_id] nvarchar(32) NOT NULL,
        [full_arabic_name] nvarchar(256) NOT NULL,
        [officer_code] nvarchar(64) NOT NULL,
        [mobile_number] nvarchar(32) NOT NULL,
        [user_type] nvarchar(64) NOT NULL,
        CONSTRAINT [PK_officer_directory] PRIMARY KEY ([national_id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[roles] (
        [id] nvarchar(96) NOT NULL,
        [key] nvarchar(96) NOT NULL,
        [label_ar] nvarchar(256) NOT NULL,
        [is_system] bit NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_roles] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] nvarchar(96) NOT NULL,
        [national_id] nvarchar(32) NOT NULL,
        [full_arabic_name] nvarchar(256) NOT NULL,
        [role] nvarchar(96) NOT NULL,
        [account_status] nvarchar(48) NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_users] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE INDEX [ix_admin_records_module] ON [dbo].[admin_records] ([module]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE INDEX [ix_admission_cycles_is_active] ON [dbo].[admission_cycles] ([is_active]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE UNIQUE INDEX [ux_admission_rules_cycle_version] ON [dbo].[admission_rules] ([cycle_id], [version]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE INDEX [ix_lookup_rows_lookup_key] ON [dbo].[lookup_rows] ([lookup_key]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE UNIQUE INDEX [ux_roles_key] ON [dbo].[roles] ([key]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    CREATE UNIQUE INDEX [ux_users_national_id] ON [dbo].[users] ([national_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260521200238_InitialAdminSchema'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260521200238_InitialAdminSchema', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE TABLE [dbo].[application_settings_category_configs] (
        [id] nvarchar(96) NOT NULL,
        [category_id] nvarchar(96) NOT NULL,
        [is_active] bit NOT NULL,
        [sort_order] int NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_application_settings_category_configs] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE TABLE [dbo].[application_settings_category_specializations] (
        [id] nvarchar(96) NOT NULL,
        [config_id] nvarchar(96) NOT NULL,
        [specialization_id] nvarchar(96) NOT NULL,
        [is_active] bit NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_application_settings_category_specializations] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE TABLE [dbo].[application_settings_graduation_years] (
        [id] nvarchar(96) NOT NULL,
        [category_specialization_id] nvarchar(96) NOT NULL,
        [graduation_years_json] nvarchar(max) NOT NULL,
        [gender_types_json] nvarchar(max) NOT NULL,
        [marital_status_codes_json] nvarchar(max) NOT NULL,
        [age_min] int NULL,
        [max_age] int NULL,
        [division_codes_json] nvarchar(max) NOT NULL,
        [school_category_codes_json] nvarchar(max) NOT NULL,
        [application_start_date] date NOT NULL,
        [application_end_date] date NOT NULL,
        [age_reference_date] date NOT NULL,
        [is_active] bit NOT NULL,
        [grade_kind] nvarchar(16) NOT NULL,
        [min_percentage] decimal(5,2) NULL,
        [academic_grade_id] nvarchar(96) NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_application_settings_graduation_years] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE INDEX [ix_app_settings_configs_sort_order] ON [dbo].[application_settings_category_configs] ([sort_order]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE UNIQUE INDEX [ux_app_settings_configs_category_id] ON [dbo].[application_settings_category_configs] ([category_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE INDEX [ix_app_settings_specs_config_id] ON [dbo].[application_settings_category_specializations] ([config_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE UNIQUE INDEX [ux_app_settings_specs_config_specialization] ON [dbo].[application_settings_category_specializations] ([config_id], [specialization_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE INDEX [ix_app_settings_years_category_specialization_id] ON [dbo].[application_settings_graduation_years] ([category_specialization_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    CREATE INDEX [ix_app_settings_years_window] ON [dbo].[application_settings_graduation_years] ([category_specialization_id], [application_start_date], [application_end_date]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260522114816_AddApplicationSettingsTables'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260522114816_AddApplicationSettingsTables', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260525120424_AddApplicantPortal'
)
BEGIN
    CREATE TABLE [dbo].[applicant_portal_records] (
        [type] nvarchar(64) NOT NULL,
        [record_id] nvarchar(128) NOT NULL,
        [applicant_id] nvarchar(128) NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_applicant_portal_records] PRIMARY KEY ([type], [record_id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260525120424_AddApplicantPortal'
)
BEGIN
    CREATE TABLE [dbo].[exam_slots] (
        [id] nvarchar(64) NOT NULL,
        [date] date NOT NULL,
        [time] nvarchar(16) NOT NULL,
        [location] nvarchar(512) NOT NULL,
        [capacity] int NOT NULL,
        [reserved] int NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_exam_slots] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260525120424_AddApplicantPortal'
)
BEGIN
    CREATE INDEX [ix_portal_records_applicant_id] ON [dbo].[applicant_portal_records] ([applicant_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260525120424_AddApplicantPortal'
)
BEGIN
    CREATE INDEX [ix_exam_slots_date] ON [dbo].[exam_slots] ([date]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260525120424_AddApplicantPortal'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260525120424_AddApplicantPortal', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260526194218_PendingModelChanges'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260526194218_PendingModelChanges', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_questions] (
        [id] nvarchar(128) NOT NULL,
        [category] nvarchar(128) NOT NULL,
        [classification] nvarchar(128) NULL,
        [difficulty] int NOT NULL,
        [type] nvarchar(48) NOT NULL,
        [text] nvarchar(max) NOT NULL,
        [correct_index] int NOT NULL,
        [time_limit_seconds] int NOT NULL,
        [notes] nvarchar(max) NULL,
        [status] nvarchar(48) NOT NULL,
        [version] int NOT NULL,
        [image_url] nvarchar(1024) NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_exam_questions] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exams] (
        [id] nvarchar(128) NOT NULL,
        [name_ar] nvarchar(256) NOT NULL,
        [cycle_id] nvarchar(96) NOT NULL,
        [cycle_name] nvarchar(256) NULL,
        [scheduled_for] nvarchar(64) NULL,
        [access_start_at] nvarchar(64) NULL,
        [access_end_at] nvarchar(64) NULL,
        [duration_minutes] int NULL,
        [question_count] int NULL,
        [random_selection] bit NULL,
        [random_question_order] bit NULL,
        [display_mode] nvarchar(48) NULL,
        [status] nvarchar(48) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_exams] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_question_options] (
        [question_id] nvarchar(128) NOT NULL,
        [option_order] int NOT NULL,
        [option_text] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_exam_question_options] PRIMARY KEY ([question_id], [option_order]),
        CONSTRAINT [FK_exam_question_options_exam_questions_question_id] FOREIGN KEY ([question_id]) REFERENCES [dbo].[exam_questions] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_question_matching_pairs] (
        [question_id] nvarchar(128) NOT NULL,
        [pair_order] int NOT NULL,
        [prompt] nvarchar(max) NOT NULL,
        [match_text] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_exam_question_matching_pairs] PRIMARY KEY ([question_id], [pair_order]),
        CONSTRAINT [FK_exam_question_matching_pairs_exam_questions_question_id] FOREIGN KEY ([question_id]) REFERENCES [dbo].[exam_questions] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_rules] (
        [exam_id] nvarchar(128) NOT NULL,
        [rule_order] int NOT NULL,
        [category] nvarchar(128) NOT NULL,
        [difficulty_min] int NOT NULL,
        [difficulty_max] int NOT NULL,
        [question_count] int NOT NULL,
        [minutes] int NOT NULL,
        CONSTRAINT [PK_exam_rules] PRIMARY KEY ([exam_id], [rule_order]),
        CONSTRAINT [FK_exam_rules_exams_exam_id] FOREIGN KEY ([exam_id]) REFERENCES [dbo].[exams] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_question_links] (
        [exam_id] nvarchar(128) NOT NULL,
        [question_order] int NOT NULL,
        [question_id] nvarchar(128) NOT NULL,
        CONSTRAINT [PK_exam_question_links] PRIMARY KEY ([exam_id], [question_order]),
        CONSTRAINT [FK_exam_question_links_exams_exam_id] FOREIGN KEY ([exam_id]) REFERENCES [dbo].[exams] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE TABLE [dbo].[exam_assignments] (
        [exam_id] nvarchar(128) NOT NULL,
        [assignment_kind] nvarchar(64) NOT NULL,
        [assignment_order] int NOT NULL,
        [value] nvarchar(256) NOT NULL,
        CONSTRAINT [PK_exam_assignments] PRIMARY KEY ([exam_id], [assignment_kind], [assignment_order]),
        CONSTRAINT [FK_exam_assignments_exams_exam_id] FOREIGN KEY ([exam_id]) REFERENCES [dbo].[exams] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE INDEX [ix_exam_questions_category] ON [dbo].[exam_questions] ([category]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE INDEX [ix_exam_questions_status] ON [dbo].[exam_questions] ([status]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE INDEX [ix_exams_cycle_id] ON [dbo].[exams] ([cycle_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE INDEX [ix_exams_status] ON [dbo].[exams] ([status]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    CREATE INDEX [ix_exam_question_links_question_id] ON [dbo].[exam_question_links] ([question_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    INSERT INTO [dbo].[exam_questions]
        ([id], [category], [classification], [difficulty], [type], [text], [correct_index], [time_limit_seconds], [notes], [status], [version], [image_url], [created_at], [updated_at])
    SELECT
        [id],
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.category'), N''), N''),
        JSON_VALUE([payload_json], '$.classification'),
        COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.difficulty')), 1),
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.type'), N''), N'mcq'),
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.text'), N''), N''),
        COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.correctIndex')), 0),
        COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.timeLimitSeconds')), 60),
        JSON_VALUE([payload_json], '$.notes'),
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.status'), N''), N'draft'),
        COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.version')), 1),
        JSON_VALUE([payload_json], '$.imageUrl'),
        [created_at],
        [updated_at]
    FROM [dbo].[admin_records]
    WHERE [module] = N'questions';

    INSERT INTO [dbo].[exam_question_options] ([question_id], [option_order], [option_text])
    SELECT r.[id], TRY_CONVERT(int, o.[key]), CONVERT(nvarchar(max), o.[value])
    FROM [dbo].[admin_records] r
    CROSS APPLY OPENJSON(r.[payload_json], '$.options') o
    WHERE r.[module] = N'questions';

    INSERT INTO [dbo].[exam_question_matching_pairs] ([question_id], [pair_order], [prompt], [match_text])
    SELECT r.[id], TRY_CONVERT(int, p.[key]), COALESCE(JSON_VALUE(p.[value], '$.prompt'), N''), COALESCE(JSON_VALUE(p.[value], '$.match'), N'')
    FROM [dbo].[admin_records] r
    CROSS APPLY OPENJSON(r.[payload_json], '$.matchingPairs') p
    WHERE r.[module] = N'questions';

    INSERT INTO [dbo].[exams]
        ([id], [name_ar], [cycle_id], [cycle_name], [scheduled_for], [access_start_at], [access_end_at], [duration_minutes], [question_count], [random_selection], [random_question_order], [display_mode], [status], [created_at], [updated_at])
    SELECT
        [id],
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.nameAr'), N''), [id]),
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.cycleId'), N''), N''),
        JSON_VALUE([payload_json], '$.cycleName'),
        JSON_VALUE([payload_json], '$.scheduledFor'),
        JSON_VALUE([payload_json], '$.accessStartAt'),
        JSON_VALUE([payload_json], '$.accessEndAt'),
        TRY_CONVERT(int, JSON_VALUE([payload_json], '$.durationMinutes')),
        TRY_CONVERT(int, JSON_VALUE([payload_json], '$.questionCount')),
        TRY_CONVERT(bit, JSON_VALUE([payload_json], '$.randomSelection')),
        TRY_CONVERT(bit, JSON_VALUE([payload_json], '$.randomQuestionOrder')),
        JSON_VALUE([payload_json], '$.displayMode'),
        COALESCE(NULLIF(JSON_VALUE([payload_json], '$.status'), N''), N'draft'),
        [created_at],
        [updated_at]
    FROM [dbo].[admin_records]
    WHERE [module] = N'exams';

    INSERT INTO [dbo].[exam_rules] ([exam_id], [rule_order], [category], [difficulty_min], [difficulty_max], [question_count], [minutes])
    SELECT r.[id], TRY_CONVERT(int, item.[key]), COALESCE(JSON_VALUE(item.[value], '$.category'), N''), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.difficultyMin')), 1), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.difficultyMax')), 5), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.count')), 0), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.minutes')), 0)
    FROM [dbo].[admin_records] r
    CROSS APPLY OPENJSON(r.[payload_json], '$.rules') item
    WHERE r.[module] = N'exams';

    INSERT INTO [dbo].[exam_question_links] ([exam_id], [question_order], [question_id])
    SELECT r.[id], TRY_CONVERT(int, item.[key]), CONVERT(nvarchar(128), item.[value])
    FROM [dbo].[admin_records] r
    CROSS APPLY OPENJSON(r.[payload_json], '$.questionIds') item
    WHERE r.[module] = N'exams';

    DELETE FROM [dbo].[admin_records]
    WHERE [module] IN (N'questions', N'exams');
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529120000_NormalizeExamCatalog'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260529120000_NormalizeExamCatalog', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529123000_DrainAdminRecords'
)
BEGIN
    CREATE TABLE [dbo].[admin_record_documents] (
        [module] nvarchar(96) NOT NULL,
        [id] nvarchar(128) NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_admin_record_documents] PRIMARY KEY ([module], [id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529123000_DrainAdminRecords'
)
BEGIN
    CREATE INDEX [ix_admin_record_documents_module] ON [dbo].[admin_record_documents] ([module]);
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529123000_DrainAdminRecords'
)
BEGIN
    INSERT INTO [dbo].[admin_record_documents]
        ([module], [id], [payload_json], [created_at], [updated_at])
    SELECT [module], [id], [payload_json], [created_at], [updated_at]
    FROM [dbo].[admin_records] source
    WHERE NOT EXISTS (
        SELECT 1
        FROM [dbo].[admin_record_documents] target
        WHERE target.[module] = source.[module] AND target.[id] = source.[id]
    );

    DELETE FROM [dbo].[admin_records];
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260529123000_DrainAdminRecords'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260529123000_DrainAdminRecords', N'10.0.8');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260530114800_AddGeneralSettingsTable'
)
BEGIN
    CREATE TABLE [dbo].[general_settings] (
        [id] nvarchar(64) NOT NULL,
        [exam_days_per_applicant] int NOT NULL,
        [exam_slot_selection_window_days] int NOT NULL,
        [primary_relatives_entry_responsible_test_code] nvarchar(96) NULL,
        [acquaintance_documents_entry_responsible_test_code] nvarchar(96) NULL,
        [acquaintance_documents_print_responsible_test_code] nvarchar(96) NULL,
        [acquaintance_documents_mutation_lock_timing] nvarchar(48) NULL,
        [primary_relatives_visibility_responsible_test_code] nvarchar(96) NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_general_settings] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [dbo].[__EFMigrationsHistory_AdminApi]
    WHERE [MigrationId] = N'20260530114800_AddGeneralSettingsTable'
)
BEGIN
    INSERT INTO [dbo].[__EFMigrationsHistory_AdminApi] ([MigrationId], [ProductVersion])
    VALUES (N'20260530114800_AddGeneralSettingsTable', N'10.0.8');
END;

COMMIT;
GO

