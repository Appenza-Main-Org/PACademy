using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizePaymentsLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_ledger",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    applicant_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    fawry_reference = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    last_sync_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    paid_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    deleted_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    delete_reason = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_ledger", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payment_ledger_cycle_id",
                schema: AdminDbContext.Schema,
                table: "payment_ledger",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_ledger_national_id",
                schema: AdminDbContext.Schema,
                table: "payment_ledger",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_ledger_status",
                schema: AdminDbContext.Schema,
                table: "payment_ledger",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_payment_ledger_fawry_reference",
                schema: AdminDbContext.Schema,
                table: "payment_ledger",
                column: "fawry_reference",
                unique: true,
                filter: "[fawry_reference] IS NOT NULL");

            // Clean rebuild (no JSON→columns backfill): drop the extracted bucket's rows
            // from the shared JSON store. The `payments` operational table holds only the
            // `payments` bucket, so this empties it; portal payment rows in
            // applicant_portal_records (type='payment') are a different source and untouched.
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("payments")} WHERE [module] = N'payments';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_ledger",
                schema: AdminDbContext.Schema);
        }
    }
}
