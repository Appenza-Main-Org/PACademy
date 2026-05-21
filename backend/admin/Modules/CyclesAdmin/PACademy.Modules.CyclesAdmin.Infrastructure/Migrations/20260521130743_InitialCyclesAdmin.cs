using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.CyclesAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCyclesAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_cycle_setup_items",
                columns: table => new
                {
                    bucket = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    id = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_cycle_setup_items", x => new { x.bucket, x.id });
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_cycle_setup_items_bucket_sort_order",
                table: "admin_cycle_setup_items",
                columns: new[] { "bucket", "sort_order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_cycle_setup_items");
        }
    }
}
