using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Settings;

/// <summary>
/// Dedicated storage for the admin "general settings" singleton surfaced at
/// <c>/admin/settings</c> (exam-day controls + applicant control-screen test
/// bindings). Replaces the previous generic <c>admin_records</c> / normalized
/// <c>admin_settings</c> JSON-blob path so each field is a real, typed column.
///
/// Single-row table: the only row uses <see cref="Id"/> == <see cref="SingletonId"/>.
/// </summary>
public sealed class GeneralSettingsEntity
{
    public const string SingletonId = "settings";

    public required string Id { get; set; }

    /// <summary>عدد أيام الاختبار للطالب — positive integer, default 3.</summary>
    public int ExamDaysPerApplicant { get; set; } = 3;

    /// <summary>عدد الأيام المسموح بها لاختيار موعد الاختبار قبل تاريخه — positive integer, default 1.</summary>
    public int ExamSlotSelectionWindowDays { get; set; } = 1;

    /// <summary>الاختبار المسؤول عن إظهار شاشات إدراج بيانات الأقارب الأولية.</summary>
    public string? PrimaryRelativesEntryResponsibleTestCode { get; set; }

    /// <summary>الاختبار المسؤول عن إظهار شاشات إدراج وثائق التعارف.</summary>
    public string? AcquaintanceDocumentsEntryResponsibleTestCode { get; set; }

    /// <summary>الاختبار المسؤول عن إظهار شاشات طباعة وثائق التعارف.</summary>
    public string? AcquaintanceDocumentsPrintResponsibleTestCode { get; set; }

    /// <summary>توقيت غلق الإدراج/الحذف/التعديل لوثائق التعارف.</summary>
    public string? AcquaintanceDocumentsMutationLockTiming { get; set; }

    /// <summary>المرحلة/الاختبار المسؤول عن إظهار شاشات الأقارب الأولية.</summary>
    public string? PrimaryRelativesVisibilityResponsibleTestCode { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public interface IGeneralSettingsDbContext
{
    DbSet<GeneralSettingsEntity> GeneralSettings { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
