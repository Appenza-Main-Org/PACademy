namespace PACademy.Modules.IdentityApplicant.Application.Moi;

/// <summary>
/// Thin wrapper over <see cref="IMoiClient"/> so the controller stays
/// dependency-free of the client interface (consistent with the rest of
/// the modules' Application/Infrastructure split).
/// </summary>
public sealed class FetchMoiVerificationUseCase(IMoiClient client)
{
    public Task<MoiApplicantSessionDto?> ExecuteAsync(string nationalId, CancellationToken ct = default)
        => client.VerifyAsync(nationalId, ct);
}
