using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class WizardStepStatusConfiguration : IEntityTypeConfiguration<WizardStepStatus>
{
    public void Configure(EntityTypeBuilder<WizardStepStatus> b)
    {
        b.ToTable("wizard_step_statuses");
        b.HasKey(w => new { w.CycleId, w.StepKey });

        b.Property(w => w.CycleId).IsRequired();
        b.Property(w => w.StepKey).HasMaxLength(64).IsRequired();
        b.Property(w => w.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired()
            .HasDefaultValue(WizardStepStatusValue.NotStarted);
        b.Property(w => w.CompletedAt);
        b.Property(w => w.CompletedBy);
        b.Property(w => w.UpdatedAt).IsRequired();
        b.Property(w => w.RowVersion).IsRowVersion();

        b.HasIndex(w => w.CycleId).HasDatabaseName("IX_wizard_step_statuses_cycle");
    }
}
