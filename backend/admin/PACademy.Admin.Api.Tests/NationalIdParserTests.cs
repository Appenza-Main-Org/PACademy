using PACademy.Shared.Contracts;
using PACademy.Modules.IdentityApplicant.Application.Moi;

namespace PACademy.Admin.Api.Tests;

public sealed class NationalIdParserTests
{
    [Fact]
    public void ParsesCenturyTwoAndMaleGender()
    {
        var info = NationalIdParser.ParseEgyptianNationalId("29912310123457");

        Assert.Equal(new DateOnly(1999, 12, 31), info.BirthDate);
        Assert.Equal(EgyptianNationalIdGender.Male, info.Gender);
        Assert.Equal("ذكر", info.GenderAr);
        Assert.Equal("01", info.GovernorateCode);
    }

    [Fact]
    public void ParsesCenturyThreeLeapYearAndFemaleGender()
    {
        var info = NationalIdParser.ParseEgyptianNationalId("30002290123467");

        Assert.Equal(new DateOnly(2000, 2, 29), info.BirthDate);
        Assert.Equal(EgyptianNationalIdGender.Female, info.Gender);
        Assert.Equal("أنثى", info.GenderAr);
    }

    [Theory]
    [InlineData("3000229012346")]
    [InlineData("3000229012346A")]
    [InlineData("40002290123467")]
    [InlineData("30002300123467")]
    public void RejectsMalformedNationalIds(string nationalId)
    {
        Assert.Throws<NationalIdFormatException>(() => NationalIdParser.ParseEgyptianNationalId(nationalId));
    }

    [Fact]
    public void CalculatesAgeAsOfReferenceDate()
    {
        var age = NationalIdParser.CalculateAge(new DateOnly(2000, 2, 29), new DateOnly(2026, 2, 28));
        var afterBirthday = NationalIdParser.CalculateAge(new DateOnly(2000, 2, 29), new DateOnly(2026, 3, 1));

        Assert.Equal(26, age);
        Assert.Equal(26, afterBirthday);
    }

    [Fact]
    public void DerivedMoiIdentityMapsGovernorateCode24ToMinya()
    {
        var session = NidIdentityDeriver.Derive("30509212402852", "01167345289");

        Assert.NotNull(session);
        Assert.Equal("محافظة المنيا", session.BirthGovernorate);
        Assert.Equal(string.Empty, session.BirthDistrict);
    }

    [Fact]
    public void DerivedMoiIdentityMapsGovernorateCode04ToSuez()
    {
        var session = NidIdentityDeriver.Derive("30509210402852", "01167345289");

        Assert.NotNull(session);
        Assert.Equal("محافظة السويس", session.BirthGovernorate);
        Assert.Equal(string.Empty, session.BirthDistrict);
    }
}
