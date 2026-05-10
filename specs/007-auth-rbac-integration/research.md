# Phase 0 Research — Auth + RBAC Integration

Five technical decisions that the plan deferred. One **Decision / Rationale / Alternatives** block per item, written so a reader can see why the simpler alternative was rejected.

---

## R0.1 — OTP store: SQL table on `IdentityDbContext`

**Decision**: `pending_otps` is a SQL Server table owned by `IdentityDbContext`, with a 5-minute background sweep job removing expired rows. No Redis, no in-memory dictionary.

**Rationale**:
- The deployment topology is single-node (`PACademy.Api` is one container; spec 005 explicitly avoids distributed transactions). A SQL table reuses the existing connection pool, the existing migration history mechanism, and the existing audit/transaction story.
- OTP codes hash to ≤ 100 bytes per row; 100 concurrent staff → ≤ 10 KB working set. Throughput is dominated by the SMS gateway, not the storage layer.
- Bringing in Redis would add a new infrastructure dependency, a new failure mode (Redis-down ≠ DB-down), and a new operational concern (TTL sweepers, persistence config). Not worth it for this scale.
- A pure in-memory `ConcurrentDictionary<Guid, PendingOtp>` would tie OTP validity to process lifetime — a single API restart during a demo would invalidate every in-flight OTP. Unacceptable.
- The 5-minute background sweep is scheduled via the existing `BackgroundService` host pattern (already used by `ReportSnapshotsRefresher` from spec 002).

**Alternatives considered**:
- **Redis with `EXPIRE`** — natural fit for transient state. Rejected on operational grounds (new dep, no existing Redis in the stack).
- **In-process dictionary** — fast and free. Rejected on resilience grounds (process restart kills sessions).
- **HTTP-only cookie carrying signed OTP state** — stateless. Rejected because the masked phone tail must be returned to the UI without revealing it on the wire as ciphertext, and because failed-attempt counters need server-side enforcement.

---

## R0.2 — `IOtpTransport` shape; SMS vendor abstracted

**Decision**: A single-method abstraction:

```csharp
public interface IOtpTransport
{
    Task<OtpDispatchResult> SendAsync(string maskedPhoneTail, string fullPhone, string code, CancellationToken ct);
}

public sealed record OtpDispatchResult(bool Delivered, string? VendorMessageId, string? FailureCode);
```

Two implementations ship with this spec:
- `InMemoryOtpTransport` (dev/test default) — logs the code to `ILogger<InMemoryOtpTransport>` at `Debug` level **only** when `ASPNETCORE_ENVIRONMENT == "Development"`; returns `Delivered=true`. Never used outside dev.
- `SmsOtpTransport` (staging/prod) — wraps the eventual SMS vendor SDK. Throws `OtpTransportNotConfiguredException` if vendor settings are missing, so misconfiguration fails loudly at startup rather than silently dropping OTPs.

Selected via `Configuration:Otp:Transport ∈ { "InMemory", "Sms" }`. Default `Sms` in non-Development; default `InMemory` in Development.

**Rationale**:
- The vendor (Vonage / Twilio / Egyptian local provider like Mobinil-Connect or Etisalat-SMS) isn't picked yet (D-003). Abstracting now keeps spec 007 unblocked while ops procurement runs in parallel.
- `OtpDispatchResult` carries both a vendor message id (for diagnostic correlation) and a failure code (for differentiating retry-vs-permanent failures). Matches the shapes most commercial SMS gateways return.
- The `maskedPhoneTail` parameter is passed separately so the transport can log it without ever logging the full phone number.

**Alternatives considered**:
- **Bake in a specific vendor now** — fastest if the vendor is decided. Rejected because the procurement decision is not in this spec's blast radius and a wrong commit would force a refactor.
- **Strategy pattern with vendor-specific subclasses of `SmsOtpTransport`** — overkill given the abstraction already lets us swap entire transports.

---

## R0.3 — MOIPASS resilience: timeout + retry + circuit-breaker via Polly

**Decision**: `MoipassOfficerLookup` uses `Polly` v8 (already a transitive dep via ASP.NET Core's `IHttpClientFactory`) with:
- 2-second per-attempt timeout (matches SC-005 p95 target)
- 2 retries on transient failures (HTTP 5xx + network exceptions), exponential backoff (200 ms, 400 ms)
- Circuit breaker: open after 5 consecutive failures within 30 s; half-open probe every 60 s
- 5-second hard ceiling on the total operation (matches SC-005 p99 target)

When the circuit is open, the endpoint returns `503 Service Unavailable` with error code `OFFICER_LOOKUP_UNAVAILABLE` immediately (no upstream call attempted). The frontend's User Story 3 acceptance scenario 3 ("officer-source service is unreachable") catches exactly this code.

**Rationale**:
- MOIPASS is operated by a separate ministry; we have no control over its uptime. The circuit breaker prevents our auth flow from being held hostage by a stuck MOIPASS instance.
- 2s + 2 retries × backoff = ≤ 2.6 s in the unhappy case, comfortably under the 5 s hard ceiling.
- The 60 s half-open probe is conservative; if MOIPASS recovers, admins see availability return within ~1 minute. Aggressive enough for ops, gentle enough not to hammer a recovering upstream.

**Alternatives considered**:
- **No retries** — simpler. Rejected because transient network blips are common on Egyptian government networks (per ops experience with prior MOI integrations) and a single retry recovers ~80% of those.
- **No circuit breaker** — fewer moving parts. Rejected because a stuck upstream would queue requests and exhaust the thread pool under load.
- **Custom resilience layer** — more control. Rejected because Polly is battle-tested and already on the dependency tree.

---

## R0.4 — Pending-session bearer: opaque `pendingId` (Guid) carried in response body

**Decision**: The `pendingId` returned by `POST /auth/login/request-otp` is an opaque `Guid` (the primary key of the `pending_otps` row). The frontend stores it in the auth Zustand slice for the duration of the OTP entry screen and passes it back in the `POST /auth/login/verify-otp` body. No JWT, no cookie, no signing.

**Rationale**:
- Simplest contract that works. The `pendingId` is unguessable (Guid v4 has 122 bits of entropy) and short-lived (5 min). Server-side validation looks up the row by id and checks expiry + attempt count.
- Cookie-based pending bearer would intermingle with the existing post-auth cookie session and risk being sent on requests that shouldn't carry auth state.
- JWT-based pending bearer requires key management, signing, and verification — overkill when the bearer never leaves a 2-step transaction within seconds.
- Q3=A specifies "short-lived bearer that verify-otp exchanges for the session token" — an opaque id that maps to a server-side row meets the contract verbatim.

**Alternatives considered**:
- **Short-lived JWT** — stateless verification, no DB hit on verify-otp. Rejected because the failed-attempt counter still needs server-side state, defeating the statelessness benefit.
- **Httponly cookie** — cleanest browser-side. Rejected because the OTP screen is on the same origin as the post-auth dashboard and cookie scoping would be fragile.
- **Double-submit (two cookies, one signed)** — security overkill for a 5-minute window inside the same browser session.

---

## R0.5 — Permission evaluator: pure function + ASP.NET authorization handler

**Decision**: Two layers:

1. **`IPermissionEvaluator`** in `Identity.Application` — pure function:

   ```csharp
   public interface IPermissionEvaluator
   {
       bool Has(IReadOnlyList<string> userPermissions, string required);
   }
   ```

   Wildcard rules: `*` matches anything. `resource:*` matches every `resource:<verb>`. Exact matches win first.

2. **`PermissionRequirementHandler`** in `PACademy.Api/Authorization/` — implements ASP.NET Core's `AuthorizationHandler<PermissionRequirement>`. Resolves the user's effective permissions from `ICurrentUser`, calls `IPermissionEvaluator.Has(...)`, succeeds or fails the requirement.

3. **Endpoint declaration**:

   ```csharp
   [Authorize(Policy = "applicants:edit")]
   public async Task<IActionResult> UpdateApplicant(...)
   ```

   `Program.cs` registers a policy convention that maps any policy name containing `:` to a `PermissionRequirement` automatically — no per-policy boilerplate.

**Rationale**:
- The pure function is unit-testable without ASP.NET. It's also reusable from non-HTTP contexts (e.g. inside use cases that need to gate behaviour by permission, like "can this user edit a system role?").
- The ASP.NET handler is the standard idiomatic place for HTTP-level authorization. Custom middleware would bypass the framework's built-in `[Authorize]` ergonomics.
- The convention-based policy registration removes per-policy `AddPolicy(...)` boilerplate. Any new endpoint just declares `[Authorize(Policy = "<resource>:<verb>")]` and it works.

**Alternatives considered**:
- **Custom middleware that reads a `[RequirePermission]` attribute** — works but bypasses ASP.NET's authorization pipeline and conflicts with `[AllowAnonymous]` semantics. Rejected.
- **Hardcoded if-blocks per endpoint** — what the legacy code does today. Rejected because it scatters authorization logic and breaks the audit story (every check needs to emit an audit row on deny — easier from one central handler).
- **Claim-based authorization (translate permissions to ClaimsIdentity claims)** — works in ASP.NET but doesn't compose well with the wildcard semantics (`resource:*` would need a custom ClaimsTransformation). Wildcard logic stays in the pure function regardless.

---

## Resolution status

| ID | Decision | Locked in plan / contracts? |
|---|---|---|
| R0.1 | SQL table on `IdentityDbContext` | data-model.md §3 |
| R0.2 | Two-impl `IOtpTransport` abstraction | plan.md §Project Structure; data-model.md §3 |
| R0.3 | Polly timeout + retry + circuit breaker | quickstart.md verification step 4 |
| R0.4 | Opaque Guid `pendingId` in response body | contracts/auth-api.md |
| R0.5 | Pure `IPermissionEvaluator` + ASP.NET handler | plan.md §Project Structure |

All five resolved. Phase 1 design can proceed.
