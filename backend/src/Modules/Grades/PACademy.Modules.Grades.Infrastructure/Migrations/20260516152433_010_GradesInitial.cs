using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Grades.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _010_GradesInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "grade_rows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Seat = table.Column<int>(type: "int", nullable: false),
                    SeatingNumber = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Nid = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Branch = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    School = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Total = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    ImportMax = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    OverrideMax = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    LastEditedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastEditedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_rows", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pending_grade_imports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    MaxDegree = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    NewRowsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DuplicatesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pending_grade_imports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "grade_adjustments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GradeRowId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    AddedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_adjustments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_grade_adjustments_grade_rows_GradeRowId",
                        column: x => x.GradeRowId,
                        principalTable: "grade_rows",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_grade_adjustments_GradeRowId",
                table: "grade_adjustments",
                column: "GradeRowId");

            migrationBuilder.CreateIndex(
                name: "IX_grade_rows_Nid",
                table: "grade_rows",
                column: "Nid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_grade_rows_Seat",
                table: "grade_rows",
                column: "Seat");

            migrationBuilder.CreateIndex(
                name: "IX_pending_grade_imports_created_at",
                table: "pending_grade_imports",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "grade_adjustments");

            migrationBuilder.DropTable(
                name: "pending_grade_imports");

            migrationBuilder.DropTable(
                name: "grade_rows");
        }
    }
}
