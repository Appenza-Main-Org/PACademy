using FluentAssertions;
using PACademy.Application.Identity;

namespace PACademy.Application.Tests.Identity;

public sealed class SystemUserValidatorTests
{
    private readonly SystemUserValidator _sut = new();

    private static CreateUserCommand ValidCommand() => new(
        NationalId: "30506150112341",
        OfficerCode: "OC01001",
        FullName: "محمد أحمد السيد",
        Mobile: "01012345678",
        Email: "officer@pac.demo",
        IssueDate: new DateTime(2020, 1, 1),
        CardFactoryNumber: "CF100001",
        Role: "committee_admin",
        Unit: "لجنة القبول",
        Password: "SecurePass123");

    [Fact]
    public void Validate_ValidCommand_Succeeds()
    {
        var result = _sut.Validate(ValidCommand());
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234567890123")]  // 13 digits
    [InlineData("12345678901234")]  // wrong century digit
    [InlineData("not14digits!")]
    public void Validate_InvalidNationalId_Fails(string nid)
    {
        var cmd = ValidCommand() with { NationalId = nid };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(cmd.NationalId));
    }

    [Theory]
    [InlineData("09012345678")]  // wrong prefix
    [InlineData("0101234567")]   // only 10 digits
    [InlineData("012345678")]    // too short
    [InlineData("")]
    public void Validate_InvalidMobile_Fails(string mobile)
    {
        var cmd = ValidCommand() with { Mobile = mobile };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(cmd.Mobile));
    }

    [Theory]
    [InlineData("010", true)]
    [InlineData("011", true)]
    [InlineData("012", true)]
    [InlineData("015", true)]
    public void Validate_ValidMobilePrefixes_Succeeds(string prefix, bool expected)
    {
        var cmd = ValidCommand() with { Mobile = $"{prefix}12345678" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().Be(expected);
    }

    [Fact]
    public void Validate_InvalidEmail_Fails()
    {
        var cmd = ValidCommand() with { Email = "not-an-email" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(cmd.Email));
    }

    [Fact]
    public void Validate_FutureIssueDate_Fails()
    {
        var cmd = ValidCommand() with { IssueDate = DateTime.UtcNow.AddDays(1) };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(cmd.IssueDate));
    }

    [Fact]
    public void Validate_OfficerCodeWithSpecialChars_Fails()
    {
        var cmd = ValidCommand() with { OfficerCode = "OC-001/A" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_CardFactoryNumberTooLong_Fails()
    {
        var cmd = ValidCommand() with { CardFactoryNumber = new string('A', 33) };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_ShortPassword_Fails()
    {
        var cmd = ValidCommand() with { Password = "short" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(cmd.Password));
    }

    [Fact]
    public void Validate_EmptyFullName_Fails()
    {
        var cmd = ValidCommand() with { FullName = "" };
        var result = _sut.Validate(cmd);
        result.IsValid.Should().BeFalse();
    }
}
