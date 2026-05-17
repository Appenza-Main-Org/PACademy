using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Lookups.Domain;

namespace PACademy.Modules.Lookups.Infrastructure.Persistence.Configurations;

public sealed class ApplicantCategorySpecializationConfiguration : IEntityTypeConfiguration<ApplicantCategorySpecialization>
{
    public void Configure(EntityTypeBuilder<ApplicantCategorySpecialization> b)
    {
        b.ToTable("applicant_category_specializations");

        b.HasKey(s => s.Id);

        b.Property(s => s.Id).HasColumnName("id");
        b.Property(s => s.ConfigId).HasColumnName("config_id").IsRequired();
        b.Property(s => s.SpecializationId).HasColumnName("specialization_id").HasMaxLength(64).IsRequired();
        b.Property(s => s.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        b.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();

        b.Property(s => s.RowVersion)
            .HasColumnName("row_version")
            .IsRowVersion();

        b.HasOne<ApplicantCategoryConfig>()
            .WithMany()
            .HasForeignKey(s => s.ConfigId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(s => new { s.ConfigId, s.SpecializationId })
            .HasDatabaseName("UX_AppCatSpec_ConfigSpec")
            .IsUnique();

        b.HasIndex(s => s.SpecializationId)
            .HasDatabaseName("IX_AppCatSpec_Specialization");
    }
}
