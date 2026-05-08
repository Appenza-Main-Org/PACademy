namespace PACademy.Application.Identity;

public static class RoleApps
{
    public static IReadOnlyList<string> ForRole(string role) => role switch
    {
        "super_admin" => ["admin", "committee", "board", "investigations", "medical", "barcode", "biometric", "exams", "architecture"],
        "committee_admin" => ["admin", "committee", "barcode", "biometric"],
        "committee_user" => ["committee", "barcode", "biometric"],
        "medical_admin" => ["medical", "barcode", "biometric"],
        "medical_doctor" => ["medical"],
        "investigator" => ["investigations"],
        "board_admin" => ["board"],
        "exams_admin" => ["exams"],
        "biometric_user" => ["biometric"],
        "records_clerk" => ["medical", "exams"],
        "applicant" => ["applicant"],
        _ => Array.Empty<string>(),
    };
}
