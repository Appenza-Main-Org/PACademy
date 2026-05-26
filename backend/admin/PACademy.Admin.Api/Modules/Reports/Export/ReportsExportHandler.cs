using System.Text;
using PACademy.Admin.Api.Modules.Reports.Dtos;
using PACademy.Admin.Api.Modules.Reports.Queries;

namespace PACademy.Admin.Api.Modules.Reports.Export;

public sealed class ReportsExportHandler(ReportsQueryService queries)
{
    public async Task<(byte[] Bytes, string ContentType, string FileName)> ExportAsync(ReportsExportRequest request, CancellationToken ct)
    {
        var rows = await queries.ExportRowsAsync(request.Filters, request.Report, ct);
        var stamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss");
        var title = string.IsNullOrWhiteSpace(request.Title) ? "reports" : request.Title;
        return request.Format.ToLowerInvariant() switch
        {
            "csv" => (Csv(rows), "text/csv; charset=utf-8", $"reports-{request.Report}-{stamp}.csv"),
            "xlsx" => (HtmlTable(title, rows), "application/vnd.ms-excel", $"reports-{request.Report}-{stamp}.xls"),
            "docx" => (HtmlTable(title, rows), "application/msword", $"reports-{request.Report}-{stamp}.doc"),
            "pdf" => (HtmlTable(title, rows), "text/html; charset=utf-8", $"reports-{request.Report}-{stamp}.html"),
            _ => (Csv(rows), "text/csv; charset=utf-8", $"reports-{request.Report}-{stamp}.csv")
        };
    }

    private static byte[] Csv(IReadOnlyList<ApplicantReportRowDto> rows)
    {
        var sb = new StringBuilder();
        sb.Append('\uFEFF');
        sb.AppendLine("nationalId,nameAr,gender,age,category,applicantType,specialization,committee,currentStage,paymentStatus,submittedAt");
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(",", [
                Escape(row.NationalId),
                Escape(row.NameAr),
                Escape(row.Gender),
                row.Age?.ToString() ?? "",
                Escape(row.CategoryLabelAr),
                Escape(row.ApplicantTypeLabelAr),
                Escape(row.SpecializationLabelAr),
                Escape(row.CommitteeLabelAr),
                row.CurrentStage.ToString(),
                Escape(row.PaymentStatus),
                row.SubmittedAt.ToString("O")
            ]));
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static byte[] HtmlTable(string title, IReadOnlyList<ApplicantReportRowDto> rows)
    {
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"><style>body{font-family:Arial,sans-serif;direction:rtl}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px;text-align:right}</style></head><body>");
        sb.Append("<h1>").Append(System.Net.WebUtility.HtmlEncode(title)).Append("</h1>");
        sb.Append("<table><thead><tr><th>الرقم القومي</th><th>الاسم</th><th>الجنس</th><th>السن</th><th>الفئة</th><th>التخصص</th><th>اللجنة</th><th>المرحلة</th><th>الدفع</th></tr></thead><tbody>");
        foreach (var row in rows)
        {
            sb.Append("<tr><td>").Append(System.Net.WebUtility.HtmlEncode(row.NationalId))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.NameAr))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.Gender))
                .Append("</td><td>").Append(row.Age)
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.CategoryLabelAr))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.SpecializationLabelAr))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.CommitteeLabelAr))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.CurrentStageLabelAr))
                .Append("</td><td>").Append(System.Net.WebUtility.HtmlEncode(row.PaymentStatus))
                .Append("</td></tr>");
        }
        sb.Append("</tbody></table></body></html>");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string Escape(string value)
    {
        var escaped = value.Replace("\"", "\"\"");
        return escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n') ? $"\"{escaped}\"" : escaped;
    }
}
