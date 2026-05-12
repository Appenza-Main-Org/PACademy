using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Committees.Domain;

namespace PACademy.Modules.Committees.Infrastructure.Persistence.Configurations;

internal sealed class CommitteeDateBindingConfiguration : IEntityTypeConfiguration<CommitteeDateBinding>
{
    public void Configure(EntityTypeBuilder<CommitteeDateBinding> b)
    {
        b.ToTable("committee_date_bindings");
        b.HasKey(x => new { x.CommitteeId, x.BoundDate });
        b.Property(x => x.RowVersion).IsRowVersion();
    }
}
