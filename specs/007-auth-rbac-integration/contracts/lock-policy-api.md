# Contract — Lock Policy API (`/auth/lock-policy/*`)

Endpoints owned by `LockPolicyController` in `PACademy.Api`. Restricted to `super_admin` (permission `*`); other roles get 403 PERMISSION_DENIED.

## GET `/auth/lock-policy`

Return the current single-row policy.

### Response — 200 OK

```json
{
  "maxFailedAttempts": 5,
  "lockDurationMinutes": 30
}
```

---

## PATCH `/auth/lock-policy`

Update the policy. Both fields optional; only the provided fields change.

### Request

```json
{
  "maxFailedAttempts": 7,
  "lockDurationMinutes": 60
}
```

### Response — 200 OK

Same shape as GET. Returns the post-update state.

### Response — 400 VALIDATION_FAILED

Field out of range.

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Invalid lock policy values",
  "payload": {
    "errors": [
      { "field": "maxFailedAttempts", "constraint": "must be 1..10", "value": 0 },
      { "field": "lockDurationMinutes", "constraint": "must be 5..120", "value": 999 }
    ]
  }
}
```

### Audit

- Action `lock_policy_updated`, outcome `success`. `before` and `after` JSON capture the full policy on either side of the change.

---

## GET `/auth/lock-policy/locked-users`

List all users currently in `lockout_states`.

### Response — 200 OK

```json
{
  "items": [
    {
      "userId": "9f1e...",
      "name": "موظف لجنة القبول",
      "role": "committee_user",
      "reason": "otp_failures",
      "lockedAt": "2026-05-10T14:00:00Z",
      "unlocksAt": "2026-05-10T14:30:00Z"
    }
  ],
  "total": 1
}
```

Sorted by `unlocksAt` ascending (next-to-unlock first). No pagination — list is bounded by total active users; even at 1000 users with all locked it's a single small page.

---

## POST `/auth/lock-policy/unlock`

Manually clear a user's lockout.

### Request

```json
{
  "userId": "9f1e..."
}
```

### Response — 204 No Content

The `LockoutState` row is deleted; any pending OTP rows for the user are also invalidated (`ConsumedAt = UtcNow`) so the user's next sign-in starts clean. The user can `request-otp` immediately.

### Response — 404 NOT_FOUND

User exists but isn't currently locked.

```json
{
  "code": "NOT_FOUND",
  "message": "User is not currently locked"
}
```

### Response — 404 NOT_FOUND (variant)

User does not exist at all.

```json
{
  "code": "NOT_FOUND",
  "message": "User not found"
}
```

### Audit

- Action `manual_unlock`, outcome `success`. `before` JSON captures `LockoutState` row; `after` is null. The actor (the unlocking super-admin) is in `actor_id` / `actor_name` per the standard audit shape.
