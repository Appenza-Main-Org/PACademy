namespace PACademy.Modules.CyclesAdmin.Infrastructure;

public sealed class AdminJsonItem
{
    private AdminJsonItem() { }

    public string Bucket { get; private set; } = default!;
    public string Id { get; private set; } = default!;
    public string PayloadJson { get; private set; } = default!;
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    public static AdminJsonItem Create(string bucket, string id, string payloadJson, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(bucket)) throw new ArgumentException("bucket required", nameof(bucket));
        if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("id required", nameof(id));
        if (string.IsNullOrWhiteSpace(payloadJson)) throw new ArgumentException("payload required", nameof(payloadJson));
        var now = DateTimeOffset.UtcNow;
        return new AdminJsonItem
        {
            Bucket = bucket,
            Id = id,
            PayloadJson = payloadJson,
            SortOrder = sortOrder,
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void ReplacePayload(string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) throw new ArgumentException("payload required", nameof(payloadJson));
        PayloadJson = payloadJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
