namespace PACademy.Shared.Domain.Lookups;

/// <summary>
/// Egyptian university faculty (الكليات).
///
/// Source of truth for both backends. Mutating factory + behaviour methods
/// are <c>internal</c> so only the admin backend (which has friend access
/// via <c>InternalsVisibleTo</c> if needed) can call them.
/// </summary>
public sealed class Faculty
{
    private Faculty() { }

    public string Code { get; private set; } = default!;     // FAC-01 ..
    public string Name { get; private set; } = default!;     // Arabic display name
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    public static Faculty Create(string code, string name)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("code required", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name required", nameof(name));
        var now = DateTimeOffset.UtcNow;
        return new Faculty
        {
            Code = code,
            Name = name,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            /* InMemory provider doesn't auto-populate IsRowVersion fields the
             * way SqlServer does; seed with an empty byte[] so the
             * non-nullable contract holds. SqlServer will overwrite. */
            RowVersion = [],
        };
    }

    public void Rename(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName)) throw new ArgumentException("name required", nameof(newName));
        Name = newName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
