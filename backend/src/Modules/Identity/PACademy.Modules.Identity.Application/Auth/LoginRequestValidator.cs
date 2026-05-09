using FluentValidation;

namespace PACademy.Modules.Identity.Application.Auth;

public sealed record LoginRequest(string NationalId, string Password);

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
