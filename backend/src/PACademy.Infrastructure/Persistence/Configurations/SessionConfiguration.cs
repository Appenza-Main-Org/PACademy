using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.Sessions;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> b)
    {
        b.ToTable("sessions");
        b.HasKey(s => s.Id);
        b.Property(s => s.UserId).IsRequired();
        b.Property(s => s.IpAddress).HasMaxLength(45).IsRequired();
        b.Property(s => s.UserAgent).HasMaxLength(500).IsRequired();
        b.Property(s => s.CreatedAt).IsRequired();
        b.Property(s => s.LastSeenAt).IsRequired();
        b.Property(s => s.RevokedReason).HasMaxLength(200);

        b.HasIndex(s => s.UserId).HasDatabaseName("IX_sessions_user_id");
        b.HasIndex(s => s.RevokedAt).HasDatabaseName("IX_sessions_revoked_at");
    }
}
