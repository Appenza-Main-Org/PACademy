using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _004_LookupsCrudExtensions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "cycles");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "cycles",
                newName: "NameAr");

            migrationBuilder.AlterColumn<DateTime>(
                name: "OpenDate",
                table: "cycles",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CloseDate",
                table: "cycles",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Cohort",
                table: "cycles",
                type: "nvarchar(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ConditionOverrides",
                table: "cycles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<int>(
                name: "ExpectedCapacity",
                table: "cycles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "OpenCategories",
                table: "cycles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<int>(
                name: "Year",
                table: "cycles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_cycles_year_cohort_active",
                table: "cycles",
                columns: new[] { "Year", "Cohort" },
                unique: true,
                filter: "[Status] = N'Active'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_cycles_year_cohort_active",
                table: "cycles");

            migrationBuilder.DropColumn(
                name: "Cohort",
                table: "cycles");

            migrationBuilder.DropColumn(
                name: "ConditionOverrides",
                table: "cycles");

            migrationBuilder.DropColumn(
                name: "ExpectedCapacity",
                table: "cycles");

            migrationBuilder.DropColumn(
                name: "OpenCategories",
                table: "cycles");

            migrationBuilder.DropColumn(
                name: "Year",
                table: "cycles");

            migrationBuilder.RenameColumn(
                name: "NameAr",
                table: "cycles",
                newName: "Name");

            migrationBuilder.AlterColumn<DateTime>(
                name: "OpenDate",
                table: "cycles",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CloseDate",
                table: "cycles",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "cycles",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }
    }
}
