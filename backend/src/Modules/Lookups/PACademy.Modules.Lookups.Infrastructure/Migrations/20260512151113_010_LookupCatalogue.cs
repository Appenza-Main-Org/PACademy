using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Lookups.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _010_LookupCatalogue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lookup_item_types",
                columns: table => new
                {
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    LabelAr = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CodePrefix = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Padding = table.Column<byte>(type: "tinyint", nullable: false),
                    IsHierarchical = table.Column<bool>(type: "bit", nullable: false),
                    HasDates = table.Column<bool>(type: "bit", nullable: false),
                    HasExtras = table.Column<bool>(type: "bit", nullable: false),
                    SectionKey = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SortInSection = table.Column<short>(type: "smallint", nullable: false),
                    IsAdminUi = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lookup_item_types", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "lookup_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    lookup_type_code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    parent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    start_date = table.Column<DateOnly>(type: "date", nullable: true),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    extras = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    faculty_code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    deleted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    delete_reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lookup_items", x => x.id);
                    table.CheckConstraint("CK_LookupItem_DateRange", "[start_date] IS NULL OR [end_date] IS NULL OR [start_date] <= [end_date]");
                    table.CheckConstraint("CK_LookupItem_NotSelfParent", "[parent_id] IS NULL OR [parent_id] <> [id]");
                    table.ForeignKey(
                        name: "FK_lookup_items_lookup_item_types_lookup_type_code",
                        column: x => x.lookup_type_code,
                        principalTable: "lookup_item_types",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lookup_items_lookup_items_parent_id",
                        column: x => x.parent_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "UX_LookupItemType_CodePrefix",
                table: "lookup_item_types",
                column: "CodePrefix",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LookupItem_Parent",
                table: "lookup_items",
                columns: new[] { "parent_id", "deleted_at" });

            migrationBuilder.CreateIndex(
                name: "IX_LookupItem_SortOrder",
                table: "lookup_items",
                columns: new[] { "lookup_type_code", "sort_order", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_LookupItem_Type_Active",
                table: "lookup_items",
                columns: new[] { "lookup_type_code", "is_active", "deleted_at" });

            migrationBuilder.CreateIndex(
                name: "UX_LookupItem_TypeCode_Code",
                table: "lookup_items",
                columns: new[] { "lookup_type_code", "code" },
                unique: true,
                filter: "[deleted_at] IS NULL");

            // Seed the 17 admin-UI lookup type codes (FR-020). Idempotent via NOT EXISTS guard
            // so the migration is safe to re-run on partially-migrated environments.
            migrationBuilder.Sql(@"
MERGE INTO dbo.lookup_item_types AS tgt
USING (VALUES
    (N'RELATIONSHIPS',               N'صلات القرابة',            N'REL',  3, 1, 0, 1, N'kinship',    10, 1),
    (N'RELATIONSHIP_DEGREE_TIERS',   N'درجات القرابة',           N'RDT',  3, 0, 0, 1, N'kinship',    20, 1),
    (N'TESTS',                       N'الاختبارات',              N'TST',  3, 0, 0, 1, N'process',    10, 1),
    (N'TEST_RESULTS',                N'نتائج الاختبارات',        N'TRS',  3, 0, 0, 1, N'process',    20, 1),
    (N'COMMITTEES',                  N'اللجان',                  N'COM',  3, 0, 0, 1, N'process',    30, 1),
    (N'FACULTIES',                   N'الكليات',                 N'FAC',  3, 0, 0, 0, N'academic',   10, 1),
    (N'SPECIALIZATIONS',             N'التخصصات',                N'SPC',  3, 0, 0, 0, N'academic',   20, 1),
    (N'APPLICANT_CATEGORIES',        N'فئات المتقدمين',          N'CAT',  3, 0, 0, 1, N'admissions', 10, 1),
    (N'APPLICANT_DIVISIONS',         N'الشُعب',                  N'DIV',  3, 0, 0, 0, N'admissions', 20, 1),
    (N'SCHOOL_CATEGORIES',           N'فئات المدارس',            N'SCH',  3, 0, 0, 0, N'admissions', 30, 1),
    (N'QUALIFICATIONS',              N'المؤهلات',                N'QUL',  3, 0, 0, 1, N'admissions', 40, 1),
    (N'NATIONALITIES_COUNTRIES',     N'الجنسيات والدول',         N'CTR',  3, 0, 0, 1, N'geography',  10, 1),
    (N'GOVERNORATES',                N'المحافظات',               N'GOV',  3, 0, 0, 1, N'geography',  20, 1),
    (N'POLICE_STATIONS',             N'أقسام الشرطة',            N'PST',  3, 0, 0, 1, N'geography',  30, 1),
    (N'JOBS',                        N'الوظائف',                 N'JOB',  3, 1, 0, 0, N'reference',  10, 1),
    (N'NID_MISSING_REASONS',         N'أسباب غياب الرقم القومي', N'NMR',  3, 0, 0, 1, N'reference',  20, 1),
    (N'ANNOUNCEMENTS',               N'الإعلانات',               N'ANN',  3, 0, 1, 1, N'reference',  30, 1)
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
            migrationBuilder.DropTable(
                name: "lookup_items");

            migrationBuilder.DropTable(
                name: "lookup_item_types");
        }
    }
}
