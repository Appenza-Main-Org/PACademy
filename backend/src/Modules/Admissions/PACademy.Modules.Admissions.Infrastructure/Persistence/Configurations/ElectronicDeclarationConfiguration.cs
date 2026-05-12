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
        b.Property(d => d.BodyAr)
            .HasColumnType("nvarchar(max)")
            .IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
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
