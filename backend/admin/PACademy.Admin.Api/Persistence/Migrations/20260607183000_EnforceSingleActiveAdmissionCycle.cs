using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnforceSingleActiveAdmissionCycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                ;WITH ranked_published_cycles AS (
                    SELECT
                        [id],
                        ROW_NUMBER() OVER (ORDER BY [updated_at] DESC, [created_at] DESC, [id] DESC) AS [rn]
                    FROM {AdminDbContext.QualifiedTableName("admission_cycles")}
                    WHERE [is_active] = CAST(1 AS bit)
                       OR [status] IN (N'active', N'open', N'extended')
                )
                UPDATE cycles
                SET
                    [is_active] = CAST(0 AS bit),
                    [status] = N'closed',
                    [payload_json] = JSON_MODIFY(
                        JSON_MODIFY([payload_json], '$.isActive', CAST(0 AS bit)),
                        '$.status',
                        N'closed'
                    ),
                    [updated_at] = SYSDATETIMEOFFSET()
                FROM {AdminDbContext.QualifiedTableName("admission_cycles")} AS cycles
                INNER JOIN ranked_published_cycles AS ranked
                    ON ranked.[id] = cycles.[id]
                WHERE ranked.[rn] > 1;

                ;WITH ranked_published_cycles AS (
                    SELECT
                        [id],
                        ROW_NUMBER() OVER (ORDER BY [updated_at] DESC, [created_at] DESC, [id] DESC) AS [rn]
                    FROM {AdminDbContext.QualifiedTableName("admission_cycles")}
                    WHERE [is_active] = CAST(1 AS bit)
                       OR [status] IN (N'active', N'open', N'extended')
                )
                UPDATE cycles
                SET
                    [is_active] = CAST(1 AS bit),
                    [payload_json] = JSON_MODIFY([payload_json], '$.isActive', CAST(1 AS bit)),
                    [updated_at] = SYSDATETIMEOFFSET()
                FROM {AdminDbContext.QualifiedTableName("admission_cycles")} AS cycles
                INNER JOIN ranked_published_cycles AS ranked
                    ON ranked.[id] = cycles.[id]
                WHERE ranked.[rn] = 1;
                """);

            migrationBuilder.DropIndex(
                name: "ix_admission_cycles_is_active",
                schema: AdminDbContext.Schema,
                table: "admission_cycles");

            migrationBuilder.CreateIndex(
                name: "ux_admission_cycles_single_active",
                schema: AdminDbContext.Schema,
                table: "admission_cycles",
                column: "is_active",
                unique: true,
                filter: "[is_active] = CAST(1 AS bit)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_admission_cycles_single_active",
                schema: AdminDbContext.Schema,
                table: "admission_cycles");

            migrationBuilder.CreateIndex(
                name: "ix_admission_cycles_is_active",
                schema: AdminDbContext.Schema,
                table: "admission_cycles",
                column: "is_active");
        }
    }
}
