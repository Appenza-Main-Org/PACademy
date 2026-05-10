# Phase 1 Data Model — Auth + RBAC Integration

## §1 — Owning context

All entities in this spec are owned by **`IdentityDbContext`** (introduced in spec 005, dormant through spec 006, activated here).

Three new tables under `__EFMigrationsHistory_Identity`:

| Table | Purpose | Lifecycle |
|---|---|---|
| `pending_otps` | Server-side state for in-flight OTP verifications | Transient (5-min TTL) |
| `lockout_states` | Per-user lockout counter and unlock-at timestamp | Long-lived; cleared on success or manual unlock |
| `lock_policy` | Single-row org-wide lockout policy | Permanent; one row only |

Two existing tables migrate ownership from `PaDbContext` → `IdentityDbContext`:
- `system_users` (existing data preserved; only EF configuration source moves)
- `sessions` (same)

AspNet Identity tables (`AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserRoles`, `AspNetUserTokens`, `AspNetRoles`, `AspNetRoleClaims`) likewise transition to `IdentityDbContext`. No DDL changes; the base class call inside `IdentityDbContext.OnModelCreating` (via `IdentityDbContext<SystemUser, IdentityRole<Guid>, Guid>`) handles them.

## §2 — Existing entities (unchanged)

### SystemUser (`system_users`)

| Column | Type | Notes |
|---|---|---|
| Id | uniqueidentifier PK | |
| NationalId | nvarchar(14) UNIQUE | Egyptian NID format `\d{14}` |
| OfficerCode | nvarchar(50) | |
| FullName | nvarchar(300) | Arabic collation `Arabic_100_CI_AS_SC` (per spec 006) |
| Mobile | nvarchar(20) | Egyptian mobile `^(010\|011\|012\|015)\d{8}$` |
| Email | nvarchar(200) | |
| IssueDate | date | |
| CardFactoryNumber | nvarchar(50) | |
| Role | nvarchar(50) | One of the 12 seeded role keys |
| Unit | nvarchar(200) | |
| IsActive | bit | |
| Archived | bit | Soft-delete flag |
| ArchivedAt | datetime2 NULL | |
| DemoOrigin | bit | FR-017 from spec 003 |
| CreatedAt | datetime2 | |
| (AspNet Identity columns) | | UserName, NormalizedUserName, PasswordHash, ConcurrencyStamp, SecurityStamp, LockoutEnabled, LockoutEnd, AccessFailedCount, EmailConfirmed, PhoneNumberConfirmed, TwoFactorEnabled, NormalizedEmail, PhoneNumber |

`UserName` is mirrored from `NationalId` so `UserManager.FindByNameAsync(nid)` works without a custom store query (legacy convention from spec 003).

### Session (`sessions`)

Existing shape unchanged. Lifecycle owned by the cookie auth middleware.

## §3 — New entities

### PendingOtp (`pending_otps`)

| Column | Type | Notes |
|---|---|---|
| Id | uniqueidentifier PK | The opaque `pendingId` returned to the client |
| UserId | uniqueidentifier FK → system_users.Id | Subject of the in-flight verification |
| CodeHash | nvarchar(128) | PBKDF2-hashed OTP code (never store cleartext) |
| MaskedPhoneTail | nvarchar(20) | E.g. `•••• 4521`; surfaced to UI for confirmation |
| ExpiresAt | datetime2 | `CreatedAt + 5 minutes` |
| AttemptCount | int | Increments on each failed verify; resets on success |
| CreatedAt | datetime2 | UTC |
| ConsumedAt | datetime2 NULL | Set when the row is verified successfully (single-use enforcement) |

Indexes:
- `IX_pending_otps_user_id_active` filtered `WHERE ConsumedAt IS NULL` — supports the "newest pending OTP per user" query for the "concurrent OTP requests for the same user" edge case (the older pending row gets soft-invalidated).
- `IX_pending_otps_expires_at` — supports the background sweep job.

State transitions:

```
[created] ──verify success──▶ [consumed]    (terminal)
   │
   ├──verify wrong code──▶ [created] (AttemptCount++)
   │
   ├──AttemptCount reaches LockPolicy.maxFailedAttempts──▶ [locked]   (triggers LockoutState row)
   │
   └──ExpiresAt passes──▶ [expired]    (terminal — swept after 24h grace)
```

A new `request-otp` for a user with an existing un-consumed pending row INVALIDATES the prior row (sets `ConsumedAt = UtcNow`) and creates a fresh row. Only the latest pending row is acceptable on verify.

### LockoutState (`lockout_states`)

| Column | Type | Notes |
|---|---|---|
| UserId | uniqueidentifier PK & FK | One row per locked user |
| LockedAt | datetime2 | When the lockout fired |
| UnlocksAt | datetime2 | `LockedAt + LockPolicy.lockDurationMinutes` |
| Reason | nvarchar(100) | E.g. `otp_failures`, `manual_lock` (reserved for future) |
| FailedAttemptCount | int | Counter that triggered the lock; preserved for forensics |

Indexes:
- `IX_lockout_states_unlocks_at` — supports the auto-unlock background sweep.

State transitions:

```
[active] ──UnlocksAt passes──▶ [auto-cleared]    (sweeper deletes the row, emits audit `lockout_auto_cleared`)
   │
   └──manual unlock──▶ [manually-cleared]    (sweeper deletes the row, emits audit `manual_unlock`)
```

A `LockoutState` row's existence (regardless of `UnlocksAt`) means the user is locked. Auto-cleared via a sweeper rather than a computed property to keep the state explicit and to give the audit log a clear `lockout_auto_cleared` event.

### LockPolicy (`lock_policy`)

| Column | Type | Notes |
|---|---|---|
| Id | tinyint PK | Always `1` (single-row table; constraint `CHECK (Id = 1)`) |
| MaxFailedAttempts | int | Range `[1, 10]`; default `5` |
| LockDurationMinutes | int | Range `[5, 120]`; default `30` |
| UpdatedAt | datetime2 | |
| UpdatedBy | uniqueidentifier FK → system_users.Id | |

Range validation lives in `UpdateLockPolicyUseCase` (FR-007), enforced before save. The `CHECK` constraint on `Id = 1` plus the PK guarantees there's only ever one row — even malicious direct DB inserts cannot create a second policy.

Seeded by `IdentityDemoSeeder` with `(MaxFailedAttempts=5, LockDurationMinutes=30)`.

## §4 — Read-only DTOs (not persisted)

### OfficerRecord

Shape returned by `IOfficerLookup.LookupAsync(...)`:

```csharp
public sealed record OfficerRecord(
    string NationalId,
    string OfficerCode,
    string FullName,
    string Mobile,
    string Email,
    DateTime IssueDate,
    string CardFactoryNumber,
    string Unit
);
```

Returned verbatim to the admin from `GET /v1/officers/lookup`. Not persisted in the academy DB. The MOIPASS implementation maps from MOIPASS's own response shape; the stub implementation maps from seeded `system_users` rows.

## §5 — Cross-cutting concerns

### Audit emissions (FR-013)

Every entity mutation in this spec emits an audit row through `IAuditApi.RecordAsync(...)` (the contract from spec 005). Action verb registry extension:

| Action | Emitted by | Outcome states |
|---|---|---|
| `login_request` | `RequestOtpUseCase` | `pending`, `invalid_credentials`, `account_already_locked` |
| `login_success` | `VerifyOtpUseCase` | `success` |
| `login_otp_failed` | `VerifyOtpUseCase` | `code_mismatch`, `code_expired`, `code_already_used` |
| `account_locked` | `VerifyOtpUseCase` (when crossing threshold) | `success` |
| `lockout_auto_cleared` | Sweeper | `success` |
| `manual_unlock` | `UnlockUserUseCase` | `success` |
| `lock_policy_updated` | `UpdateLockPolicyUseCase` | `success` (with before/after JSON) |
| `permission_denied` | `PermissionRequirementHandler` | `success` |

Pre-auth events (`login_request` with `invalid_credentials`, `login_otp_failed`) record the actor as the synthetic `_anonymous_` (well-known UUID `00000000-0000-0000-0000-000000000000`) with the request's IP captured under `actor_ip`. The target NID is recorded under `target_label`. This reuses the existing audit schema without changes.

### Permission wildcard semantics (FR-012)

```csharp
public bool Has(IReadOnlyList<string> userPermissions, string required)
{
    // 1. super-admin: '*' matches anything
    if (userPermissions.Contains("*")) return true;

    // 2. exact match
    if (userPermissions.Contains(required)) return true;

    // 3. resource wildcard: 'committees:*' matches 'committees:view', 'committees:manage', etc.
    var colonIndex = required.IndexOf(':');
    if (colonIndex < 0) return false;
    var resourcePrefix = required[..(colonIndex + 1)] + "*"; // 'committees:*'
    return userPermissions.Contains(resourcePrefix);
}
```

No regex, no string parsing beyond a single `IndexOf`. Constant-time per check; ≤ 1 µs in benchmarks (well within the SC ≤ 1 ms p95 budget).

## §6 — Migration plan

A single new EF migration on `IdentityDbContext`: `20260510NNNNNN_007_AuthRbacIntegration` containing:

1. `CREATE TABLE pending_otps` (with the indexes from §3)
2. `CREATE TABLE lockout_states` (with the index from §3)
3. `CREATE TABLE lock_policy` (with the `CHECK (Id = 1)` constraint)
4. The `system_users` / `sessions` / AspNet Identity tables already exist on the remote DB (created by `PaDbContext`'s migrations) — the new migration explicitly does NOT recreate them. The EF model snapshot for `IdentityDbContext` captures them so future migrations track changes correctly.

The migration is run via `dotnet ef database update --context IdentityDbContext` (per quickstart.md Step 3).

No data migration needed — existing rows in `system_users` / `sessions` work unchanged because the column shapes are identical. Only the migration history ownership shifts from `__EFMigrationsHistory_Audit` (where ReportSnapshotTables sits) to `__EFMigrationsHistory_Identity` (where this new migration lands), via the spec-005 `005_split_migration_history.sql` script that has already run on remote.

## §7 — Indexes summary (new)

| Index | Table | Definition | Purpose |
|---|---|---|---|
| `IX_pending_otps_user_id_active` | `pending_otps` | `(UserId)` filtered `WHERE ConsumedAt IS NULL` | Find latest active pending row per user |
| `IX_pending_otps_expires_at` | `pending_otps` | `(ExpiresAt)` | Background sweep |
| `IX_lockout_states_unlocks_at` | `lockout_states` | `(UnlocksAt)` | Background sweep for auto-unlock |

No additional indexes on `system_users` / `sessions` — existing ones suffice.

## §8 — Soft-delete + `DemoOrigin` posture

- `pending_otps`: NOT soft-deletable. Transient state; deleted by sweeper on expiry.
- `lockout_states`: NOT soft-deletable. Cleared row = unlocked user.
- `lock_policy`: NOT soft-deletable. Single-row table.
- All three new tables carry a `DemoOrigin` column for parity with the FR-017 (spec 003) durability rule, but no demo seeder writes to `pending_otps` or `lockout_states` (transient). `lock_policy` gets `DemoOrigin = true` on the seed row so a future "wipe demo data" operation knows it can reset to factory defaults.

Note: `DemoOrigin` is added to `lock_policy` only, not `pending_otps` / `lockout_states` — those are transient, the flag would be misleading.
