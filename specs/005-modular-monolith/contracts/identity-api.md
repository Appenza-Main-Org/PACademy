# Contract: `IIdentityApi`

**Project**: `PACademy.Modules.Identity.Public`
**Source file (target)**: `backend/src/Modules/Identity/PACademy.Modules.Identity.Public/IIdentityApi.cs`
**Consumed by**: `Admissions.Application`, `ReferenceData.Application`, `Workflows.Application`, `Shared.Audit.Application`

```csharp
namespace PACademy.Modules.Identity.Public;

/// <summary>
/// Read-only intra-process surface for Identity. DI-only — never exposed over HTTP (FR-M05).
/// </summary>
public interface IIdentityApi
{
    /// <summary>
    /// Current authenticated user, or null when unauthenticated.
    /// Reads from the request's <c>HttpContext.User</c> claims principal — no DB hit on the hot path.
    /// </summary>
    Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default);

    /// <summary>
    /// Verifies the user exists and is not archived. Returns false for unknown ids OR archived users.
    /// Used by audit-write paths to verify the actor before recording.
    /// Cached for the request lifetime; one DB hit per (request, userId).
    /// </summary>
    Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default);
}

public sealed record CurrentUserDto(
    Guid Id,
    string FullName,
    string Role,
    IReadOnlyList<string> Apps);
```

## Behaviour notes

- `GetCurrentUserAsync` returns `null` for unauthenticated requests. Callers in modules that require authentication MUST check.
- `Apps` reflects the role's app-access list (e.g. `["admin","committee","barcode"]`). Used by other modules' authorization helpers when they need to gate a feature on app membership.
- The `Role` string is the canonical role code (e.g. `super_admin`, `committee_admin`) — never the Arabic label.

## Migration from spec 003

Phase 4 (specs 003 + 004) used `ICurrentUser` (in `PACademy.Application`) to provide the same shape. `IIdentityApi.GetCurrentUserAsync` is the cross-module rename; `ICurrentUser` is moved into `Modules.Identity.Application` as the in-module type, and `IdentityApi` (the impl of `IIdentityApi`) delegates to it.

Use cases in Identity itself continue to inject `ICurrentUser` directly. Use cases in OTHER modules consume `IIdentityApi`.
