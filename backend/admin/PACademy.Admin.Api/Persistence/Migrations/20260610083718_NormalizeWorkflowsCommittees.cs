using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeWorkflowsCommittees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "applicant_workflow_progress",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    workflow_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    workflow_version = table.Column<int>(type: "int", nullable: false),
                    current_stage_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    completed_stage_ids_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_workflow_progress", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "committees",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    grade_type = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    grade_min = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    grade_max = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    capacity = table.Column<int>(type: "int", nullable: false),
                    gender = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    head_user_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    academic_year_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    linked_cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committees", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "workflows",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    department = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    updated_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflows", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "applicant_workflow_test_results",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    progress_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    stage_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    test_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    outcome = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    score = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    recorded_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    recorded_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_workflow_test_results", x => new { x.progress_id, x.stage_id, x.test_id });
                    table.ForeignKey(
                        name: "FK_applicant_workflow_test_results_applicant_workflow_progress_progress_id",
                        column: x => x.progress_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "applicant_workflow_progress",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_stage_tests",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    workflow_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    stage_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    test_order = table.Column<int>(type: "int", nullable: false),
                    test_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    required = table.Column<bool>(type: "bit", nullable: false),
                    pass_criterion_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    owner_app = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_stage_tests", x => new { x.workflow_id, x.stage_id, x.test_order });
                    table.ForeignKey(
                        name: "FK_workflow_stage_tests_workflows_workflow_id",
                        column: x => x.workflow_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "workflows",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_stages",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    workflow_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    stage_order = table.Column<int>(type: "int", nullable: false),
                    stage_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    status_on_enter = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    allowed_next_statuses_json = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_stages", x => new { x.workflow_id, x.stage_order });
                    table.ForeignKey(
                        name: "FK_workflow_stages_workflows_workflow_id",
                        column: x => x.workflow_id,
                        principalSchema: AdminDbContext.Schema,
                        principalTable: "workflows",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_applicant_workflow_progress_applicant_id",
                schema: AdminDbContext.Schema,
                table: "applicant_workflow_progress",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_workflow_progress_workflow_id",
                schema: AdminDbContext.Schema,
                table: "applicant_workflow_progress",
                column: "workflow_id");

            migrationBuilder.CreateIndex(
                name: "ix_committees_category_key",
                schema: AdminDbContext.Schema,
                table: "committees",
                column: "category_key");

            migrationBuilder.CreateIndex(
                name: "ix_committees_linked_cycle_id",
                schema: AdminDbContext.Schema,
                table: "committees",
                column: "linked_cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_committees_status",
                schema: AdminDbContext.Schema,
                table: "committees",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_stages_stage_id",
                schema: AdminDbContext.Schema,
                table: "workflow_stages",
                column: "stage_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflows_cycle_id",
                schema: AdminDbContext.Schema,
                table: "workflows",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflows_department",
                schema: AdminDbContext.Schema,
                table: "workflows",
                column: "department");

            migrationBuilder.CreateIndex(
                name: "ix_workflows_is_active",
                schema: AdminDbContext.Schema,
                table: "workflows",
                column: "is_active");

            // Clean rebuild (no JSON→columns backfill): drop the extracted buckets'
            // rows from their shared JSON stores. workflow_records keeps the
            // append-only `workflowTransitions` log; committee_records is fully
            // drained after this phase (committees / committeeInstances /
            // committeeResults all normalized) but the table stays.
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("workflow_records")} WHERE [module] IN (N'workflows', N'applicantWorkflowProgress');");
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("committee_records")} WHERE [module] = N'committees';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicant_workflow_test_results",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "committees",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "workflow_stage_tests",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "workflow_stages",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "applicant_workflow_progress",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "workflows",
                schema: AdminDbContext.Schema);
        }
    }
}
