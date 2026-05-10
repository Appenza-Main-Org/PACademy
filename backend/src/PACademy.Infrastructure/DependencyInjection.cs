using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Application.Admin.AdmissionRules;
using PACademy.Application.Admin.Applicants;
using PACademy.Application.Admin.Categories;
using PACademy.Application.Admin.Cycles;
using PACademy.Application.Admin.Users;
using PACademy.Application.Audit;
using PACademy.Application.Auth;
using PACademy.Application.Common;
using PACademy.Application.Identity;
using PACademy.Contracts.Admin.AdmissionRules;
using PACademy.Contracts.Admin.Applicants;
using PACademy.Contracts.Admin.Categories;
using PACademy.Contracts.Admin.Cycles;
using PACademy.Contracts.Admin.Users;
using PACademy.Contracts.Auth;
using PACademy.Infrastructure.Audit;
using PACademy.Infrastructure.Identity;
using PACademy.Infrastructure.Persistence;
using PACademy.Infrastructure.Reports;
using PACademy.Infrastructure.Seeding;
using System.Security.Claims;

namespace PACademy.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPaInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddDbContext<PaDbContext>(opt =>
            opt.UseSqlServer(connectionString,
                o => o.MigrationsAssembly(typeof(PaDbContext).Assembly.FullName)));

        services.AddScoped<IPaDbContext>(sp => sp.GetRequiredService<PaDbContext>());

        // T466: Cookie auth + ConfigureApplicationCookie moved to IdentityModule.
        // Legacy UserManager/SignInManager kept for InSystemIdentityProvider and DemoDataSeeder
        // until those are migrated to use the Identity module's services (post-spec-007).
        services.AddIdentityCore<SystemUser>(opt =>
            {
                opt.Password.RequireDigit = true;
                opt.Password.RequiredLength = 8;
                opt.Password.RequireUppercase = false;
                opt.Password.RequireNonAlphanumeric = false;
                opt.Lockout.MaxFailedAccessAttempts = 5;
            })
            .AddEntityFrameworkStores<PaDbContext>()
            .AddSignInManager<SignInManager<SystemUser>>();

        // T143: Full RBAC policy matrix — one AppAccess policy per app key + one Role policy per role.
        services.AddAuthorization(opts =>
        {
            // App access — one policy per app key (CLAUDE.md §5)
            foreach (var key in new[]
            {
                "admin", "committee", "board", "investigations",
                "medical", "barcode", "biometric", "exams", "applicant", "architecture",
            })
            {
                opts.AddPolicy($"AppAccess:{key}", p =>
                    p.RequireAuthenticatedUser().RequireClaim("apps", key));
            }

            // Role tier — one policy per RBAC role (RoleApps.AllRoles)
            foreach (var role in RoleApps.AllRoles)
            {
                var roleName = role; // capture for closure
                opts.AddPolicy($"Role:{roleName}", p =>
                    p.RequireAuthenticatedUser().RequireClaim(ClaimTypes.Role, roleName));
            }
        });

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:5173"];

        services.AddCors(opt =>
            opt.AddDefaultPolicy(policy =>
                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        services.AddScoped<IAuditWriter, AuditWriter>();
        services.AddScoped<IIdentityProvider, InSystemIdentityProvider>();

        // Phase 3 — Admin applicants use cases
        services.AddScoped<ListApplicantsUseCase>();
        services.AddScoped<GetApplicantUseCase>();
        services.AddScoped<UpdateApplicantUseCase>();
        services.AddScoped<IValidator<ApplicantPatchDto>, ApplicantPatchValidator>();

        // Auth use cases (LoginUseCase only; Logout/GetMe moved to IdentityModule in spec 007)
        services.AddScoped<LoginUseCase>();
        services.AddScoped<IValidator<LoginRequest>, LoginRequestValidator>();

        // T173 — Admin Users use cases (Phase 4, US2)
        services.AddScoped<ListSystemUsersUseCase>();
        services.AddScoped<GetSystemUserUseCase>();
        services.AddScoped<CreateSystemUserUseCase>();
        services.AddScoped<UpdateSystemUserUseCase>();
        services.AddScoped<IValidator<CreateSystemUserRequest>, CreateSystemUserValidator>();

        // T239/T240 — Admin Cycles use cases (Spec 004, US2)
        services.AddScoped<ListCyclesUseCase>();
        services.AddScoped<GetCycleUseCase>();
        services.AddScoped<CreateCycleUseCase>();
        services.AddScoped<UpdateCycleUseCase>();
        services.AddScoped<TransitionCycleStatusUseCase>();
        services.AddScoped<DeleteCycleUseCase>();
        services.AddScoped<IValidator<CreateCycleRequest>, CreateCycleValidator>();

        // Split lookup tables — 21 entities × 6 use cases (List/Get/Create/Update/Archive/Restore)
        // Replaces the legacy single-table ReferenceData layer.
        RegisterLookupUseCases(services);

        // Spec 004 US3 — Categories use cases
        services.AddScoped<ListCategoriesUseCase>();
        services.AddScoped<GetCategoryUseCase>();
        services.AddScoped<CreateCategoryUseCase>();
        services.AddScoped<UpdateCategoryUseCase>();
        services.AddScoped<DeleteCategoryUseCase>();

        // Spec 004 US4 — Admission Rules use cases
        services.AddScoped<ListAdmissionRulesUseCase>();
        services.AddScoped<GetAdmissionRuleUseCase>();
        services.AddScoped<CreateAdmissionRuleUseCase>();

        services.AddHostedService<ReportSnapshotsRefresher>();
        services.AddScoped<DemoDataSeeder>();

        return services;
    }

    private static void RegisterLookupUseCases(IServiceCollection services)
    {
        // ── Sprint 1 typed lookups ─────────────────────────────────────────
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.ListGovernoratesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.GetGovernorateUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.CreateGovernorateUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.UpdateGovernorateUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.ArchiveGovernorateUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Governorates.RestoreGovernorateUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.ListSpecializationsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.GetSpecializationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.CreateSpecializationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.UpdateSpecializationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.ArchiveSpecializationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specializations.RestoreSpecializationUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.ListRanksUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.GetRankUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.CreateRankUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.UpdateRankUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.ArchiveRankUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Ranks.RestoreRankUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.ListCollegesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.GetCollegeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.CreateCollegeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.UpdateCollegeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.ArchiveCollegeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Colleges.RestoreCollegeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.ListQualificationsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.GetQualificationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.CreateQualificationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.UpdateQualificationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.ArchiveQualificationUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Qualifications.RestoreQualificationUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.ListNationalitiesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.GetNationalityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.CreateNationalityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.UpdateNationalityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.ArchiveNationalityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Nationalities.RestoreNationalityUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.ListRelationshipsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.GetRelationshipUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.CreateRelationshipUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.UpdateRelationshipUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.ArchiveRelationshipUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Relationships.RestoreRelationshipUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.ListCaseTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.GetCaseTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.CreateCaseTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.UpdateCaseTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.ArchiveCaseTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CaseTypes.RestoreCaseTypeUseCase>();

        // ── Gap I simple lookups ───────────────────────────────────────────
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.ListEducationTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.GetEducationTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.CreateEducationTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.UpdateEducationTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.ArchiveEducationTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.EducationTypes.RestoreEducationTypeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.ListMaritalStatusesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.GetMaritalStatusUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.CreateMaritalStatusUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.UpdateMaritalStatusUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.ArchiveMaritalStatusUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.MaritalStatuses.RestoreMaritalStatusUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.ListUniversitiesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.GetUniversityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.CreateUniversityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.UpdateUniversityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.ArchiveUniversityUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Universities.RestoreUniversityUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.ListFacultiesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.GetFacultyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.CreateFacultyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.UpdateFacultyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.ArchiveFacultyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Faculties.RestoreFacultyUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.ListSpecialtyTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.GetSpecialtyTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.CreateSpecialtyTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.UpdateSpecialtyTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.ArchiveSpecialtyTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.SpecialtyTypes.RestoreSpecialtyTypeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.ListSpecialtiesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.GetSpecialtyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.CreateSpecialtyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.UpdateSpecialtyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.ArchiveSpecialtyUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Specialties.RestoreSpecialtyUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.ListDegreeTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.GetDegreeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.CreateDegreeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.UpdateDegreeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.ArchiveDegreeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.DegreeTypes.RestoreDegreeTypeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.ListJobsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.GetJobUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.CreateJobUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.UpdateJobUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.ArchiveJobUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.Jobs.RestoreJobUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.ListExamTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.GetExamTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.CreateExamTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.UpdateExamTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.ArchiveExamTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamTypes.RestoreExamTypeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.ListExamGroupsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.GetExamGroupUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.CreateExamGroupUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.UpdateExamGroupUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.ArchiveExamGroupUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.ExamGroups.RestoreExamGroupUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.ListCommitteeTypesUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.GetCommitteeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.CreateCommitteeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.UpdateCommitteeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.ArchiveCommitteeTypeUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.CommitteeTypes.RestoreCommitteeTypeUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.ListRejectionReasonsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.GetRejectionReasonUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.CreateRejectionReasonUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.UpdateRejectionReasonUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.ArchiveRejectionReasonUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.RejectionReasons.RestoreRejectionReasonUseCase>();

        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.ListNotificationDepartmentsUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.GetNotificationDepartmentUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.CreateNotificationDepartmentUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.UpdateNotificationDepartmentUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.ArchiveNotificationDepartmentUseCase>();
        services.AddScoped<PACademy.Application.Admin.Lookups.NotificationDepartments.RestoreNotificationDepartmentUseCase>();
    }
}
