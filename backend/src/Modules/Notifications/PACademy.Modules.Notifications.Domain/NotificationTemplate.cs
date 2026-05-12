namespace PACademy.Modules.Notifications.Domain;

public sealed class NotificationTemplate
{
    public Guid Id { get; private set; }
    public Guid? CycleId { get; private set; }
    public NotificationTriggerEvent TriggerEvent { get; private set; }
    public string SubjectAr { get; private set; } = string.Empty;
    public string BodyAr { get; private set; } = string.Empty;
    public NotificationChannel Channel { get; private set; }
    public bool IsPublished { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }
    public string? DeleteReason { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private NotificationTemplate() { }

    public static NotificationTemplate Create(
        Guid? cycleId,
        NotificationTriggerEvent triggerEvent,
        string subjectAr,
        string bodyAr,
        NotificationChannel channel,
        Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(subjectAr)) throw new ArgumentException("عنوان الإشعار مطلوب");
        if (string.IsNullOrWhiteSpace(bodyAr)) throw new ArgumentException("نص الإشعار مطلوب");

        return new NotificationTemplate
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            TriggerEvent = triggerEvent,
            SubjectAr = subjectAr,
            BodyAr = bodyAr,
            Channel = channel,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Update(string? subjectAr, string? bodyAr)
    {
        if (IsPublished)
            throw new InvalidOperationException("لا يمكن تعديل إشعار منشور — استخدم نشر/إلغاء نشر");
        if (!string.IsNullOrWhiteSpace(subjectAr)) SubjectAr = subjectAr;
        if (!string.IsNullOrWhiteSpace(bodyAr)) BodyAr = bodyAr;
    }

    public void Publish()
    {
        if (IsPublished) throw new InvalidOperationException("الإشعار منشور بالفعل");
        IsPublished = true;
        PublishedAt = DateTime.UtcNow;
    }

    public void Unpublish()
    {
        if (!IsPublished) throw new InvalidOperationException("الإشعار غير منشور");
        IsPublished = false;
        PublishedAt = null;
    }

    public void Archive(Guid deletedBy, string? reason)
    {
        if (IsPublished) throw new InvalidOperationException("لا يمكن أرشفة إشعار منشور");
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
        DeleteReason = reason;
    }

    public void Restore()
    {
        DeletedAt = null;
        DeletedBy = null;
        DeleteReason = null;
    }
}
