using FluentAssertions;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Domain.Tests.Committees;

/// <summary>
/// Spec 009 T062 — CommitteeDateBinding and CommitteeMember domain invariants.
/// </summary>
public sealed class CommitteeDateBindingTests
{
    [Fact]
    public void Create_ValidCapacity_Succeeds()
    {
        var binding = CommitteeDateBinding.Create(
            Guid.NewGuid(), new DateOnly(2030, 7, 15), capacity: 30);

        binding.Capacity.Should().Be(30);
        binding.BoundDate.Should().Be(new DateOnly(2030, 7, 15));
    }

    [Fact]
    public void Create_ZeroCapacity_Allowed()
    {
        var binding = CommitteeDateBinding.Create(
            Guid.NewGuid(), new DateOnly(2030, 7, 15), capacity: 0);

        binding.Capacity.Should().Be(0);
    }

    [Fact]
    public void Create_NegativeCapacity_Throws()
    {
        var act = () => CommitteeDateBinding.Create(
            Guid.NewGuid(), new DateOnly(2030, 7, 15), capacity: -1);

        act.Should().Throw<ArgumentException>().WithMessage("*صفراً*");
    }

    [Fact]
    public void UpdateCapacity_Valid_UpdatesValue()
    {
        var binding = CommitteeDateBinding.Create(
            Guid.NewGuid(), new DateOnly(2030, 7, 15), capacity: 10);

        binding.UpdateCapacity(50);

        binding.Capacity.Should().Be(50);
    }

    [Fact]
    public void UpdateCapacity_Negative_Throws()
    {
        var binding = CommitteeDateBinding.Create(
            Guid.NewGuid(), new DateOnly(2030, 7, 15), capacity: 10);

        var act = () => binding.UpdateCapacity(-5);

        act.Should().Throw<ArgumentException>().WithMessage("*صفراً*");
    }
}

public sealed class CommitteeMemberTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void SwapChair_ExistingMember_PromotesAndDemotesPrevious()
    {
        var committee = Committee.Create(
            CycleId, "north", "لجنة الشمال", null, null, 50, [], Actor);
        var chair1 = Guid.NewGuid();
        var chair2 = Guid.NewGuid();
        committee.AddMember(chair1, CommitteeMemberRole.Chair);
        committee.AddMember(chair2, CommitteeMemberRole.Member);

        committee.SwapChair(chair2);

        committee.Members.Single(m => m.UserId == chair1).Role
            .Should().Be(CommitteeMemberRole.Member);
        committee.Members.Single(m => m.UserId == chair2).Role
            .Should().Be(CommitteeMemberRole.Chair);
        committee.ChairUserId.Should().Be(chair2);
    }

    [Fact]
    public void SwapChair_NonExistingMember_StillUpdatesChairUserId()
    {
        var committee = Committee.Create(
            CycleId, "south", "لجنة الجنوب", null, null, 50, [], Actor);
        var newChairId = Guid.NewGuid();

        // SwapChair when the user is not yet a member simply sets ChairUserId
        committee.SwapChair(newChairId);

        committee.ChairUserId.Should().Be(newChairId);
    }

    [Fact]
    public void AddMember_WithRole_SetsRoleCorrectly()
    {
        var committee = Committee.Create(
            CycleId, "west", "لجنة الغرب", null, null, 40, [], Actor);
        var userId = Guid.NewGuid();

        var member = committee.AddMember(userId, CommitteeMemberRole.Secretary);

        member.UserId.Should().Be(userId);
        member.Role.Should().Be(CommitteeMemberRole.Secretary);
    }
}
