using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Infrastructure.Persistence.Configurations;

internal sealed class LockoutStateConfiguration : IEntityTypeConfiguration<LockoutState>
{
    public void Configure(EntityTypeBuilder<LockoutState> b)
    {
        b.ToTable("lockout_states");
        b.HasKey(l => l.UserId);

        b.Property(l => l.UserId).IsRequired();
        b.Property(l => l.LockedAt).IsRequired();
        b.Property(l => l.UnlocksAt).IsRequired();
        b.Property(l => l.Reason).HasMaxLength(100).IsRequired();
        b.Property(l => l.FailedAttemptCount).IsRequired();

        b.HasOne<SystemUser>()
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(l => l.UnlocksAt)
            .HasDatabaseName("IX_lockout_states_unlocks_at");
    }
}
