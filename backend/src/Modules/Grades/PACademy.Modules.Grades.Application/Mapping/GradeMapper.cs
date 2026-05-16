using PACademy.Modules.Grades.Application.Dtos;
using PACademy.Modules.Grades.Domain;

namespace PACademy.Modules.Grades.Application.Mapping;

internal static class GradeMapper
{
    public static GradeRowDto ToDto(GradeRow r) => new(
        r.Id,
        r.Seat,
        r.SeatingNumber,
        r.Nid,
        r.Name,
        r.Kind.ToString().ToLowerInvariant(),
        r.Branch,
        r.School,
        r.Region,
        r.Total,
        r.ImportMax,
        r.OverrideMax,
        r.LastEditedAt,
        r.LastEditedBy,
        r.Status,
        r.Adjustments.Select(ToDto).ToList(),
        Convert.ToBase64String(r.RowVersion ?? []));

    public static GradeAdjustmentDto ToDto(GradeAdjustment a) => new(
        a.Id,
        a.Reason.ToString(),
        a.Note,
        a.Amount,
        a.AddedBy,
        a.AddedAt,
        a.IsActive,
        Convert.ToBase64String(a.RowVersion ?? []));

    public static AdjustmentReason ParseReason(string raw)
        => raw switch
        {
            "SPORTS_ACTIVITY" or "SportsActivity" => AdjustmentReason.SportsActivity,
            "GRIEVANCE" or "Grievance" => AdjustmentReason.Grievance,
            "LEGAL_CASE" or "LegalCase" => AdjustmentReason.LegalCase,
            "OTHER" or "Other" => AdjustmentReason.Other,
            _ => throw new ArgumentException($"Unknown adjustment reason: {raw}"),
        };

    public static GradeKind ParseKind(string raw)
        => raw.ToLowerInvariant() switch
        {
            "general" => GradeKind.General,
            "azhar" => GradeKind.Azhar,
            _ => throw new ArgumentException($"Unknown grade kind: {raw}"),
        };
}
