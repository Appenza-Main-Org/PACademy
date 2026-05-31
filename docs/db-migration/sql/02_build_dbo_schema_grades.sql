IF OBJECT_ID(N'[__EFMigrationsHistory_ApplicantGradesAdmin]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory_ApplicantGradesAdmin] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory_ApplicantGradesAdmin] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE TABLE [applicant_grades] (
        [id] uniqueidentifier NOT NULL,
        [seat] int NOT NULL,
        [seating_number] nvarchar(32) NULL,
        [nid] nvarchar(14) NOT NULL,
        [name] nvarchar(200) NOT NULL,
        [kind] nvarchar(16) NOT NULL,
        [gender] nvarchar(16) NOT NULL,
        [branch] nvarchar(200) NOT NULL,
        [graduation_year] int NULL,
        [school_category_code] nvarchar(32) NULL,
        [school] nvarchar(200) NOT NULL,
        [region] nvarchar(120) NOT NULL,
        [exam_round] nvarchar(64) NULL,
        [total] decimal(7,2) NOT NULL,
        [import_max] decimal(7,2) NOT NULL,
        [override_max] decimal(7,2) NULL,
        [last_edited_at] nvarchar(64) NULL,
        [last_edited_by] nvarchar(120) NULL,
        [grade_changed_at] datetimeoffset NULL,
        [previous_grade] decimal(7,2) NULL,
        [status] nvarchar(64) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_applicant_grades] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE TABLE [grade_import_batches] (
        [id] uniqueidentifier NOT NULL,
        [source_format] nvarchar(32) NOT NULL,
        [status] nvarchar(32) NOT NULL,
        [graduation_year] int NULL,
        [selected_school_categories_json] nvarchar(max) NOT NULL,
        [max_grade_by_category_json] nvarchar(max) NOT NULL,
        [total_rows] int NOT NULL,
        [valid_rows] int NOT NULL,
        [invalid_rows] int NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_grade_import_batches] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE TABLE [applicant_grade_adjustments] (
        [id] uniqueidentifier NOT NULL,
        [applicant_grade_id] uniqueidentifier NOT NULL,
        [reason] nvarchar(64) NOT NULL,
        [reason_label] nvarchar(120) NOT NULL,
        [note] nvarchar(500) NOT NULL,
        [amount] decimal(7,2) NOT NULL,
        [by] nvarchar(120) NOT NULL,
        [when_label] nvarchar(64) NOT NULL,
        [is_active] bit NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_applicant_grade_adjustments] PRIMARY KEY ([id]),
        CONSTRAINT [FK_applicant_grade_adjustments_applicant_grades_applicant_grade_id] FOREIGN KEY ([applicant_grade_id]) REFERENCES [applicant_grades] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE TABLE [grade_import_rows] (
        [id] uniqueidentifier NOT NULL,
        [grade_import_batch_id] uniqueidentifier NOT NULL,
        [source_row_index] int NOT NULL,
        [national_id] nvarchar(14) NOT NULL,
        [is_valid] bit NOT NULL,
        [payload_json] nvarchar(max) NOT NULL,
        [errors_json] nvarchar(max) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_grade_import_rows] PRIMARY KEY ([id]),
        CONSTRAINT [FK_grade_import_rows_grade_import_batches_grade_import_batch_id] FOREIGN KEY ([grade_import_batch_id]) REFERENCES [grade_import_batches] ([id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE INDEX [IX_applicant_grade_adjustments_applicant_grade_id] ON [applicant_grade_adjustments] ([applicant_grade_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE INDEX [IX_applicant_grades_graduation_year] ON [applicant_grades] ([graduation_year]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE UNIQUE INDEX [IX_applicant_grades_nid] ON [applicant_grades] ([nid]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE INDEX [IX_applicant_grades_school_category_code] ON [applicant_grades] ([school_category_code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE UNIQUE INDEX [IX_applicant_grades_seat] ON [applicant_grades] ([seat]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE INDEX [IX_grade_import_rows_grade_import_batch_id] ON [grade_import_rows] ([grade_import_batch_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    CREATE INDEX [IX_grade_import_rows_national_id] ON [grade_import_rows] ([national_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_ApplicantGradesAdmin]
    WHERE [MigrationId] = N'20260521011646_InitialApplicantGrades'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory_ApplicantGradesAdmin] ([MigrationId], [ProductVersion])
    VALUES (N'20260521011646_InitialApplicantGrades', N'10.0.0');
END;

COMMIT;
GO

