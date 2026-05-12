using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class CycleExamConfiguration : IEntityTypeConfiguration<CycleExam>
{
    public void Configure(EntityTypeBuilder<CycleExam> b)
    {
        b.ToTable("cycle_exams");
        b.HasKey(e => e.Id);

        b.Property(e => e.CycleId).IsRequired();
        b.Property(e => e.ExamTypeKey).HasMaxLength(100).IsRequired();
        b.Property(e => e.CategoryId);
        b.Property(e => e.Order).IsRequired();
        b.Property(e => e.IsRequired).HasDefaultValue(false);
        b.Property(e => e.FeeEgp).HasColumnType("decimal(10,2)");
        b.Property(e => e.IsArchived).HasDefaultValue(false);
        b.Property(e => e.CreatedAt).IsRequired();
        b.Property(e => e.CreatedBy).IsRequired();
        b.Property(e => e.UpdatedAt).IsRequired();
        b.Property(e => e.RowVersion).IsRowVersion();

        b.HasIndex(e => e.CycleId).HasDatabaseName("IX_cycle_exams_cycle");
        b.HasIndex(e => new { e.CycleId, e.Order })
            .HasFilter("[IsArchived] = 0")
            .HasDatabaseName("IX_cycle_exams_cycle_order");
    }
}
