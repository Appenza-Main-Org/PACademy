using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(ApplicantGradesAdminDbContext))]
    [Migration("20260603134000_RepairApplicantGradePayloadMirror")]
    public partial class RepairApplicantGradePayloadMirror : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF COL_LENGTH(N'dbo.applicant_grades', N'admin_record_id') IS NULL
                BEGIN
                    ALTER TABLE [applicant_grades]
                    ADD [admin_record_id] nvarchar(128) NULL;
                END;
                """);

            migrationBuilder.Sql("""
                IF COL_LENGTH(N'dbo.applicant_grades', N'payload_json') IS NULL
                BEGIN
                    ALTER TABLE [applicant_grades]
                    ADD [payload_json] nvarchar(max) NOT NULL
                        CONSTRAINT [DF_applicant_grades_payload_json_repair] DEFAULT N'{}';
                END;
                """);

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
                WHERE [admin_record_id] IS NULL
                   OR [payload_json] = N'{}'
                   OR [payload_json] IS NULL;
                """);

            migrationBuilder.Sql("""
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_applicant_grades_admin_record_id'
                      AND [object_id] = OBJECT_ID(N'dbo.applicant_grades')
                )
                BEGIN
                    CREATE UNIQUE INDEX [IX_applicant_grades_admin_record_id]
                    ON [applicant_grades] ([admin_record_id])
                    WHERE [admin_record_id] IS NOT NULL;
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentional no-op. This repair migration only reconciles
            // environments whose migration history drifted from schema.
        }
    }
}
