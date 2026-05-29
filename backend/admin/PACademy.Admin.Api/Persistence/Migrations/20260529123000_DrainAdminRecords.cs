using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AdminDbContext))]
    [Migration("20260529123000_DrainAdminRecords")]
    public partial class DrainAdminRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_record_documents",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_admin_record_documents", x => new { x.module, x.id }));

            migrationBuilder.CreateIndex(
                name: "ix_admin_record_documents_module",
                schema: AdminDbContext.Schema,
                table: "admin_record_documents",
                column: "module");

            migrationBuilder.Sql($"""
                INSERT INTO {AdminDbContext.QualifiedTableName("admin_record_documents")}
                    ([module], [id], [payload_json], [created_at], [updated_at])
                SELECT [module], [id], [payload_json], [created_at], [updated_at]
                FROM {AdminDbContext.QualifiedTableName("admin_records")} source
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {AdminDbContext.QualifiedTableName("admin_record_documents")} target
                    WHERE target.[module] = source.[module] AND target.[id] = source.[id]
                );

                DELETE FROM {AdminDbContext.QualifiedTableName("admin_records")};
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                INSERT INTO {AdminDbContext.QualifiedTableName("admin_records")}
                    ([module], [id], [payload_json], [created_at], [updated_at])
                SELECT [module], [id], [payload_json], [created_at], [updated_at]
                FROM {AdminDbContext.QualifiedTableName("admin_record_documents")} source
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {AdminDbContext.QualifiedTableName("admin_records")} target
                    WHERE target.[module] = source.[module] AND target.[id] = source.[id]
                );
                """);

            migrationBuilder.DropTable(name: "admin_record_documents", schema: AdminDbContext.Schema);
        }
    }
}
