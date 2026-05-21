using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.LookupsAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GenericLookupItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_lookup_items",
                columns: table => new
                {
                    lookup_key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "nvarchar(240)", maxLength: 240, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_lookup_items", x => new { x.lookup_key, x.code });
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_lookup_items_lookup_key",
                table: "admin_lookup_items",
                column: "lookup_key");

            migrationBuilder.CreateIndex(
                name: "IX_admin_lookup_items_lookup_key_sort_order",
                table: "admin_lookup_items",
                columns: new[] { "lookup_key", "sort_order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_lookup_items");
        }
    }
}
