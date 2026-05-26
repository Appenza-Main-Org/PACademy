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
            // Tables already exist in PACademy_staging_db schema — no-op.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "admin_v2");

            migrationBuilder.RenameTable(
                name: "users",
                schema: "PACademy_staging_db",
                newName: "users",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "roles",
                schema: "PACademy_staging_db",
                newName: "roles",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "officer_directory",
                schema: "PACademy_staging_db",
                newName: "officer_directory",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "lookup_rows",
                schema: "PACademy_staging_db",
                newName: "lookup_rows",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "exam_slots",
                schema: "PACademy_staging_db",
                newName: "exam_slots",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "audit_entries",
                schema: "PACademy_staging_db",
                newName: "audit_entries",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "application_settings_graduation_years",
                schema: "PACademy_staging_db",
                newName: "application_settings_graduation_years",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "application_settings_category_specializations",
                schema: "PACademy_staging_db",
                newName: "application_settings_category_specializations",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "application_settings_category_configs",
                schema: "PACademy_staging_db",
                newName: "application_settings_category_configs",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "applicant_portal_records",
                schema: "PACademy_staging_db",
                newName: "applicant_portal_records",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "applicant_categories",
                schema: "PACademy_staging_db",
                newName: "applicant_categories",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "admission_rules",
                schema: "PACademy_staging_db",
                newName: "admission_rules",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "admission_cycles",
                schema: "PACademy_staging_db",
                newName: "admission_cycles",
                newSchema: "admin_v2");

            migrationBuilder.RenameTable(
                name: "admin_records",
                schema: "PACademy_staging_db",
                newName: "admin_records",
                newSchema: "admin_v2");
        }
    }
}
