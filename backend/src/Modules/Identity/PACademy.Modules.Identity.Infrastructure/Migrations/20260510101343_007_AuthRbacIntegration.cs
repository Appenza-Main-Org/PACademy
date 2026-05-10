using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _007_AuthRbacIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use IF NOT EXISTS guards throughout so this migration is safe to run
            // on an existing database that was previously managed by PaDbContext.

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetRoles') IS NULL
BEGIN
    CREATE TABLE [AspNetRoles] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(256) NULL,
        [NormalizedName] nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'sessions') IS NULL
BEGIN
    CREATE TABLE [sessions] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [IpAddress] nvarchar(45) NOT NULL,
        [UserAgent] nvarchar(500) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [LastSeenAt] datetime2 NOT NULL,
        [RevokedAt] datetime2 NULL,
        [RevokedReason] nvarchar(200) NULL,
        CONSTRAINT [PK_sessions] PRIMARY KEY ([Id])
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'system_users') IS NULL
BEGIN
    CREATE TABLE [system_users] (
        [Id] uniqueidentifier NOT NULL,
        [OfficerCode] nvarchar(32) NOT NULL,
        [FullName] nvarchar(200) COLLATE Arabic_100_CI_AS_SC NOT NULL,
        [Mobile] nvarchar(20) NOT NULL,
        [IsActive] bit NOT NULL,
        [IssueDate] datetime2 NOT NULL,
        [CardFactoryNumber] nvarchar(32) NOT NULL,
        [Role] nvarchar(64) NOT NULL,
        [Unit] nvarchar(200) NULL,
        [Archived] bit NOT NULL DEFAULT 0,
        [ArchivedAt] datetime2 NULL,
        [DemoOrigin] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL,
        [UserName] nvarchar(256) NULL,
        [NormalizedUserName] nvarchar(256) NULL,
        [Email] nvarchar(256) NULL,
        [NormalizedEmail] nvarchar(256) NULL,
        [EmailConfirmed] bit NOT NULL,
        [PasswordHash] nvarchar(max) NULL,
        [SecurityStamp] nvarchar(max) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        [PhoneNumber] nvarchar(max) NULL,
        [PhoneNumberConfirmed] bit NOT NULL,
        [TwoFactorEnabled] bit NOT NULL,
        [LockoutEnd] datetimeoffset NULL,
        [LockoutEnabled] bit NOT NULL,
        [AccessFailedCount] int NOT NULL,
        CONSTRAINT [PK_system_users] PRIMARY KEY ([Id])
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetRoleClaims') IS NULL
BEGIN
    CREATE TABLE [AspNetRoleClaims] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [RoleId] uniqueidentifier NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetUserClaims') IS NULL
BEGIN
    CREATE TABLE [AspNetUserClaims] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetUserLogins') IS NULL
BEGIN
    CREATE TABLE [AspNetUserLogins] (
        [LoginProvider] nvarchar(450) NOT NULL,
        [ProviderKey] nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetUserRoles') IS NULL
BEGIN
    CREATE TABLE [AspNetUserRoles] (
        [UserId] uniqueidentifier NOT NULL,
        [RoleId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'AspNetUserTokens') IS NULL
BEGIN
    CREATE TABLE [AspNetUserTokens] (
        [UserId] uniqueidentifier NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name] nvarchar(450) NOT NULL,
        [Value] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'lock_policy') IS NULL
BEGIN
    CREATE TABLE [lock_policy] (
        [Id] int NOT NULL,
        [MaxFailedAttempts] int NOT NULL,
        [LockDurationMinutes] int NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [DemoOrigin] bit NOT NULL DEFAULT 0,
        CONSTRAINT [PK_lock_policy] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_lock_policy_single_row] CHECK ([Id] = 1),
        CONSTRAINT [FK_lock_policy_system_users_UpdatedBy] FOREIGN KEY ([UpdatedBy]) REFERENCES [system_users] ([Id]) ON DELETE SET NULL
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'lockout_states') IS NULL
BEGIN
    CREATE TABLE [lockout_states] (
        [UserId] uniqueidentifier NOT NULL,
        [LockedAt] datetime2 NOT NULL,
        [UnlocksAt] datetime2 NOT NULL,
        [Reason] nvarchar(100) NOT NULL,
        [FailedAttemptCount] int NOT NULL,
        CONSTRAINT [PK_lockout_states] PRIMARY KEY ([UserId]),
        CONSTRAINT [FK_lockout_states_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'pending_otps') IS NULL
BEGIN
    CREATE TABLE [pending_otps] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [CodeHash] nvarchar(128) NOT NULL,
        [MaskedPhoneTail] nvarchar(20) COLLATE Arabic_100_CI_AS_SC NOT NULL,
        [ExpiresAt] datetime2 NOT NULL,
        [AttemptCount] int NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL,
        [ConsumedAt] datetime2 NULL,
        CONSTRAINT [PK_pending_otps] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_pending_otps_system_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [system_users] ([Id]) ON DELETE CASCADE
    );
END");

            // Indexes — skip if already present
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AspNetRoleClaims_RoleId' AND object_id = OBJECT_ID(N'AspNetRoleClaims'))
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'RoleNameIndex' AND object_id = OBJECT_ID(N'AspNetRoles'))
    CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AspNetUserClaims_UserId' AND object_id = OBJECT_ID(N'AspNetUserClaims'))
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AspNetUserLogins_UserId' AND object_id = OBJECT_ID(N'AspNetUserLogins'))
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AspNetUserRoles_RoleId' AND object_id = OBJECT_ID(N'AspNetUserRoles'))
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lock_policy_UpdatedBy' AND object_id = OBJECT_ID(N'lock_policy'))
    CREATE INDEX [IX_lock_policy_UpdatedBy] ON [lock_policy] ([UpdatedBy]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lockout_states_unlocks_at' AND object_id = OBJECT_ID(N'lockout_states'))
    CREATE INDEX [IX_lockout_states_unlocks_at] ON [lockout_states] ([UnlocksAt]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pending_otps_expires_at' AND object_id = OBJECT_ID(N'pending_otps'))
    CREATE INDEX [IX_pending_otps_expires_at] ON [pending_otps] ([ExpiresAt]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pending_otps_user_id_active' AND object_id = OBJECT_ID(N'pending_otps'))
    CREATE INDEX [IX_pending_otps_user_id_active] ON [pending_otps] ([UserId]) WHERE [ConsumedAt] IS NULL;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sessions_revoked_at' AND object_id = OBJECT_ID(N'sessions'))
    CREATE INDEX [IX_sessions_revoked_at] ON [sessions] ([RevokedAt]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sessions_user_id' AND object_id = OBJECT_ID(N'sessions'))
    CREATE INDEX [IX_sessions_user_id] ON [sessions] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'EmailIndex' AND object_id = OBJECT_ID(N'system_users'))
    CREATE INDEX [EmailIndex] ON [system_users] ([NormalizedEmail]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_system_users_card_factory_active' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [IX_system_users_card_factory_active] ON [system_users] ([CardFactoryNumber]) WHERE [Archived] = 0;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_system_users_email_active' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [IX_system_users_email_active] ON [system_users] ([Email]) WHERE [Archived] = 0;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_system_users_mobile_active' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [IX_system_users_mobile_active] ON [system_users] ([Mobile]) WHERE [Archived] = 0 AND [Mobile] IS NOT NULL;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_system_users_national_id_active' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [IX_system_users_national_id_active] ON [system_users] ([UserName]) WHERE [Archived] = 0;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_system_users_officer_code_active' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [IX_system_users_officer_code_active] ON [system_users] ([OfficerCode]) WHERE [Archived] = 0;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UserNameIndex' AND object_id = OBJECT_ID(N'system_users'))
    CREATE UNIQUE INDEX [UserNameIndex] ON [system_users] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF OBJECT_ID(N'pending_otps') IS NOT NULL DROP TABLE [pending_otps];");
            migrationBuilder.Sql("IF OBJECT_ID(N'lockout_states') IS NOT NULL DROP TABLE [lockout_states];");
            migrationBuilder.Sql("IF OBJECT_ID(N'lock_policy') IS NOT NULL DROP TABLE [lock_policy];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetUserTokens') IS NOT NULL DROP TABLE [AspNetUserTokens];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetUserRoles') IS NOT NULL DROP TABLE [AspNetUserRoles];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetUserLogins') IS NOT NULL DROP TABLE [AspNetUserLogins];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetUserClaims') IS NOT NULL DROP TABLE [AspNetUserClaims];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetRoleClaims') IS NOT NULL DROP TABLE [AspNetRoleClaims];");
            migrationBuilder.Sql("IF OBJECT_ID(N'sessions') IS NOT NULL DROP TABLE [sessions];");
            migrationBuilder.Sql("IF OBJECT_ID(N'AspNetRoles') IS NOT NULL DROP TABLE [AspNetRoles];");
            migrationBuilder.Sql("IF OBJECT_ID(N'system_users') IS NOT NULL DROP TABLE [system_users];");
        }
    }
}
