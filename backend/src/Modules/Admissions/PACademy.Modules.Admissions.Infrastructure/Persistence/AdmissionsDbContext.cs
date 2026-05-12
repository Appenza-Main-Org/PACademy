using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using PACademy.Modules.Admissions.Application;
using PACademy.Modules.Admissions.Domain;
using PACademy.Shared.Audit.Domain;
using System.Data;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence;

public sealed class AdmissionsDbContext : DbContext, IAdmissionsDbContext
{
    public AdmissionsDbContext(DbContextOptions<AdmissionsDbContext> options) : base(options) { }

    // Original entities
    public DbSet<Applicant> Applicants => Set<Applicant>();
    public DbSet<Cycle> Cycles => Set<Cycle>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<AdmissionRule> AdmissionRules => Set<AdmissionRule>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    // Spec 009 — wizard entities
    public DbSet<WizardStepStatus> WizardStepStatuses => Set<WizardStepStatus>();
    public DbSet<CommitteeMergeSplitRule> CommitteeMergeSplitRules => Set<CommitteeMergeSplitRule>();
    public DbSet<CommitteeScoreThreshold> CommitteeScoreThresholds => Set<CommitteeScoreThreshold>();
    public DbSet<ExamDateConfig> ExamDateConfigs => Set<ExamDateConfig>();
    public DbSet<TotalScoreConfig> TotalScoreConfigs => Set<TotalScoreConfig>();
    public DbSet<ElectronicDeclaration> ElectronicDeclarations => Set<ElectronicDeclaration>();
    public DbSet<CycleExam> CycleExams => Set<CycleExam>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AdmissionsDbContext).Assembly);
    }

    public Task<IDbContextTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken ct = default)
        => Database.BeginTransactionAsync(isolationLevel, ct);

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => base.SaveChangesAsync(cancellationToken);
}
