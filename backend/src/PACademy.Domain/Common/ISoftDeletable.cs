namespace PACademy.Domain.Common;

public interface ISoftDeletable
{
    bool Archived { get; }
    DateTime? ArchivedAt { get; }
}
