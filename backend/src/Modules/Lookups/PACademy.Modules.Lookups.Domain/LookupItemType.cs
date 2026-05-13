namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Closed-extension type registry row. Seeded at migration time; never written via API.
/// `Code` is the primary key (string, e.g., "RELATIONSHIPS", "FACULTIES").
/// </summary>
public sealed class LookupItemType
{
    private LookupItemType() { }

    public string Code { get; private set; } = string.Empty;
    public string LabelAr { get; private set; } = string.Empty;
    public string CodePrefix { get; private set; } = string.Empty;
    public byte Padding { get; private set; }
    public bool IsHierarchical { get; private set; }
    public bool HasDates { get; private set; }
    public bool HasExtras { get; private set; }
    public string SectionKey { get; private set; } = string.Empty;
    public short SortInSection { get; private set; }
    public bool IsAdminUi { get; private set; }

    public static LookupItemType Create(
        string code,
        string labelAr,
        string codePrefix,
        byte padding,
        bool isHierarchical,
        bool hasDates,
        bool hasExtras,
        string sectionKey,
        short sortInSection,
        bool isAdminUi)
    {
        return new LookupItemType
        {
            Code = code,
            LabelAr = labelAr,
            CodePrefix = codePrefix,
            Padding = padding,
            IsHierarchical = isHierarchical,
            HasDates = hasDates,
            HasExtras = hasExtras,
            SectionKey = sectionKey,
            SortInSection = sortInSection,
            IsAdminUi = isAdminUi,
        };
    }
}
