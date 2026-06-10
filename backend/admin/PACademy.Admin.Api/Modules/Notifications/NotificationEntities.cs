namespace PACademy.Admin.Api.Modules.Notifications;

/// <summary>
/// Normalized "Shape A" tables for admin-authored broadcast notifications,
/// extracted from the JSON <c>notifications</c> bucket (the Shape-B operational
/// table is also named <c>notifications</c>, hence the <c>notifications_master</c>
/// name). House mirror strategy: typed columns own query/index/integrity;
/// <c>PayloadJson</c> keeps the full DTO verbatim. The polymorphic audience
/// selector becomes child rows with the discriminator typed and the
/// per-variant target kept as JSON.
/// </summary>
public sealed class NotificationMasterEntity
{
    public required string Id { get; set; }
    public string? Type { get; set; }
    public string? TitleAr { get; set; }
    public string? Status { get; set; }
    public DateTimeOffset? PublishAt { get; set; }
    public DateTimeOffset? ExpireAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    /// <summary>Full DTO mirror — returned verbatim by the read path.</summary>
    public required string PayloadJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public List<NotificationAudienceEntity> Audience { get; set; } = [];
}

/// <summary>One audience selector of a notification (<c>audience[]</c>).
/// <c>Kind</c> is the discriminator (general/student/department/category/committee);
/// the variant-specific fields stay in <c>TargetJson</c>.</summary>
public sealed class NotificationAudienceEntity
{
    public required string NotificationId { get; set; }
    public int AudienceOrder { get; set; }
    public string? Kind { get; set; }
    public required string TargetJson { get; set; }
}
