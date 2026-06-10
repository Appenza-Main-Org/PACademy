using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeNotificationsExamPlansCommitteeResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "committee_results",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    phase = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    pass_fail = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    entered_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    entered_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    approved_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_results", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exam_plans",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    category_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notifications_master",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    type = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    title_ar = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    publish_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    expire_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    created_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications_master", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "committee_result_scores",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    result_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    score_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    score_value = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_result_scores", x => new { x.result_id, x.score_key });
                    table.ForeignKey(
                        name: "FK_committee_result_scores_committee_results_result_id",
                        column: x => x.result_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "committee_results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exam_plan_exams",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    plan_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    exam_order = table.Column<int>(type: "int", nullable: false),
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    fee = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    is_required = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_plan_exams", x => new { x.plan_id, x.exam_order });
                    table.ForeignKey(
                        name: "FK_exam_plan_exams_exam_plans_plan_id",
                        column: x => x.plan_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "exam_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notification_audience",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    notification_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    audience_order = table.Column<int>(type: "int", nullable: false),
                    kind = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    target_json = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_audience", x => new { x.notification_id, x.audience_order });
                    table.ForeignKey(
                        name: "FK_notification_audience_notifications_master_notification_id",
                        column: x => x.notification_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "notifications_master",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_committee_results_applicant_id",
                schema: AdminDbContext.Schema,
                table: "committee_results",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_results_committee_id",
                schema: AdminDbContext.Schema,
                table: "committee_results",
                column: "committee_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_results_phase",
                schema: AdminDbContext.Schema,
                table: "committee_results",
                column: "phase");

            migrationBuilder.CreateIndex(
                name: "ix_exam_plan_exams_exam_id",
                schema: AdminDbContext.Schema,
                table: "exam_plan_exams",
                column: "exam_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_plans_cycle_category",
                schema: AdminDbContext.Schema,
                table: "exam_plans",
                columns: new[] { "cycle_id", "category_id" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_audience_kind",
                schema: AdminDbContext.Schema,
                table: "notification_audience",
                column: "kind");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_master_publish_at",
                schema: AdminDbContext.Schema,
                table: "notifications_master",
                column: "publish_at");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_master_status",
                schema: AdminDbContext.Schema,
                table: "notifications_master",
                column: "status");

            // Clean rebuild (no JSON→columns backfill): drop the extracted buckets'
            // rows from their shared JSON stores. Kept-JSON siblings survive:
            // committee_records keeps `committees`; exam_operational_records keeps
            // exam-attempts / exam-live-sessions / exam-audit; the Shape-B
            // `notifications` table empties (it held only this bucket).
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("committee_records")} WHERE [module] = N'committeeResults';");
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("exam_operational_records")} WHERE [module] = N'examPlans';");
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("notifications")} WHERE [module] = N'notifications';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "committee_result_scores",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_plan_exams",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "notification_audience",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "committee_results",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_plans",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "notifications_master",
                schema: AdminDbContext.Schema);
        }
    }
}
