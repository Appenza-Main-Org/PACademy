using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PACademy.Admin.Api.Persistence;

public sealed class AdminDbContextFactory : IDesignTimeDbContextFactory<AdminDbContext>
{
    public AdminDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseSqlServer("Server=localhost;Database=PACademy_Admin;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;

        return new AdminDbContext(options);
    }
}
