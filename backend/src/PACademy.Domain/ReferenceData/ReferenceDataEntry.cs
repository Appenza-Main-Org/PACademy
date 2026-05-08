using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.ReferenceData;

public sealed class ReferenceDataEntry : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string Category { get; private set; } = string.Empty;
    public string Key { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string? Metadata { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private ReferenceDataEntry() { }

    public static ReferenceDataEntry Create(
        string category,
        string key,
        string nameAr,
        bool demoOrigin = false)
    {
        return new ReferenceDataEntry
        {
            Id = Guid.NewGuid(),
            Category = category,
            Key = key,
            NameAr = nameAr,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }
}
