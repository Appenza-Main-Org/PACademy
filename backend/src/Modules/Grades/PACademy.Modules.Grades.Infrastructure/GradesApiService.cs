using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Infrastructure.Persistence;
using PACademy.Modules.Grades.Public;

namespace PACademy.Modules.Grades.Infrastructure;

internal sealed class GradesApiService(GradesDbContext db) : IGradeApi
{
    public Task<int> CountByNidAsync(string nid, CancellationToken ct = default)
        => db.GradeRows.CountAsync(r => r.Nid == nid, ct);

    public Task<int> TotalCountAsync(CancellationToken ct = default)
        => db.GradeRows.CountAsync(ct);
}
