using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeMemberConfiguration : IEntityTypeConfiguration<CommitteeMember>
{
    public void Configure(EntityTypeBuilder<CommitteeMember> b)
    {
        b.ToTable("committee_members");
        b.HasKey(x => new { x.CommitteeId, x.UserId });
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.RowVersion).IsRowVersion();
    }
}
