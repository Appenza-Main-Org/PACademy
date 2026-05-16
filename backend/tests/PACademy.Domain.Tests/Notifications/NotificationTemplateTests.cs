using FluentAssertions;
using PACademy.Modules.Notifications.Domain;

namespace PACademy.Domain.Tests.Notifications;

/// <summary>
/// Spec 009 T063 — NotificationTemplate domain invariants.
/// publish/un-publish/archive lifecycle; update blocked on published.
/// </summary>
public sealed class NotificationTemplateTests
{
    private static readonly Guid Actor = Guid.NewGuid();

    [Fact]
    public void Create_HappyPath_Succeeds()
    {
        var t = NewTemplate();

        t.SubjectAr.Should().Be("موضوع الإشعار");
        t.IsPublished.Should().BeFalse();
        t.PublishedAt.Should().BeNull();
    }

    [Fact]
    public void Create_EmptySubject_Throws()
    {
        var act = () => NotificationTemplate.Create(
            cycleId: null,
            NotificationTriggerEvent.ApplicationReceived,
            subjectAr: "  ",
            bodyAr: "نص",
            NotificationChannel.Email,
            Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*عنوان*");
    }

    [Fact]
    public void Create_EmptyBody_Throws()
    {
        var act = () => NotificationTemplate.Create(
            cycleId: null,
            NotificationTriggerEvent.ApplicationReceived,
            subjectAr: "موضوع",
            bodyAr: " ",
            NotificationChannel.Email,
            Actor);

        act.Should().Throw<ArgumentException>().WithMessage("*نص*");
    }

    [Fact]
    public void Publish_UnpublishedTemplate_SetsPublishedAt()
    {
        var t = NewTemplate();

        t.Publish();

        t.IsPublished.Should().BeTrue();
        t.PublishedAt.Should().NotBeNull();
    }

    [Fact]
    public void Publish_AlreadyPublished_Throws()
    {
        var t = NewTemplate();
        t.Publish();

        var act = () => t.Publish();

        act.Should().Throw<InvalidOperationException>().WithMessage("*منشور بالفعل*");
    }

    [Fact]
    public void Unpublish_PublishedTemplate_ClearsPublishedAt()
    {
        var t = NewTemplate();
        t.Publish();

        t.Unpublish();

        t.IsPublished.Should().BeFalse();
        t.PublishedAt.Should().BeNull();
    }

    [Fact]
    public void Unpublish_NotPublished_Throws()
    {
        var t = NewTemplate();

        var act = () => t.Unpublish();

        act.Should().Throw<InvalidOperationException>().WithMessage("*غير منشور*");
    }

    [Fact]
    public void Update_UnpublishedTemplate_UpdatesFields()
    {
        var t = NewTemplate();

        t.Update("موضوع محدث", "نص محدث");

        t.SubjectAr.Should().Be("موضوع محدث");
        t.BodyAr.Should().Be("نص محدث");
    }

    [Fact]
    public void Update_PublishedTemplate_Throws()
    {
        var t = NewTemplate();
        t.Publish();

        var act = () => t.Update("جديد", "جديد");

        act.Should().Throw<InvalidOperationException>().WithMessage("*منشور*");
    }

    [Fact]
    public void Archive_UnpublishedTemplate_SetsDeletedAt()
    {
        var t = NewTemplate();

        t.Archive(Actor, "سبب الأرشفة");

        t.DeletedAt.Should().NotBeNull();
        t.DeletedBy.Should().Be(Actor);
        t.DeleteReason.Should().Be("سبب الأرشفة");
    }

    [Fact]
    public void Archive_PublishedTemplate_Throws()
    {
        var t = NewTemplate();
        t.Publish();

        var act = () => t.Archive(Actor, null);

        act.Should().Throw<InvalidOperationException>().WithMessage("*منشور*");
    }

    [Fact]
    public void Restore_ArchivedTemplate_ClearsDeletedAt()
    {
        var t = NewTemplate();
        t.Archive(Actor, "test");

        t.Restore();

        t.DeletedAt.Should().BeNull();
        t.DeletedBy.Should().BeNull();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static NotificationTemplate NewTemplate() =>
        NotificationTemplate.Create(
            cycleId: null,
            NotificationTriggerEvent.ApplicationReceived,
            "موضوع الإشعار",
            "نص الإشعار للمتقدمين",
            NotificationChannel.Email,
            Actor);
}
