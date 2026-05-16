using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class ElectronicDeclarationConfiguration
    : IEntityTypeConfiguration<ElectronicDeclaration>
{
    public void Configure(EntityTypeBuilder<ElectronicDeclaration> b)
    {
        b.ToTable("electronic_declarations");
        b.HasKey(d => d.Id);

        b.Property(d => d.CycleId).IsRequired();
        b.Property(d => d.Mode)
            .HasConversion<string>()
            .HasMaxLength(16)
            .IsRequired()
            .HasDefaultValue(DeclarationMode.Text);
        b.Property(d => d.BodyAr)
            .HasColumnType("nvarchar(max)")
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(d => d.DocumentFileName).HasMaxLength(260);
        b.Property(d => d.DocumentRelativeUrl).HasMaxLength(400);
        b.Property(d => d.DocumentSize);
        b.Property(d => d.Version).IsRequired().HasDefaultValue(1);
        b.Property(d => d.EffectiveFrom).IsRequired();
        b.Property(d => d.PublishedAt);
        b.Property(d => d.IsArchived).HasDefaultValue(false);
        b.Property(d => d.CreatedAt).IsRequired();
        b.Property(d => d.CreatedBy).IsRequired();
        b.Property(d => d.RowVersion).IsRowVersion();

        b.HasIndex(d => d.CycleId).HasDatabaseName("IX_electronic_declarations_cycle");
        b.HasIndex(d => new { d.CycleId, d.Version })
            .IsUnique()
            .HasDatabaseName("IX_electronic_declarations_cycle_version");
    }
}
