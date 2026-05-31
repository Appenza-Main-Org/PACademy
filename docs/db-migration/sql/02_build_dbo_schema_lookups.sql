IF OBJECT_ID(N'[__EFMigrationsHistory_LookupsAdmin]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory_LookupsAdmin] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory_LookupsAdmin] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_LookupsAdmin]
    WHERE [MigrationId] = N'20260520113946_InitialLookups'
)
BEGIN
    CREATE TABLE [faculties] (
        [code] nvarchar(16) NOT NULL,
        [name] nvarchar(120) NOT NULL,
        [is_active] bit NOT NULL,
        [created_at] datetimeoffset NOT NULL,
        [updated_at] datetimeoffset NOT NULL,
        [row_version] rowversion NOT NULL,
        CONSTRAINT [PK_faculties] PRIMARY KEY ([code])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory_LookupsAdmin]
    WHERE [MigrationId] = N'20260520113946_InitialLookups'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory_LookupsAdmin] ([MigrationId], [ProductVersion])
    VALUES (N'20260520113946_InitialLookups', N'10.0.0');
END;

COMMIT;
GO

