using FluentValidation;

namespace PACademy.Modules.Identity.Application.Admin.Users;

public sealed class CreateSystemUserValidator : AbstractValidator<CreateSystemUserRequest>
{
    public CreateSystemUserValidator()
    {
        RuleFor(x => x.NationalId)
            .NotEmpty().WithMessage("الرقم القومي مطلوب.")
            .Length(14).WithMessage("الرقم القومي يجب أن يتكوّن من 14 رقماً.")
            .Must(IsValidNationalId).WithMessage("الرقم القومي غير صحيح.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("الاسم الكامل مطلوب.")
            .MaximumLength(200).WithMessage("الاسم لا يمكن أن يتجاوز 200 حرف.");

        RuleFor(x => x.Mobile)
            .NotEmpty().WithMessage("رقم الهاتف مطلوب.")
            .Matches(@"^(010|011|012|015)\d{8}$")
            .WithMessage("رقم الهاتف يجب أن يكون مصري (010/011/012/015 + 8 أرقام).");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("البريد الإلكتروني مطلوب.")
            .EmailAddress().WithMessage("البريد الإلكتروني غير صحيح.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("الدور الوظيفي مطلوب.")
            .Must(r => RoleApps.AllRoles.Contains(r))
            .WithMessage("الدور الوظيفي غير مسموح به.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("كلمة المرور مطلوبة.")
            .MinimumLength(8).WithMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.")
            .Matches(@"\d").WithMessage("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.");

        RuleFor(x => x.OfficerCode)
            .NotEmpty().WithMessage("الكود الوظيفي مطلوب.")
            .MaximumLength(32).WithMessage("الكود الوظيفي يجب ألا يتجاوز 32 حرفاً.")
            .Matches(@"^[A-Za-z0-9]+$").WithMessage("الكود الوظيفي يجب أن يحتوي على أحرف وأرقام فقط.");

        RuleFor(x => x.CardFactoryNumber)
            .NotEmpty().WithMessage("رقم مصنع البطاقة مطلوب.")
            .MaximumLength(32).WithMessage("رقم مصنع البطاقة يجب ألا يتجاوز 32 حرفاً.");

        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("تاريخ الإصدار مطلوب.")
            .LessThanOrEqualTo(_ => DateTime.UtcNow).WithMessage("تاريخ الإصدار لا يمكن أن يكون في المستقبل.");
    }

    private static bool IsValidNationalId(string nationalId)
    {
        if (string.IsNullOrWhiteSpace(nationalId) || nationalId.Length != 14) return false;
        if (!nationalId.All(char.IsAsciiDigit)) return false;
        var centuryDigit = nationalId[0] - '0';
        if (centuryDigit != 2 && centuryDigit != 3) return false;
        int century = centuryDigit == 2 ? 1900 : 2000;
        if (!int.TryParse(nationalId[1..3], out var year)) return false;
        if (!int.TryParse(nationalId[3..5], out var month)) return false;
        if (!int.TryParse(nationalId[5..7], out var day)) return false;
        try { _ = new DateTime(century + year, month, day); return true; }
        catch (ArgumentOutOfRangeException) { return false; }
    }
}
