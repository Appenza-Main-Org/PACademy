using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op. Historically this migration's Down() carried a schema rename
            // (PACademy_staging_db -> admin_v2). Under the database-per-environment
            // topology every table lives in the canonical dbo schema, so there is
            // no cross-schema rename to perform.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op. The previous body referenced the retired admin_v2 /
            // PACademy_staging_db schemas and no longer applies.
        }
    }
}
