using FluentValidation;
using System.Text.Json.Nodes;

namespace PACademy.Admin.Api.Modules.Lookups;

public sealed class LookupRowValidator : AbstractValidator<JsonObject>
{
    public LookupRowValidator()
    {
        RuleFor(x => LookupJson.StringProp(x, "name"))
            .NotEmpty()
            .WithMessage("اسم الكود مطلوب");

        RuleFor(x => LookupJson.StringProp(x, "code"))
            .Must(code => code is null || code.Trim().Length > 0)
            .WithMessage("كود السجل غير صالح");
    }
}
