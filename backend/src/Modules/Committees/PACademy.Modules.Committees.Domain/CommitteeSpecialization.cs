namespace PACademy.Modules.Committees.Domain;

public sealed class CommitteeSpecialization
{
    public Guid CommitteeId { get; private set; }
    public string SpecializationKey { get; private set; } = string.Empty;

    private CommitteeSpecialization() { }

    internal CommitteeSpecialization(Guid committeeId, string specializationKey)
    {
        CommitteeId = committeeId;
        SpecializationKey = specializationKey;
    }
}
