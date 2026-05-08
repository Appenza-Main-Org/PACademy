using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AuditImmutabilityTrigger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // FR-008: audit_entries are immutable — block UPDATE and DELETE at the DB level
            migrationBuilder.Sql("""
                CREATE TRIGGER tr_audit_entries_immutable
                ON audit_entries
                AFTER UPDATE, DELETE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    THROW 51000, 'audit_entries are immutable', 1;
                END
                """);

            // Additionally deny UPDATE and DELETE on audit_entries to the application's
            // runtime DB user. The migration user (sa / db_owner) can still run migrations.
            // In production, replace 'pac_app_user' with the actual runtime login.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'pac_app_user')
                BEGIN
                    DENY UPDATE ON audit_entries TO pac_app_user;
                    DENY DELETE ON audit_entries TO pac_app_user;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS tr_audit_entries_immutable");
        }
    }
}
