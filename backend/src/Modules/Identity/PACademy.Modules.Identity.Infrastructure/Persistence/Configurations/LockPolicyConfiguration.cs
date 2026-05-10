using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Infrastructure.Persistence.Configurations;

internal sealed class LockPolicyConfiguration : IEntityTypeConfiguration<LockPolicy>
{
    public void Configure(EntityTypeBuilder<LockPolicy> b)
    {
        b.ToTable("lock_policy");
        b.HasKey(p => p.Id);

        b.Property(p => p.Id).ValueGeneratedNever();
        b.Property(p => p.MaxFailedAttempts).IsRequired();
        b.Property(p => p.LockDurationMinutes).IsRequired();
        b.Property(p => p.UpdatedAt).IsRequired();
        b.Property(p => p.UpdatedBy);
        b.Property(p => p.DemoOrigin).IsRequired().HasDefaultValue(false);

        b.ToTable(t => t.HasCheckConstraint("CK_lock_policy_single_row", "[Id] = 1"));

        b.HasOne<SystemUser>()
            .WithMany()
            .HasForeignKey(p => p.UpdatedBy)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);
    }
}
