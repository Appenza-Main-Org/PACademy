namespace PACademy.Shared.Domain.Lookups;

/// <summary>
/// Generic lookup row for the admin reference-data catalogue.
/// The typed frontend rows are preserved verbatim in <see cref="PayloadJson"/>.
/// </summary>
public sealed class LookupItem
{
    private LookupItem() { }

    public string LookupKey { get; private set; } = default!;
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public bool IsActive { get; private set; }
    public string PayloadJson { get; private set; } = default!;
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    public static LookupItem Create(
        string lookupKey,
        string code,
        string name,
        bool isActive,
        string payloadJson,
        int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(lookupKey)) throw new ArgumentException("lookup key required", nameof(lookupKey));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("code required", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name required", nameof(name));
        if (string.IsNullOrWhiteSpace(payloadJson)) throw new ArgumentException("payload required", nameof(payloadJson));

        var now = DateTimeOffset.UtcNow;
        return new LookupItem
        {
            LookupKey = lookupKey,
            Code = code,
            Name = name,
            IsActive = isActive,
            PayloadJson = payloadJson,
            SortOrder = sortOrder,
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void ReplacePayload(string code, string name, bool isActive, string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("code required", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name required", nameof(name));
        if (string.IsNullOrWhiteSpace(payloadJson)) throw new ArgumentException("payload required", nameof(payloadJson));

        Code = code;
        Name = name;
        IsActive = isActive;
        PayloadJson = payloadJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
