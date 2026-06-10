namespace PACademy.Admin.Api.Modules.OperationalRecords;

/// <summary>
/// Single source of truth for which operational modules have been promoted
/// from the legacy JSON bucket tables to normalized typed tables (the
/// NormalizeOperationalRecords / NormalizeCommitteeInstances /
/// NormalizeWorkflowsCommittees migration wave).
///
/// <c>OperationalRecordsService</c> uses <see cref="KindFor"/> to route reads
/// and writes to the typed tables; <c>OperationalRecordStore</c> uses
/// <see cref="Contains"/> to refuse accidental legacy reads of these modules
/// (the legacy buckets stopped receiving rows for them, so such a read
/// silently returns a frozen snapshot).
/// </summary>
public static class NormalizedOperationalModules
{
    public static bool Contains(string module) => KindFor(module) is not null;

    public static string? KindFor(string module) => module switch
    {
        "applicants" => "applicants",
        "grades" => "grades",
        "cycles" => "cycles",
        "categories" => "categories",
        "committeeInstances" => "committeeInstances",
        "payments" => "payments",
        "exam-committee-users" => "examCommitteeUsers",
        "exam-devices" => "examDevices",
        "examResults" => "examResults",
        "exam-results" => "examAttemptResults",
        "biometric-enrollments" => "biometricEnrollments",
        "notifications" => "notifications",
        "examPlans" => "examPlans",
        "committeeResults" => "committeeResults",
        "workflows" => "workflows",
        "applicantWorkflowProgress" => "applicantWorkflowProgress",
        "committees" => "committees",
        _ => null
    };
}
