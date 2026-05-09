namespace PACademy.Contracts.Admin.AdmissionRules;

public sealed record AdmissionRuleListItemDto(
    Guid Id,
    string Name,
    Guid? CycleId,
    int Version,
    DateTime EffectiveAt,
    Guid ChangedById,
    bool IsActive,
    DateTime CreatedAt);
