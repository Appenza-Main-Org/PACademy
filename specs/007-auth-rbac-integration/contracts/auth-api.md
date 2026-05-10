# Contract — Auth API (`/auth/*`)

Endpoints owned by `AuthController` in `PACademy.Api`. All return `application/json`. All errors follow the spec-005 `ApiError` envelope (`{ code, message, conflictCode?, payload? }`).

## POST `/auth/login/request-otp`

Issue a 6-digit OTP and return a pending-session bearer.

### Request

```json
{
  "nationalId": "27001010150010",
  "password": "SuperAdmin123!"
}
```

### Response — 200 OK

```json
{
  "pendingId": "f3e2c1d0-...-abcd",
  "otpDevice": "•••• 4521",
  "otpExpiresAt": "2026-05-10T14:35:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `pendingId` | string (UUID v4) | Opaque server-side reference. Echoed back in `verify-otp`. Single-use; consumed by either successful verify or the lockout-triggering failed attempt. |
| `otpDevice` | string | Masked phone tail per FR-016. Only the last 4 digits revealed; rest is `•` characters. UI shows "تم إرسال رمز التحقق إلى الجهاز المنتهي بـ {otpDevice}". |
| `otpExpiresAt` | string (ISO-8601 UTC) | 5 minutes after `request-otp` succeeded. UI shows a countdown. |

### Response — 401 INVALID_CREDENTIALS

Bad NID or password. The masked phone tail is **not** revealed (no user enumeration leak).

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "بيانات الدخول غير صحيحة"
}
```

### Response — 403 ACCOUNT_LOCKED

User exists and password is correct, but `lockout_states` has a row for them. No new OTP issued; the existing `LockoutState.UnlocksAt` is surfaced so the UI can show the countdown.

```json
{
  "code": "ACCOUNT_LOCKED",
  "message": "الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل.",
  "payload": {
    "unlocksAt": "2026-05-10T14:55:00Z",
    "reason": "otp_failures"
  }
}
```

### Audit

- Outcome `pending` on success.
- Outcome `invalid_credentials` on 401.
- Outcome `account_already_locked` on 403.

Actor recorded as `_anonymous_` (well-known UUID) for failure paths; the target NID is captured under `target_label`. IP under `actor_ip`.

---

## POST `/auth/login/verify-otp`

Verify the 6-digit code against a pending row and mint the session.

### Request

```json
{
  "pendingId": "f3e2c1d0-...-abcd",
  "code": "493217"
}
```

### Response — 200 OK

```json
{
  "userId": "deaee750-d883-4f47-80fb-e03f3323e238",
  "nationalId": "27001010150010",
  "fullName": "الإدارة العليا للنظام",
  "role": "super_admin",
  "roleLabel": "مدير النظام الرئيسي",
  "unit": "قيادة الأكاديمية",
  "apps": ["admin","committee","board","investigations","medical","barcode","biometric","exams","architecture"],
  "permissions": ["*"],
  "token": "<cookie-managed; field reserved for future bearer-token transport>"
}
```

Matches `AuthUser` shape from `INTEGRATION_HANDOFF.md §5`. The session cookie (`pa-session`, HttpOnly, Secure in non-Development) is set by the response. The `token` field is reserved for a future bearer-token transport but stays empty for cookie-based sessions; the frontend reads the user shape from this body.

The `pending_otps` row is marked consumed (`ConsumedAt = UtcNow`) atomically with the session cookie issuance — if either fails, both fail, no leftovers.

### Response — 400 OTP_MISMATCH

The submitted code doesn't match the stored hash for `pendingId`. `AttemptCount++` on the pending row.

```json
{
  "code": "OTP_MISMATCH",
  "message": "رمز التحقق غير صحيح",
  "payload": {
    "remainingAttempts": 3
  }
}
```

`remainingAttempts = LockPolicy.maxFailedAttempts - AttemptCount`. Surfaced so the UI can warn at 1 remaining.

### Response — 400 OTP_EXPIRED

`pending_otps.ExpiresAt < UtcNow`.

```json
{
  "code": "OTP_EXPIRED",
  "message": "انتهت صلاحية رمز التحقق. أعد طلب رمز جديد."
}
```

### Response — 400 OTP_REUSED

`pending_otps.ConsumedAt != NULL`. Either an attacker is replaying or the user double-submitted.

```json
{
  "code": "OTP_REUSED",
  "message": "رمز التحقق مستخدم مسبقاً. أعد طلب رمز جديد."
}
```

### Response — 403 ACCOUNT_LOCKED

The verify attempt itself triggered the lockout (`AttemptCount` hit `LockPolicy.maxFailedAttempts`). A `LockoutState` row is created in the same transaction.

Same response shape as `request-otp` 403.

### Audit

- Outcome `success` on 200 (action `login_success`).
- Outcome `code_mismatch` on 400 OTP_MISMATCH (action `login_otp_failed`).
- Outcome `code_expired` on 400 OTP_EXPIRED (action `login_otp_failed`).
- Outcome `code_already_used` on 400 OTP_REUSED (action `login_otp_failed`).
- Outcome `success` on 403 ACCOUNT_LOCKED (action `account_locked`) — the lockout fired successfully even though the user-facing response is "denied".

---

## GET `/auth/me`

Return the currently authenticated user's `AuthUser` shape. Same envelope as `verify-otp` 200.

### Response — 200 OK

Same body as `verify-otp` 200.

### Response — 401 UNAUTHENTICATED

No valid session cookie.

```json
{
  "code": "UNAUTHENTICATED",
  "message": "Authentication required"
}
```

---

## POST `/auth/logout`

Clear the session cookie. Idempotent — calling without a session is fine.

### Response — 204 No Content

### Audit

- Action `logout`, outcome `success`.

---

## DEPRECATED — POST `/auth/login` (legacy single-step)

Stays wired during the cutover window per quickstart §Cutover sequence step 1, then removed in step 4. Returns:

```json
{
  "code": "DEPRECATED",
  "message": "Use /auth/login/request-otp + /auth/login/verify-otp"
}
```

with HTTP 410 Gone — the frontend doesn't call this; this is just a guard against operator confusion. Removed entirely after the cutover window.
