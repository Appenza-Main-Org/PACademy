using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Shared.Persistence.Lookups;

/// <summary>
/// EF Core fluent configuration for the <see cref="Faculty"/> entity.
/// Both backends apply this — the table shape is identical, the difference
/// is just whether <see cref="DbContext"/> exposes <c>DbSet</c> (admin) or
/// <c>IQueryable</c> (applicant).
/// </summary>
public sealed class FacultyConfiguration : IEntityTypeConfiguration<Faculty>
{
    public void Configure(EntityTypeBuilder<Faculty> b)
    {
        b.ToTable("faculties");
        b.HasKey(x => x.Code);

        b.Property(x => x.Code).HasColumnName("code").HasMaxLength(16).IsRequired();
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
        b.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
    }
}
