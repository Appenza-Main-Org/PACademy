using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Admissions.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _011_DeclarationDocumentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "BodyAr",
                table: "electronic_declarations",
                type: "nvarchar(max)",
                nullable: true,
                collation: "Arabic_100_CI_AS_SC",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldCollation: "Arabic_100_CI_AS_SC");

            migrationBuilder.AddColumn<string>(
                name: "DocumentFileName",
                table: "electronic_declarations",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentRelativeUrl",
                table: "electronic_declarations",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DocumentSize",
                table: "electronic_declarations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Mode",
                table: "electronic_declarations",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Text");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DocumentFileName",
                table: "electronic_declarations");

            migrationBuilder.DropColumn(
                name: "DocumentRelativeUrl",
                table: "electronic_declarations");

            migrationBuilder.DropColumn(
                name: "DocumentSize",
                table: "electronic_declarations");

            migrationBuilder.DropColumn(
                name: "Mode",
                table: "electronic_declarations");

            migrationBuilder.AlterColumn<string>(
                name: "BodyAr",
                table: "electronic_declarations",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                collation: "Arabic_100_CI_AS_SC",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true,
                oldCollation: "Arabic_100_CI_AS_SC");
        }
    }
}
