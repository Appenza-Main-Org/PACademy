namespace PACademy.Modules.Committees.Domain;

public sealed class CommitteeMember
{
    public Guid CommitteeId { get; private set; }
    public Guid UserId { get; private set; }
    public CommitteeMemberRole Role { get; private set; }
    public DateTime AddedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private CommitteeMember() { }

    internal CommitteeMember(Guid committeeId, Guid userId, CommitteeMemberRole role)
    {
        CommitteeId = committeeId;
        UserId = userId;
        Role = role;
        AddedAt = DateTime.UtcNow;
    }

    internal void SetRole(CommitteeMemberRole role) => Role = role;
}
