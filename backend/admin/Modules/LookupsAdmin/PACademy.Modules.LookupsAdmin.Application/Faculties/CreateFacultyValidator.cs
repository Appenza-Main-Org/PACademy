using FluentValidation;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

/// <summary>
/// Validates the create-faculty request. FluentValidation runs
/// automatically when the controller pulls
/// <see cref="IValidator{T}"/> via DI (or via the AspNetCore integration).
/// </summary>
public sealed class CreateFacultyValidator : AbstractValidator<CreateFacultyRequest>
{
    public CreateFacultyValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .Matches("^FAC-[0-9]{2,4}$")
            .WithMessage("الكود يجب أن يطابق نمط FAC-NN");

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(120);
    }
}
