using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialAdminSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_records",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "admission_cycles",
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    year = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admission_cycles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "admission_rules",
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admission_rules", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "applicant_categories",
                columns: table => new
                {
                    key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    label_ar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    is_open = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_categories", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "audit_entries",
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    module = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    action = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    entity = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    entity_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    actor_user_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    actor_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    details = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_entries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lookup_rows",
                columns: table => new
                {
                    lookup_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    code = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    name = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lookup_rows", x => new { x.lookup_key, x.code });
                });

            migrationBuilder.CreateTable(
                name: "officer_directory",
                columns: table => new
                {
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    full_arabic_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    officer_code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    mobile_number = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    user_type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_officer_directory", x => x.national_id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    label_ar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    is_system = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    full_arabic_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    role = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    account_status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_admin_records_module",
                table: "admin_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_admission_cycles_is_active",
                table: "admission_cycles",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ux_admission_rules_cycle_version",
                table: "admission_rules",
                columns: new[] { "cycle_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lookup_rows_lookup_key",
                table: "lookup_rows",
                column: "lookup_key");

            migrationBuilder.CreateIndex(
                name: "ux_roles_key",
                table: "roles",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_users_national_id",
                table: "users",
                column: "national_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_records");

            migrationBuilder.DropTable(
                name: "admission_cycles");

            migrationBuilder.DropTable(
                name: "admission_rules");

            migrationBuilder.DropTable(
                name: "applicant_categories");

            migrationBuilder.DropTable(
                name: "audit_entries");

            migrationBuilder.DropTable(
                name: "lookup_rows");

            migrationBuilder.DropTable(
                name: "officer_directory");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
