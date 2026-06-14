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

    [Fact]
    public void InitialAcquaintanceDocReusesSubmittedPersonalData()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/applicant/PACademy.Applicant.Api/Modules/ApplicantPortal/PortalService.cs"));

        // The وثيقة تعارف must reuse data the applicant already submitted —
        // these personal fields used to be hardcoded empty in the initial payload.
        Assert.Contains("[\"maritalStatus\"] = StringFrom(profile, \"maritalStatus\")", source);
        Assert.Contains("[\"homePhone\"] = StringFrom(profile, \"homePhone\")", source);
        Assert.Contains("[\"shuhraName\"] = StringFrom(profile, \"shuhra\")", source);
        Assert.Contains("[\"qualificationYear\"] = qualificationYear", source);
        Assert.Contains("[\"totalGrades\"] = totalGrades", source);
        Assert.Contains("[\"gradesPercent\"] = gradesPercent", source);
        Assert.Contains("[\"address\"] = address", source);

        // Regression guard: none of the reused fields may be hardcoded empty again.
        Assert.DoesNotContain("[\"maritalStatus\"] = \"\"", source);
        Assert.DoesNotContain("[\"totalGrades\"] = \"\"", source);
        Assert.DoesNotContain("[\"address\"] = \"\"", source);
    }

    [Fact]
    public void InitialAcquaintanceDocPrefillsFamilyFromDraft()
    {
        var source = File.ReadAllText(FindRepoFile(
            "backend/applicant/PACademy.Applicant.Api/Modules/ApplicantPortal/PortalService.cs"));

        // Stage 7 saves the family blob into the draft (draft.family), not the
        // standalone "family" record — the initial doc must read it from there.
        Assert.Contains("draft[\"family\"] as JsonObject ?? await GetFamilyAsync", source);

        // Family must be mapped into the وثيقة تعارف record shapes (parents +
        // grandparents), not dumped raw — guards against the blank-family regression.
        Assert.Contains("[\"parents\"] = BuildParentsSectionFromFamily(family)", source);
        Assert.Contains("[\"grandparents\"] = BuildGrandparentsSectionFromFamily(family)", source);
        Assert.Contains("MapFatherRecord(", source);
        Assert.Contains("MapMotherRecord(", source);
        Assert.Contains("MapGrandparentRecord(", source);

        // Regression guard: the raw snapshot must no longer be dumped into parents.
        Assert.DoesNotContain("[\"parents\"] = family is null ? new JsonObject() : family.DeepClone()", source);
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
