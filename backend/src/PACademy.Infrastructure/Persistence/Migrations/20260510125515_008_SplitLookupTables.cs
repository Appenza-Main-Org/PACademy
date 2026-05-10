using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PACademy.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _008_SplitLookupTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "case_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    Severity = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BlocksApplication = table.Column<bool>(type: "bit", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_case_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "committee_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_committee_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "degree_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_degree_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "education_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_education_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "exam_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_groups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "exam_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exam_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "governorates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    NameEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_governorates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "jobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "marital_statuses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_marital_statuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "nationalities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    NameEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsoCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nationalities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notification_departments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_departments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "qualifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    Level = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FacultyRequired = table.Column<bool>(type: "bit", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_qualifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ranks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    Level = table.Column<int>(type: "int", nullable: false),
                    ApplicableTo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ranks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rejection_reasons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rejection_reasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    Degree = table.Column<int>(type: "int", nullable: false),
                    Side = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_relationships", x => x.Id);
                    table.CheckConstraint("CK_relationships_degree", "[Degree] BETWEEN 1 AND 4");
                });

            migrationBuilder.CreateTable(
                name: "specializations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FacultyType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_specializations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "specialty_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_specialty_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "universities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_universities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "colleges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    GovernorateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_colleges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_colleges_governorates_GovernorateId",
                        column: x => x.GovernorateId,
                        principalTable: "governorates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "specialties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SpecialtyTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_specialties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_specialties_specialty_types_SpecialtyTypeId",
                        column: x => x.SpecialtyTypeId,
                        principalTable: "specialty_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "faculties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UniversityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DemoOrigin = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LabelAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false, collation: "Arabic_100_CI_AS_SC"),
                    LabelEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_faculties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_faculties_universities_UniversityId",
                        column: x => x.UniversityId,
                        principalTable: "universities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_case_types_key",
                table: "case_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_colleges_governorate",
                table: "colleges",
                column: "GovernorateId");

            migrationBuilder.CreateIndex(
                name: "IX_colleges_key",
                table: "colleges",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_committee_types_key",
                table: "committee_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_committee_types_sort",
                table: "committee_types",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_degree_types_key",
                table: "degree_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_degree_types_sort",
                table: "degree_types",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_education_types_key",
                table: "education_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_education_types_sort",
                table: "education_types",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_exam_groups_key",
                table: "exam_groups",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_exam_groups_sort",
                table: "exam_groups",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_exam_types_key",
                table: "exam_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_exam_types_sort",
                table: "exam_types",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_faculties_key",
                table: "faculties",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_faculties_sort",
                table: "faculties",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_faculties_university",
                table: "faculties",
                column: "UniversityId");

            migrationBuilder.CreateIndex(
                name: "IX_governorates_key",
                table: "governorates",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_governorates_sort",
                table: "governorates",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_jobs_key",
                table: "jobs",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_jobs_sort",
                table: "jobs",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_marital_statuses_key",
                table: "marital_statuses",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_marital_statuses_sort",
                table: "marital_statuses",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_nationalities_iso",
                table: "nationalities",
                column: "IsoCode");

            migrationBuilder.CreateIndex(
                name: "IX_nationalities_key",
                table: "nationalities",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notification_departments_key",
                table: "notification_departments",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notification_departments_sort",
                table: "notification_departments",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_qualifications_key",
                table: "qualifications",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_qualifications_sort",
                table: "qualifications",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_ranks_key",
                table: "ranks",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ranks_sort",
                table: "ranks",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_rejection_reasons_key",
                table: "rejection_reasons",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rejection_reasons_sort",
                table: "rejection_reasons",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_relationships_key",
                table: "relationships",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_specializations_key",
                table: "specializations",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_specializations_sort",
                table: "specializations",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_specialties_key",
                table: "specialties",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_specialties_sort",
                table: "specialties",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_specialties_specialty_type",
                table: "specialties",
                column: "SpecialtyTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_specialty_types_key",
                table: "specialty_types",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_specialty_types_sort",
                table: "specialty_types",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_universities_key",
                table: "universities",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_universities_sort",
                table: "universities",
                column: "SortOrder");

            // ─── Data migration: copy reference_data_entries → 21 new tables ────
            // Each block reads rows from the source table and inserts into the
            // typed target. JSON metadata is unpacked into typed columns where
            // applicable (region, code, level, etc.). Idempotent via NOT EXISTS
            // so re-running on a partly-migrated DB only fills gaps.

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'reference_data_entries') IS NOT NULL
BEGIN
    -- Sprint 1 typed lookups
    INSERT INTO governorates (Id, [Key], NameAr, NameEn, Region, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, ISNULL(r.NameEn, ''),
           ISNULL(JSON_VALUE(r.Metadata, '$.region'), 'Cairo'),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'governorate'
       AND NOT EXISTS (SELECT 1 FROM governorates g WHERE g.Id = r.Id);

    INSERT INTO specializations (Id, [Key], NameAr, Code, FacultyType, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           ISNULL(JSON_VALUE(r.Metadata, '$.code'), r.[Key]),
           ISNULL(JSON_VALUE(r.Metadata, '$.facultyType'), 'Civil'),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'specialization'
       AND NOT EXISTS (SELECT 1 FROM specializations s WHERE s.Id = r.Id);

    INSERT INTO ranks (Id, [Key], NameAr, [Level], ApplicableTo, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           TRY_CAST(JSON_VALUE(r.Metadata, '$.level') AS int),
           ISNULL(JSON_VALUE(r.Metadata, '$.applicableTo'), 'Officer'),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'rank'
       AND NOT EXISTS (SELECT 1 FROM ranks t WHERE t.Id = r.Id);

    -- College: governorateId in metadata is the source row's governorate Key.
    -- Resolve to the target governorate's Guid (which we just inserted with the same Id from reference_data_entries).
    INSERT INTO colleges (Id, [Key], NameAr, GovernorateId, [Type], SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           ISNULL((SELECT TOP 1 g.Id FROM governorates g
                    WHERE g.[Key] = JSON_VALUE(r.Metadata, '$.governorateId')),
                  (SELECT TOP 1 g.Id FROM governorates g ORDER BY g.SortOrder)),
           ISNULL(JSON_VALUE(r.Metadata, '$.type'), 'Public'),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'college'
       AND NOT EXISTS (SELECT 1 FROM colleges c WHERE c.Id = r.Id);

    INSERT INTO qualifications (Id, [Key], NameAr, [Level], FacultyRequired, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           ISNULL(JSON_VALUE(r.Metadata, '$.level'), 'Bachelor'),
           CASE WHEN LOWER(JSON_VALUE(r.Metadata, '$.facultyRequired')) IN ('true','1') THEN 1 ELSE 0 END,
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'qualification'
       AND NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.Id = r.Id);

    INSERT INTO nationalities (Id, [Key], NameAr, NameEn, IsoCode, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, ISNULL(r.NameEn, ''),
           ISNULL(JSON_VALUE(r.Metadata, '$.isoCode'), r.[Key]),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'nationality'
       AND NOT EXISTS (SELECT 1 FROM nationalities n WHERE n.Id = r.Id);

    INSERT INTO relationships (Id, [Key], NameAr, Degree, Side, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           ISNULL(TRY_CAST(JSON_VALUE(r.Metadata, '$.degree') AS int), 1),
           ISNULL(JSON_VALUE(r.Metadata, '$.side'), 'Paternal'),
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'relationship'
       AND NOT EXISTS (SELECT 1 FROM relationships rel WHERE rel.Id = r.Id);

    INSERT INTO case_types (Id, [Key], NameAr, Severity, BlocksApplication, SortOrder, IsActive, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr,
           ISNULL(JSON_VALUE(r.Metadata, '$.severity'), 'Low'),
           CASE WHEN LOWER(JSON_VALUE(r.Metadata, '$.blocksApplication')) IN ('true','1') THEN 1 ELSE 0 END,
           r.SortOrder, r.IsActive, r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'case-type'
       AND NOT EXISTS (SELECT 1 FROM case_types c WHERE c.Id = r.Id);

    -- Gap-I simple lookups (LabelAr/LabelEn map from NameAr/NameEn; isSystem from metadata)
    INSERT INTO education_types (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'educationTypes'
       AND NOT EXISTS (SELECT 1 FROM education_types e WHERE e.Id = r.Id);

    INSERT INTO marital_statuses (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'maritalStatuses'
       AND NOT EXISTS (SELECT 1 FROM marital_statuses m WHERE m.Id = r.Id);

    INSERT INTO universities (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'universities'
       AND NOT EXISTS (SELECT 1 FROM universities u WHERE u.Id = r.Id);

    -- Faculties: parentId in metadata is the parent universities row Id (Guid as string).
    INSERT INTO faculties (Id, [Key], LabelAr, LabelEn, UniversityId, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn,
           ISNULL(TRY_CAST(JSON_VALUE(r.Metadata, '$.parentId') AS uniqueidentifier),
                  (SELECT TOP 1 u.Id FROM universities u ORDER BY u.SortOrder)),
           r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'faculties'
       AND NOT EXISTS (SELECT 1 FROM faculties f WHERE f.Id = r.Id);

    INSERT INTO specialty_types (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'specialtyTypes'
       AND NOT EXISTS (SELECT 1 FROM specialty_types st WHERE st.Id = r.Id);

    INSERT INTO specialties (Id, [Key], LabelAr, LabelEn, SpecialtyTypeId, Gender, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn,
           ISNULL(TRY_CAST(JSON_VALUE(r.Metadata, '$.parentId') AS uniqueidentifier),
                  (SELECT TOP 1 st.Id FROM specialty_types st ORDER BY st.SortOrder)),
           CASE
               WHEN JSON_VALUE(r.Metadata, '$.gender') = 'male' THEN 'Male'
               WHEN JSON_VALUE(r.Metadata, '$.gender') = 'female' THEN 'Female'
               ELSE NULL
           END,
           r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'specialties'
       AND NOT EXISTS (SELECT 1 FROM specialties s WHERE s.Id = r.Id);

    INSERT INTO degree_types (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'degreeTypes'
       AND NOT EXISTS (SELECT 1 FROM degree_types d WHERE d.Id = r.Id);

    INSERT INTO jobs (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'jobs'
       AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.Id = r.Id);

    INSERT INTO exam_types (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'examTypes'
       AND NOT EXISTS (SELECT 1 FROM exam_types e WHERE e.Id = r.Id);

    INSERT INTO exam_groups (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'examGroups'
       AND NOT EXISTS (SELECT 1 FROM exam_groups eg WHERE eg.Id = r.Id);

    INSERT INTO committee_types (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'committeeTypes'
       AND NOT EXISTS (SELECT 1 FROM committee_types c WHERE c.Id = r.Id);

    INSERT INTO rejection_reasons (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'rejectionReasons'
       AND NOT EXISTS (SELECT 1 FROM rejection_reasons rj WHERE rj.Id = r.Id);

    INSERT INTO notification_departments (Id, [Key], LabelAr, LabelEn, SortOrder, IsActive, IsSystem, CreatedAt, Archived, ArchivedAt, DemoOrigin)
    SELECT r.Id, r.[Key], r.NameAr, r.NameEn, r.SortOrder, r.IsActive,
           CASE WHEN LOWER(ISNULL(JSON_VALUE(r.Metadata, '$.isSystem'),'false')) IN ('true','1') THEN 1 ELSE 0 END,
           r.CreatedAt, r.Archived, r.ArchivedAt, r.DemoOrigin
      FROM reference_data_entries r
     WHERE r.Category = 'notificationDepartments'
       AND NOT EXISTS (SELECT 1 FROM notification_departments n WHERE n.Id = r.Id);

    -- NOTE: reference_data_entries is NOT dropped here. The old entity is
    -- still mapped while we cut over services and frontend in stage 2.
    -- A follow-up migration drops it once the codebase no longer references it.
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "case_types");

            migrationBuilder.DropTable(
                name: "colleges");

            migrationBuilder.DropTable(
                name: "committee_types");

            migrationBuilder.DropTable(
                name: "degree_types");

            migrationBuilder.DropTable(
                name: "education_types");

            migrationBuilder.DropTable(
                name: "exam_groups");

            migrationBuilder.DropTable(
                name: "exam_types");

            migrationBuilder.DropTable(
                name: "faculties");

            migrationBuilder.DropTable(
                name: "jobs");

            migrationBuilder.DropTable(
                name: "marital_statuses");

            migrationBuilder.DropTable(
                name: "nationalities");

            migrationBuilder.DropTable(
                name: "notification_departments");

            migrationBuilder.DropTable(
                name: "qualifications");

            migrationBuilder.DropTable(
                name: "ranks");

            migrationBuilder.DropTable(
                name: "rejection_reasons");

            migrationBuilder.DropTable(
                name: "relationships");

            migrationBuilder.DropTable(
                name: "specializations");

            migrationBuilder.DropTable(
                name: "specialties");

            migrationBuilder.DropTable(
                name: "governorates");

            migrationBuilder.DropTable(
                name: "universities");

            migrationBuilder.DropTable(
                name: "specialty_types");
        }
    }
}
