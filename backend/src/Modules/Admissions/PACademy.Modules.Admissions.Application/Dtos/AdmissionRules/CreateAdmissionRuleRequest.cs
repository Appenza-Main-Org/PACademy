using System.Text.Json;

namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record CreateAdmissionRuleRequest(
    string Name,
    string? Description,
    Guid? CycleId,
    JsonElement? Rules,
    DateTime? EffectiveAt);
