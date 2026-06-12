using System.Text.Json.Nodes;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Modules.Reports.Queries;

/// <summary>
/// Resolves an applicant row's pipeline stage (1..11) for report placement.
/// Portal rows persist `stage` (furthest reached) and win as-is; admin-created
/// and data-exchange-imported rows often carry no stage — for those the
/// furthest stage derives from real milestone evidence on the row, so they
/// don't all misfile into stage 1 («رقم الهاتف»).
/// </summary>
public static class ApplicantStageDerivation
{
    public const int StageCount = 11;

    /// <summary>Canonical Arabic labels for the 11 applicant pipeline stages —
    /// the single backend source (mirrors the frontend STAGE_LABELS contract).</summary>
    public static readonly string[] StageLabels =
    [
        "رقم الهاتف",
        "رسالة التأكيد",
        "البيانات الشخصية",
        "بيانات المؤهل",
        "الحالة الاجتماعية",
        "سداد الرسوم",
        "بيانات الأسرة",
        "موعد الاختبار",
        "كارت التردد",
        "المتابعة",
        "وثيقة التعارف"
    ];

    public static string StageLabelOf(int stage) => StageLabels[Math.Clamp(stage, 1, StageCount) - 1];

    private const int FinalStage = StageCount;          // وثيقة التعارف
    private const int FollowUpStage = 10;               // المتابعة — exam outcomes recorded
    private const int AttendanceCardStage = 9;          // كارت التردد printed
    private const int ExamBookedStage = 8;              // موعد الاختبار reserved
    private const int FamilyStage = 7;                  // بيانات الأسرة — paid means stage 6 is done

    public static int StageOf(JsonObject row)
    {
        var stored = AdminRecordJson.NumberProp(row, "stage") ?? AdminRecordJson.NumberProp(row, "currentStage");
        if (stored is not null) return Math.Clamp((int)stored.Value, 1, StageCount);
        if (Text(row, "status") == "approved") return FinalStage;
        if (row["followUp"] is JsonObject followUp && followUp.Count > 0) return FollowUpStage;
        if (!string.IsNullOrWhiteSpace(Text(row, "attendanceCardPrintedAt"))) return AttendanceCardStage;
        if (HasExamBooking(row)) return ExamBookedStage;
        if (Text(row, "paymentStatus") == "paid") return FamilyStage;
        return 1;
    }

    private static bool HasExamBooking(JsonObject row) =>
        (row["examSlot"] is JsonObject slot && slot.Count > 0)
            || !string.IsNullOrWhiteSpace(Text(row, "examSlotId"))
            || !string.IsNullOrWhiteSpace(Text(row, "firstExamDate"));

    private static string? Text(JsonObject row, string name) => AdminRecordJson.StringProp(row, name);
}
