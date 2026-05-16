using FluentAssertions;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Domain.Tests.Admissions;

/// <summary>
/// Spec 009 T022 — ElectronicDeclaration domain invariants.
///
/// Coverage:
///   • CreateDraft rejects empty body.
///   • Version is set as supplied; default is 1.
///   • Update is blocked on a published declaration.
///   • Archive is blocked on a published declaration.
///   • Publish is blocked on an archived declaration.
///   • Unpublish clears PublishedAt.
/// </summary>
public sealed class ElectronicDeclarationTests
{
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTime Effective = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    private static ElectronicDeclaration MakeDraft(string body = "نص الإقرار", int version = 1) =>
        ElectronicDeclaration.CreateDraft(
            CycleId,
            DeclarationMode.Text,
            body,
            documentFileName: null,
            documentRelativeUrl: null,
            documentSize: null,
            Effective,
            Actor,
            version);

    [Fact]
    public void CreateDraft_HappyPath_Succeeds()
    {
        var decl = MakeDraft();

        decl.CycleId.Should().Be(CycleId);
        decl.BodyAr.Should().Be("نص الإقرار");
        decl.Version.Should().Be(1);
        decl.PublishedAt.Should().BeNull();
        decl.IsArchived.Should().BeFalse();
        decl.CreatedBy.Should().Be(Actor);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateDraft_EmptyBody_Throws(string emptyBody)
    {
        var act = () => ElectronicDeclaration.CreateDraft(
            CycleId, DeclarationMode.Text, emptyBody,
            documentFileName: null, documentRelativeUrl: null, documentSize: null,
            Effective, Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*فارغاً*");
    }

    [Fact]
    public void CreateDraft_ExplicitVersion_RecordsVersion()
    {
        var decl = MakeDraft(version: 4);

        decl.Version.Should().Be(4);
    }

    [Fact]
    public void Publish_SetsPublishedAt()
    {
        var decl = MakeDraft();
        decl.Publish();

        decl.PublishedAt.Should().NotBeNull();
    }

    [Fact]
    public void Publish_OnArchivedDeclaration_Throws()
    {
        var decl = MakeDraft();
        decl.Archive();

        var act = () => decl.Publish();

        act.Should().Throw<InvalidOperationException>().WithMessage("*مؤرشف*");
    }

    [Fact]
    public void Unpublish_ClearsPublishedAt()
    {
        var decl = MakeDraft();
        decl.Publish();

        decl.Unpublish();

        decl.PublishedAt.Should().BeNull();
    }

    [Fact]
    public void Update_OnPublishedDeclaration_Throws()
    {
        var decl = MakeDraft();
        decl.Publish();

        var act = () => decl.Update(
            mode: null, bodyAr: "نص جديد",
            documentFileName: null, documentRelativeUrl: null, documentSize: null,
            clearDocument: false, effectiveFrom: null);

        act.Should().Throw<InvalidOperationException>().WithMessage("*منشور*");
    }

    [Fact]
    public void Update_EmptyBody_Throws()
    {
        var decl = MakeDraft();

        var act = () => decl.Update(
            mode: null, bodyAr: "   ",
            documentFileName: null, documentRelativeUrl: null, documentSize: null,
            clearDocument: false, effectiveFrom: null);

        act.Should().Throw<ArgumentException>().WithMessage("*فارغاً*");
    }

    [Fact]
    public void Update_NullBody_DoesNotChangeBody()
    {
        var decl = MakeDraft("النص الأصلي");

        decl.Update(
            mode: null, bodyAr: null,
            documentFileName: null, documentRelativeUrl: null, documentSize: null,
            clearDocument: false, effectiveFrom: Effective.AddDays(1));

        decl.BodyAr.Should().Be("النص الأصلي");
        decl.EffectiveFrom.Should().Be(Effective.AddDays(1));
    }

    [Fact]
    public void Archive_OnPublishedDeclaration_Throws()
    {
        var decl = MakeDraft();
        decl.Publish();

        var act = () => decl.Archive();

        act.Should().Throw<InvalidOperationException>().WithMessage("*منشور*");
    }

    [Fact]
    public void Archive_OnUnpublishedDeclaration_Succeeds()
    {
        var decl = MakeDraft();

        decl.Archive();

        decl.IsArchived.Should().BeTrue();
    }
}
