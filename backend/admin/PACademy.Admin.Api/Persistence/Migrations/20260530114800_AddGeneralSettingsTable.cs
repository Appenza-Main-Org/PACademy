using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGeneralSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: AdminDbContext.Schema);

            migrationBuilder.CreateTable(
                name: "general_settings",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    exam_days_per_applicant = table.Column<int>(type: "int", nullable: false),
                    exam_slot_selection_window_days = table.Column<int>(type: "int", nullable: false),
                    primary_relatives_entry_responsible_test_code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    acquaintance_documents_entry_responsible_test_code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    acquaintance_documents_print_responsible_test_code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    acquaintance_documents_mutation_lock_timing = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    primary_relatives_visibility_responsible_test_code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_general_settings", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "general_settings",
                schema: AdminDbContext.Schema);
        }
    }
}
