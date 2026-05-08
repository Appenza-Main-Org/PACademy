using FluentAssertions;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using PACademy.Api.Tests.Fixtures;

namespace PACademy.Api.Tests.Audit;

/// <summary>
/// Asserts that audit_entries are immutable — both UPDATE and DELETE must fail.
/// Covers FR-008 audit immutability requirement.
/// </summary>
[Collection("SqlServer")]
public sealed class ImmutabilityTests(SqlServerFixture sqlFixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(sqlFixture, seedDemo: true);
        await _factory.InitializeAsync();
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Update_AuditEntry_ShouldFail()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PACademy.Infrastructure.Persistence.PaDbContext>();

        var entry = db.AuditEntries.First();

        var act = async () =>
        {
            await using var conn = new SqlConnection(sqlFixture.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"UPDATE audit_entries SET ActorName = 'tampered' WHERE Id = '{entry.Id}'";
            await cmd.ExecuteNonQueryAsync();
        };

        await act.Should().ThrowAsync<SqlException>();
    }

    [Fact]
    public async Task Delete_AuditEntry_ShouldFail()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PACademy.Infrastructure.Persistence.PaDbContext>();

        var entry = db.AuditEntries.First();

        var act = async () =>
        {
            await using var conn = new SqlConnection(sqlFixture.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DELETE FROM audit_entries WHERE Id = '{entry.Id}'";
            await cmd.ExecuteNonQueryAsync();
        };

        await act.Should().ThrowAsync<SqlException>();
    }
}
