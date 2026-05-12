namespace PACademy.Shared.Contracts.Concurrency;

/// <summary>
/// Response body for HTTP 409 when a rowVersion concurrency token is stale.
/// Frontend uses this to surface a diff drawer per FR-013.
/// </summary>
public sealed record RowVersionConflictResult(
    string Code,
    string MessageAr,
    string MessageEn,
    string CurrentRowVersion,
    string EntityType,
    string EntityId)
{
    public const string DefaultCode = "ROW_VERSION_CONFLICT";
    public const string DefaultMessageAr = "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة";
    public const string DefaultMessageEn = "This record was modified by another user — please refresh.";

    public static RowVersionConflictResult For(string entityType, string entityId, byte[] currentRowVersion)
        => new(
            DefaultCode,
            DefaultMessageAr,
            DefaultMessageEn,
            Convert.ToBase64String(currentRowVersion),
            entityType,
            entityId);
}
