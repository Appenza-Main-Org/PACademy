using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Payments.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _013_PaymentsInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    applicant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    applicant_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    national_id = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    cycle_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    fawry_reference = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<int>(type: "int", nullable: false),
                    last_sync_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    paid_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    demo_origin = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payment_Applicant",
                table: "payments",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "IX_Payment_Cycle_Status",
                table: "payments",
                columns: new[] { "cycle_id", "status" });

            migrationBuilder.CreateIndex(
                name: "UX_Payment_FawryReference",
                table: "payments",
                column: "fawry_reference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payments");
        }
    }
}
