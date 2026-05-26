namespace PACademy.Shared.Contracts;

public static class ErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string Conflict = "CONFLICT";
    public const string DependencyBlocked = "DEPENDENCY_BLOCKED";
    public const string NotFound = "NOT_FOUND";
    public const string Forbidden = "FORBIDDEN";
    public const string InternalError = "INTERNAL_ERROR";

    public const string LookupCodeDuplicate = "LOOKUP_CODE_DUPLICATE";
    public const string DuplicateCode = "DUPLICATE_CODE";
    public const string InUse = "IN_USE";
    public const string ActiveCycleExists = "ACTIVE_CYCLE_EXISTS";
    public const string NoActiveCycle = "NO_ACTIVE_CYCLE";
    public const string CycleActivationIncomplete = "CYCLE_ACTIVATION_INCOMPLETE";
    public const string NidCycleDuplicate = "NID_CYCLE_DUPLICATE";
    public const string ExamOrderDuplicate = "EXAM_ORDER_DUPLICATE";
    public const string CommitteeAtCapacity = "COMMITTEE_AT_CAPACITY";
}
