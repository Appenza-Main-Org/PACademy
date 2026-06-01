using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAcquaintanceDocumentScheduleSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "acquaintance_documents_open_timing",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "nvarchar(48)",
                maxLength: 48,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "acquaintance_documents_open_offset_value",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "acquaintance_documents_open_offset_unit",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "acquaintance_documents_close_responsible_test_code",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "nvarchar(96)",
                maxLength: 96,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "acquaintance_documents_close_timing",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "nvarchar(48)",
                maxLength: 48,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "acquaintance_documents_close_offset_value",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "acquaintance_documents_close_offset_unit",
                schema: AdminDbContext.Schema,
                table: "general_settings",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "acquaintance_documents_open_timing",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_open_offset_value",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_open_offset_unit",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_close_responsible_test_code",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_close_timing",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_close_offset_value",
                schema: AdminDbContext.Schema,
                table: "general_settings");

            migrationBuilder.DropColumn(
                name: "acquaintance_documents_close_offset_unit",
                schema: AdminDbContext.Schema,
                table: "general_settings");
        }
    }
}
