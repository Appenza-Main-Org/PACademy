using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.Applicants;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class ApplicantConfiguration : IEntityTypeConfiguration<Applicant>
{
    public void Configure(EntityTypeBuilder<Applicant> b)
    {
        b.ToTable("applicants");
        b.HasKey(a => a.Id);
        b.Property(a => a.NationalId).HasMaxLength(14).IsRequired();
        b.Property(a => a.FullName).HasMaxLength(300).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC_UTF8");
        b.Property(a => a.Gender).HasMaxLength(10);
        b.Property(a => a.Mobile).HasMaxLength(20);
        b.Property(a => a.Email).HasMaxLength(200);
        b.Property(a => a.Governorate).HasMaxLength(100);
        b.Property(a => a.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(a => a.CreatedAt).IsRequired();
        b.Property(a => a.UpdatedAt).IsRequired();
        b.Property(a => a.Archived).HasDefaultValue(false).IsRequired();
        b.Property(a => a.DemoOrigin).HasDefaultValue(false).IsRequired();

        // FR-016: unique (CycleId, NationalId)
        b.HasIndex(a => new { a.CycleId, a.NationalId })
            .IsUnique()
            .HasDatabaseName("IX_applicants_cycle_national_id");

        b.HasIndex(a => a.Archived)
            .HasFilter("[Archived] = 0")
            .HasDatabaseName("IX_applicants_active");

        b.HasMany(a => a.Submissions)
            .WithOne(s => s.Applicant)
            .HasForeignKey(s => s.ApplicantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
