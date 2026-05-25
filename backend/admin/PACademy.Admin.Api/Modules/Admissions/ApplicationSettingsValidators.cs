using System.Text.Json.Nodes;
using FluentValidation;

namespace PACademy.Admin.Api.Modules.Admissions;

public sealed class ApplicationSettingsAttachSpecializationValidator : AbstractValidator<JsonObject>
{
    public ApplicationSettingsAttachSpecializationValidator()
    {
        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "specializationId"))
            .NotEmpty()
            .WithMessage("التخصص مطلوب");
    }
}

public sealed class ApplicationSettingsYearValidator : AbstractValidator<JsonObject>
{
    public ApplicationSettingsYearValidator()
    {
        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "categorySpecializationId"))
            .NotEmpty()
            .WithMessage("تخصص الفئة مطلوب");

        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "gradeKind"))
            .Must(x => x is "GRADES" or "TAGDIR")
            .WithMessage("نمط التقدير غير صالح");

        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "applicationStartDate"))
            .NotEmpty()
            .WithMessage("تاريخ بداية التقديم مطلوب");

        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "applicationEndDate"))
            .NotEmpty()
            .WithMessage("تاريخ نهاية التقديم مطلوب");

        RuleFor(x => ApplicationSettingsValidationJson.StringProp(x, "ageReferenceDate"))
            .NotEmpty()
            .WithMessage("تاريخ حساب السن مطلوب");
    }
}

public static class ApplicationSettingsValidationJson
{
    public static string? StringProp(JsonObject obj, string name) =>
        obj.TryGetPropertyValue(name, out var node) ? node?.GetValue<string>() : null;
}
