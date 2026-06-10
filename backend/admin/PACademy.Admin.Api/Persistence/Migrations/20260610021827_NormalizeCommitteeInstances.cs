using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeCommitteeInstances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "committee_instances",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    definition_code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    category_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    reserved = table.Column<int>(type: "int", nullable: false),
                    reserved_refreshed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_instances", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_committee_instances_category_key",
                schema: AdminDbContext.Schema,
                table: "committee_instances",
                column: "category_key");

            migrationBuilder.CreateIndex(
                name: "ix_committee_instances_cycle_date",
                schema: AdminDbContext.Schema,
                table: "committee_instances",
                columns: new[] { "cycle_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_committee_instances_cycle_id",
                schema: AdminDbContext.Schema,
                table: "committee_instances",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_instances_definition_code",
                schema: AdminDbContext.Schema,
                table: "committee_instances",
                column: "definition_code");

            // Clean rebuild (no JSON→columns backfill): drop the extracted bucket's
            // rows from the shared JSON store. The committee_records table still holds
            // its other buckets (committees, committeeResults), so never DROP it.
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("committee_records")} WHERE [module] = N'committeeInstances';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "committee_instances",
                schema: AdminDbContext.Schema);
        }
    }
}
