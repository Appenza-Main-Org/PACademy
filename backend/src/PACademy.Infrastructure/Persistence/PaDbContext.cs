using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PACademy.Application.Common;
using PACademy.Domain.AdmissionRules;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Domain.Categories;
using PACademy.Domain.Common;
using PACademy.Domain.Cycles;
using PACademy.Domain.ReferenceData;
using PACademy.Domain.Sessions;
using PACademy.Domain.Workflows;
using PACademy.Infrastructure.Identity;

namespace PACademy.Infrastructure.Persistence;

public sealed class PaDbContext(
    DbContextOptions<PaDbContext> options,
    ICurrentUser currentUser)
    : IdentityDbContext<SystemUser, IdentityRole<Guid>, Guid>(options),
      IPaDbContext
{
    public DbSet<Applicant> Applicants => Set<Applicant>();
    public DbSet<ApplicantStageSubmission> ApplicantStageSubmissions => Set<ApplicantStageSubmission>();
    public DbSet<Cycle> Cycles => Set<Cycle>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<AdmissionRule> AdmissionRules => Set<AdmissionRule>();
    public DbSet<ReferenceDataEntry> ReferenceDataEntries => Set<ReferenceDataEntry>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(PaDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        HandleSoftDeletes();
        EmitAuditEntries();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void HandleSoftDeletes()
    {
        var utcNow = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ISoftDeletable>()
            .Where(e => e.State == EntityState.Deleted))
        {
            entry.State = EntityState.Modified;
            entry.Entity.GetType().GetProperty("Archived")?.SetValue(entry.Entity, true);
            entry.Entity.GetType().GetProperty("ArchivedAt")?.SetValue(entry.Entity, utcNow);
        }
    }

    private void EmitAuditEntries()
    {
        if (!currentUser.IsAuthenticated) return;

        var auditableChanges = ChangeTracker.Entries<IAuditableWrite>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        foreach (var entry in auditableChanges)
        {
            // Skip AuditEntry itself to avoid recursion
            if (entry.Entity is AuditEntry) continue;

            var action = entry.State switch
            {
                EntityState.Added => AuditAction.Create,
                EntityState.Modified => AuditAction.Update,
                EntityState.Deleted => AuditAction.Delete,
                _ => AuditAction.Update,
            };

            string? beforeJson = null;
            string? afterJson = null;

            if (entry.State == EntityState.Modified)
            {
                var before = new Dictionary<string, object?>();
                var after = new Dictionary<string, object?>();
                foreach (var prop in entry.Properties.Where(p => p.IsModified))
                {
                    before[prop.Metadata.Name] = prop.OriginalValue;
                    after[prop.Metadata.Name] = prop.CurrentValue;
                }
                beforeJson = System.Text.Json.JsonSerializer.Serialize(before);
                afterJson = System.Text.Json.JsonSerializer.Serialize(after);
            }

            var auditEntry = AuditEntry.Create(
                actorId: currentUser.Id,
                actorName: currentUser.Name,
                actorIp: currentUser.IpAddress,
                action: action,
                targetType: entry.Entity.GetType().Name,
                targetId: GetEntityId(entry.Entity),
                targetLabel: GetEntityLabel(entry.Entity),
                outcome: AuditOutcome.Success,
                beforeJson: beforeJson,
                afterJson: afterJson);

            AuditEntries.Add(auditEntry);
        }
    }

    private static Guid GetEntityId(object entity)
    {
        var idProp = entity.GetType().GetProperty("Id");
        return idProp?.GetValue(entity) is Guid id ? id : Guid.Empty;
    }

    private static string GetEntityLabel(object entity)
    {
        foreach (var name in new[] { "FullName", "Name", "Key", "NationalId", "NameAr" })
        {
            var val = entity.GetType().GetProperty(name)?.GetValue(entity)?.ToString();
            if (!string.IsNullOrEmpty(val)) return val;
        }
        return entity.GetType().Name;
    }
}
