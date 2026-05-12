using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeSpecializationConfiguration : IEntityTypeConfiguration<CommitteeSpecialization>
{
    public void Configure(EntityTypeBuilder<CommitteeSpecialization> b)
    {
        b.ToTable("committee_specializations");
        b.HasKey(x => new { x.CommitteeId, x.SpecializationKey });
        b.Property(x => x.SpecializationKey).HasMaxLength(64);
    }
}
