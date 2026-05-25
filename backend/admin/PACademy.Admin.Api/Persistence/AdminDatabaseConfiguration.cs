namespace PACademy.Admin.Api.Persistence;

public sealed record AdminDatabaseSettings(
    string ConnectionName,
    string? ConnectionString,
    string Schema,
    bool UseInMemory);

public static class AdminDatabaseConfiguration
{
    public const string DefaultConnectionName = "AdminDb";

    public static AdminDatabaseSettings ResolveAdminDatabaseSettings(this IConfiguration configuration)
    {
        var configuredName =
            Environment.GetEnvironmentVariable("ADMIN_DB_CONNECTION_NAME")
            ?? configuration["Database:ActiveConnectionName"]
            ?? configuration["AdminDatabase:ActiveConnectionName"]
            ?? DefaultConnectionName;

        var connectionName = NormalizeConnectionName(configuredName);
        var schema =
            Environment.GetEnvironmentVariable("ADMIN_DB_SCHEMA")
            ?? configuration["Database:Schema"]
            ?? configuration["AdminDatabase:Schema"]
            ?? AdminDbContext.DefaultSchema;

        var connectionString =
            Environment.GetEnvironmentVariable("ADMIN_DB_CONNECTION_STRING")
            ?? configuration.GetConnectionString(connectionName);

        var useInMemory =
            configuration.GetValue<bool>("UseInMemoryAdminDb")
            || string.IsNullOrWhiteSpace(connectionString);

        return new AdminDatabaseSettings(connectionName, connectionString, AdminDbContext.NormalizeSchema(schema), useInMemory);
    }

    private static string NormalizeConnectionName(string value)
    {
        const string prefix = "ConnectionStrings:";
        var trimmed = value.Trim();
        return trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? trimmed[prefix.Length..]
            : trimmed;
    }
}
