namespace PACademy.Modules.Committees.Domain;

public sealed class CommitteeDateBinding
{
    public Guid CommitteeId { get; private set; }
    public DateOnly BoundDate { get; private set; }
    public int Capacity { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private CommitteeDateBinding() { }

    public static CommitteeDateBinding Create(Guid committeeId, DateOnly boundDate, int capacity)
    {
        if (capacity < 0) throw new ArgumentException("الطاقة الاستيعابية يجب أن تكون صفراً أو أكثر");
        return new CommitteeDateBinding
        {
            CommitteeId = committeeId,
            BoundDate = boundDate,
            Capacity = capacity,
        };
    }

    public void UpdateCapacity(int capacity)
    {
        if (capacity < 0) throw new ArgumentException("الطاقة الاستيعابية يجب أن تكون صفراً أو أكثر");
        Capacity = capacity;
    }
}
