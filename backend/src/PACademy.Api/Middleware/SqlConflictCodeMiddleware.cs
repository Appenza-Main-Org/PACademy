using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts;

namespace PACademy.Api.Middleware;

/// <summary>
/// Translates SQL Server trigger / constraint errors into typed
/// <see cref="DomainConflictException"/> so the existing 422 path on
/// <see cref="GlobalExceptionMiddleware"/> can surface them with the
/// right conflict code.
///
/// Mappings (spec 010 / docs/DB_CONSTRAINTS.md §10):
///   51200 → CIRCULAR_HIERARCHY        51230 → UNKNOWN_TARGET
///   51210 → PARENT_HAS_CHILDREN       51240 → UNKNOWN_FACULTY
///   51220 → IN_USE
///   547   CK_LookupItem_NotSelfParent → SELF_PARENT
///   547   CK_LookupItem_DateRange     → INVALID_DATE_RANGE
///   2601/2627 UX_LookupItem_TypeCode_Code → DUPLICATE_CODE
///   2601/2627 PK_Category*                → DUPLICATE_MAPPING
///
/// Registered between GlobalExceptionMiddleware and
/// DbUpdateConcurrencyExceptionMiddleware so the global handler
/// catches the thrown DomainConflictException.
/// </summary>
internal sealed class SqlConflictCodeMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DbUpdateException dux) when (TryMap(dux, out var conflict))
        {
            throw conflict;
        }
    }

    private static bool TryMap(DbUpdateException dux, out DomainConflictException conflict)
    {
        conflict = null!;
        var sql = FindSqlException(dux);
        if (sql is null) return false;

        var (code, message) = ResolveConflict(sql);
        if (code is null) return false;

        conflict = new DomainConflictException(message, code);
        return true;
    }

    private static SqlException? FindSqlException(Exception? ex)
    {
        while (ex is not null)
        {
            if (ex is SqlException sql) return sql;
            ex = ex.InnerException;
        }
        return null;
    }

    private static (string? code, string message) ResolveConflict(SqlException sql)
    {
        foreach (SqlError err in sql.Errors)
        {
            switch (err.Number)
            {
                case 51200: return ("CIRCULAR_HIERARCHY",  "العلاقة الأبوية تخلق دورة في الشجرة");
                case 51210: return ("PARENT_HAS_CHILDREN", "لا يمكن حذف السجل — يحتوي على عناصر فرعية نشطة");
                case 51220: return ("IN_USE",              "لا يمكن حذف السجل — مستخدم في سجلات أخرى");
                case 51230: return ("UNKNOWN_TARGET",      "أحد طرفي الربط غير موجود أو غير نشط");
                case 51240: return ("UNKNOWN_FACULTY",     "رمز الكلية المرتبطة بالتخصص غير موجود");
                case 547:
                    if (err.Message.Contains("CK_LookupItem_NotSelfParent", StringComparison.OrdinalIgnoreCase))
                        return ("SELF_PARENT", "لا يمكن أن يكون السجل أبًا لنفسه");
                    if (err.Message.Contains("CK_LookupItem_DateRange", StringComparison.OrdinalIgnoreCase))
                        return ("INVALID_DATE_RANGE", "تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
                    break;
                case 2601:
                case 2627:
                    if (err.Message.Contains("UX_LookupItem_TypeCode_Code", StringComparison.OrdinalIgnoreCase))
                        return ("DUPLICATE_CODE", "هذا الكود مستخدم بالفعل ضمن هذا الجدول");
                    if (err.Message.Contains("PK_Category", StringComparison.OrdinalIgnoreCase) ||
                        err.Message.Contains("PK_PeriodCategories", StringComparison.OrdinalIgnoreCase))
                        return ("DUPLICATE_MAPPING", "هذا الربط موجود بالفعل");
                    break;
            }
        }
        return (null, string.Empty);
    }
}
