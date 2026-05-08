using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using PACademy.Application.Common;

namespace PACademy.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used by `dotnet ef migrations add`.
/// Not used at runtime.
/// </summary>
internal sealed class PaDbContextFactory : IDesignTimeDbContextFactory<PaDbContext>
{
    public PaDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PaDbContext>()
            .UseSqlServer("Server=localhost,1433;Database=PACademy;User Id=sa;Password=P@ssw0rd!Dev;TrustServerCertificate=True;",
                o => o.MigrationsAssembly(typeof(PaDbContext).Assembly.FullName))
            .Options;

        return new PaDbContext(options, NullCurrentUser.Instance);
    }

    private sealed class NullCurrentUser : ICurrentUser
    {
        public static readonly NullCurrentUser Instance = new();
        public Guid Id => Guid.Empty;
        public string Name => "migrations";
        public string IpAddress => "::1";
        public bool IsAuthenticated => false;
    }
}
