using FluentValidation;

namespace PACademy.Modules.ApplicantGradesAdmin.Application.Grades;

public sealed class AddAdjustmentValidator : AbstractValidator<AddAdjustmentRequest>
{
    public AddAdjustmentValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty()
            .Must(x => GradeConstants.ReasonLabels.ContainsKey(x))
            .WithMessage("سبب التعديل غير معروف.");

        RuleFor(x => x.Note)
            .MaximumLength(500);

        When(x => x.Reason == GradeConstants.ReasonOther, () =>
        {
            RuleFor(x => x.Note).NotEmpty().WithMessage("ملاحظات السبب مطلوبة عند اختيار أخرى.");
        });

        RuleFor(x => x.Amount)
            .NotEqual(0)
            .GreaterThanOrEqualTo(-100)
            .LessThanOrEqualTo(100);

        RuleFor(x => x.OverrideMax)
            .GreaterThan(0)
            .When(x => x.OverrideMax.HasValue);
    }
}

public sealed class UpdateOverrideMaxValidator : AbstractValidator<UpdateOverrideMaxRequest>
{
    public UpdateOverrideMaxValidator()
    {
        RuleFor(x => x.OverrideMax)
            .GreaterThan(0)
            .When(x => x.OverrideMax.HasValue);
    }
}

public sealed class StageImportValidator : AbstractValidator<StageImportRequest>
{
    public StageImportValidator()
    {
        RuleFor(x => x.Kind).NotEmpty();
        RuleFor(x => x.MaxDegree).GreaterThan(0);
        RuleFor(x => x.Rows).NotNull();
    }
}

public sealed class RunImportCommitValidator : AbstractValidator<RunImportCommitRequest>
{
    public RunImportCommitValidator()
    {
        RuleFor(x => x.GraduationYear).InclusiveBetween(1900, 2200);
        RuleFor(x => x.Rows).NotNull();
        RuleFor(x => x.SelectedSchoolCategories).NotNull();
        RuleFor(x => x.MaxGradeByCategory).NotNull();
        RuleForEach(x => x.MaxGradeByCategory.Values).GreaterThan(0);
    }
}
