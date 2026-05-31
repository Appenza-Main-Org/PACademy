IF OBJECT_ID(N'[__EFMigrationsHistory_IdentityApplicant]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory_IdentityApplicant] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory_IdentityApplicant] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_IdentityApplicant]
    WHERE [MigrationId] = N'20260521092833_InitialIdentityApplicant'
)
BEGIN
    CREATE TABLE [applicants] (
        [id] uniqueidentifier NOT NULL,
        [national_id] nvarchar(14) NOT NULL,
        [phone_number] nvarchar(11) NOT NULL,
        [full_name] nvarchar(200) NULL,
        [email] nvarchar(200) NULL,
        [gender] nvarchar(16) NULL,
        [religion] nvarchar(16) NULL,
        [date_of_birth] date NULL,
        [birth_governorate] nvarchar(120) NULL,
        [birth_district] nvarchar(120) NULL,
        [source] nvarchar(16) NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_applicants] PRIMARY KEY ([id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_IdentityApplicant]
    WHERE [MigrationId] = N'20260521092833_InitialIdentityApplicant'
)
BEGIN
    CREATE UNIQUE INDEX [UX_applicants_national_id] ON [applicants] ([national_id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_IdentityApplicant]
    WHERE [MigrationId] = N'20260521092833_InitialIdentityApplicant'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory_IdentityApplicant] ([MigrationId], [ProductVersion])
    VALUES (N'20260521092833_InitialIdentityApplicant', N'10.0.0');
END;

COMMIT;
GO

