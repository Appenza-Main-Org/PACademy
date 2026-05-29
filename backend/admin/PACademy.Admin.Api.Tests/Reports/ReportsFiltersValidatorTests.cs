using PACademy.Admin.Api.Modules.Reports.Dtos;
using PACademy.Admin.Api.Modules.Reports.Validators;

namespace PACademy.Admin.Api.Tests.Reports;

public sealed class ReportsFiltersValidatorTests
{
    private readonly ReportsFiltersValidator validator = new();

    [Fact]
    public void Rejects_inverted_age_range()
    {
        var result = validator.Validate(new ReportsFiltersDto { AgeMin = 30, AgeMax = 20 });
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Rejects_inverted_date_range()
    {
        var result = validator.Validate(new ReportsFiltersDto
        {
            DateFrom = new DateOnly(2026, 5, 20),
            DateTo = new DateOnly(2026, 5, 1)
        });
        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData(12)]
    public void Rejects_invalid_stage(int stage)
    {
        var result = validator.Validate(new ReportsFiltersDto { StoppedAtStage = stage });
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Sort_whitelist_contains_rfp_detail_fields()
    {
        Assert.Contains("submittedAt", ReportsFiltersValidator.SortWhitelist);
        Assert.Contains("currentStage", ReportsFiltersValidator.SortWhitelist);
        Assert.Contains("nationalId", ReportsFiltersValidator.SortWhitelist);
        Assert.Contains("nameAr", ReportsFiltersValidator.SortWhitelist);
        Assert.Contains("paymentStatus", ReportsFiltersValidator.SortWhitelist);
        Assert.Contains("lastActivityAt", ReportsFiltersValidator.SortWhitelist);
    }
}
