namespace PACademy.Modules.Payments.Domain;

/// <summary>
/// Fawry payment lifecycle. Mirrors the frontend's
/// <c>FawryPaymentStatus</c> union shape; wire format is camelCase
/// (configured globally in Program.cs via JsonStringEnumConverter).
/// </summary>
public enum PaymentStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Expired = 3,
    Refunded = 4,
}
