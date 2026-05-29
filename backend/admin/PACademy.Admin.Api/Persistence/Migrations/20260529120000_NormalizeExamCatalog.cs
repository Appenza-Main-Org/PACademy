using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AdminDbContext))]
    [Migration("20260529120000_NormalizeExamCatalog")]
    public partial class NormalizeExamCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exam_questions",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    category = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    classification = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    difficulty = table.Column<int>(type: "int", nullable: false),
                    type = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    text = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    correct_index = table.Column<int>(type: "int", nullable: false),
                    time_limit_seconds = table.Column<int>(type: "int", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    image_url = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_exam_questions", x => x.id));

            migrationBuilder.CreateTable(
                name: "exams",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    name_ar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    cycle_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    scheduled_for = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    access_start_at = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    access_end_at = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    duration_minutes = table.Column<int>(type: "int", nullable: true),
                    question_count = table.Column<int>(type: "int", nullable: true),
                    random_selection = table.Column<bool>(type: "bit", nullable: true),
                    random_question_order = table.Column<bool>(type: "bit", nullable: true),
                    display_mode = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_exams", x => x.id));

            migrationBuilder.CreateTable(
                name: "exam_question_options",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    question_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    option_order = table.Column<int>(type: "int", nullable: false),
                    option_text = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_question_options", x => new { x.question_id, x.option_order });
                    table.ForeignKey(
                        name: "FK_exam_question_options_exam_questions_question_id",
                        column: x => x.question_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exam_questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exam_question_matching_pairs",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    question_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    pair_order = table.Column<int>(type: "int", nullable: false),
                    prompt = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    match_text = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_question_matching_pairs", x => new { x.question_id, x.pair_order });
                    table.ForeignKey(
                        name: "FK_exam_question_matching_pairs_exam_questions_question_id",
                        column: x => x.question_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exam_questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exam_rules",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    rule_order = table.Column<int>(type: "int", nullable: false),
                    category = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    difficulty_min = table.Column<int>(type: "int", nullable: false),
                    difficulty_max = table.Column<int>(type: "int", nullable: false),
                    question_count = table.Column<int>(type: "int", nullable: false),
                    minutes = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_rules", x => new { x.exam_id, x.rule_order });
                    table.ForeignKey(
                        name: "FK_exam_rules_exams_exam_id",
                        column: x => x.exam_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exam_question_links",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    question_order = table.Column<int>(type: "int", nullable: false),
                    question_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_question_links", x => new { x.exam_id, x.question_order });
                    table.ForeignKey(
                        name: "FK_exam_question_links_exams_exam_id",
                        column: x => x.exam_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exam_assignments",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    assignment_kind = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    assignment_order = table.Column<int>(type: "int", nullable: false),
                    value = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_assignments", x => new { x.exam_id, x.assignment_kind, x.assignment_order });
                    table.ForeignKey(
                        name: "FK_exam_assignments_exams_exam_id",
                        column: x => x.exam_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "ix_exam_questions_category", schema: AdminDbContext.Schema, table: "exam_questions", column: "category");
            migrationBuilder.CreateIndex(name: "ix_exam_questions_status", schema: AdminDbContext.Schema, table: "exam_questions", column: "status");
            migrationBuilder.CreateIndex(name: "ix_exams_cycle_id", schema: AdminDbContext.Schema, table: "exams", column: "cycle_id");
            migrationBuilder.CreateIndex(name: "ix_exams_status", schema: AdminDbContext.Schema, table: "exams", column: "status");
            migrationBuilder.CreateIndex(name: "ix_exam_question_links_question_id", schema: AdminDbContext.Schema, table: "exam_question_links", column: "question_id");

            migrationBuilder.Sql($"""
                INSERT INTO {AdminDbContext.QualifiedTableName("exam_questions")}
                    ([id], [category], [classification], [difficulty], [type], [text], [correct_index], [time_limit_seconds], [notes], [status], [version], [image_url], [created_at], [updated_at])
                SELECT
                    [id],
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.category'), N''), N''),
                    JSON_VALUE([payload_json], '$.classification'),
                    COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.difficulty')), 1),
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.type'), N''), N'mcq'),
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.text'), N''), N''),
                    COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.correctIndex')), 0),
                    COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.timeLimitSeconds')), 60),
                    JSON_VALUE([payload_json], '$.notes'),
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.status'), N''), N'draft'),
                    COALESCE(TRY_CONVERT(int, JSON_VALUE([payload_json], '$.version')), 1),
                    JSON_VALUE([payload_json], '$.imageUrl'),
                    [created_at],
                    [updated_at]
                FROM {AdminDbContext.QualifiedTableName("admin_records")}
                WHERE [module] = N'questions';

                INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_options")} ([question_id], [option_order], [option_text])
                SELECT r.[id], TRY_CONVERT(int, o.[key]), CONVERT(nvarchar(max), o.[value])
                FROM {AdminDbContext.QualifiedTableName("admin_records")} r
                CROSS APPLY OPENJSON(r.[payload_json], '$.options') o
                WHERE r.[module] = N'questions';

                INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_matching_pairs")} ([question_id], [pair_order], [prompt], [match_text])
                SELECT r.[id], TRY_CONVERT(int, p.[key]), COALESCE(JSON_VALUE(p.[value], '$.prompt'), N''), COALESCE(JSON_VALUE(p.[value], '$.match'), N'')
                FROM {AdminDbContext.QualifiedTableName("admin_records")} r
                CROSS APPLY OPENJSON(r.[payload_json], '$.matchingPairs') p
                WHERE r.[module] = N'questions';

                INSERT INTO {AdminDbContext.QualifiedTableName("exams")}
                    ([id], [name_ar], [cycle_id], [cycle_name], [scheduled_for], [access_start_at], [access_end_at], [duration_minutes], [question_count], [random_selection], [random_question_order], [display_mode], [status], [created_at], [updated_at])
                SELECT
                    [id],
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.nameAr'), N''), [id]),
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.cycleId'), N''), N''),
                    JSON_VALUE([payload_json], '$.cycleName'),
                    JSON_VALUE([payload_json], '$.scheduledFor'),
                    JSON_VALUE([payload_json], '$.accessStartAt'),
                    JSON_VALUE([payload_json], '$.accessEndAt'),
                    TRY_CONVERT(int, JSON_VALUE([payload_json], '$.durationMinutes')),
                    TRY_CONVERT(int, JSON_VALUE([payload_json], '$.questionCount')),
                    TRY_CONVERT(bit, JSON_VALUE([payload_json], '$.randomSelection')),
                    TRY_CONVERT(bit, JSON_VALUE([payload_json], '$.randomQuestionOrder')),
                    JSON_VALUE([payload_json], '$.displayMode'),
                    COALESCE(NULLIF(JSON_VALUE([payload_json], '$.status'), N''), N'draft'),
                    [created_at],
                    [updated_at]
                FROM {AdminDbContext.QualifiedTableName("admin_records")}
                WHERE [module] = N'exams';

                INSERT INTO {AdminDbContext.QualifiedTableName("exam_rules")} ([exam_id], [rule_order], [category], [difficulty_min], [difficulty_max], [question_count], [minutes])
                SELECT r.[id], TRY_CONVERT(int, item.[key]), COALESCE(JSON_VALUE(item.[value], '$.category'), N''), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.difficultyMin')), 1), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.difficultyMax')), 5), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.count')), 0), COALESCE(TRY_CONVERT(int, JSON_VALUE(item.[value], '$.minutes')), 0)
                FROM {AdminDbContext.QualifiedTableName("admin_records")} r
                CROSS APPLY OPENJSON(r.[payload_json], '$.rules') item
                WHERE r.[module] = N'exams';

                INSERT INTO {AdminDbContext.QualifiedTableName("exam_question_links")} ([exam_id], [question_order], [question_id])
                SELECT r.[id], TRY_CONVERT(int, item.[key]), CONVERT(nvarchar(128), item.[value])
                FROM {AdminDbContext.QualifiedTableName("admin_records")} r
                CROSS APPLY OPENJSON(r.[payload_json], '$.questionIds') item
                WHERE r.[module] = N'exams';

                DELETE FROM {AdminDbContext.QualifiedTableName("admin_records")}
                WHERE [module] IN (N'questions', N'exams');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "exam_assignments", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exam_question_links", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exam_rules", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exam_question_matching_pairs", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exam_question_options", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exams", schema: AdminDbContext.Schema);
            migrationBuilder.DropTable(name: "exam_questions", schema: AdminDbContext.Schema);
        }
    }
}
