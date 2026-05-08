using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PACademy.Application.Audit;
using PACademy.Application.Common;
using PACademy.Domain.Audit;
using PACademy.Infrastructure.Persistence;

namespace PACademy.Infrastructure.Audit;

/// <summary>
/// IAuditWriter implementation.
/// Single-row path: appends to PaDbContext change set (caller calls SaveChangesAsync).
/// Bulk path: SqlBulkCopy bypassing EF for large import batches (plan §10 / FR-028).
/// </summary>
internal sealed class AuditWriter(PaDbContext db, ICurrentUser currentUser) : IAuditWriter
{
    public Task RecordAsync(
        AuditAction action,
        string targetType,
        Guid targetId,
        string targetLabel,
        AuditOutcome outcome,
        string? beforeJson = null,
        string? afterJson = null,
        CancellationToken ct = default)
    {
        var entry = AuditEntry.Create(
            currentUser.Id,
            currentUser.Name,
            currentUser.IpAddress,
            action,
            targetType,
            targetId,
            targetLabel,
            outcome,
            beforeJson,
            afterJson);

        db.AuditEntries.Add(entry);
        // Caller is responsible for SaveChangesAsync
        return Task.CompletedTask;
    }

    public async Task RecordBulkAsync(
        AuditEntry summary,
        IReadOnlyList<AuditEntry> children,
        CancellationToken ct = default)
    {
        var connectionString = db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("No connection string available.");

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var transaction = connection.BeginTransaction();

        try
        {
            await using var summaryCmd = connection.CreateCommand();
            summaryCmd.Transaction = transaction;
            summaryCmd.CommandText = """
                INSERT INTO audit_entries
                    (Id, ActorId, ActorName, ActorIp, Action, TargetType, TargetId,
                     TargetLabel, Outcome, BeforeJson, AfterJson, BatchId, OccurredAt, DemoOrigin)
                VALUES
                    (@Id, @ActorId, @ActorName, @ActorIp, @Action, @TargetType, @TargetId,
                     @TargetLabel, @Outcome, @BeforeJson, @AfterJson, NULL, @OccurredAt, @DemoOrigin)
                """;
            AddAuditParams(summaryCmd, summary);
            await summaryCmd.ExecuteNonQueryAsync(ct);

            if (children.Count > 0)
            {
                var table = BuildChildrenDataTable(children, summary.Id);
                using var bulkCopy = new SqlBulkCopy(connection, SqlBulkCopyOptions.CheckConstraints, transaction)
                {
                    DestinationTableName = "audit_entries",
                    BatchSize = 10_000,
                };
                MapBulkColumns(bulkCopy);
                await bulkCopy.WriteToServerAsync(table, ct);
            }

            await transaction.CommitAsync(ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    private static void AddAuditParams(SqlCommand cmd, AuditEntry entry)
    {
        cmd.Parameters.AddWithValue("@Id", entry.Id);
        cmd.Parameters.AddWithValue("@ActorId", entry.ActorId);
        cmd.Parameters.AddWithValue("@ActorName", entry.ActorName);
        cmd.Parameters.AddWithValue("@ActorIp", entry.ActorIp);
        cmd.Parameters.AddWithValue("@Action", entry.Action.ToString());
        cmd.Parameters.AddWithValue("@TargetType", entry.TargetType);
        cmd.Parameters.AddWithValue("@TargetId", entry.TargetId);
        cmd.Parameters.AddWithValue("@TargetLabel", entry.TargetLabel);
        cmd.Parameters.AddWithValue("@Outcome", entry.Outcome.ToString());
        cmd.Parameters.AddWithValue("@BeforeJson", (object?)entry.BeforeJson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AfterJson", (object?)entry.AfterJson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@OccurredAt", entry.OccurredAt);
        cmd.Parameters.AddWithValue("@DemoOrigin", entry.DemoOrigin);
    }

    private static System.Data.DataTable BuildChildrenDataTable(IReadOnlyList<AuditEntry> children, Guid batchId)
    {
        var table = new System.Data.DataTable();
        table.Columns.Add("Id", typeof(Guid));
        table.Columns.Add("ActorId", typeof(Guid));
        table.Columns.Add("ActorName", typeof(string));
        table.Columns.Add("ActorIp", typeof(string));
        table.Columns.Add("Action", typeof(string));
        table.Columns.Add("TargetType", typeof(string));
        table.Columns.Add("TargetId", typeof(Guid));
        table.Columns.Add("TargetLabel", typeof(string));
        table.Columns.Add("Outcome", typeof(string));
        table.Columns.Add("BeforeJson", typeof(string));
        table.Columns.Add("AfterJson", typeof(string));
        table.Columns.Add("BatchId", typeof(Guid));
        table.Columns.Add("OccurredAt", typeof(DateTime));
        table.Columns.Add("DemoOrigin", typeof(bool));

        foreach (var child in children)
        {
            table.Rows.Add(
                child.Id, child.ActorId, child.ActorName, child.ActorIp,
                child.Action.ToString(), child.TargetType, child.TargetId,
                child.TargetLabel, child.Outcome.ToString(),
                (object?)child.BeforeJson ?? DBNull.Value,
                (object?)child.AfterJson ?? DBNull.Value,
                batchId, child.OccurredAt, child.DemoOrigin);
        }
        return table;
    }

    private static void MapBulkColumns(SqlBulkCopy bulkCopy)
    {
        foreach (string col in new[]
        {
            "Id", "ActorId", "ActorName", "ActorIp", "Action", "TargetType",
            "TargetId", "TargetLabel", "Outcome", "BeforeJson", "AfterJson",
            "BatchId", "OccurredAt", "DemoOrigin",
        })
        {
            bulkCopy.ColumnMappings.Add(col, col);
        }
    }
}
