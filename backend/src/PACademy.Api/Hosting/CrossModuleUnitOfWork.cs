using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;

namespace PACademy.Api.Hosting;

/// <summary>
/// Host-level helper that opens a single SqlConnection + SqlTransaction shared across
/// multiple DbContext instances. Required for cross-module atomic writes (FR-D06).
/// TransactionScope is forbidden — Docker SQL Server does not support DTC.
///
/// Usage:
///   await using var uow = new CrossModuleUnitOfWork(configuration);
///   await uow.BeginAsync(ct);
///   var admissions = uow.Use&lt;AdmissionsDbContext&gt;(opts =&gt; new AdmissionsDbContext(opts));
///   var audit      = uow.Use&lt;AuditDbContext&gt;(opts =&gt; new AuditDbContext(opts));
///   admissions.Cycles.Add(cycle);
///   audit.AuditEntries.Add(auditEntry);
///   await admissions.SaveChangesAsync(ct);
///   await audit.SaveChangesAsync(ct);
///   await uow.CommitAsync(ct);
/// </summary>
public sealed class CrossModuleUnitOfWork : IAsyncDisposable
{
    private readonly string _connectionString;
    private SqlConnection? _conn;
    private DbTransaction? _tx;

    public CrossModuleUnitOfWork(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");
    }

    public async Task BeginAsync(CancellationToken ct = default)
    {
        _conn = new SqlConnection(_connectionString);
        await _conn.OpenAsync(ct);
        _tx = await _conn.BeginTransactionAsync(ct);
    }

    /// <summary>
    /// Returns a DbContext instance bound to the shared connection and transaction.
    /// The caller owns the returned context's lifetime (SaveChanges, Dispose).
    /// </summary>
    public T Use<T>(Func<DbContextOptions<T>, T> factory) where T : DbContext
    {
        if (_conn is null || _tx is null)
            throw new InvalidOperationException("Call BeginAsync before Use<T>.");

        var opts = new DbContextOptionsBuilder<T>()
            .UseSqlServer(_conn)
            .Options;

        var ctx = factory(opts);
        ctx.Database.UseTransaction(_tx);
        return ctx;
    }

    public async Task CommitAsync(CancellationToken ct = default)
    {
        if (_tx is null)
            throw new InvalidOperationException("No active transaction to commit.");
        await _tx.CommitAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (_tx is not null)
        {
            await _tx.DisposeAsync();
            _tx = null;
        }
        if (_conn is not null)
        {
            await _conn.DisposeAsync();
            _conn = null;
        }
    }
}
