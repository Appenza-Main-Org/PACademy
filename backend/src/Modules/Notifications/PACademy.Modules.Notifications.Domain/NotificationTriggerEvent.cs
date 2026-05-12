namespace PACademy.Modules.Notifications.Domain;

public enum NotificationTriggerEvent
{
    ApplicationReceived,
    PaymentSucceeded,
    PaymentFailed,
    ExamScheduled,
    ExamResultPublished,
    AdmissionApproved,
    AdmissionRejected,
    DocumentRequired,
    AppointmentReminder,
    CycleOpened,
    CycleClosed,
}

public enum NotificationChannel { Sms, Email, InApp }
