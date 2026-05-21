namespace PACademy.Shared.Domain.Grades;

/// <summary>
/// Imported applicant grade row. Shape mirrors the frontend GradeRow type.
/// Adjustments are stored separately so original imported totals remain intact.
/// </summary>
public sealed class ApplicantGrade
{
    private readonly List<ApplicantGradeAdjustment> _adjustments = [];

    private ApplicantGrade() { }

    public Guid Id { get; private set; }
    public int Seat { get; private set; }
    public string? SeatingNumber { get; private set; }
    public string Nid { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string Kind { get; private set; } = default!;
    public string Gender { get; private set; } = default!;
    public string Branch { get; private set; } = default!;
    public int? GraduationYear { get; private set; }
    public string? SchoolCategoryCode { get; private set; }
    public string School { get; private set; } = default!;
    public string Region { get; private set; } = default!;
    public string? ExamRound { get; private set; }
    public decimal Total { get; private set; }
    public decimal ImportMax { get; private set; }
    public decimal? OverrideMax { get; private set; }
    public string? LastEditedAt { get; private set; }
    public string? LastEditedBy { get; private set; }
    public DateTimeOffset? GradeChangedAt { get; private set; }
    public decimal? PreviousGrade { get; private set; }
    public string Status { get; private set; } = "—";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;
    public IReadOnlyCollection<ApplicantGradeAdjustment> Adjustments => _adjustments;

    public static ApplicantGrade Create(
        int seat,
        string? seatingNumber,
        string nid,
        string name,
        string kind,
        string gender,
        string branch,
        int? graduationYear,
        string? schoolCategoryCode,
        string school,
        string region,
        string? examRound,
        decimal total,
        decimal importMax,
        string status = "—")
    {
        if (seat <= 0) throw new ArgumentException("seat required", nameof(seat));
        if (string.IsNullOrWhiteSpace(nid)) throw new ArgumentException("nid required", nameof(nid));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name required", nameof(name));
        if (importMax <= 0) throw new ArgumentException("import max must be positive", nameof(importMax));

        var now = DateTimeOffset.UtcNow;
        return new ApplicantGrade
        {
            Id = Guid.NewGuid(),
            Seat = seat,
            SeatingNumber = string.IsNullOrWhiteSpace(seatingNumber) ? null : seatingNumber.Trim(),
            Nid = nid.Trim(),
            Name = name.Trim(),
            Kind = kind,
            Gender = gender,
            Branch = branch,
            GraduationYear = graduationYear,
            SchoolCategoryCode = string.IsNullOrWhiteSpace(schoolCategoryCode) ? null : schoolCategoryCode.Trim(),
            School = string.IsNullOrWhiteSpace(school) ? "—" : school.Trim(),
            Region = string.IsNullOrWhiteSpace(region) ? "—" : region.Trim(),
            ExamRound = string.IsNullOrWhiteSpace(examRound) ? null : examRound.Trim(),
            Total = total,
            ImportMax = importMax,
            Status = string.IsNullOrWhiteSpace(status) ? "—" : status.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            RowVersion = [],
        };
    }

    public void ReplaceFromImport(
        string? seatingNumber,
        string name,
        string kind,
        string gender,
        string branch,
        int? graduationYear,
        string? schoolCategoryCode,
        string school,
        string region,
        string? examRound,
        decimal total,
        decimal importMax)
    {
        if (Total != total)
        {
            PreviousGrade = Total;
            GradeChangedAt = DateTimeOffset.UtcNow;
        }

        SeatingNumber = string.IsNullOrWhiteSpace(seatingNumber) ? SeatingNumber : seatingNumber.Trim();
        Name = name.Trim();
        Kind = kind;
        Gender = gender;
        Branch = branch;
        GraduationYear = graduationYear;
        SchoolCategoryCode = string.IsNullOrWhiteSpace(schoolCategoryCode) ? SchoolCategoryCode : schoolCategoryCode.Trim();
        School = string.IsNullOrWhiteSpace(school) ? School : school.Trim();
        Region = string.IsNullOrWhiteSpace(region) ? Region : region.Trim();
        ExamRound = string.IsNullOrWhiteSpace(examRound) ? ExamRound : examRound.Trim();
        Total = total;
        ImportMax = importMax;
        LastEditedAt = "الآن";
        LastEditedBy = "استيراد ملف";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetOverrideMax(decimal? value)
    {
        OverrideMax = value;
        TouchEdited();
    }

    public ApplicantGradeAdjustment AddAdjustment(
        string reason,
        string reasonLabel,
        string note,
        decimal amount,
        string by)
    {
        var adjustment = ApplicantGradeAdjustment.Create(Id, reason, reasonLabel, note, amount, by);
        _adjustments.Add(adjustment);
        TouchEdited();
        return adjustment;
    }

    public void ToggleAdjustment(Guid adjustmentId, bool isActive)
    {
        var adjustment = _adjustments.FirstOrDefault(x => x.Id == adjustmentId)
            ?? throw new KeyNotFoundException("التعديل غير موجود.");
        adjustment.SetActive(isActive);
        TouchEdited();
    }

    public void DeleteAdjustment(Guid adjustmentId)
    {
        var adjustment = _adjustments.FirstOrDefault(x => x.Id == adjustmentId)
            ?? throw new KeyNotFoundException("التعديل غير موجود.");
        _adjustments.Remove(adjustment);
        TouchEdited();
    }

    public void DeactivateAdjustments()
    {
        foreach (var adjustment in _adjustments.Where(x => x.IsActive))
        {
            adjustment.SetActive(false);
        }
        TouchEdited();
    }

    private void TouchEdited()
    {
        LastEditedAt = "الآن";
        LastEditedBy ??= "مسؤول النظام";
        GradeChangedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
