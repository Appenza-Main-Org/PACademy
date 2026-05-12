using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class ExamDateConfigConfiguration : IEntityTypeConfiguration<ExamDateConfig>
{
    public void Configure(EntityTypeBuilder<ExamDateConfig> b)
    {
        b.ToTable("exam_date_configs");
        b.HasKey(e => e.Id);

        b.Property(e => e.CycleId).IsRequired();
        b.Property(e => e.FirstAvailableDate).IsRequired();
        b.Property(e => e.BookableDaysJson)
            .HasColumnName("BookableDays")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("[]");
        b.Property(e => e.BlackoutDatesJson)
            .HasColumnName("BlackoutDates")
            .HasColumnType("nvarchar(max)")
            .HasDefaultValue("[]");
        b.Property(e => e.UpdatedAt).IsRequired();
        b.Property(e => e.UpdatedBy).IsRequired();
        b.Property(e => e.RowVersion).IsRowVersion();

        b.HasIndex(e => e.CycleId).IsUnique().HasDatabaseName("IX_exam_date_configs_cycle");
    }
}
