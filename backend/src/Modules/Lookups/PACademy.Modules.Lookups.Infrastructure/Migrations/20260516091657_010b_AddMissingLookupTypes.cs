using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Lookups.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _010b_AddMissingLookupTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
MERGE INTO dbo.lookup_item_types AS tgt
USING (VALUES
    (N'SUBMISSION_TYPES',  N'أنواع التقديم',     N'SUB', 3, 0, 0, 0, N'admissions',  5, 1),
    (N'UNIVERSITIES',      N'الجامعات',          N'UNI', 3, 0, 0, 0, N'academic',   30, 1),
    (N'MARITAL_STATUSES',  N'الحالات الاجتماعية', N'MAR', 3, 0, 0, 0, N'reference',  40, 1),
    (N'ACADEMIC_GRADES',   N'التقديرات',         N'GRD', 3, 0, 0, 0, N'academic',   40, 1),
    (N'ACADEMIC_DEGREES',  N'الدرجات العلمية',   N'DEG', 3, 0, 0, 0, N'academic',   50, 1)
) AS src(Code, LabelAr, CodePrefix, Padding, IsHierarchical, HasDates, HasExtras, SectionKey, SortInSection, IsAdminUi)
ON tgt.Code = src.Code
WHEN NOT MATCHED THEN
    INSERT (Code, LabelAr, CodePrefix, Padding, IsHierarchical, HasDates, HasExtras, SectionKey, SortInSection, IsAdminUi)
    VALUES (src.Code, src.LabelAr, src.CodePrefix, src.Padding, src.IsHierarchical, src.HasDates, src.HasExtras, src.SectionKey, src.SortInSection, src.IsAdminUi);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM dbo.lookup_item_types
WHERE Code IN (N'SUBMISSION_TYPES', N'UNIVERSITIES', N'MARITAL_STATUSES', N'ACADEMIC_GRADES', N'ACADEMIC_DEGREES');
");
        }
    }
}
