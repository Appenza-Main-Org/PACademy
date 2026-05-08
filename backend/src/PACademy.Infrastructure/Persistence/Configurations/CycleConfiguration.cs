using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Domain.Cycles;

namespace PACademy.Infrastructure.Persistence.Configurations;

internal sealed class CycleConfiguration : IEntityTypeConfiguration<Cycle>
{
    public void Configure(EntityTypeBuilder<Cycle> b)
    {
        b.ToTable("cycles");
        b.HasKey(c => c.Id);
        b.Property(c => c.Name).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC_UTF8");
        b.Property(c => c.Description).HasMaxLength(1000);
        b.Property(c => c.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(c => c.CreatedAt).IsRequired();
        b.Property(c => c.UpdatedAt).IsRequired();
        b.Property(c => c.Archived).HasDefaultValue(false).IsRequired();
        b.Property(c => c.DemoOrigin).HasDefaultValue(false).IsRequired();

        b.HasIndex(c => c.Archived)
            .HasFilter("[Archived] = 0")
            .HasDatabaseName("IX_cycles_active");
    }
}
