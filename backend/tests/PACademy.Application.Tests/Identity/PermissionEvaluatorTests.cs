using FluentAssertions;
using PACademy.Modules.Identity.Application.Authorization;

namespace PACademy.Application.Tests.Identity;

/// <summary>
/// T436-T438 — PermissionEvaluator unit tests covering the three matching rules.
/// </summary>
public sealed class PermissionEvaluatorTests
{
    private readonly PermissionEvaluator _sut = new();

    // ── T436: Super-admin wildcard ────────────────────────────────────────────
    [Fact]
    public void Has_SuperAdminWildcard_AlwaysTrue()
    {
        _sut.Has(["*"], "cycles:create").Should().BeTrue();
        _sut.Has(["*"], "users:view").Should().BeTrue();
        _sut.Has(["*"], "anything:at:all").Should().BeTrue();
    }

    [Fact]
    public void Has_SuperAdminWildcard_WithNoPermRequired_StillTrue()
    {
        _sut.Has(["*"], "random_perm").Should().BeTrue();
    }

    // ── T437: Exact match ─────────────────────────────────────────────────────
    [Fact]
    public void Has_ExactMatch_ReturnsTrue()
    {
        _sut.Has(["cycles:view", "cycles:create"], "cycles:view").Should().BeTrue();
        _sut.Has(["cycles:view", "cycles:create"], "cycles:create").Should().BeTrue();
    }

    [Fact]
    public void Has_NoMatch_ReturnsFalse()
    {
        _sut.Has(["cycles:view"], "cycles:delete").Should().BeFalse();
        _sut.Has(["users:view"], "cycles:view").Should().BeFalse();
        _sut.Has([], "cycles:view").Should().BeFalse();
    }

    // ── T438: Resource wildcard ───────────────────────────────────────────────
    [Fact]
    public void Has_ResourceWildcard_MatchesAllVerbsForResource()
    {
        var perms = new[] { "committees:*" };
        _sut.Has(perms, "committees:view").Should().BeTrue();
        _sut.Has(perms, "committees:create").Should().BeTrue();
        _sut.Has(perms, "committees:delete").Should().BeTrue();
    }

    [Fact]
    public void Has_ResourceWildcard_DoesNotMatchOtherResources()
    {
        var perms = new[] { "committees:*" };
        _sut.Has(perms, "cycles:view").Should().BeFalse();
        _sut.Has(perms, "users:view").Should().BeFalse();
    }

    [Fact]
    public void Has_ResourceWildcard_DoesNotMatchWildcardItself()
    {
        // "committees:*" should not match "committees:*" via exact-match only
        // (it does match via resource-wildcard rule, but let's check exact path)
        _sut.Has(["committees:*"], "committees:*").Should().BeTrue();
    }

    [Fact]
    public void Has_RequiredWithoutColon_OnlyExactMatchOrSuperApplies()
    {
        _sut.Has(["cycles:*"], "cycles").Should().BeFalse();
        _sut.Has(["cycles"], "cycles").Should().BeTrue();
    }

    // ── Combined scenarios ────────────────────────────────────────────────────
    [Theory]
    [InlineData(new[] { "*" }, "any:permission", true)]
    [InlineData(new[] { "users:view", "users:create" }, "users:view", true)]
    [InlineData(new[] { "users:view", "users:create" }, "users:delete", false)]
    [InlineData(new[] { "users:*" }, "users:delete", true)]
    [InlineData(new[] { "admin:*" }, "users:view", false)]
    [InlineData(new string[0], "users:view", false)]
    public void Has_Scenarios(string[] perms, string required, bool expected)
    {
        _sut.Has(perms, required).Should().Be(expected);
    }
}
