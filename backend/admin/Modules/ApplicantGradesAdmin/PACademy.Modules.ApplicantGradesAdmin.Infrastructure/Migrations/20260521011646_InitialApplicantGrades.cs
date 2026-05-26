using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialApplicantGrades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "applicant_grades",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    seat = table.Column<int>(type: "int", nullable: false),
                    seating_number = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    nid = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    gender = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    branch = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    graduation_year = table.Column<int>(type: "int", nullable: true),
                    school_category_code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    school = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    region = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    exam_round = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    total = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    import_max = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    override_max = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    last_edited_at = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    last_edited_by = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    grade_changed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    previous_grade = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    status = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_grades", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "grade_import_batches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_format = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    graduation_year = table.Column<int>(type: "int", nullable: true),
                    selected_school_categories_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    max_grade_by_category_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    total_rows = table.Column<int>(type: "int", nullable: false),
                    valid_rows = table.Column<int>(type: "int", nullable: false),
                    invalid_rows = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_import_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "applicant_grade_adjustments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    applicant_grade_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    reason_label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    by = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    when_label = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_grade_adjustments", x => x.id);
                    table.ForeignKey(
                        name: "FK_applicant_grade_adjustments_applicant_grades_applicant_grade_id",
                        column: x => x.applicant_grade_id,
                        principalTable: "applicant_grades",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "grade_import_rows",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    grade_import_batch_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_row_index = table.Column<int>(type: "int", nullable: false),
                    national_id = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    is_valid = table.Column<bool>(type: "bit", nullable: false),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    errors_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_import_rows", x => x.id);
                    table.ForeignKey(
                        name: "FK_grade_import_rows_grade_import_batches_grade_import_batch_id",
                        column: x => x.grade_import_batch_id,
                        principalTable: "grade_import_batches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grade_adjustments_applicant_grade_id",
                table: "applicant_grade_adjustments",
                column: "applicant_grade_id");

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_graduation_year",
                table: "applicant_grades",
                column: "graduation_year");

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_nid",
                table: "applicant_grades",
                column: "nid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_school_category_code",
                table: "applicant_grades",
                column: "school_category_code");

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_seat",
                table: "applicant_grades",
                column: "seat",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_grade_import_rows_grade_import_batch_id",
                table: "grade_import_rows",
                column: "grade_import_batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_grade_import_rows_national_id",
                table: "grade_import_rows",
                column: "national_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicant_grade_adjustments");

            migrationBuilder.DropTable(
                name: "grade_import_rows");

            migrationBuilder.DropTable(
                name: "applicant_grades");

            migrationBuilder.DropTable(
                name: "grade_import_batches");
        }
    }
}
