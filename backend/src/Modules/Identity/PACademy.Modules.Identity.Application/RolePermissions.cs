namespace PACademy.Modules.Identity.Application;

public static class RolePermissions
{
    private static readonly Dictionary<string, IReadOnlyList<string>> _map = new()
    {
        ["super_admin"] = ["*"],
        ["committee_admin"] = [
            "applicants:view", "applicants:edit", "applicants:transition",
            "committees:manage", "barcode:print", "biometric:verify",
            "workflows:read", "workflows:write", "users:create",
        ],
        ["committee_user"] = ["applicants:view", "barcode:print", "biometric:verify"],
        ["medical_admin"] = ["medical:manage", "results:enter", "biometric:verify"],
        ["medical_doctor"] = ["medical:examine", "results:enter"],
        ["investigator"] = ["investigations:view", "investigations:edit"],
        ["board_admin"] = ["board:manage"],
        ["exams_admin"] = ["exams:manage", "questions:manage", "results:view"],
        ["biometric_user"] = ["biometric:verify"],
        ["records_clerk"] = ["results:enter"],
        ["applicant"] = ["applicant:view", "applicant:apply"],
        ["finance_review"] = ["payments:review", "payments:refund_eligibility", "reports:view"],
    };

    public static IReadOnlyList<string> ForRole(string role) =>
        _map.TryGetValue(role, out var perms) ? perms : Array.Empty<string>();
}
