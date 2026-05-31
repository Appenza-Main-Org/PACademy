#:package Microsoft.Data.SqlClient@5.2.2
using Microsoft.Data.SqlClient;

string conn = Environment.GetEnvironmentVariable("PADB_CONN")
    ?? throw new Exception("PADB_CONN env var required");
if (args.Length < 1) { Console.Error.WriteLine("usage: dbrun <file.sql>"); return 1; }
string path = args[0];
string sql = File.ReadAllText(path);

// Split on bare GO batch separators (line that is only GO, optional whitespace).
var batches = System.Text.RegularExpressions.Regex
    .Split(sql, @"(?im)^[ \t]*GO[ \t]*$")
    .Where(b => b.Trim().Length > 0)
    .ToList();

using var c = new SqlConnection(conn);
c.InfoMessage += (s, e) => Console.WriteLine("  · " + e.Message);
await c.OpenAsync();
Console.WriteLine($"-- connected; running {batches.Count} batch(es) from {Path.GetFileName(path)}");
int bi = 0;
foreach (var b in batches)
{
    bi++;
    try
    {
        using var cmd = new SqlCommand(b, c) { CommandTimeout = 0 };
        using var r = await cmd.ExecuteReaderAsync();
        do
        {
            if (r.FieldCount > 0)
            {
                var cols = Enumerable.Range(0, r.FieldCount).Select(i => r.GetName(i)).ToArray();
                bool header = false;
                while (await r.ReadAsync())
                {
                    if (!header) { Console.WriteLine("   " + string.Join(" | ", cols)); header = true; }
                    var vals = Enumerable.Range(0, r.FieldCount)
                        .Select(i => r.IsDBNull(i) ? "NULL" : Convert.ToString(r.GetValue(i)) ?? "");
                    Console.WriteLine("   " + string.Join(" | ", vals));
                }
            }
        } while (await r.NextResultAsync());
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"!! BATCH {bi} FAILED in {Path.GetFileName(path)}: {ex.Message}");
        return 1;
    }
}
Console.WriteLine($"-- OK {Path.GetFileName(path)}");
return 0;
