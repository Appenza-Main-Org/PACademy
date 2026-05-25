using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationSettingsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: AdminDbContext.Schema);

            migrationBuilder.CreateTable(
                name: "application_settings_category_configs",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    category_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_settings_category_configs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "application_settings_category_specializations",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    config_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    specialization_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_settings_category_specializations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "application_settings_graduation_years",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    category_specialization_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    graduation_years_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    gender_types_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    marital_status_codes_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    age_min = table.Column<int>(type: "int", nullable: true),
                    max_age = table.Column<int>(type: "int", nullable: true),
                    division_codes_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    school_category_codes_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    application_start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    application_end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    age_reference_date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    grade_kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    min_percentage = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    academic_grade_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_settings_graduation_years", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_app_settings_configs_sort_order",
                table: "application_settings_category_configs",
                schema: AdminDbContext.Schema,
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "ux_app_settings_configs_category_id",
                table: "application_settings_category_configs",
                schema: AdminDbContext.Schema,
                column: "category_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_app_settings_specs_config_id",
                table: "application_settings_category_specializations",
                schema: AdminDbContext.Schema,
                column: "config_id");

            migrationBuilder.CreateIndex(
                name: "ux_app_settings_specs_config_specialization",
                table: "application_settings_category_specializations",
                schema: AdminDbContext.Schema,
                columns: new[] { "config_id", "specialization_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_app_settings_years_category_specialization_id",
                table: "application_settings_graduation_years",
                schema: AdminDbContext.Schema,
                column: "category_specialization_id");

            migrationBuilder.CreateIndex(
                name: "ix_app_settings_years_window",
                table: "application_settings_graduation_years",
                schema: AdminDbContext.Schema,
                columns: new[] { "category_specialization_id", "application_start_date", "application_end_date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "application_settings_category_configs",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "application_settings_category_specializations",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "application_settings_graduation_years",
                schema: AdminDbContext.Schema);
        }
    }
}
