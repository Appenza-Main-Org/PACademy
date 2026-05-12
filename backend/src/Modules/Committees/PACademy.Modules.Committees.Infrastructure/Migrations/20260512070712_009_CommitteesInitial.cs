using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Modules.Committees.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _009_CommitteesInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "committees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CycleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ChairUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DailyCapacity = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DeleteReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committees", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "committee_date_bindings",
                columns: table => new
                {
                    CommitteeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BoundDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_date_bindings", x => new { x.CommitteeId, x.BoundDate });
                    table.ForeignKey(
                        name: "FK_committee_date_bindings_committees_CommitteeId",
                        column: x => x.CommitteeId,
                        principalTable: "committees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "committee_members",
                columns: table => new
                {
                    CommitteeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_members", x => new { x.CommitteeId, x.UserId });
                    table.ForeignKey(
                        name: "FK_committee_members_committees_CommitteeId",
                        column: x => x.CommitteeId,
                        principalTable: "committees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "committee_specializations",
                columns: table => new
                {
                    CommitteeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SpecializationKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_specializations", x => new { x.CommitteeId, x.SpecializationKey });
                    table.ForeignKey(
                        name: "FK_committee_specializations_committees_CommitteeId",
                        column: x => x.CommitteeId,
                        principalTable: "committees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_committees_CycleId_Key",
                table: "committees",
                columns: new[] { "CycleId", "Key" },
                unique: true,
                filter: "[DeletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_committees_status",
                table: "committees",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "committee_date_bindings");

            migrationBuilder.DropTable(
                name: "committee_members");

            migrationBuilder.DropTable(
                name: "committee_specializations");

            migrationBuilder.DropTable(
                name: "committees");
        }
    }
}
