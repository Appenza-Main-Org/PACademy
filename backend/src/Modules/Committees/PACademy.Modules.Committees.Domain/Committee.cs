namespace PACademy.Modules.Committees.Domain;

public sealed class Committee
{
    public Guid Id { get; private set; }
    public Guid CycleId { get; private set; }
    public string Key { get; private set; } = string.Empty;
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public Guid? ChairUserId { get; private set; }
    public int DailyCapacity { get; private set; }
    public CommitteeStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }
    public string? DeleteReason { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private readonly List<CommitteeMember> _members = [];
    public IReadOnlyList<CommitteeMember> Members => _members;

    private readonly List<CommitteeSpecialization> _specializations = [];
    public IReadOnlyList<CommitteeSpecialization> Specializations => _specializations;

    private readonly List<CommitteeDateBinding> _dateBindings = [];
    public IReadOnlyList<CommitteeDateBinding> DateBindings => _dateBindings;

    private Committee() { }

    public static Committee Create(
        Guid cycleId,
        string key,
        string nameAr,
        string? nameEn,
        Guid? chairUserId,
        int dailyCapacity,
        IReadOnlyList<string> specializations,
        Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(key)) throw new ArgumentException("المفتاح مطلوب");
        if (string.IsNullOrWhiteSpace(nameAr)) throw new ArgumentException("الاسم العربي مطلوب");
        if (dailyCapacity < 1) throw new ArgumentException("الطاقة الاستيعابية يجب أن تكون 1 على الأقل");

        var now = DateTime.UtcNow;
        var committee = new Committee
        {
            Id = Guid.NewGuid(),
            CycleId = cycleId,
            Key = key,
            NameAr = nameAr,
            NameEn = nameEn,
            ChairUserId = chairUserId,
            DailyCapacity = dailyCapacity,
            Status = CommitteeStatus.Active,
            CreatedAt = now,
            CreatedBy = createdBy,
        };

        foreach (var spec in specializations)
            committee._specializations.Add(new CommitteeSpecialization(committee.Id, spec));

        return committee;
    }

    public void Update(
        string nameAr,
        string? nameEn,
        Guid? chairUserId,
        int dailyCapacity,
        CommitteeStatus? status)
    {
        if (!string.IsNullOrWhiteSpace(nameAr)) NameAr = nameAr;
        NameEn = nameEn;
        ChairUserId = chairUserId;
        if (dailyCapacity >= 1) DailyCapacity = dailyCapacity;
        if (status.HasValue) Status = status.Value;
    }

    public CommitteeMember AddMember(Guid userId, CommitteeMemberRole role)
    {
        if (_members.Any(m => m.UserId == userId))
            throw new InvalidOperationException("المستخدم عضو بالفعل في هذه اللجنة");
        if (role == CommitteeMemberRole.Chair)
            SwapChairInternal(userId);
        var member = new CommitteeMember(Id, userId, role);
        _members.Add(member);
        return member;
    }

    public void RemoveMember(Guid userId)
    {
        var member = _members.FirstOrDefault(m => m.UserId == userId)
            ?? throw new InvalidOperationException("العضو غير موجود في هذه اللجنة");
        _members.Remove(member);
    }

    public void SwapChair(Guid newChairUserId)
    {
        SwapChairInternal(newChairUserId);
        ChairUserId = newChairUserId;
    }

    private void SwapChairInternal(Guid newChairUserId)
    {
        var oldChair = _members.FirstOrDefault(m => m.Role == CommitteeMemberRole.Chair);
        if (oldChair is not null) oldChair.SetRole(CommitteeMemberRole.Member);
        var newChair = _members.FirstOrDefault(m => m.UserId == newChairUserId);
        if (newChair is not null) newChair.SetRole(CommitteeMemberRole.Chair);
        ChairUserId = newChairUserId;
    }

    public void Archive(Guid deletedBy, string? reason)
    {
        if (Status == CommitteeStatus.Archived)
            throw new InvalidOperationException("اللجنة مؤرشفة بالفعل");
        Status = CommitteeStatus.Archived;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
        DeleteReason = reason;
    }

    public void Restore()
    {
        if (Status != CommitteeStatus.Archived)
            throw new InvalidOperationException("اللجنة غير مؤرشفة");
        Status = CommitteeStatus.Active;
        DeletedAt = null;
        DeletedBy = null;
        DeleteReason = null;
    }
}
