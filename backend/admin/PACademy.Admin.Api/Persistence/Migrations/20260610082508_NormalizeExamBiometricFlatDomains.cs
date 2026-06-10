using System;
using Microsoft.EntityFrameworkCore.Migrations;
using PACademy.Admin.Api.Persistence;

#nullable disable

namespace PACademy.Admin.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeExamBiometricFlatDomains : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "biometric_enrollments",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    enrolled_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    enrolled_by = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    device_emp_code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_biometric_enrollments", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exam_attempt_results",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    attempt_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    pass_fail = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_attempt_results", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exam_committee_users",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    username = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    permission = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    exam_type = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    authorized_device_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    authorized_ip = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_committee_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exam_devices",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: false),
                    label = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    mac_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    allowed_from = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    allowed_to = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_devices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "exam_results",
                schema: AdminDbContext.Schema,
                columns: table => new
                {
                    id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    cycle_id = table.Column<string>(type: "nvarchar(96)", maxLength: 96, nullable: true),
                    exam_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    applicant_id = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    national_id = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    status = table.Column<string>(type: "nvarchar(48)", maxLength: 48, nullable: true),
                    received_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    payload_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_results", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_biometric_enrollments_applicant_id",
                schema: AdminDbContext.Schema,
                table: "biometric_enrollments",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_enrollments_device_emp_code",
                schema: AdminDbContext.Schema,
                table: "biometric_enrollments",
                column: "device_emp_code");

            migrationBuilder.CreateIndex(
                name: "ix_biometric_enrollments_national_id",
                schema: AdminDbContext.Schema,
                table: "biometric_enrollments",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_attempt_results_applicant_id",
                schema: AdminDbContext.Schema,
                table: "exam_attempt_results",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_attempt_results_exam_id",
                schema: AdminDbContext.Schema,
                table: "exam_attempt_results",
                column: "exam_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_attempt_results_status",
                schema: AdminDbContext.Schema,
                table: "exam_attempt_results",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_exam_committee_users_status",
                schema: AdminDbContext.Schema,
                table: "exam_committee_users",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_exam_committee_users_username",
                schema: AdminDbContext.Schema,
                table: "exam_committee_users",
                column: "username");

            migrationBuilder.CreateIndex(
                name: "ix_exam_devices_mac_address",
                schema: AdminDbContext.Schema,
                table: "exam_devices",
                column: "mac_address");

            migrationBuilder.CreateIndex(
                name: "ix_exam_devices_status",
                schema: AdminDbContext.Schema,
                table: "exam_devices",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_exam_results_applicant_id",
                schema: AdminDbContext.Schema,
                table: "exam_results",
                column: "applicant_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_results_cycle_exam",
                schema: AdminDbContext.Schema,
                table: "exam_results",
                columns: new[] { "cycle_id", "exam_id" });

            migrationBuilder.CreateIndex(
                name: "ix_exam_results_national_id",
                schema: AdminDbContext.Schema,
                table: "exam_results",
                column: "national_id");

            migrationBuilder.CreateIndex(
                name: "ix_exam_results_status",
                schema: AdminDbContext.Schema,
                table: "exam_results",
                column: "status");

            // Clean rebuild (no JSON→columns backfill): drop the extracted buckets'
            // rows from their shared JSON stores. Kept-JSON siblings survive:
            // exam_operational_records keeps examPlans / exam-attempts /
            // exam-live-sessions / exam-audit; biometric_records keeps
            // biometric-verifications / gate-logs / audit / config.
            // NOTE: legacy `exam-results` rows in admin_records are intentionally
            // NOT deleted — AdminRecordsSeeder re-homes them through the service
            // into exam_attempt_results on next boot, then clears admin_records.
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("exam_operational_records")} WHERE [module] IN (N'exam-committee-users', N'exam-devices', N'examResults');");
            migrationBuilder.Sql(
                $"DELETE FROM {AdminDbContext.QualifiedTableName("biometric_records")} WHERE [module] = N'biometric-enrollments';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "biometric_enrollments",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_attempt_results",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_committee_users",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_devices",
                schema: AdminDbContext.Schema);

            migrationBuilder.DropTable(
                name: "exam_results",
                schema: AdminDbContext.Schema);
        }
    }
}
