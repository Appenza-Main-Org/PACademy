using FluentAssertions;
using NetArchTest.Rules;
using PACademy.Modules.Admissions.Infrastructure;
using PACademy.Modules.Committees.Infrastructure;
using PACademy.Modules.Grades.Infrastructure;
using PACademy.Modules.Identity.Infrastructure;
using PACademy.Modules.Notifications.Infrastructure;
using PACademy.Modules.ReferenceData.Infrastructure;
using PACademy.Modules.Workflows.Infrastructure;
using PACademy.Shared.Audit.Infrastructure;
using PACademy.Shared.Contracts;
using Xunit;

namespace PACademy.Architecture.Tests;

/// <summary>
/// NetArchTest boundary assertions for the phase-5 modular monolith (T356–T358, T310, T319, T329, T339a, T340).
/// Each test locks a rule; CI fails when a forbidden reference is introduced.
/// </summary>
public sealed class ModuleBoundariesTests
{
    // ── T358 ─────────────────────────────────────────────────────────────────
    [Fact]
    public void SharedContracts_has_zero_PAcademy_project_references()
    {
        var refs = typeof(PagedResult<>).Assembly
            .GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true);

        refs.Should().BeEmpty(
            "Shared.Contracts is the root of the dependency graph — it must not reference any PACademy project");
    }

    // ── T356 ─────────────────────────────────────────────────────────────────
    [Fact]
    public void SharedAudit_Public_references_only_SharedContracts_and_Domain()
    {
        var refs = typeof(PACademy.Shared.Audit.Public.IAuditApi).Assembly
            .GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true)
            .Select(a => a.Name!)
            .ToList();

        refs.Should().NotContain(n => n.Contains("Identity") || n.Contains("Admissions")
            || n.Contains("ReferenceData") || n.Contains("Workflows"),
            "Shared.Audit.Public may only reference Shared.Contracts and Shared.Audit.Domain");
    }

    [Fact]
    public void Identity_Public_references_only_SharedContracts()
    {
        var refs = typeof(PACademy.Modules.Identity.Public.IIdentityApi).Assembly
            .GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true)
            .Select(a => a.Name!)
            .ToList();

        refs.Should().NotContain(n => n.Contains("Identity.Domain") || n.Contains("Admissions")
            || n.Contains("ReferenceData") || n.Contains("Workflows") || n.Contains("Audit"),
            "Identity.Public may only reference Shared.Contracts");
    }

    [Fact]
    public void ReferenceData_Public_references_only_SharedContracts()
    {
        var refs = typeof(PACademy.Modules.ReferenceData.Public.IReferenceDataApi).Assembly
            .GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true)
            .Select(a => a.Name!)
            .ToList();

        refs.Should().NotContain(n => n.Contains("Admissions")
            || n.Contains("Identity") || n.Contains("Workflows") || n.Contains("Audit"),
            "ReferenceData.Public may only reference Shared.Contracts");
    }

    [Fact]
    public void Workflows_Public_references_only_SharedContracts()
    {
        var refs = typeof(PACademy.Modules.Workflows.Public.IWorkflowsApi).Assembly
            .GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true)
            .Select(a => a.Name!)
            .ToList();

        refs.Should().NotContain(n => n.Contains("Admissions")
            || n.Contains("Identity") || n.Contains("ReferenceData") || n.Contains("Audit"),
            "Workflows.Public may only reference Shared.Contracts");
    }

    // ── T357 — Domain assemblies must not reference EF Core ──────────────────
    [Fact]
    public void SharedAudit_Domain_has_no_EF_dependency()
    {
        var refs = typeof(PACademy.Shared.Audit.Domain.AuditEntry).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty);

        refs.Should().NotContain(n => n.StartsWith("Microsoft.EntityFrameworkCore"),
            "Domain assemblies must be infrastructure-free (no EF Core)");
    }

    [Fact]
    public void Identity_Domain_has_no_EF_dependency()
    {
        var refs = typeof(PACademy.Modules.Identity.Domain.Session).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty);

        // Identity.Domain may reference Microsoft.AspNetCore.Identity (for base IdentityUser)
        // but must NOT directly reference Microsoft.EntityFrameworkCore
        refs.Should().NotContain(n => n == "Microsoft.EntityFrameworkCore",
            "Identity.Domain must not directly reference EF Core (AspNetCore.Identity is allowed)");
    }

    [Fact]
    public void ReferenceData_Domain_has_no_EF_dependency()
    {
        var refs = typeof(PACademy.Modules.ReferenceData.Domain.ReferenceDataEntry).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty);

        refs.Should().NotContain(n => n.StartsWith("Microsoft.EntityFrameworkCore"),
            "ReferenceData.Domain must be infrastructure-free");
    }

    [Fact]
    public void Workflows_Domain_has_no_EF_dependency()
    {
        var refs = typeof(PACademy.Modules.Workflows.Domain.Workflow).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty);

        refs.Should().NotContain(n => n.StartsWith("Microsoft.EntityFrameworkCore"),
            "Workflows.Domain must be infrastructure-free");
    }

    // ── T340 — Admissions Application must not reference module internals ─────
    // NOTE: These tests anchor on the Admissions.Infrastructure assembly (which transitively
    // includes Application). They are updated to IAdmissionsApi once the Application project
    // has types — see T342.
    [Fact]
    public void Admissions_does_not_depend_on_Identity_Infrastructure()
    {
        var admissionsInfraAssembly = typeof(AdmissionsModule).Assembly;

        var result = Types.InAssembly(admissionsInfraAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Admissions must not depend on Identity.Infrastructure. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Admissions_does_not_depend_on_ReferenceData_Infrastructure()
    {
        var admissionsInfraAssembly = typeof(AdmissionsModule).Assembly;

        var result = Types.InAssembly(admissionsInfraAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.ReferenceData.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Admissions must not depend on ReferenceData.Infrastructure. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Admissions_does_not_depend_on_Workflows_Infrastructure()
    {
        var admissionsInfraAssembly = typeof(AdmissionsModule).Assembly;

        var result = Types.InAssembly(admissionsInfraAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Workflows.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Admissions must not depend on Workflows.Infrastructure. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T319 — Identity must not depend on Admissions or ReferenceData ────────
    [Fact]
    public void Identity_Application_does_not_depend_on_Admissions()
    {
        var identityAppAssembly = typeof(PACademy.Modules.Identity.Application.ICurrentUser).Assembly;

        var result = Types.InAssembly(identityAppAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Application must not depend on Admissions. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T329 — ReferenceData must not depend on Admissions ───────────────────
    [Fact]
    public void ReferenceData_does_not_depend_on_Admissions()
    {
        var rdInfraAssembly = typeof(ReferenceDataModule).Assembly;

        var result = Types.InAssembly(rdInfraAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"ReferenceData must not depend on Admissions. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T339a — Workflows must not depend on Admissions or ReferenceData ──────
    [Fact]
    public void Workflows_does_not_depend_on_Admissions()
    {
        var workflowsInfraAssembly = typeof(WorkflowsModule).Assembly;

        var result = Types.InAssembly(workflowsInfraAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Workflows must not depend on Admissions. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T403 — Identity module boundary assertions (spec 007) ─────────────────
    [Fact]
    public void Identity_Infrastructure_does_not_depend_on_Admissions_Infrastructure()
    {
        var result = Types.InAssembly(typeof(IdentityModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Infrastructure must not depend on Admissions.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Identity_Infrastructure_does_not_depend_on_ReferenceData_Infrastructure()
    {
        var result = Types.InAssembly(typeof(IdentityModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.ReferenceData.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Infrastructure must not depend on ReferenceData.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Identity_Infrastructure_does_not_depend_on_Workflows_Infrastructure()
    {
        var result = Types.InAssembly(typeof(IdentityModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Workflows.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Infrastructure must not depend on Workflows.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Identity_Application_does_not_depend_on_ReferenceData()
    {
        var identityAppAssembly = typeof(PACademy.Modules.Identity.Application.ICurrentUser).Assembly;

        var result = Types.InAssembly(identityAppAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.ReferenceData")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Identity.Application must not depend on ReferenceData. Failing types: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T462 — Registration overlap guard ────────────────────────────────────
    // Ensures legacy PACademy.Infrastructure does not import Identity module internals,
    // keeping the dependency direction correct during the cutover window.
    [Fact]
    public void Legacy_Infrastructure_does_not_depend_on_Identity_Module_Infrastructure()
    {
        var legacyAssembly = typeof(PACademy.Infrastructure.DependencyInjection).Assembly;

        var result = Types.InAssembly(legacyAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Legacy Infrastructure must not depend on Identity module's Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Legacy_Infrastructure_does_not_depend_on_Identity_Module_Application()
    {
        var legacyAssembly = typeof(PACademy.Infrastructure.DependencyInjection).Assembly;

        var result = Types.InAssembly(legacyAssembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Application")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Legacy Infrastructure must not depend on Identity module's Application layer. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T069 — Committees module must not reference sibling Domain/Infrastructure ──
    [Fact]
    public void Committees_Infrastructure_does_not_depend_on_Identity_Infrastructure()
    {
        var result = Types.InAssembly(typeof(CommitteesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Committees must not depend on Identity.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Committees_Infrastructure_does_not_depend_on_Notifications_Infrastructure()
    {
        var result = Types.InAssembly(typeof(CommitteesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Notifications.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Committees must not depend on Notifications.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Committees_may_reference_AdmissionsPublic_but_not_AdmissionsInfrastructure()
    {
        var result = Types.InAssembly(typeof(CommitteesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Committees may reference Admissions.Public but not Admissions.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── T070 — Notifications module must not reference sibling Infrastructure ─
    [Fact]
    public void Notifications_Infrastructure_does_not_depend_on_Identity_Infrastructure()
    {
        var result = Types.InAssembly(typeof(NotificationsModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Notifications must not depend on Identity.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Notifications_Infrastructure_does_not_depend_on_Committees_Infrastructure()
    {
        var result = Types.InAssembly(typeof(NotificationsModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Committees.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Notifications must not depend on Committees.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Notifications_Infrastructure_does_not_depend_on_Admissions_Infrastructure()
    {
        var result = Types.InAssembly(typeof(NotificationsModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Notifications must not depend on Admissions.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    // ── Grades module isolation (T025 / new) ──────────────────────────────────
    [Fact]
    public void Grades_Infrastructure_does_not_depend_on_Identity_Infrastructure()
    {
        var result = Types.InAssembly(typeof(GradesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Grades must not depend on Identity.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Grades_Infrastructure_does_not_depend_on_Committees_Infrastructure()
    {
        var result = Types.InAssembly(typeof(GradesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Committees.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Grades must not depend on Committees.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Grades_Infrastructure_does_not_depend_on_Notifications_Infrastructure()
    {
        var result = Types.InAssembly(typeof(GradesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Notifications.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Grades must not depend on Notifications.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Grades_may_reference_AdmissionsPublic_but_not_AdmissionsInfrastructure()
    {
        var result = Types.InAssembly(typeof(GradesModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Admissions.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Grades may reference Admissions.Public but not Admissions.Infrastructure. Failing: " +
            $"{string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }
}
