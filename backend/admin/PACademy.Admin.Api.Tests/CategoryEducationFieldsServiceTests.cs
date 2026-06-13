using FluentValidation;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.Admissions;
using PACademy.Admin.Api.Persistence;
using static PACademy.Admin.Api.Modules.Admissions.CategoryEducationFieldsService;

namespace PACademy.Admin.Api.Tests;

public sealed class CategoryEducationFieldsServiceTests
{
    [Fact]
    public async Task ListReturnsBuiltInDefaultsWhenTableIsEmpty()
    {
        await using var db = CreateDb();
        var service = new CategoryEducationFieldsService(db);

        var all = await service.ListAsync(null, CancellationToken.None);
        var general = await service.ListAsync("officers_general", CancellationToken.None);

        Assert.Equal(4, all.Select(x => x.CategoryKey).Distinct().Count());
        Assert.Equal(
            ["thanawiTotal", "thanawiPercentage", "thanawiGrade"],
            general.Select(x => x.FieldKey).ToArray());
        Assert.True(general.Single(x => x.FieldKey == "thanawiPercentage").IsRequired);
        Assert.Equal(100, general.Single(x => x.FieldKey == "thanawiPercentage").MaxValue);
        // ليسانس حقوق omits the university percentage (was an isLawBachelor conditional).
        var law = await service.ListAsync("law_bachelor", CancellationToken.None);
        Assert.DoesNotContain(law, x => x.FieldKey == "bachelorPercentage");
        Assert.Contains(law, x => x.FieldKey == "bachelorGrade" && x.SectionKey == "university");
    }

    [Fact]
    public async Task SaveReplacesCategoryRowsAndSubsequentReadsReturnStoredRows()
    {
        await using var db = CreateDb();
        var service = new CategoryEducationFieldsService(db);

        var saved = await service.SaveCategoryAsync(
            "officers_general",
            [
                new CategoryEducationFieldDto(
                    Id: "",
                    CategoryKey: "officers_general",
                    FieldKey: "totalScore",
                    LabelAr: "المجموع الكلي",
                    InputKind: "number",
                    SectionKey: "secondary",
                    IsRequired: true,
                    MinValue: 0,
                    MaxValue: 410,
                    SortOrder: 10,
                    IsActive: true),
            ],
            CancellationToken.None);

        var listed = await service.ListAsync("officers_general", CancellationToken.None);

        Assert.Single(saved);
        Assert.Single(listed);
        Assert.Equal("totalScore", listed[0].FieldKey);
        Assert.Equal("المجموع الكلي", listed[0].LabelAr);
        Assert.StartsWith("CEF-", listed[0].Id);
        // Stored rows win over defaults; other categories still answer defaults.
        var specialized = await service.ListAsync("specialized_officers", CancellationToken.None);
        Assert.Contains(specialized, x => x.FieldKey == "doctorateGrade");
    }

    [Fact]
    public async Task SaveRejectsUnknownInputKindAndDuplicateFieldKeys()
    {
        await using var db = CreateDb();
        var service = new CategoryEducationFieldsService(db);

        await Assert.ThrowsAsync<ValidationException>(() => service.SaveCategoryAsync(
            "officers_general",
            [Row("thanawiTotal", inputKind: "checkbox")],
            CancellationToken.None));

        await Assert.ThrowsAsync<ValidationException>(() => service.SaveCategoryAsync(
            "officers_general",
            [Row("thanawiTotal"), Row("thanawiTotal")],
            CancellationToken.None));
    }

    private static CategoryEducationFieldDto Row(string fieldKey, string inputKind = "number") => new(
        Id: "",
        CategoryKey: "officers_general",
        FieldKey: fieldKey,
        LabelAr: "حقل",
        InputKind: inputKind,
        SectionKey: "secondary",
        IsRequired: false,
        MinValue: null,
        MaxValue: null,
        SortOrder: 0,
        IsActive: true);

    private static AdminDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AdminDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AdminDbContext(options);
    }
}
