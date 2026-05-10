using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Identity.Domain;

namespace PACademy.Modules.Identity.Infrastructure.Persistence.Configurations;

internal sealed class SystemUserConfiguration : IEntityTypeConfiguration<SystemUser>
{
    public void Configure(EntityTypeBuilder<SystemUser> b)
    {
        b.ToTable("system_users");

        b.Property(u => u.OfficerCode).HasMaxLength(32).IsRequired();
        b.Property(u => u.FullName).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(u => u.Mobile).HasMaxLength(20).IsRequired();
        b.Property(u => u.CardFactoryNumber).HasMaxLength(32).IsRequired();
        b.Property(u => u.Role).HasMaxLength(64).IsRequired();
        b.Property(u => u.Unit).HasMaxLength(200);
        b.Property(u => u.IssueDate).IsRequired();
        b.Property(u => u.IsActive).IsRequired();
        b.Property(u => u.Archived).IsRequired().HasDefaultValue(false);
        b.Property(u => u.DemoOrigin).IsRequired().HasDefaultValue(false);
        b.Property(u => u.CreatedAt).IsRequired();

        // FR-029 unique constraints on active rows only
        b.HasIndex(u => u.UserName)
            .HasFilter("[Archived] = 0")
            .IsUnique()
            .HasDatabaseName("IX_system_users_national_id_active");

        b.HasIndex(u => u.OfficerCode)
            .HasFilter("[Archived] = 0")
            .IsUnique()
            .HasDatabaseName("IX_system_users_officer_code_active");

        b.HasIndex(u => u.Email)
            .HasFilter("[Archived] = 0")
            .IsUnique()
            .HasDatabaseName("IX_system_users_email_active");

        b.HasIndex(u => u.Mobile)
            .HasFilter("[Archived] = 0 AND [Mobile] IS NOT NULL")
            .IsUnique()
            .HasDatabaseName("IX_system_users_mobile_active");

        b.HasIndex(u => u.CardFactoryNumber)
            .HasFilter("[Archived] = 0")
            .IsUnique()
            .HasDatabaseName("IX_system_users_card_factory_active");
    }
}
