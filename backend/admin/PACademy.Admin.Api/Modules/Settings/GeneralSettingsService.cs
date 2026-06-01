using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace PACademy.Admin.Api.Modules.Settings;

/// <summary>
/// Reads and patches the admin general-settings singleton from its dedicated
/// <c>general_settings</c> table. The on-the-wire JSON contract matches the
/// frontend <c>AdminSettings</c> interface (camelCase keys); PATCH is a partial
/// merge — only keys present in the request body are updated.
/// </summary>
public sealed class GeneralSettingsService(IGeneralSettingsDbContext db)
{
    public async Task<JsonObject> GetAsync(CancellationToken ct)
    {
        var entity = await db.GeneralSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == GeneralSettingsEntity.SingletonId, ct);
        return ToJson(entity ?? new GeneralSettingsEntity { Id = GeneralSettingsEntity.SingletonId });
    }

    public async Task<JsonObject> UpdateAsync(JsonObject patch, CancellationToken ct)
    {
        var entity = await db.GeneralSettings
            .FirstOrDefaultAsync(x => x.Id == GeneralSettingsEntity.SingletonId, ct);

        var now = DateTimeOffset.UtcNow;
        var isCreate = entity is null;
        if (entity is null)
        {
            entity = new GeneralSettingsEntity { Id = GeneralSettingsEntity.SingletonId, CreatedAt = now };
            db.GeneralSettings.Add(entity);
        }

        ApplyPatch(entity, patch);
        entity.UpdatedAt = now;
        if (isCreate) entity.CreatedAt = now;

        await db.SaveChangesAsync(ct);
        return ToJson(entity);
    }

    private static void ApplyPatch(GeneralSettingsEntity entity, JsonObject patch)
    {
        if (TryGetInt(patch, "examDaysPerApplicant", out var examDays))
            entity.ExamDaysPerApplicant = examDays;
        if (TryGetInt(patch, "examSlotSelectionWindowDays", out var slotWindow))
            entity.ExamSlotSelectionWindowDays = slotWindow;

        if (patch.ContainsKey("primaryRelativesEntryResponsibleTestCode"))
            entity.PrimaryRelativesEntryResponsibleTestCode = StringOrNull(patch, "primaryRelativesEntryResponsibleTestCode");
        if (patch.ContainsKey("acquaintanceDocumentsEntryResponsibleTestCode"))
            entity.AcquaintanceDocumentsEntryResponsibleTestCode = StringOrNull(patch, "acquaintanceDocumentsEntryResponsibleTestCode");
        if (patch.ContainsKey("acquaintanceDocumentsPrintResponsibleTestCode"))
            entity.AcquaintanceDocumentsPrintResponsibleTestCode = StringOrNull(patch, "acquaintanceDocumentsPrintResponsibleTestCode");
        if (patch.ContainsKey("acquaintanceDocumentsMutationLockTiming"))
            entity.AcquaintanceDocumentsMutationLockTiming = StringOrNull(patch, "acquaintanceDocumentsMutationLockTiming");
        if (patch.ContainsKey("acquaintanceDocumentsOpenTiming"))
            entity.AcquaintanceDocumentsOpenTiming = StringOrNull(patch, "acquaintanceDocumentsOpenTiming");
        if (patch.ContainsKey("acquaintanceDocumentsOpenOffsetValue"))
            entity.AcquaintanceDocumentsOpenOffsetValue = NullableIntOrNull(patch, "acquaintanceDocumentsOpenOffsetValue");
        if (patch.ContainsKey("acquaintanceDocumentsOpenOffsetUnit"))
            entity.AcquaintanceDocumentsOpenOffsetUnit = StringOrNull(patch, "acquaintanceDocumentsOpenOffsetUnit");
        if (patch.ContainsKey("acquaintanceDocumentsCloseResponsibleTestCode"))
            entity.AcquaintanceDocumentsCloseResponsibleTestCode = StringOrNull(patch, "acquaintanceDocumentsCloseResponsibleTestCode");
        if (patch.ContainsKey("acquaintanceDocumentsCloseTiming"))
            entity.AcquaintanceDocumentsCloseTiming = StringOrNull(patch, "acquaintanceDocumentsCloseTiming");
        if (patch.ContainsKey("acquaintanceDocumentsCloseOffsetValue"))
            entity.AcquaintanceDocumentsCloseOffsetValue = NullableIntOrNull(patch, "acquaintanceDocumentsCloseOffsetValue");
        if (patch.ContainsKey("acquaintanceDocumentsCloseOffsetUnit"))
            entity.AcquaintanceDocumentsCloseOffsetUnit = StringOrNull(patch, "acquaintanceDocumentsCloseOffsetUnit");
        if (patch.ContainsKey("primaryRelativesVisibilityResponsibleTestCode"))
            entity.PrimaryRelativesVisibilityResponsibleTestCode = StringOrNull(patch, "primaryRelativesVisibilityResponsibleTestCode");
    }

    private static JsonObject ToJson(GeneralSettingsEntity e) => new()
    {
        ["examDaysPerApplicant"] = e.ExamDaysPerApplicant,
        ["examSlotSelectionWindowDays"] = e.ExamSlotSelectionWindowDays,
        ["primaryRelativesEntryResponsibleTestCode"] = e.PrimaryRelativesEntryResponsibleTestCode,
        ["acquaintanceDocumentsEntryResponsibleTestCode"] = e.AcquaintanceDocumentsEntryResponsibleTestCode,
        ["acquaintanceDocumentsPrintResponsibleTestCode"] = e.AcquaintanceDocumentsPrintResponsibleTestCode,
        ["acquaintanceDocumentsMutationLockTiming"] = e.AcquaintanceDocumentsMutationLockTiming,
        ["acquaintanceDocumentsOpenTiming"] = e.AcquaintanceDocumentsOpenTiming,
        ["acquaintanceDocumentsOpenOffsetValue"] = e.AcquaintanceDocumentsOpenOffsetValue,
        ["acquaintanceDocumentsOpenOffsetUnit"] = e.AcquaintanceDocumentsOpenOffsetUnit,
        ["acquaintanceDocumentsCloseResponsibleTestCode"] = e.AcquaintanceDocumentsCloseResponsibleTestCode,
        ["acquaintanceDocumentsCloseTiming"] = e.AcquaintanceDocumentsCloseTiming,
        ["acquaintanceDocumentsCloseOffsetValue"] = e.AcquaintanceDocumentsCloseOffsetValue,
        ["acquaintanceDocumentsCloseOffsetUnit"] = e.AcquaintanceDocumentsCloseOffsetUnit,
        ["primaryRelativesVisibilityResponsibleTestCode"] = e.PrimaryRelativesVisibilityResponsibleTestCode,
    };

    private static bool TryGetInt(JsonObject obj, string name, out int value)
    {
        value = 0;
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return false;
        try
        {
            value = node.GetValue<int>();
            return true;
        }
        catch
        {
            // Tolerate string-encoded numbers ("3") from the form layer.
            if (int.TryParse(node.ToString(), out var parsed))
            {
                value = parsed;
                return true;
            }
            return false;
        }
    }

    private static string? StringOrNull(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        var value = node.GetValue<string?>();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static int? NullableIntOrNull(JsonObject obj, string name)
    {
        if (!obj.TryGetPropertyValue(name, out var node) || node is null) return null;
        try
        {
            return node.GetValue<int?>();
        }
        catch
        {
            return int.TryParse(node.ToString(), out var parsed) ? parsed : null;
        }
    }
}
