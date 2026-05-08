using FluentAssertions;
using PACademy.Domain.Identity;

namespace PACademy.Domain.Tests.Identity;

public sealed class SuperAdminFloorPolicyTests
{
    [Fact]
    public void Check_WhenMoreThanOneActiveSuperAdmin_AllowsDeactivation()
    {
        var result = SuperAdminFloorPolicy.Check(activeSupAdminCount: 2);

        result.IsAllowed.Should().BeTrue();
        result.DenyReason.Should().BeNull();
    }

    [Fact]
    public void Check_WhenExactlyOneSuperAdmin_DeniesDeactivation()
    {
        var result = SuperAdminFloorPolicy.Check(activeSupAdminCount: 1);

        result.IsAllowed.Should().BeFalse();
        result.DenyReason.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Check_WhenZeroSuperAdmins_DeniesDeactivation()
    {
        var result = SuperAdminFloorPolicy.Check(activeSupAdminCount: 0);

        result.IsAllowed.Should().BeFalse();
    }

    [Theory]
    [InlineData(3)]
    [InlineData(10)]
    [InlineData(100)]
    public void Check_WhenManySuperAdmins_AllowsDeactivation(int count)
    {
        var result = SuperAdminFloorPolicy.Check(activeSupAdminCount: count);

        result.IsAllowed.Should().BeTrue();
    }
}
