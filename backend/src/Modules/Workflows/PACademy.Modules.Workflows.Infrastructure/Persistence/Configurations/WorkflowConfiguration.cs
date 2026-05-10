using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Workflows.Domain;

namespace PACademy.Modules.Workflows.Infrastructure.Persistence.Configurations;

internal sealed class WorkflowConfiguration : IEntityTypeConfiguration<Workflow>
{
    public void Configure(EntityTypeBuilder<Workflow> b)
    {
        b.ToTable("workflows");
        b.HasKey(w => w.Id);
        b.Property(w => w.Name).HasMaxLength(200).IsRequired()
            .UseCollation("Arabic_100_CI_AS_SC");
        b.Property(w => w.Description).HasMaxLength(1000);
        b.Property(w => w.StepsJson).HasColumnType("nvarchar(max)");
        b.Property(w => w.IsActive).IsRequired();
        b.Property(w => w.CreatedAt).IsRequired();
        b.Property(w => w.UpdatedAt).IsRequired();
        b.Property(w => w.Archived).HasDefaultValue(false).IsRequired();
        b.Property(w => w.DemoOrigin).HasDefaultValue(false).IsRequired();
    }
}
