namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record AdmissionRuleListItemDto(
    Guid Id,
    string Name,
    Guid? CycleId,
    int Version,
    DateTime EffectiveAt,
    Guid ChangedById,
    bool IsActive,
    DateTime CreatedAt);
