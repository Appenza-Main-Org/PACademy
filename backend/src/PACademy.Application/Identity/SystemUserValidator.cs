using FluentValidation;
using PACademy.Application.Common;

namespace PACademy.Application.Identity;

public sealed class SystemUserValidator : AbstractValidator<CreateUserCommand>
{
    public SystemUserValidator()
    {
        RuleFor(x => x.NationalId)
            .NotEmpty().WithMessage("الرقم القومي مطلوب.")
            .Length(14).WithMessage("الرقم القومي يجب أن يتكوّن من 14 رقماً.")
            .Must(EgyptianNationalIdParser.IsValid).WithMessage("الرقم القومي غير صحيح.");

        RuleFor(x => x.Mobile)
            .NotEmpty().WithMessage("رقم الهاتف مطلوب.")
            .Matches(@"^(010|011|012|015)\d{8}$")
            .WithMessage("رقم الهاتف يجب أن يكون مصري (010/011/012/015 + 8 أرقام).");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("البريد الإلكتروني مطلوب.")
            .EmailAddress().WithMessage("البريد الإلكتروني غير صحيح.");

        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("تاريخ الإصدار مطلوب.")
            .LessThanOrEqualTo(_ => DateTime.UtcNow).WithMessage("تاريخ الإصدار لا يمكن أن يكون في المستقبل.");

        RuleFor(x => x.OfficerCode)
            .NotEmpty().WithMessage("الكود الوظيفي مطلوب.")
            .MaximumLength(32).WithMessage("الكود الوظيفي يجب ألا يتجاوز 32 حرفاً.")
            .Matches(@"^[A-Za-z0-9]+$").WithMessage("الكود الوظيفي يجب أن يحتوي على أحرف وأرقام فقط.");

        RuleFor(x => x.CardFactoryNumber)
            .NotEmpty().WithMessage("رقم مصنع البطاقة مطلوب.")
            .MaximumLength(32).WithMessage("رقم مصنع البطاقة يجب ألا يتجاوز 32 حرفاً.")
            .Matches(@"^[A-Za-z0-9]+$").WithMessage("رقم مصنع البطاقة يجب أن يحتوي على أحرف وأرقام فقط.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("الاسم الكامل مطلوب.")
            .MaximumLength(200).WithMessage("الاسم لا يمكن أن يتجاوز 200 حرف.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("الدور الوظيفي مطلوب.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("كلمة المرور مطلوبة.")
            .MinimumLength(8).WithMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    }
}
