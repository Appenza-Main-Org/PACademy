using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Lookups.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _010a_LookupMappingsAndTriggers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "category_committees",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryCommittees", x => new { x.category_id, x.target_id });
                    table.ForeignKey(
                        name: "FK_category_committees_lookup_items_category_id",
                        column: x => x.category_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_category_committees_lookup_items_target_id",
                        column: x => x.target_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "category_specializations",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategorySpecializations", x => new { x.category_id, x.target_id });
                    table.ForeignKey(
                        name: "FK_category_specializations_lookup_items_category_id",
                        column: x => x.category_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_category_specializations_lookup_items_target_id",
                        column: x => x.target_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "category_tests",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryTests", x => new { x.category_id, x.target_id });
                    table.ForeignKey(
                        name: "FK_category_tests_lookup_items_category_id",
                        column: x => x.category_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_category_tests_lookup_items_target_id",
                        column: x => x.target_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "period_categories",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    target_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeriodCategories", x => new { x.category_id, x.target_id });
                    table.ForeignKey(
                        name: "FK_period_categories_lookup_items_category_id",
                        column: x => x.category_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_period_categories_lookup_items_target_id",
                        column: x => x.target_id,
                        principalTable: "lookup_items",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_category_committees_target_id",
                table: "category_committees",
                column: "target_id");

            migrationBuilder.CreateIndex(
                name: "IX_category_specializations_target_id",
                table: "category_specializations",
                column: "target_id");

            migrationBuilder.CreateIndex(
                name: "IX_category_tests_target_id",
                table: "category_tests",
                column: "target_id");

            migrationBuilder.CreateIndex(
                name: "IX_period_categories_target_id",
                table: "period_categories",
                column: "target_id");

            // ── tr_LookupItem_NoCycles (FR-004 CIRCULAR_HIERARCHY → 51200) ──────
            // CTE must immediately precede a SELECT/INSERT/etc., not an IF EXISTS;
            // we materialize the cycle-flag into a variable then branch on it.
            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_LookupItem_NoCycles
ON dbo.lookup_items
AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(parent_id) RETURN;

    DECLARE @cycle BIT = 0;
    ;WITH ancestors AS (
        SELECT i.id AS root, i.parent_id AS ancestor_id, 1 AS depth
            FROM inserted i
            WHERE i.parent_id IS NOT NULL
        UNION ALL
        SELECT a.root, p.parent_id, a.depth + 1
            FROM ancestors a
            JOIN dbo.lookup_items p ON p.id = a.ancestor_id
            WHERE p.parent_id IS NOT NULL AND a.depth < 100
    )
    SELECT @cycle = 1 FROM ancestors WHERE root = ancestor_id
    OPTION (MAXRECURSION 0);

    IF @cycle = 1
        THROW 51200, 'CIRCULAR_HIERARCHY', 1;
END;
");

            // ── tr_LookupItem_BlockDelete (PARENT_HAS_CHILDREN 51210 + IN_USE 51220) ──
            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_LookupItem_BlockDelete
ON dbo.lookup_items
AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(deleted_at) RETURN;

    -- IN_USE first (more specific than PARENT_HAS_CHILDREN)
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN deleted d ON d.id = i.id
        WHERE d.deleted_at IS NULL AND i.deleted_at IS NOT NULL
          AND (
                EXISTS (SELECT 1 FROM dbo.category_specializations m WHERE m.category_id = i.id OR m.target_id = i.id)
             OR EXISTS (SELECT 1 FROM dbo.category_committees      m WHERE m.category_id = i.id OR m.target_id = i.id)
             OR EXISTS (SELECT 1 FROM dbo.category_tests           m WHERE m.category_id = i.id OR m.target_id = i.id)
             OR EXISTS (SELECT 1 FROM dbo.period_categories        m WHERE m.category_id = i.id OR m.target_id = i.id)
          )
    )
        THROW 51220, 'IN_USE', 1;

    -- PARENT_HAS_CHILDREN
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN deleted d ON d.id = i.id
        WHERE d.deleted_at IS NULL AND i.deleted_at IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM dbo.lookup_items c
              WHERE c.parent_id = i.id AND c.deleted_at IS NULL
          )
    )
        THROW 51210, 'PARENT_HAS_CHILDREN', 1;
END;
");

            // ── tr_LookupItem_FacultyFK (UNKNOWN_FACULTY 51240) ───────────────
            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_LookupItem_FacultyFK
ON dbo.lookup_items
AFTER INSERT, UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE i.lookup_type_code = 'SPECIALIZATIONS'
          AND i.faculty_code IS NOT NULL
          AND i.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM dbo.lookup_items f
              WHERE f.lookup_type_code = 'FACULTIES'
                AND f.code = i.faculty_code
                AND f.deleted_at IS NULL
          )
    )
        THROW 51240, 'UNKNOWN_FACULTY', 1;
END;
");

            // ── 4 mapping-table validators (UNKNOWN_TARGET 51230) ─────────────
            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_CategorySpecializations_ValidateRefs
ON dbo.category_specializations
AFTER INSERT
AS BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        LEFT JOIN dbo.lookup_items c ON c.id = i.category_id AND c.lookup_type_code = 'APPLICANT_CATEGORIES' AND c.deleted_at IS NULL
        LEFT JOIN dbo.lookup_items t ON t.id = i.target_id   AND t.lookup_type_code = 'SPECIALIZATIONS'      AND t.deleted_at IS NULL
        WHERE c.id IS NULL OR t.id IS NULL
    )
        THROW 51230, 'UNKNOWN_TARGET', 1;
END;
");

            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_CategoryCommittees_ValidateRefs
ON dbo.category_committees
AFTER INSERT
AS BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        LEFT JOIN dbo.lookup_items c ON c.id = i.category_id AND c.lookup_type_code = 'APPLICANT_CATEGORIES' AND c.deleted_at IS NULL
        LEFT JOIN dbo.lookup_items t ON t.id = i.target_id   AND t.lookup_type_code = 'COMMITTEES'           AND t.deleted_at IS NULL
        WHERE c.id IS NULL OR t.id IS NULL
    )
        THROW 51230, 'UNKNOWN_TARGET', 1;
END;
");

            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_CategoryTests_ValidateRefs
ON dbo.category_tests
AFTER INSERT
AS BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        LEFT JOIN dbo.lookup_items c ON c.id = i.category_id AND c.lookup_type_code = 'APPLICANT_CATEGORIES' AND c.deleted_at IS NULL
        LEFT JOIN dbo.lookup_items t ON t.id = i.target_id   AND t.lookup_type_code = 'TESTS'                AND t.deleted_at IS NULL
        WHERE c.id IS NULL OR t.id IS NULL
    )
        THROW 51230, 'UNKNOWN_TARGET', 1;
END;
");

            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.tr_PeriodCategories_ValidateRefs
ON dbo.period_categories
AFTER INSERT
AS BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        LEFT JOIN dbo.lookup_items c ON c.id = i.category_id AND c.lookup_type_code = 'CYCLE_PERIODS'        AND c.deleted_at IS NULL
        LEFT JOIN dbo.lookup_items t ON t.id = i.target_id   AND t.lookup_type_code = 'APPLICANT_CATEGORIES' AND t.deleted_at IS NULL
        WHERE c.id IS NULL OR t.id IS NULL
    )
        THROW 51230, 'UNKNOWN_TARGET', 1;
END;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_PeriodCategories_ValidateRefs', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_PeriodCategories_ValidateRefs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_CategoryTests_ValidateRefs', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_CategoryTests_ValidateRefs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_CategoryCommittees_ValidateRefs', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_CategoryCommittees_ValidateRefs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_CategorySpecializations_ValidateRefs', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_CategorySpecializations_ValidateRefs;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_LookupItem_FacultyFK', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_LookupItem_FacultyFK;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_LookupItem_BlockDelete', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_LookupItem_BlockDelete;");
            migrationBuilder.Sql("IF OBJECT_ID('dbo.tr_LookupItem_NoCycles', 'TR') IS NOT NULL DROP TRIGGER dbo.tr_LookupItem_NoCycles;");

            migrationBuilder.DropTable(name: "category_committees");
            migrationBuilder.DropTable(name: "category_specializations");
            migrationBuilder.DropTable(name: "category_tests");
            migrationBuilder.DropTable(name: "period_categories");
        }
    }
}
