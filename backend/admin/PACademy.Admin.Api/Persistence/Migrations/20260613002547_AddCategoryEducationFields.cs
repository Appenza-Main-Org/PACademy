using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryEducationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "category_education_fields",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    category_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    field_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    label_ar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    input_kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    section_key = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    min_value = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    max_value = table.Column<decimal>(type: "decimal(9,2)", precision: 9, scale: 2, nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    last_modified_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    source_system = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, defaultValue: "appenza-admin"),
                    checksum = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_category_education_fields", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_category_education_fields_category_sort",
                schema: AdminDbContext.Schema,
                table: "category_education_fields",
                columns: new[] { "category_key", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ux_category_education_fields_category_field",
                schema: AdminDbContext.Schema,
                table: "category_education_fields",
                columns: new[] { "category_key", "field_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "category_education_fields",
                schema: AdminDbContext.Schema);
        }
    }
}
