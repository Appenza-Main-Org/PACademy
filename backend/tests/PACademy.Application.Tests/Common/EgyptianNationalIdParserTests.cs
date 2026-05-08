using FluentAssertions;
using PACademy.Application.Common;

namespace PACademy.Application.Tests.Common;

public sealed class EgyptianNationalIdParserTests
{
    // Valid NID: century=3(2000s), born 2005-06-15, Cairo gov=01, serial 1231, gender digit=1 (odd=male)
    private const string ValidMaleNid2000s = "30506150112311";
    // century=2(1900s), born 1985-03-20, Alex gov=02, serial 5678, gender digit=4 (even=female)
    private const string ValidFemaleNid1900s = "28503200256784";

    [Fact]
    public void Parse_ValidMale2000sNid_ReturnsCorrectDob()
    {
        var result = EgyptianNationalIdParser.Parse(ValidMaleNid2000s);

        result.IsValid.Should().BeTrue();
        result.DateOfBirth.Should().Be(new DateTime(2005, 6, 15));
        result.Gender.Should().Be("male");
        result.Error.Should().BeNull();
    }

    [Fact]
    public void Parse_ValidFemale1900sNid_ReturnsCorrectDob()
    {
        var result = EgyptianNationalIdParser.Parse(ValidFemaleNid1900s);

        result.IsValid.Should().BeTrue();
        result.DateOfBirth.Should().Be(new DateTime(1985, 3, 20));
        result.Gender.Should().Be("female");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("1234567890123")]  // 13 digits
    [InlineData("123456789012345")] // 15 digits
    public void Parse_WrongLength_ReturnsInvalid(string id)
    {
        EgyptianNationalIdParser.Parse(id).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Parse_NonDigitCharacters_ReturnsInvalid()
    {
        EgyptianNationalIdParser.Parse("3050615011234A").IsValid.Should().BeFalse();
    }

    [Fact]
    public void Parse_CenturyDigit1_ReturnsInvalid()
    {
        // Century digit 1 is not valid (only 2 or 3)
        EgyptianNationalIdParser.Parse("10506150112341").IsValid.Should().BeFalse();
    }

    [Fact]
    public void Parse_InvalidMonth_ReturnsInvalid()
    {
        // Month 13 is invalid
        EgyptianNationalIdParser.Parse("30513150112341").IsValid.Should().BeFalse();
    }

    [Fact]
    public void IsValid_ValidNid_ReturnsTrue()
    {
        EgyptianNationalIdParser.IsValid(ValidMaleNid2000s).Should().BeTrue();
    }

    [Fact]
    public void IsValid_InvalidNid_ReturnsFalse()
    {
        EgyptianNationalIdParser.IsValid("not-a-nid").Should().BeFalse();
    }
}
