using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicantAcquaintanceDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: AdminDbContext.Schema);

            migrationBuilder.CreateTable(
                name: "acquaintance_doc_settings",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    opening_test_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    opening_required_outcome = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    closing_test_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    closing_mode = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    closing_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    is_enabled = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_acquaintance_doc_settings", x => x.id);
                    table.ForeignKey(
                        name: "FK_acquaintance_doc_settings_admission_cycles_cycle_id",
                        column: x => x.cycle_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "admission_cycles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "applicant_acquaintance_docs",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    opened_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    closed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    last_autosaved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    version = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_acquaintance_docs", x => x.id);
                    table.ForeignKey(
                        name: "FK_applicant_acquaintance_docs_admission_cycles_cycle_id",
                        column: x => x.cycle_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "admission_cycles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "applicant_acquaintance_doc_sections",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    acquaintance_doc_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    section_key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    data_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_acquaintance_doc_sections", x => x.id);
                    table.ForeignKey(
                        name: "FK_applicant_acquaintance_doc_sections_applicant_acquaintance_docs_acquaintance_doc_id",
                        column: x => x.acquaintance_doc_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "applicant_acquaintance_docs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "applicant_acquaintance_doc_revisions",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    acquaintance_doc_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    change_kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    changed_section_keys_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_acquaintance_doc_revisions", x => x.id);
                    table.ForeignKey(
                        name: "FK_applicant_acquaintance_doc_revisions_applicant_acquaintance_docs_acquaintance_doc_id",
                        column: x => x.acquaintance_doc_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "applicant_acquaintance_docs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_acquaintance_doc_settings_cycle_id",
                schema: AdminDbContext.Schema,
                table: "acquaintance_doc_settings",
                column: "cycle_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_applicant_acquaintance_docs_applicant_id",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_docs",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_acquaintance_docs_cycle_id",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_docs",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_acquaintance_docs_status",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_docs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_applicant_acquaintance_docs_cycle_applicant",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_docs",
                columns: new[] { "cycle_id", "applicant_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_applicant_acquaintance_doc_sections_doc_section",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_doc_sections",
                columns: new[] { "acquaintance_doc_id", "section_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_applicant_acquaintance_doc_revisions_doc_id",
                schema: AdminDbContext.Schema,
                table: "applicant_acquaintance_doc_revisions",
                column: "acquaintance_doc_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicant_acquaintance_doc_revisions",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "applicant_acquaintance_doc_sections",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "acquaintance_doc_settings",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "applicant_acquaintance_docs",
                schema: AdminDbContext.Schema);
        }
    }
}
