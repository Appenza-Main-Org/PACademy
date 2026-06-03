using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.ApplicantGradesAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OptimizeApplicantGradeListIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_branch_seat",
                table: "applicant_grades",
                columns: new[] { "branch", "seat" });

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_gender_seat",
                table: "applicant_grades",
                columns: new[] { "gender", "seat" });

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_graduation_year_seat",
                table: "applicant_grades",
                columns: new[] { "graduation_year", "seat" });

            migrationBuilder.CreateIndex(
                name: "IX_applicant_grades_school_category_code_seat",
                table: "applicant_grades",
                columns: new[] { "school_category_code", "seat" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_applicant_grades_branch_seat",
                table: "applicant_grades");

            migrationBuilder.DropIndex(
                name: "IX_applicant_grades_gender_seat",
                table: "applicant_grades");

            migrationBuilder.DropIndex(
                name: "IX_applicant_grades_graduation_year_seat",
                table: "applicant_grades");

            migrationBuilder.DropIndex(
                name: "IX_applicant_grades_school_category_code_seat",
                table: "applicant_grades");
        }
    }
}
