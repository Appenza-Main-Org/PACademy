using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChangeTrackingForDataExchange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "lookup_rows",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "lookup_rows",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "lookup_rows",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exams",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exams",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exams",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exam_slots",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exam_slots",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exam_slots",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exam_questions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exam_questions",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exam_questions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "applicant_categories",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "applicant_categories",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "applicant_categories",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admission_rules",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admission_rules",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admission_rules",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admission_cycles",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admission_cycles",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admission_cycles",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");

            migrationBuilder.AddColumn<string>(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "appenza-admin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "lookup_rows");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "lookup_rows");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "lookup_rows");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exams");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exams");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exams");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exam_slots");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exam_slots");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exam_slots");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "exam_questions");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "exam_questions");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "exam_questions");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_graduation_years");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_specializations");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "application_settings_category_configs");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "applicant_categories");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "applicant_categories");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "applicant_categories");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admission_cycles");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admission_cycles");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admission_cycles");

            migrationBuilder.DropColumn(
                name: "checksum",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents");

            migrationBuilder.DropColumn(
                name: "last_modified_by",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents");

            migrationBuilder.DropColumn(
                name: "source_system",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents");
        }
    }
}
