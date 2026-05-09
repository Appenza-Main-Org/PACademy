using FluentValidation;
using PACademy.Modules.Admissions.Application.Dtos;

namespace PACademy.Modules.Admissions.Application.Admin.Applicants;

public sealed class ApplicantPatchValidator : AbstractValidator<ApplicantPatchDto>
{
    public ApplicantPatchValidator()
    {
        // Per-field PATCH: each field optional (null = unchanged), but when
        // present, must satisfy the rule.
        // Status is NOT a PATCH field — see Resolved Clarification #15.
        When(x => x.FullName is not null, () =>
        {
            RuleFor(x => x.FullName!)
                .NotEmpty().WithMessage("الاسم الكامل لا يمكن أن يكون فارغاً.")
                .MaximumLength(300).WithMessage("الاسم لا يمكن أن يتجاوز 300 حرف.");
        });

        When(x => x.Mobile is not null && !string.IsNullOrEmpty(x.Mobile), () =>
        {
            RuleFor(x => x.Mobile!)
                .Matches(@"^(010|011|012|015)\d{8}$")
                .WithMessage("رقم الهاتف يجب أن يكون مصري (010/011/012/015 + 8 أرقام).");
        });

        When(x => x.Email is not null && !string.IsNullOrEmpty(x.Email), () =>
        {
            RuleFor(x => x.Email!)
                .EmailAddress().WithMessage("البريد الإلكتروني غير صحيح.")
                .MaximumLength(200);
        });

        When(x => x.Governorate is not null, () =>
        {
            RuleFor(x => x.Governorate!).MaximumLength(100);
        });
    }
}
