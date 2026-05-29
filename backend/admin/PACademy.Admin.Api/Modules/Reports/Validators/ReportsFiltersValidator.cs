using FluentValidation;
using PACademy.Admin.Api.Modules.Reports.Dtos;

namespace PACademy.Admin.Api.Modules.Reports.Validators;

public sealed class ReportsFiltersValidator : AbstractValidator<ReportsFiltersDto>
{
    public static readonly HashSet<string> SortWhitelist = new(StringComparer.OrdinalIgnoreCase)
    {
        "submittedAt",
        "currentStage",
        "nationalId",
        "nameAr",
        "paymentStatus",
        "lastActivityAt"
    };

    public ReportsFiltersValidator()
    {
        RuleFor(x => x.AgeMin).GreaterThanOrEqualTo(0).When(x => x.AgeMin.HasValue);
        RuleFor(x => x.AgeMax).LessThanOrEqualTo(120).When(x => x.AgeMax.HasValue);
        RuleFor(x => x).Must(x => !x.AgeMin.HasValue || !x.AgeMax.HasValue || x.AgeMin <= x.AgeMax)
            .WithMessage("الحد الأدنى للسن يجب أن يكون أقل من أو يساوي الحد الأقصى.");
        RuleFor(x => x).Must(x => !x.DateFrom.HasValue || !x.DateTo.HasValue || x.DateFrom <= x.DateTo)
            .WithMessage("تاريخ البداية يجب أن يسبق تاريخ النهاية.");
        RuleFor(x => x.StoppedAtStage).InclusiveBetween(0, 11).When(x => x.StoppedAtStage.HasValue);
    }
}
