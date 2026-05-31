using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeOperationalRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateTable(
                name: "admission_setup_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admission_setup_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "applicant_management_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicant_management_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "biometric_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_biometric_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "committee_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "exam_operational_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_operational_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "grade_operational_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_operational_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "report_snapshots",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_report_snapshots", x => new { x.module, x.id });
                });

            migrationBuilder.CreateTable(
                name: "workflow_records",
                schema: "dbo",
                columns: table => new
                {
                    module = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    committee_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    category_key = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    department = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    kind = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_records", x => new { x.module, x.id });
                });

            migrationBuilder.CreateIndex(
                name: "ix_admission_setup_records_applicant_id",
                schema: "dbo",
                table: "admission_setup_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_admission_setup_records_cycle_id",
                schema: "dbo",
                table: "admission_setup_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_admission_setup_records_module",
                schema: "dbo",
                table: "admission_setup_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_admission_setup_records_national_id",
                schema: "dbo",
                table: "admission_setup_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_admission_setup_records_status",
                schema: "dbo",
                table: "admission_setup_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_management_records_applicant_id",
                schema: "dbo",
                table: "applicant_management_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_management_records_cycle_id",
                schema: "dbo",
                table: "applicant_management_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_management_records_module",
                schema: "dbo",
                table: "applicant_management_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_management_records_national_id",
                schema: "dbo",
                table: "applicant_management_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_applicant_management_records_status",
                schema: "dbo",
                table: "applicant_management_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_records_applicant_id",
                schema: "dbo",
                table: "biometric_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_records_cycle_id",
                schema: "dbo",
                table: "biometric_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_records_module",
                schema: "dbo",
                table: "biometric_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_records_national_id",
                schema: "dbo",
                table: "biometric_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_records_status",
                schema: "dbo",
                table: "biometric_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_committee_records_applicant_id",
                schema: "dbo",
                table: "committee_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_records_cycle_id",
                schema: "dbo",
                table: "committee_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_records_module",
                schema: "dbo",
                table: "committee_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_committee_records_national_id",
                schema: "dbo",
                table: "committee_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_committee_records_status",
                schema: "dbo",
                table: "committee_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_exam_operational_records_applicant_id",
                schema: "dbo",
                table: "exam_operational_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_operational_records_cycle_id",
                schema: "dbo",
                table: "exam_operational_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_operational_records_module",
                schema: "dbo",
                table: "exam_operational_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_exam_operational_records_national_id",
                schema: "dbo",
                table: "exam_operational_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_operational_records_status",
                schema: "dbo",
                table: "exam_operational_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_grade_operational_records_applicant_id",
                schema: "dbo",
                table: "grade_operational_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_operational_records_cycle_id",
                schema: "dbo",
                table: "grade_operational_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_operational_records_module",
                schema: "dbo",
                table: "grade_operational_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_grade_operational_records_national_id",
                schema: "dbo",
                table: "grade_operational_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_operational_records_status",
                schema: "dbo",
                table: "grade_operational_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_applicant_id",
                schema: "dbo",
                table: "notifications",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_cycle_id",
                schema: "dbo",
                table: "notifications",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_module",
                schema: "dbo",
                table: "notifications",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_national_id",
                schema: "dbo",
                table: "notifications",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_status",
                schema: "dbo",
                table: "notifications",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_payments_applicant_id",
                schema: "dbo",
                table: "payments",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_cycle_id",
                schema: "dbo",
                table: "payments",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_module",
                schema: "dbo",
                table: "payments",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_payments_national_id",
                schema: "dbo",
                table: "payments",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_status",
                schema: "dbo",
                table: "payments",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_report_snapshots_applicant_id",
                schema: "dbo",
                table: "report_snapshots",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_snapshots_cycle_id",
                schema: "dbo",
                table: "report_snapshots",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_snapshots_module",
                schema: "dbo",
                table: "report_snapshots",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_report_snapshots_national_id",
                schema: "dbo",
                table: "report_snapshots",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_snapshots_status",
                schema: "dbo",
                table: "report_snapshots",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_records_applicant_id",
                schema: "dbo",
                table: "workflow_records",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_records_cycle_id",
                schema: "dbo",
                table: "workflow_records",
                column: "cycle_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_records_module",
                schema: "dbo",
                table: "workflow_records",
                column: "module");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_records_national_id",
                schema: "dbo",
                table: "workflow_records",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_records_status",
                schema: "dbo",
                table: "workflow_records",
                column: "status");

            CopyLegacyAdminRecordDocuments(migrationBuilder);
            DropLegacyAdminRecordDocuments(migrationBuilder);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            RestoreLegacyAdminRecordDocuments(migrationBuilder);

            migrationBuilder.DropTable(
                name: "admission_setup_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "applicant_management_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "biometric_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "committee_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "exam_operational_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "grade_operational_records",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "report_snapshots",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "workflow_records",
                schema: "dbo");

            migrationBuilder.EnsureSchema(
                name: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "users",
                schema: "dbo",
                newName: "users",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "roles",
                schema: "dbo",
                newName: "roles",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "officer_directory",
                schema: "dbo",
                newName: "officer_directory",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "lookup_rows",
                schema: "dbo",
                newName: "lookup_rows",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "general_settings",
                schema: "dbo",
                newName: "general_settings",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exams",
                schema: "dbo",
                newName: "exams",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_slots",
                schema: "dbo",
                newName: "exam_slots",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_rules",
                schema: "dbo",
                newName: "exam_rules",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_questions",
                schema: "dbo",
                newName: "exam_questions",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_question_options",
                schema: "dbo",
                newName: "exam_question_options",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_question_matching_pairs",
                schema: "dbo",
                newName: "exam_question_matching_pairs",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_question_links",
                schema: "dbo",
                newName: "exam_question_links",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "exam_assignments",
                schema: "dbo",
                newName: "exam_assignments",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "audit_entries",
                schema: "dbo",
                newName: "audit_entries",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "application_settings_graduation_years",
                schema: "dbo",
                newName: "application_settings_graduation_years",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "application_settings_category_specializations",
                schema: "dbo",
                newName: "application_settings_category_specializations",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "application_settings_category_configs",
                schema: "dbo",
                newName: "application_settings_category_configs",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "applicant_portal_records",
                schema: "dbo",
                newName: "applicant_portal_records",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "applicant_categories",
                schema: "dbo",
                newName: "applicant_categories",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "admission_rules",
                schema: "dbo",
                newName: "admission_rules",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "admission_cycles",
                schema: "dbo",
                newName: "admission_cycles",
                newSchema: "PACademy_staging_db");

            migrationBuilder.RenameTable(
                name: "admin_records",
                schema: "dbo",
                newName: "admin_records",
                newSchema: "PACademy_staging_db");
        }

        private static void CopyLegacyAdminRecordDocuments(MigrationBuilder migrationBuilder)
        {
            CopyLegacyDocumentsTo(migrationBuilder, "payments", "source.[module] IN (N'payments')");
            CopyLegacyDocumentsTo(migrationBuilder, "applicant_management_records", "source.[module] IN (N'applicants', N'relatives', N'acquaintance')");
            CopyLegacyDocumentsTo(migrationBuilder, "grade_operational_records", "source.[module] IN (N'grades')");
            CopyLegacyDocumentsTo(migrationBuilder, "notifications", "source.[module] IN (N'notifications')");
            CopyLegacyDocumentsTo(migrationBuilder, "workflow_records", "source.[module] IN (N'workflows', N'workflowTransitions', N'applicantWorkflowProgress')");
            CopyLegacyDocumentsTo(migrationBuilder, "committee_records", "source.[module] IN (N'committees', N'committeeInstances', N'committeeResults')");
            CopyLegacyDocumentsTo(migrationBuilder, "exam_operational_records", "source.[module] IN (N'examPlans', N'examResults', N'exam-attempts', N'exam-live-sessions', N'exam-committee-users', N'exam-devices', N'exam-audit')");
            CopyLegacyDocumentsTo(migrationBuilder, "biometric_records", "source.[module] IN (N'biometric-enrollments', N'biometric-verifications', N'biometric-gate-logs', N'biometric-audit')");
            CopyLegacyDocumentsTo(migrationBuilder, "admission_setup_records", "source.[module] = N'committeeBindings' OR source.[module] LIKE N'admissionSetup.%'");
            CopyLegacyDocumentsTo(migrationBuilder, "report_snapshots", "source.[module] IN (N'kpis', N'last14Days')");
        }

        private static void CopyLegacyDocumentsTo(MigrationBuilder migrationBuilder, string destinationTable, string predicate)
        {
            foreach (var sourceSchema in new[] { "PACademy_staging_db", "dbo" })
            {
                migrationBuilder.Sql($"""
                IF OBJECT_ID(N'[{sourceSchema}].[admin_record_documents]', N'U') IS NOT NULL
                BEGIN
                    INSERT INTO [dbo].[{destinationTable}]
                    (
                        [module],
                        [id],
                        [applicant_id],
                        [national_id],
                        [cycle_id],
                        [committee_id],
                        [category_key],
                        [department],
                        [status],
                        [kind],
                        [occurred_at],
                        [payload_json],
                        [created_at],
                        [updated_at]
                    )
                    SELECT
                        source.[module],
                        source.[id],
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.applicantId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.applicant_id'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.id')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.nationalId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.national_id'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.nid')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.cycleId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.admissionCycleId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.cycle_id')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.committeeId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.committee_id')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.categoryKey'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.categoryId'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.applicantCategory'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.category')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.department'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.module')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.status'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.paymentStatus'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.result'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.phase')
                        ),
                        COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.kind'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.type'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.action')
                        ),
                        TRY_CONVERT(datetimeoffset, COALESCE(
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.timestamp'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.ts'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.occurredAt'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.createdAt'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.registeredAt'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.date'),
                            JSON_VALUE(CASE WHEN ISJSON(source.[payload_json]) = 1 THEN source.[payload_json] END, '$.examDate')
                        )),
                        source.[payload_json],
                        source.[created_at],
                        source.[updated_at]
                    FROM [{sourceSchema}].[admin_record_documents] AS source
                    WHERE ({predicate})
                      AND NOT EXISTS
                      (
                          SELECT 1
                          FROM [dbo].[{destinationTable}] AS target
                          WHERE target.[module] = source.[module]
                            AND target.[id] = source.[id]
                      );
                END
                """);
            }
        }

        private static void DropLegacyAdminRecordDocuments(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
            IF OBJECT_ID(N'[PACademy_staging_db].[admin_record_documents]', N'U') IS NOT NULL
                DROP TABLE [PACademy_staging_db].[admin_record_documents];

            IF OBJECT_ID(N'[dbo].[admin_record_documents]', N'U') IS NOT NULL
                DROP TABLE [dbo].[admin_record_documents];
            """);
        }

        private static void RestoreLegacyAdminRecordDocuments(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
            IF SCHEMA_ID(N'PACademy_staging_db') IS NULL
                EXEC(N'CREATE SCHEMA [PACademy_staging_db]');

            IF OBJECT_ID(N'[PACademy_staging_db].[admin_record_documents]', N'U') IS NULL
            BEGIN
                CREATE TABLE [PACademy_staging_db].[admin_record_documents]
                (
                    [module] nvarchar(96) NOT NULL,
                    [id] nvarchar(128) NOT NULL,
                    [created_at] datetimeoffset NOT NULL,
                    [payload_json] nvarchar(max) NOT NULL,
                    [row_version] rowversion NOT NULL,
                    [updated_at] datetimeoffset NOT NULL,
                    CONSTRAINT [PK_admin_record_documents] PRIMARY KEY ([module], [id])
                );

                CREATE INDEX [ix_admin_record_documents_module]
                    ON [PACademy_staging_db].[admin_record_documents] ([module]);
            END
            """);

            CopyOperationalRecordsBack(migrationBuilder, "payments");
            CopyOperationalRecordsBack(migrationBuilder, "applicant_management_records");
            CopyOperationalRecordsBack(migrationBuilder, "grade_operational_records");
            CopyOperationalRecordsBack(migrationBuilder, "notifications");
            CopyOperationalRecordsBack(migrationBuilder, "workflow_records");
            CopyOperationalRecordsBack(migrationBuilder, "committee_records");
            CopyOperationalRecordsBack(migrationBuilder, "exam_operational_records");
            CopyOperationalRecordsBack(migrationBuilder, "biometric_records");
            CopyOperationalRecordsBack(migrationBuilder, "admission_setup_records");
            CopyOperationalRecordsBack(migrationBuilder, "report_snapshots");
        }

        private static void CopyOperationalRecordsBack(MigrationBuilder migrationBuilder, string sourceTable)
        {
            migrationBuilder.Sql($"""
            IF OBJECT_ID(N'[dbo].[{sourceTable}]', N'U') IS NOT NULL
            BEGIN
                INSERT INTO [PACademy_staging_db].[admin_record_documents]
                    ([module], [id], [created_at], [payload_json], [updated_at])
                SELECT
                    source.[module],
                    source.[id],
                    source.[created_at],
                    source.[payload_json],
                    source.[updated_at]
                FROM [dbo].[{sourceTable}] AS source
                WHERE NOT EXISTS
                (
                    SELECT 1
                    FROM [PACademy_staging_db].[admin_record_documents] AS target
                    WHERE target.[module] = source.[module]
                      AND target.[id] = source.[id]
                );
            END
            """);
        }
    }
}
