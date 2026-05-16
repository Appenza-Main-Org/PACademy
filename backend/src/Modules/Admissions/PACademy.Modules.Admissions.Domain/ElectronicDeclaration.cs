namespace PACademy.Modules.Admissions.Domain;

public enum DeclarationMode { Text, Pdf }

/// <summary>
/// Step 15 wizard entity — electronic declaration shown to applicants on Stage 9.
/// Versioned: each save creates a new version. Only one version per cycle may
/// be published at a time (invariant enforced by use case + DB constraint).
///
/// Dual mode: <c>Text</c> stores the inline Arabic body; <c>Pdf</c> stores
/// a reference to an uploaded file under wwwroot/uploads/declarations/.
/// Both columns may coexist on a record (admin can switch tabs without
/// losing the other surface's prior content); <c>Mode</c> selects which
/// surface is published to applicants.
/// </summary>
public sealed class ElectronicDeclaration
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public DeclarationMode Mode { get; private set; }
    public string? BodyAr { get; private set; }
    public string? DocumentFileName { get; private set; }
    public string? DocumentRelativeUrl { get; private set; }
    public long? DocumentSize { get; private set; }
    public int Version { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private ElectronicDeclaration() { }

    public static ElectronicDeclaration CreateDraft(
        Guid cycleId,
        DeclarationMode mode,
        string? bodyAr,
        string? documentFileName,
        string? documentRelativeUrl,
        long? documentSize,
        DateTime effectiveFrom,
        Guid createdBy,
        int version = 1)
    {
        ValidateContent(mode, bodyAr, documentRelativeUrl);
        return new ElectronicDeclaration
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            Mode = mode,
            BodyAr = mode == DeclarationMode.Text ? bodyAr : bodyAr,
            DocumentFileName = documentFileName,
            DocumentRelativeUrl = documentRelativeUrl,
            DocumentSize = documentSize,
            Version = version,
            EffectiveFrom = effectiveFrom,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Update(
        DeclarationMode? mode,
        string? bodyAr,
        string? documentFileName,
        string? documentRelativeUrl,
        long? documentSize,
        bool clearDocument,
        DateTime? effectiveFrom)
    {
        if (PublishedAt.HasValue)
            throw new InvalidOperationException("لا يمكن تعديل إقرار منشور");

        if (mode.HasValue) Mode = mode.Value;
        if (bodyAr is not null) BodyAr = bodyAr;
        if (clearDocument)
        {
            DocumentFileName = null;
            DocumentRelativeUrl = null;
            DocumentSize = null;
        }
        else if (documentRelativeUrl is not null)
        {
            DocumentFileName = documentFileName;
            DocumentRelativeUrl = documentRelativeUrl;
            DocumentSize = documentSize;
        }
        if (effectiveFrom.HasValue) EffectiveFrom = effectiveFrom.Value;

        ValidateContent(Mode, BodyAr, DocumentRelativeUrl);
    }

    public void Publish()
    {
        if (IsArchived)
            throw new InvalidOperationException("لا يمكن نشر إقرار مؤرشف");
        ValidateContent(Mode, BodyAr, DocumentRelativeUrl);
        PublishedAt = DateTime.UtcNow;
    }

    public void Unpublish()
    {
        PublishedAt = null;
    }

    public void Archive()
    {
        if (PublishedAt.HasValue)
            throw new InvalidOperationException("لا يمكن أرشفة الإقرار المنشور حالياً");
        IsArchived = true;
    }

    private static void ValidateContent(DeclarationMode mode, string? bodyAr, string? documentRelativeUrl)
    {
        switch (mode)
        {
            case DeclarationMode.Text when string.IsNullOrWhiteSpace(bodyAr):
                throw new ArgumentException("نص الإقرار لا يمكن أن يكون فارغاً في وضع النص");
            case DeclarationMode.Pdf when string.IsNullOrWhiteSpace(documentRelativeUrl):
                throw new ArgumentException("مستند الإقرار مطلوب في وضع PDF");
        }
    }
}
