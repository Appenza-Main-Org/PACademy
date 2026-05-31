using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicantGradePayloadMirror : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "admin_record_id",
                table: "applicant_grades",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payload_json",
                table: "applicant_grades",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.Sql("""
                UPDATE [applicant_grades]
                SET
                    [admin_record_id] = COALESCE([admin_record_id], CONVERT(nvarchar(128), [seat])),
                    [payload_json] =
                    (
                        SELECT
                            COALESCE([admin_record_id], CONVERT(nvarchar(128), [seat])) AS [id],
                            [seat],
                            [seating_number] AS [seatingNumber],
                            [nid],
                            [name],
                            [kind],
                            [gender],
                            [branch],
                            [graduation_year] AS [graduationYear],
                            [school_category_code] AS [schoolCategoryCode],
                            [school],
                            [region],
                            [exam_round] AS [examRound],
                            [total],
                            [import_max] AS [importMax],
                            [override_max] AS [overrideMax],
                            [last_edited_at] AS [lastEditedAt],
                            [last_edited_by] AS [lastEditedBy],
                            [grade_changed_at] AS [gradeChangedAt],
                            [previous_grade] AS [previousGrade],
                            [status],
                            JSON_QUERY(N'[]') AS [log]
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                    )
                WHERE [payload_json] = N'{}' OR [payload_json] IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_admin_record_id",
                table: "applicant_grades",
                column: "admin_record_id",
                unique: true,
                filter: "[admin_record_id] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_applicant_grades_admin_record_id",
                table: "applicant_grades");

            migrationBuilder.DropColumn(
                name: "admin_record_id",
                table: "applicant_grades");

            migrationBuilder.DropColumn(
                name: "payload_json",
                table: "applicant_grades");
        }
    }
}
