using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicantPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: AdminDbContext.Schema);

            migrationBuilder.CreateTable(
                name: "applicant_portal_records",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    record_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_portal_records", x => new { x.type, x.record_id });
                });

            migrationBuilder.CreateTable(
                name: "exam_slots",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    time = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    location = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    reserved = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_slots", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_portal_records_applicant_id",
                schema: AdminDbContext.Schema,
                table: "applicant_portal_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_slots_date",
                schema: AdminDbContext.Schema,
                table: "exam_slots",
                column: "date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicant_portal_records",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_slots",
                schema: AdminDbContext.Schema);
        }
    }
}
