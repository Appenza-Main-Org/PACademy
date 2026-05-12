using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Contracts.Concurrency;
using System.Text.Json;

namespace PACademy.Api.Middleware;

/// <summary>
/// Catches EF Core DbUpdateConcurrencyException and returns HTTP 409 with
/// a RowVersionConflictResult body. Registered after the audit middleware.
/// Satisfies FR-012 (optimistic locking) from spec 009.
/// </summary>
internal sealed class DbUpdateConcurrencyExceptionMiddleware(RequestDelegate next)
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            context.Response.StatusCode = 409;
            context.Response.ContentType = "application/json";

            var entry = ex.Entries.FirstOrDefault();
            var entityType = entry?.Metadata.ClrType.Name ?? "Unknown";
            var entityId = entry?.Property("Id").CurrentValue?.ToString() ?? string.Empty;

            // Try to read the original rowversion (the client's stale version)
            byte[] currentRowVersion = [];
            if (entry is not null)
            {
                var rvProp = entry.Properties
                    .FirstOrDefault(p => p.Metadata.IsConcurrencyToken);
                if (rvProp?.OriginalValue is byte[] origRv)
                    currentRowVersion = origRv;
            }

            var result = RowVersionConflictResult.For(entityType, entityId, currentRowVersion);
            await context.Response.WriteAsync(
                JsonSerializer.Serialize(result, _jsonOptions),
                context.RequestAborted);
        }
    }
}
