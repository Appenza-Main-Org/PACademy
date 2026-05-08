using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReportSnapshotTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE reports_registration_tempo (
                    [Date]           DATE         NOT NULL PRIMARY KEY,
                    Total            INT          NOT NULL DEFAULT 0,
                    LastRefreshedAt  DATETIME2    NOT NULL DEFAULT GETUTCDATE()
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE reports_stage_funnel (
                    Status           NVARCHAR(32) NOT NULL PRIMARY KEY,
                    Total            INT          NOT NULL DEFAULT 0,
                    LastRefreshedAt  DATETIME2    NOT NULL DEFAULT GETUTCDATE()
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE reports_operational_status (
                    Id                    INT          NOT NULL PRIMARY KEY DEFAULT 1,
                    TotalApplicants       INT          NOT NULL DEFAULT 0,
                    ActiveCycles          INT          NOT NULL DEFAULT 0,
                    ActiveUsers           INT          NOT NULL DEFAULT 0,
                    AuditEntriesLast24h   INT          NOT NULL DEFAULT 0,
                    LastRefreshedAt       DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT CK_reports_operational_status_singleton CHECK (Id = 1)
                );
                INSERT INTO reports_operational_status DEFAULT VALUES;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS reports_registration_tempo");
            migrationBuilder.Sql("DROP TABLE IF EXISTS reports_stage_funnel");
            migrationBuilder.Sql("DROP TABLE IF EXISTS reports_operational_status");
        }
    }
}
