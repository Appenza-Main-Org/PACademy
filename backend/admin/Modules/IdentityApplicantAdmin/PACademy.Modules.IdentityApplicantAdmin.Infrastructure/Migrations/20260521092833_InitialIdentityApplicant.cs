using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.IdentityApplicantAdmin.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialIdentityApplicant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "applicants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    national_id = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    phone_number = table.Column<string>(type: "nvarchar(11)", maxLength: 11, nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    gender = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    religion = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    birth_governorate = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    birth_district = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    source = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applicants", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "UX_applicants_national_id",
                table: "applicants",
                column: "national_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "applicants");
        }
    }
}
