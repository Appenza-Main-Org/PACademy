using FluentValidation;
using PACademy.Contracts.Auth;

namespace PACademy.Application.Auth;

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.NationalId)
            .NotEmpty().WithMessage("الرقم القومي مطلوب.")
            .Matches(@"^\d{14}$").WithMessage("الرقم القومي يجب أن يتكوّن من 14 رقماً.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("كلمة المرور مطلوبة.");
    }
}
