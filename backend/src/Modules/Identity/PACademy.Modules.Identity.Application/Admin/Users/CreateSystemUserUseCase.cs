using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;
using System.Data;

namespace PACademy.Modules.Identity.Application.Admin.Users;

public sealed class CreateSystemUserUseCase(
    IIdentityProvider identity,
    IAuditApi audit,
    IIdentityDbContext db)
{
    public async Task<SystemUserDetailDto> ExecuteAsync(
        CreateSystemUserRequest request,
        CancellationToken ct = default)
    {
        // Wrap user creation + audit in a single transaction so both succeed or both fail.
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var command = new CreateUserCommand(
            request.NationalId,
            request.OfficerCode,
            request.FullName,
            request.Mobile,
            request.Email,
            request.IssueDate,
            request.CardFactoryNumber,
            request.Role,
            request.Unit,
            request.Password);

        var userId = await identity.CreateUserAsync(command, ct);

        await audit.RecordAsync(
            AuditAction.Create, "user", userId, request.FullName,
            AuditOutcome.Success, null, null, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var user = await identity.GetUserAsync(userId, ct)
            ?? throw new InvalidOperationException("User vanished after creation.");

        return GetSystemUserUseCase.MapToDetailDto(user);
    }
}
