namespace PACademy.Admin.Api.Tests;

public sealed class AcquaintanceDocumentBackendTests
{
    [Fact]
    public void AdminMigrationDefinesNormalizedAcquaintanceDocumentTables()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/admin/PACademy.Admin.Api/Persistence/Migrations/20260602120000_AddApplicantAcquaintanceDocuments.cs"));

        Assert.Contains("acquaintance_doc_settings", source);
        Assert.Contains("applicant_acquaintance_docs", source);
        Assert.Contains("applicant_acquaintance_doc_sections", source);
        Assert.Contains("applicant_acquaintance_doc_revisions", source);
        Assert.Contains("ux_applicant_acquaintance_docs_cycle_applicant", source);
        Assert.Contains("FK_applicant_acquaintance_doc_sections_applicant_acquaintance_docs_acquaintance_doc_id", source);
    }

    [Fact]
    public void ApplicantApiExposesStatusDraftAutosaveAndPrintEndpoints()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/applicant/PACademy.Applicant.Api/Controllers/AcquaintanceDocController.cs"));

        Assert.Contains("[HttpGet(\"status\")]", source);
        Assert.Contains("[HttpGet]", source);
        Assert.Contains("[HttpPatch]", source);
        Assert.Contains("[HttpGet(\"print\")]", source);
        Assert.Contains("GetStatus", source);
        Assert.Contains("SaveDraft", source);
        Assert.Contains("GetPrintable", source);
    }

    private static string FindRepoFile(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }

        throw new FileNotFoundException(relativePath);
    }
}
