using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Lookups.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _010c_AddGradeSourcesLookup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Register the GRADE_SOURCES lookup type.
            migrationBuilder.Sql(@"
MERGE INTO dbo.lookup_item_types AS tgt
USING (VALUES
    (N'GRADE_SOURCES', N'مصدر الدرجات', N'GSRC', 2, 0, 0, 0, N'admissions', 35, 1)
) AS src(Code, LabelAr, CodePrefix, Padding, IsHierarchical, HasDates, HasExtras, SectionKey, SortInSection, IsAdminUi)
ON tgt.Code = src.Code
WHEN NOT MATCHED THEN
    INSERT (Code, LabelAr, CodePrefix, Padding, IsHierarchical, HasDates, HasExtras, SectionKey, SortInSection, IsAdminUi)
    VALUES (src.Code, src.LabelAr, src.CodePrefix, src.Padding, src.IsHierarchical, src.HasDates, src.HasExtras, src.SectionKey, src.SortInSection, src.IsAdminUi);
");

            // 2) Seed the three sources (وزارة التربية والتعليم / الأزهر الشريف / شهادة أجنبية معادلة).
            migrationBuilder.Sql(@"
MERGE INTO dbo.lookup_items AS tgt
USING (VALUES
    ('a51f4d80-9c7e-4d18-b95a-3a4f1c5c7a01', N'GRADE_SOURCES', N'GSRC-01', N'وزارة التربية والتعليم', N'Ministry of Education',     1, 0, NULL, NULL, NULL, N'{}', NULL),
    ('a51f4d80-9c7e-4d18-b95a-3a4f1c5c7a02', N'GRADE_SOURCES', N'GSRC-02', N'الأزهر الشريف',             N'Al-Azhar',                  1, 1, NULL, NULL, NULL, N'{}', NULL),
    ('a51f4d80-9c7e-4d18-b95a-3a4f1c5c7a03', N'GRADE_SOURCES', N'GSRC-03', N'شهادة أجنبية معادلة',      N'Foreign certificate (equivalency)', 1, 2, NULL, NULL, NULL, N'{}', NULL)
) AS src(id, lookup_type_code, code, name_ar, name_en, is_active, sort_order, parent_id, start_date, end_date, extras, faculty_code)
ON tgt.lookup_type_code = src.lookup_type_code AND tgt.code = src.code AND tgt.deleted_at IS NULL
WHEN NOT MATCHED THEN
    INSERT (id, lookup_type_code, code, name_ar, name_en, is_active, sort_order, parent_id,
            start_date, end_date, extras, faculty_code, created_at, created_by, updated_at, updated_by)
    VALUES (src.id, src.lookup_type_code, src.code, src.name_ar, src.name_en, src.is_active, src.sort_order,
            src.parent_id, src.start_date, src.end_date, src.extras, src.faculty_code,
            SYSUTCDATETIME(), '00000000-0000-0000-0000-000000000001', SYSUTCDATETIME(), '00000000-0000-0000-0000-000000000001');
");

            // 3) Map every existing SCHOOL_CATEGORIES row to its grade-source. Only overwrites
            //    extras whose gradeSourceCode is currently unset, so admins who hand-edited a
            //    row keep their value.
            migrationBuilder.Sql(@"
UPDATE dbo.lookup_items
SET extras = N'{""gradeSourceCode"":""GSRC-01""}'
WHERE lookup_type_code = N'SCHOOL_CATEGORIES'
  AND code IN (N'SCH-01', N'SCH-02', N'SCH-03', N'SCH-04')
  AND deleted_at IS NULL
  AND (extras IS NULL OR extras = N'' OR extras = N'{}' OR JSON_VALUE(extras, '$.gradeSourceCode') IS NULL);

UPDATE dbo.lookup_items
SET extras = N'{""gradeSourceCode"":""GSRC-02""}'
WHERE lookup_type_code = N'SCHOOL_CATEGORIES'
  AND code = N'SCH-05'
  AND deleted_at IS NULL
  AND (extras IS NULL OR extras = N'' OR extras = N'{}' OR JSON_VALUE(extras, '$.gradeSourceCode') IS NULL);

UPDATE dbo.lookup_items
SET extras = N'{""gradeSourceCode"":""GSRC-03""}'
WHERE lookup_type_code = N'SCHOOL_CATEGORIES'
  AND code = N'SCH-06'
  AND deleted_at IS NULL
  AND (extras IS NULL OR extras = N'' OR extras = N'{}' OR JSON_VALUE(extras, '$.gradeSourceCode') IS NULL);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE dbo.lookup_items
SET extras = N'{}'
WHERE lookup_type_code = N'SCHOOL_CATEGORIES'
  AND JSON_VALUE(extras, '$.gradeSourceCode') IS NOT NULL;

DELETE FROM dbo.lookup_items
WHERE lookup_type_code = N'GRADE_SOURCES';

DELETE FROM dbo.lookup_item_types
WHERE Code = N'GRADE_SOURCES';
");
        }
    }
}
