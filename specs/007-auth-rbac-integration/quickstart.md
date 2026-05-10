# Quickstart — Auth + RBAC Integration

> Operator's guide for rolling out spec 007. Cutover sequence, verification gates, rollback. Read this end-to-end before opening the controllers.

## Prerequisites

1. Spec 006 (DB switching) merged to `main` — remote DB is on the GCP SQL 2017 instance with portable collation and migration history split applied.
2. Local dev DB or remote DB is reachable and migrations are at `004b_LookupsCrudCompleteSchema` (the latest from spec 005's snapshot).
3. `dotnet ef` v10 installed (`dotnet ef --version` ≥ `10.0.7`).
4. Frontend is on the `006-switching-database` branch or later — i.e. the merged frontend includes Ghareeb's two-step OTP flow consumer.

## Environment-specific config

Add three keys to each environment's `appsettings.<env>.json`:

```json
{
  "Otp": {
    "Transport": "InMemory",
    "ValidityMinutes": 5
  },
  "OfficerLookup": {
    "Source": "Stub",
    "Moipass": {
      "BaseUrl": null,
      "ApiKey": null
    }
  },
  "LockPolicy": {
    "Defaults": {
      "MaxFailedAttempts": 5,
      "LockDurationMinutes": 30
    }
  }
}
```

| Env | `Otp.Transport` | `OfficerLookup.Source` |
|---|---|---|
| Development | `InMemory` | `Stub` |
| Staging | `Sms` | `MOIPASS` |
| Production | `Sms` | `MOIPASS` |

`Sms` requires the SMS-vendor settings (TBD with ops, D-003); the bootstrapper throws `OtpTransportNotConfiguredException` at startup if `Sms` is selected without vendor config — fail-loud.

`MOIPASS` requires `OfficerLookup.Moipass.BaseUrl` + `ApiKey`; same fail-loud bootstrap check.

## Cutover sequence (5 ordered steps)

### Step 1 — Deploy with both old and new endpoints active

Deploy the spec-007 build. New endpoints (`/auth/login/request-otp`, `/auth/login/verify-otp`, `/auth/lock-policy/*`, `/v1/officers/lookup`) are live. Legacy `/auth/login` is still wired and operational. The frontend may use either flow.

**Verification**:

```bash
# legacy still works
curl -i -X POST $API/auth/login -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'
# new endpoint works too
curl -i -X POST $API/auth/login/request-otp -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'
```

Both return 200; legacy returns the full session, new endpoint returns `{ pendingId, otpDevice, otpExpiresAt }`.

### Step 2 — Run the new EF migration

```bash
cd backend
dotnet ef database update --context IdentityDbContext --project src/Modules/Identity/PACademy.Modules.Identity.Infrastructure --startup-project src/PACademy.Api
```

Creates `pending_otps`, `lockout_states`, `lock_policy`. Seeds `lock_policy` with `(MaxFailedAttempts=5, LockDurationMinutes=30, DemoOrigin=true)`. Idempotent — re-runnable.

**Verification**:

```sql
SELECT name FROM sys.tables WHERE name IN ('pending_otps','lockout_states','lock_policy');
SELECT * FROM lock_policy;
```

Expect 3 tables, 1 lock_policy row.

### Step 3 — Frontend canary uses new endpoints exclusively

Frontend's `auth.service.ts` now calls `request-otp` + `verify-otp` only. Confirm by traffic inspection:

```bash
# Tail backend access log; confirm /auth/login (legacy) traffic is zero
tail -f /var/log/pacademy/access.log | grep "POST /auth/login\b" | wc -l
```

Run for at least 4 hours (covers a full demo working day). If any traffic appears on the legacy route, investigate before proceeding to Step 4.

### Step 4 — Remove legacy registration; redeploy

In `backend/src/PACademy.Infrastructure/DependencyInjection.cs`:

```diff
-    services.AddIdentity<SystemUser, IdentityRole<Guid>>(opt => { ... })
-        .AddEntityFrameworkStores<PaDbContext>()
-        .AddSignInManager<SignInManager<SystemUser>>()
-        .AddDefaultTokenProviders();
+    // Identity stores moved to IdentityModule (spec 007). Closing T326 from spec 005.
```

In `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/IdentityModule.cs`:

```diff
+    // Spec 007: re-enable AspNet Identity stores against IdentityDbContext.
+    // Was gated off in spec 005 commit de08f72 to avoid overriding the legacy registration.
+    services.AddIdentityCore<SystemUser>(opt =>
+    {
+        opt.Password.RequireDigit = true;
+        opt.Password.RequiredLength = 8;
+        opt.Lockout.MaxFailedAccessAttempts = 5;
+    })
+    .AddRoles<IdentityRole<Guid>>()
+    .AddEntityFrameworkStores<IdentityDbContext>()
+    .AddSignInManager<SignInManager<SystemUser>>()
+    .AddDefaultTokenProviders();
+
+    services.AddScoped<IIdentityProvider, InSystemIdentityProvider>();
```

In `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Persistence/IdentityDbContext.cs`:

```diff
+    // Add SystemUserConfiguration + SessionConfiguration to map system_users / sessions
+    // (the legacy SystemUserConfiguration in PACademy.Infrastructure/Persistence/Configurations/
+    // moves into Modules/Identity/.../Persistence/Configurations/ in this spec).
```

Make legacy `/auth/login` return 410 GONE per `contracts/auth-api.md`.

Redeploy. The `RegistrationOverlapTests` suite verifies only one `IUserStore<SystemUser>` is registered after this step.

**Verification**:

```bash
curl -i -X POST $API/auth/login -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'
# expect HTTP 410 Gone, body {"code":"DEPRECATED",...}
```

```bash
curl -i -X POST $API/auth/login/request-otp -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'
# expect HTTP 200 with {pendingId,otpDevice,otpExpiresAt}
```

### Step 5 — All-roles smoke test

Sign in as each of the 11 seeded role users (super_admin, committee_admin, committee_user, medical_admin, medical_doctor, investigator, board_admin, exams_admin, biometric_user, records_clerk, applicant) via the new flow. Confirm:

1. OTP arrives on the configured channel (`InMemory` → check API logs; `Sms` → check the test phone).
2. `verify-otp` returns the correct `permissions` array per `INTEGRATION_HANDOFF.md §5` (the role table).
3. Hub loads with the apps appropriate to the role.

## Rollback plan

The cutover is reversible up to and including Step 4. Per-step rollback:

| Step | Rollback | Risk |
|---|---|---|
| 1 | `git revert` the deployment commit | Minimal — both flows were live; reverting keeps the legacy live |
| 2 | `DROP TABLE pending_otps, lockout_states, lock_policy` | Minimal — tables are not referenced by any production traffic until Step 3 |
| 3 | Frontend revert to call legacy `/auth/login` | Minimal — backend still honors legacy until Step 4 |
| 4 | `git revert` the registration removal commit | **Highest risk window.** Investigate root cause before reverting; may need to redo Step 3 monitoring after revert |
| 5 | Per-user — manually unlock via `/auth/lock-policy/unlock` if cutover triggered spurious lockouts | Operational |

The `pending_otps` and `lockout_states` tables are additive; they cause no harm if dropped. `lock_policy` is also droppable but the runtime falls back to `Configuration:LockPolicy:Defaults` if the table is missing — so dropping it during rollback is safe.

## Post-cutover housekeeping

1. Schedule the background sweepers (Polly retry test, OTP expiry sweep, lockout auto-unlock):
   - OTP expiry sweep: every 5 minutes, `DELETE FROM pending_otps WHERE ExpiresAt < UtcNow - 24 hours` (24h grace for forensics).
   - Lockout auto-unlock: every 1 minute, for each `lockout_states` row where `UnlocksAt < UtcNow`, emit `lockout_auto_cleared` audit and DELETE the row.
2. Wire the SMS-vendor health check into ops dashboards once the vendor is selected.
3. Wire the MOIPASS circuit-breaker state into ops dashboards (open / closed / half-open transitions are P2 noise but P1 during ops triage).

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `Invalid object name 'AspNetUsers'` on login | IdentityDbContext missing `SystemUserConfiguration` | Confirm `SystemUserConfiguration.cs` was moved into `Modules/Identity/.../Persistence/Configurations/` and that `IdentityDbContext.OnModelCreating` calls `ApplyConfigurationsFromAssembly`. Repro from spec 005. |
| Both `IUserStore<SystemUser>` registrations active | Legacy `AddIdentity` not removed | Run `RegistrationOverlapTests`; remove the legacy registration in `DependencyInjection.cs`. |
| OTP arrives but verify returns OTP_MISMATCH | Code hashing mismatch (e.g. salt mismatch) | Confirm both `RequestOtpUseCase` and `VerifyOtpUseCase` use the same `IPasswordHasher<PendingOtp>` resolution path. |
| `OFFICER_LOOKUP_UNAVAILABLE` always | MOIPASS sandbox not whitelisted | Switch to `Stub` source for dev; coordinate with MOI identity team for sandbox access. |
| Permission check returns false for super_admin | `permissions` not on JWT/session | Confirm `verify-otp` populates `permissions` from `MOCK.roleDefinitions` / DB roles table. |
