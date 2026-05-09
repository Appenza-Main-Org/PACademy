using FluentValidation;
using PACademy.Contracts.Admin.ReferenceData;
using System.Text.RegularExpressions;

namespace PACademy.Application.Admin.ReferenceData;

public sealed class CreateReferenceDataValidator : AbstractValidator<CreateReferenceDataRequest>
{
    private static readonly Regex KeyPattern = new("^[a-z0-9_-]+$", RegexOptions.Compiled);

    public CreateReferenceDataValidator()
    {
        RuleFor(r => r.Category)
            .Must(c => ReferenceDataConstants.ValidCategories.Contains(c))
            .WithMessage($"Category must be one of: {string.Join(", ", ReferenceDataConstants.ValidCategories)}.");

        RuleFor(r => r.Key)
            .NotEmpty()
            .MaximumLength(100)
            .Must(k => k != null && KeyPattern.IsMatch(k))
            .WithMessage("Key must match ^[a-z0-9_-]+$.");

        RuleFor(r => r.NameAr).NotEmpty().MaximumLength(200);
        RuleFor(r => r.NameEn).MaximumLength(200);
    }
}
