using FluentValidation;
using PACademy.Modules.Admissions.Application.Dtos;

namespace PACademy.Modules.Admissions.Application.Admin.Cycles;

public sealed class CreateCycleValidator : AbstractValidator<CreateCycleRequest>
{
    private static readonly string[] ValidCohorts = ["male", "female"];

    public CreateCycleValidator()
    {
        RuleFor(r => r.NameAr).NotEmpty().MaximumLength(200);
        RuleFor(r => r.Year).GreaterThanOrEqualTo(2024);
        RuleFor(r => r.Cohort).Must(c => ValidCohorts.Contains(c))
            .WithMessage("Cohort must be 'male' or 'female'.");
        RuleFor(r => r.OpenDate).LessThan(r => r.CloseDate)
            .WithMessage("OpenDate must be before CloseDate.");
        RuleFor(r => r.ExpectedCapacity).GreaterThan(0);
    }
}
