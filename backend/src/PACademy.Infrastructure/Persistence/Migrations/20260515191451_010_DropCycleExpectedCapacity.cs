using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _010_DropCycleExpectedCapacity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpectedCapacity",
                table: "cycles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExpectedCapacity",
                table: "cycles",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
