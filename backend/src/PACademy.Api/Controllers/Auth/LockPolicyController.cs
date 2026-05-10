using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.Identity.Application;
using PACademy.Modules.Identity.Application.LockPolicies;
using PACademy.Shared.Contracts;

namespace PACademy.Api.Controllers.Auth;

[ApiController]
[Route("auth/lock-policy")]
[Authorize(Policy = "*")]
public sealed class LockPolicyController(
    GetLockPolicyUseCase getLockPolicy,
    UpdateLockPolicyUseCase updateLockPolicy,
    ListLockedUsersUseCase listLockedUsers,
    UnlockUserUseCase unlockUser,
    ICurrentUser currentUser)
    : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await getLockPolicy.ExecuteAsync(ct);
        return Ok(result);
    }

    [HttpPatch]
    public async Task<IActionResult> Patch(
        [FromBody] UpdateLockPolicyRequest request,
        CancellationToken ct)
    {
        var command = new UpdateLockPolicyCommand(request.MaxFailedAttempts, request.LockDurationMinutes);
        var (updated, errors) = await updateLockPolicy.ExecuteAsync(command, currentUser.Id, ct);

        if (errors is { Count: > 0 })
        {
            return BadRequest(new
            {
                code = ErrorCodes.ValidationFailed,
                message = "Invalid lock policy values",
                payload = new { errors = errors.Select(e => new { e.Field, e.Constraint, e.Value }) },
            });
        }

        return Ok(updated);
    }

    [HttpGet("locked-users")]
    public async Task<IActionResult> LockedUsers(CancellationToken ct)
    {
        var (items, total) = await listLockedUsers.ExecuteAsync(ct);
        return Ok(new { items, total });
    }

    [HttpPost("unlock")]
    public async Task<IActionResult> Unlock([FromBody] UnlockRequest request, CancellationToken ct)
    {
        var errorCode = await unlockUser.ExecuteAsync(request.UserId, currentUser.Id, ct);
        if (errorCode is not null)
        {
            return NotFound(new
            {
                code = errorCode,
                message = errorCode == ErrorCodes.NotFound ? "User is not currently locked or does not exist" : errorCode,
            });
        }

        return NoContent();
    }
}

public sealed record UpdateLockPolicyRequest(int? MaxFailedAttempts, int? LockDurationMinutes);
public sealed record UnlockRequest(Guid UserId);
