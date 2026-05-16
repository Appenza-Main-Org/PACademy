using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T064 — CycleExam domain invariants.
/// order assignment, optional/required flag, fee ≥ 0 validation.
/// </summary>
public sealed class CycleExamTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);

        exam.CycleId.Should().Be(CycleId);
        exam.ExamTypeKey.Should().Be("written");
        exam.Order.Should().Be(10);
        exam.IsRequired.Should().BeTrue();
        exam.FeeEgp.Should().BeNull();
        exam.IsArchived.Should().BeFalse();
    }

    [Fact]
    public void Create_EmptyExamTypeKey_Throws()
    {
        var act = () => CycleExam.Create(CycleId, "", order: 10, isRequired: true, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*مفتاح*");
    }

    [Fact]
    public void Create_NegativeFee_Throws()
    {
        var act = () => CycleExam.Create(
            CycleId, "written", order: 10, isRequired: true, Actor, feeEgp: -1m);

        act.Should().Throw<ArgumentException>().WithMessage("*سالبة*");
    }

    [Fact]
    public void Create_ZeroFee_Allowed()
    {
        var exam = CycleExam.Create(
            CycleId, "physical", order: 20, isRequired: false, Actor, feeEgp: 0m);

        exam.FeeEgp.Should().Be(0m);
    }

    [Fact]
    public void Create_WithCategoryId_AssignsCategoryId()
    {
        var catId = Guid.NewGuid();

        var exam = CycleExam.Create(
            CycleId, "sports", order: 30, isRequired: true, Actor, categoryId: catId);

        exam.CategoryId.Should().Be(catId);
    }

    [Fact]
    public void Update_Order_ChangesOrder()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);

        exam.Update(order: 20, isRequired: null, feeEgp: null);

        exam.Order.Should().Be(20);
    }

    [Fact]
    public void Update_Required_ChangesFlag()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);

        exam.Update(order: null, isRequired: false, feeEgp: null);

        exam.IsRequired.Should().BeFalse();
    }

    [Fact]
    public void Update_NegativeFee_Throws()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);

        var act = () => exam.Update(order: null, isRequired: null, feeEgp: -50m);

        act.Should().Throw<ArgumentException>().WithMessage("*سالبة*");
    }

    [Fact]
    public void Archive_SetsIsArchived()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);

        exam.Archive();

        exam.IsArchived.Should().BeTrue();
    }

    [Fact]
    public void Restore_ClearsIsArchived()
    {
        var exam = CycleExam.Create(CycleId, "written", order: 10, isRequired: true, Actor);
        exam.Archive();

        exam.Restore();

        exam.IsArchived.Should().BeFalse();
    }
}
