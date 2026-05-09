using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _004b_LookupsCrudCompleteSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "RulesJson",
                table: "admission_rules",
                newName: "Rules");

            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "reference_data_entries",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "Metadata",
                table: "reference_data_entries",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(2000)",
                oldMaxLength: 2000,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "categories",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "Conditions",
                table: "categories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<bool>(
                name: "IsSpec",
                table: "categories",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Procedures",
                table: "categories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "RequiredTests",
                table: "categories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "categories",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AlterColumn<string>(
                name: "Rules",
                table: "admission_rules",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ChangedById",
                table: "admission_rules",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "CycleId",
                table: "admission_rules",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EffectiveAt",
                table: "admission_rules",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "admission_rules",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_reference_data_category_sort",
                table: "reference_data_entries",
                columns: new[] { "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_admission_rules_cycle_version",
                table: "admission_rules",
                columns: new[] { "CycleId", "Version" },
                unique: true,
                filter: "[CycleId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_reference_data_category_sort",
                table: "reference_data_entries");

            migrationBuilder.DropIndex(
                name: "IX_admission_rules_cycle_version",
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "Conditions",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "IsSpec",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "Procedures",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "RequiredTests",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "ChangedById",
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "CycleId",
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "EffectiveAt",
                table: "admission_rules");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "admission_rules");

            migrationBuilder.RenameColumn(
                name: "Rules",
                table: "admission_rules",
                newName: "RulesJson");

            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "reference_data_entries",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Metadata",
                table: "reference_data_entries",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SortOrder",
                table: "categories",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "RulesJson",
                table: "admission_rules",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldDefaultValue: "{}");
        }
    }
}
