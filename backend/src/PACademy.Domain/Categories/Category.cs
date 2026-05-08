using PACademy.Domain.Audit;
using PACademy.Domain.Common;

namespace PACademy.Domain.Categories;

public sealed class Category : AggregateRoot<Guid>, IAuditableWrite, ISoftDeletable
{
    public string Key { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string? Description { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool Archived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public bool DemoOrigin { get; private set; }

    private Category() { }

    public static Category Create(string key, string nameAr, Guid createdBy, bool demoOrigin = false)
    {
        return new Category
        {
            Id = Guid.NewGuid(),
            Key = key,
            NameAr = nameAr,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DemoOrigin = demoOrigin,
        };
    }
}
