using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record AdmissionRuleDetailDto(
    Guid Id,
    string Name,
    string? Description,
    Guid? CycleId,
    int Version,
    DateTime EffectiveAt,
    Guid ChangedById,
    JsonElement Rules,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool DemoOrigin);
