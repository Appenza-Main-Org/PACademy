using System.Text.Json;

namespace PACademy.Contracts.Admin.AdmissionRules;

public sealed record CreateAdmissionRuleRequest(
    string Name,
    string? Description,
    Guid? CycleId,
    JsonElement? Rules,
    DateTime? EffectiveAt);
