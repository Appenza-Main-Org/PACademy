using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Payments.Domain;

namespace PACademy.Modules.Payments.Infrastructure.Persistence.Configurations;

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("payments");

        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");

        b.Property(x => x.ApplicantId).HasColumnName("applicant_id");
        b.Property(x => x.ApplicantName)
            .HasColumnName("applicant_name")
            .HasMaxLength(200)
            .IsRequired();
        b.Property(x => x.NationalId)
            .HasColumnName("national_id")
            .HasMaxLength(14)
            .IsRequired();
        b.Property(x => x.CycleId).HasColumnName("cycle_id");
        b.Property(x => x.FawryReference)
            .HasColumnName("fawry_reference")
            .HasMaxLength(64)
            .IsRequired();
        b.Property(x => x.Amount)
            .HasColumnName("amount")
            .HasColumnType("decimal(18,2)");
        b.Property(x => x.Status)
            .HasColumnName("status")
            .HasConversion<int>();
        b.Property(x => x.LastSyncAt).HasColumnName("last_sync_at");
        b.Property(x => x.PaidAt).HasColumnName("paid_at");

        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.CreatedBy).HasColumnName("created_by");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Property(x => x.UpdatedBy).HasColumnName("updated_by");

        b.Property(x => x.RowVersion)
            .HasColumnName("row_version")
            .IsRowVersion();

        b.Property(x => x.DemoOrigin).HasColumnName("demo_origin");

        b.HasIndex(x => x.FawryReference)
            .IsUnique()
            .HasDatabaseName("UX_Payment_FawryReference");

        b.HasIndex(x => new { x.CycleId, x.Status })
            .HasDatabaseName("IX_Payment_Cycle_Status");

        b.HasIndex(x => x.ApplicantId)
            .HasDatabaseName("IX_Payment_Applicant");
    }
}
