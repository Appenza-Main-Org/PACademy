using PACademy.Modules.Committees.Application.Dtos;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Application.Committees;

internal static class CommitteeMapper
{
    internal static CommitteeDto ToDto(Committee c) => new(
        c.Id,
        c.CycleId,
        c.Key,
        c.NameAr,
        c.NameEn,
        c.ChairUserId,
        c.DailyCapacity,
        c.Status.ToString().ToLowerInvariant(),
        c.Members.Select(m => new CommitteeMemberDto(m.UserId, m.Role.ToString().ToLowerInvariant(), m.AddedAt)).ToList(),
        c.Specializations.Select(s => s.SpecializationKey).ToList(),
        Convert.ToBase64String(c.RowVersion));

    internal static CommitteeDateBindingDto ToDto(CommitteeDateBinding b) => new(
        b.CommitteeId,
        b.BoundDate.ToString("yyyy-MM-dd"),
        b.Capacity,
        Convert.ToBase64String(b.RowVersion));
}
