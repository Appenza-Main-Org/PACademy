using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Notifications.Domain;

namespace PACademy.Modules.Notifications.Infrastructure.Persistence.Configurations;

internal sealed class NotificationTemplateConfiguration : IEntityTypeConfiguration<NotificationTemplate>
{
    public void Configure(EntityTypeBuilder<NotificationTemplate> b)
    {
        b.ToTable("notification_templates");
        b.HasKey(x => x.Id);
        b.Property(x => x.TriggerEvent).HasConversion<string>().HasMaxLength(64);
        b.Property(x => x.SubjectAr).HasMaxLength(200).IsRequired();
        b.Property(x => x.BodyAr).IsRequired();
        b.Property(x => x.Channel).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.DeleteReason).HasMaxLength(500);
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.CycleId, x.TriggerEvent })
            .HasDatabaseName("IX_templates_cycle_event");
    }
}
