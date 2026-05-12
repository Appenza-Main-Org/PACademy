namespace PACademy.Modules.Notifications.Application.Templates;

public sealed record NotificationTemplateDto(
    Guid Id,
    Guid? CycleId,
    string TriggerEvent,
    string SubjectAr,
    string BodyAr,
    string Channel,
    bool IsPublished,
    DateTime? PublishedAt,
    DateTime CreatedAt,
    string RowVersion);

public sealed record CreateNotificationTemplateRequest(
    Guid? CycleId,
    string TriggerEvent,
    string SubjectAr,
    string BodyAr,
    string Channel);

public sealed record UpdateNotificationTemplateRequest(
    string? SubjectAr,
    string? BodyAr,
    string RowVersion);

public sealed record PublishTemplateRequest(string RowVersion);

public sealed record ArchiveTemplateRequest(string? Reason);
