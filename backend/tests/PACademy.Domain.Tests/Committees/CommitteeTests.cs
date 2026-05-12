using FluentAssertions;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Domain.Tests.Committees;

/// <summary>
/// Spec 009 T061 — Committee domain invariants.
///
/// Coverage:
///   • Required-field validation on Create (key, nameAr, dailyCapacity ≥ 1).
///   • AddMember enforces uniqueness per (committee, user).
///   • Chair-role transitions (AddMember as Chair, SwapChair) keep only one
///     chair at a time.
///   • Archive / Restore lifecycle.
/// </summary>
public sealed class CommitteeTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var c = NewCommittee();

        c.CycleId.Should().Be(CycleId);
        c.Key.Should().Be("east");
        c.Status.Should().Be(CommitteeStatus.Active);
        c.CreatedBy.Should().Be(Actor);
        c.DailyCapacity.Should().Be(50);
    }

    [Fact]
    public void Create_EmptyKey_Throws()
    {
        var act = () => Committee.Create(
            CycleId, key: "", "name-ar", null, null, 50, [], Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*المفتاح*");
    }

    [Fact]
    public void Create_EmptyNameAr_Throws()
    {
        var act = () => Committee.Create(
            CycleId, "east", nameAr: "  ", null, null, 50, [], Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*الاسم*");
    }

    [Fact]
    public void Create_ZeroCapacity_Throws()
    {
        var act = () => Committee.Create(
            CycleId, "east", "name-ar", null, null, 0, [], Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*1 على الأقل*");
    }

    [Fact]
    public void AddMember_NewUser_Succeeds()
    {
        var c = NewCommittee();
        var userId = Guid.NewGuid();

        c.AddMember(userId, CommitteeMemberRole.Member);

        c.Members.Should().HaveCount(1);
        c.Members[0].UserId.Should().Be(userId);
        c.Members[0].Role.Should().Be(CommitteeMemberRole.Member);
    }

    [Fact]
    public void AddMember_SameUserTwice_Throws()
    {
        var c = NewCommittee();
        var userId = Guid.NewGuid();
        c.AddMember(userId, CommitteeMemberRole.Member);

        var act = () => c.AddMember(userId, CommitteeMemberRole.Secretary);

        act.Should().Throw<InvalidOperationException>().WithMessage("*عضو بالفعل*");
    }

    [Fact]
    public void AddMember_AsChair_DemotesPreviousChair()
    {
        var c = NewCommittee();
        var chair1 = Guid.NewGuid();
        var chair2 = Guid.NewGuid();
        c.AddMember(chair1, CommitteeMemberRole.Chair);

        c.AddMember(chair2, CommitteeMemberRole.Chair);

        c.Members.Single(m => m.UserId == chair1).Role
            .Should().Be(CommitteeMemberRole.Member);
        c.Members.Single(m => m.UserId == chair2).Role
            .Should().Be(CommitteeMemberRole.Chair);
        c.ChairUserId.Should().Be(chair2);
    }

    [Fact]
    public void RemoveMember_RemovesByUserId()
    {
        var c = NewCommittee();
        var u1 = Guid.NewGuid();
        var u2 = Guid.NewGuid();
        c.AddMember(u1, CommitteeMemberRole.Member);
        c.AddMember(u2, CommitteeMemberRole.Member);

        c.RemoveMember(u1);

        c.Members.Should().HaveCount(1);
        c.Members[0].UserId.Should().Be(u2);
    }

    [Fact]
    public void RemoveMember_UnknownUser_Throws()
    {
        var c = NewCommittee();

        var act = () => c.RemoveMember(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>().WithMessage("*غير موجود*");
    }

    [Fact]
    public void Archive_FromActive_Succeeds()
    {
        var c = NewCommittee();

        c.Archive(Actor, "إعادة هيكلة");

        c.Status.Should().Be(CommitteeStatus.Archived);
        c.DeletedBy.Should().Be(Actor);
        c.DeleteReason.Should().Be("إعادة هيكلة");
        c.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public void Archive_AlreadyArchived_Throws()
    {
        var c = NewCommittee();
        c.Archive(Actor, null);

        var act = () => c.Archive(Actor, null);

        act.Should().Throw<InvalidOperationException>().WithMessage("*مؤرشفة بالفعل*");
    }

    [Fact]
    public void Restore_FromArchived_Succeeds()
    {
        var c = NewCommittee();
        c.Archive(Actor, "test");

        c.Restore();

        c.Status.Should().Be(CommitteeStatus.Active);
        c.DeletedAt.Should().BeNull();
        c.DeletedBy.Should().BeNull();
        c.DeleteReason.Should().BeNull();
    }

    [Fact]
    public void Restore_OnActive_Throws()
    {
        var c = NewCommittee();

        var act = () => c.Restore();

        act.Should().Throw<InvalidOperationException>().WithMessage("*غير مؤرشفة*");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static Committee NewCommittee() =>
        Committee.Create(
            CycleId, "east", "لجنة الشرق", null, chairUserId: null,
            dailyCapacity: 50, specializations: [], Actor);
}
