using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Identity;

namespace PACademy.Shared.Persistence.Identity;

/// <summary>
/// EF Core fluent configuration for the <see cref="Applicant"/> entity.
/// Same shared-DB row both backends read/write; admin module owns DDL.
/// </summary>
public sealed class ApplicantConfiguration : IEntityTypeConfiguration<Applicant>
{
    public void Configure(EntityTypeBuilder<Applicant> b)
    {
        b.ToTable("applicants");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.NationalId)
            .HasColumnName("national_id").HasMaxLength(14).IsRequired();
        b.Property(x => x.PhoneNumber)
            .HasColumnName("phone_number").HasMaxLength(11).IsRequired();
        b.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200);
        b.Property(x => x.Email).HasColumnName("email").HasMaxLength(200);
        b.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(16);
        b.Property(x => x.Religion).HasColumnName("religion").HasMaxLength(16);
        b.Property(x => x.DateOfBirth).HasColumnName("date_of_birth");
        b.Property(x => x.BirthGovernorate).HasColumnName("birth_governorate").HasMaxLength(120);
        b.Property(x => x.BirthDistrict).HasColumnName("birth_district").HasMaxLength(120);
        b.Property(x => x.Source).HasColumnName("source").HasMaxLength(16).IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();

        // Auth lookup uses national_id; enforce uniqueness here.
        b.HasIndex(x => x.NationalId).IsUnique().HasDatabaseName("UX_applicants_national_id");
    }
}
