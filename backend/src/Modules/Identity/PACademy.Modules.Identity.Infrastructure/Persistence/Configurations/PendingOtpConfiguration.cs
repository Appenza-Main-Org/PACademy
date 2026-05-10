using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Infrastructure.Persistence.Configurations;

internal sealed class PendingOtpConfiguration : IEntityTypeConfiguration<PendingOtp>
{
    public void Configure(EntityTypeBuilder<PendingOtp> b)
    {
        b.ToTable("pending_otps");
        b.HasKey(p => p.Id);

        b.Property(p => p.UserId).IsRequired();
        b.Property(p => p.CodeHash).HasMaxLength(128).IsRequired();
        b.Property(p => p.MaskedPhoneTail).HasMaxLength(20).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(p => p.ExpiresAt).IsRequired();
        b.Property(p => p.AttemptCount).IsRequired().HasDefaultValue(0);
        b.Property(p => p.CreatedAt).IsRequired();
        b.Property(p => p.ConsumedAt);

        b.HasOne<SystemUser>()
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(p => p.UserId)
            .HasFilter("[ConsumedAt] IS NULL")
            .HasDatabaseName("IX_pending_otps_user_id_active");

        b.HasIndex(p => p.ExpiresAt)
            .HasDatabaseName("IX_pending_otps_expires_at");
    }
}
