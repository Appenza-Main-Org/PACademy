# Contract — Error Codes (Auth additions)

Extends the `Shared.Contracts/ErrorCodes.cs` registry from spec 005.

| Code | HTTP | Where thrown | Frontend Arabic copy |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | `RequestOtpUseCase` (bad NID or password) | "بيانات الدخول غير صحيحة" |
| `ACCOUNT_LOCKED` | 403 | `RequestOtpUseCase`, `VerifyOtpUseCase` | "الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل." |
| `OTP_MISMATCH` | 400 | `VerifyOtpUseCase` (code wrong) | "رمز التحقق غير صحيح" |
| `OTP_EXPIRED` | 400 | `VerifyOtpUseCase` (5-min window passed) | "انتهت صلاحية رمز التحقق. أعد طلب رمز جديد." |
| `OTP_REUSED` | 400 | `VerifyOtpUseCase` (pending row already consumed) | "رمز التحقق مستخدم مسبقاً. أعد طلب رمز جديد." |
| `UNAUTHENTICATED` | 401 | Anywhere requiring auth without a session | "Authentication required" *(generic — UI shows session-expired toast)* |
| `PERMISSION_DENIED` | 403 | `PermissionRequirementHandler` | "ليس لديك الصلاحية للقيام بهذا الإجراء" |
| `VALIDATION_FAILED` | 400 | `UpdateLockPolicyUseCase`, `LookupOfficerUseCase` | *(field-specific copy from `payload.errors[*].constraint`)* |
| `NOT_FOUND` | 404 | `UnlockUserUseCase` (user not locked / not found) | "المستخدم غير موجود" *(or "المستخدم غير موقوف حالياً")* |
| `OFFICER_NOT_FOUND` | 404 | `LookupOfficerUseCase` | "لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط" |
| `OFFICER_LOOKUP_UNAVAILABLE` | 503 | `MoipassOfficerLookup` (timeout / circuit open) | "خدمة البحث عن الضباط غير متاحة حالياً. حاول مرة أخرى." |
| `DEPRECATED` | 410 | Legacy `/auth/login` route after cutover | *(internal — only for ops/curl confusion; UI never sees this)* |

## Envelope

All errors follow the standard `ApiError` shape:

```json
{
  "code": "OTP_MISMATCH",
  "message": "رمز التحقق غير صحيح",
  "payload": {
    "remainingAttempts": 3
  }
}
```

`payload` is optional and shape-specific per error code. Documented per-endpoint in `auth-api.md` / `lock-policy-api.md` / `officers-api.md`.
