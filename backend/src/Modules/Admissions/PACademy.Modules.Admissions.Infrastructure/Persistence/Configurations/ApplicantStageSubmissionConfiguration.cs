using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Modules.Admissions.Domain;

namespace PACademy.Modules.Admissions.Infrastructure.Persistence.Configurations;

internal sealed class ApplicantStageSubmissionConfiguration : IEntityTypeConfiguration<ApplicantStageSubmission>
{
    public void Configure(EntityTypeBuilder<ApplicantStageSubmission> b)
    {
        b.ToTable("applicant_stage_submissions");
        b.HasKey(s => s.Id);
        b.Property(s => s.StageNumber).IsRequired();
        b.Property(s => s.DataJson).HasColumnType("nvarchar(max)");
        b.Property(s => s.SubmittedAt).IsRequired();
    }
}
