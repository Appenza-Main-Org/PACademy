using Microsoft.EntityFrameworkCore;
using PACademy.Modules.Grades.Application.Dtos;

namespace PACademy.Modules.Grades.Application.Import;

public sealed class RunImportPreflightUseCase(IGradesDbContext db)
{
    public async Task<ImportReportDto> ExecuteAsync(
        RunImportPreflightRequest req, CancellationToken ct = default)
    {
        var existingNids = await db.GradeRows.Select(r => r.Nid).ToListAsync(ct);
        var existing = new HashSet<string>(existingNids);

        var buckets = new Dictionary<string, List<ImportFailureRowDto>>
        {
            ["DUPLICATE_NID"] = [],
            ["INVALID_NID"] = [],
            ["MISSING_REQUIRED"] = [],
            ["NID_NOT_FOUND"] = [],
            ["GRADE_OUT_OF_RANGE"] = [],
            ["UNREADABLE_VALUE"] = [],
        };

        var imported = 0;
        foreach (var row in req.Rows)
        {
            var fail = new ImportFailureRowDto(
                row.NationalId, row.SeatingNumber, row.NameAr, row.TotalGrade, row.SourceRowIndex, null);

            if (string.IsNullOrWhiteSpace(row.NationalId) || string.IsNullOrWhiteSpace(row.NameAr))
            {
                var missing = string.Join(" · ", new[]
                {
                    string.IsNullOrWhiteSpace(row.NationalId) ? "الرقم القومي" : null,
                    string.IsNullOrWhiteSpace(row.NameAr) ? "الاسم" : null,
                }.Where(x => x is not null));
                buckets["MISSING_REQUIRED"].Add(fail with { Detail = missing });
                continue;
            }

            if (!NationalId.IsValid(row.NationalId))
            {
                buckets["INVALID_NID"].Add(fail with { Detail = "رقم قومي غير صالح" });
                continue;
            }

            if (row.TotalGrade is null)
            {
                buckets["UNREADABLE_VALUE"].Add(fail with { Detail = "تعذّر قراءة المجموع" });
                continue;
            }

            var max = row.MaxGrade;
            if (row.TotalGrade < 0 || (max.HasValue && row.TotalGrade > max.Value))
            {
                buckets["GRADE_OUT_OF_RANGE"].Add(fail with
                {
                    Detail = max.HasValue
                        ? $"المجموع {row.TotalGrade} خارج النطاق (0–{max.Value})"
                        : $"المجموع {row.TotalGrade} سالب",
                });
                continue;
            }

            if (existing.Contains(row.NationalId!))
            {
                buckets["DUPLICATE_NID"].Add(fail with { Detail = "الرقم القومي موجود مسبقًا" });
                continue;
            }

            imported++;
        }

        var groups = new List<ImportReportGroupDto>();
        AddGroup("DUPLICATE_NID", "أرقام قومية مكررة", ["skip", "override", "export"]);
        AddGroup("INVALID_NID", "أرقام قومية غير صالحة", ["skip", "export"]);
        AddGroup("MISSING_REQUIRED", "حقول مطلوبة فارغة", ["skip", "export"]);
        AddGroup("NID_NOT_FOUND", "متقدمون غير مسجلين بالدورة", ["skip", "create-applicant", "export"]);
        AddGroup("GRADE_OUT_OF_RANGE", "مجاميع خارج النطاق", ["skip", "override", "export"]);
        AddGroup("UNREADABLE_VALUE", "قيم غير قابلة للقراءة", ["skip", "export"]);

        var failed = groups.Sum(g => g.Rows.Count);
        return new ImportReportDto(
            new ImportReportTotalsDto(req.Rows.Count, imported, 0, failed),
            groups);

        void AddGroup(string code, string labelAr, IReadOnlyList<string> actions)
        {
            if (buckets[code].Count == 0) return;
            groups.Add(new ImportReportGroupDto(code, labelAr, buckets[code], actions));
        }
    }
}
